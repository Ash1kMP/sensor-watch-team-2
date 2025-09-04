import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WsService } from '../../services/ws.service';

type MaybeDate = string | number | Date | undefined;

export interface Telemetry {
  deviceId?: string;
  temperature?: number; // Fahrenheit
  humidity?: number; // %
  timestamp?: MaybeDate; // ISO or epoch
  raw?: any;
}

interface Threshold {
  low: number;
  high: number;
}
type Status = 'Alert' | 'Within Limit';

const STORAGE_KEY = 'sensorwatch.logs.v1'; // localStorage key
const MAX_TABS = 5; // number of pager tabs to keep (FIFO)
// hard cap to avoid unbounded growth

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css'],
})
export class DashboardComponent implements OnInit, OnDestroy {
  // Header
  deviceName = 'Device 0';
  locationName = 'Location 0';

  // Live data
  latest: Telemetry | null = null;
  private _history: Telemetry[] = []; // raw (unsorted)
  get history(): Telemetry[] {
    return this._history;
  }
  private round1(x: number | undefined) {
    return typeof x === 'number' && !isNaN(x) ? Math.round(x * 10) / 10 : x;
  }
  // Thresholds
  tempF: Threshold = { low: 20, high: 80 };
  humidityPct: Threshold = { low: 20, high: 100 };

  // Connection
  isConnected = false;

  // Charts
  private tempChart?: any;
  private humChart?: any;

  // ----- Filtering / Sorting / Pagination -----
  showFilters = false;

  // Filters
  filterStatus: 'all' | Status = 'all';
  filterDevice = ''; // empty = all
  filterFrom?: string; // ISO date (yyyy-mm-dd)
  filterTo?: string;

  // Sorting
  sortBy: 'date' | 'temperature' | 'humidity' | 'status' = 'date';
  sortDir: 'asc' | 'desc' = 'desc';

  // Pagination
  page = 1;
  pageSize = 10;
  // FIFO capacity: keep only enough rows for MAX_TABS pages
  private get capacity(): number {
    return this.pageSize * MAX_TABS;
  }
  // Cache last values to avoid redundant updates
  private lastTempF?: number;
  private lastHumidity?: number;

  // Derived cache
  devices: string[] = [];

  constructor(private ws: WsService) {}

  // ---------------- Lifecycle ----------------
  ngOnInit() {
    // load persisted logs first
    this.loadPersisted();

    //
    if (this._history.length) {
      const first = this._history[0] as any;
      if (typeof first?.temperature === 'number') this.lastTempF = first.temperature;
      if (typeof first?.humidity === 'number')    this.lastHumidity = first.humidity;
      this.latest = {
        ...(first || {}),
        temperature: this.round1(this.lastTempF),
        humidity:    this.round1(this.lastHumidity),
      };
    }


    // socket status
    (this.ws as any).connected$?.subscribe(
      (ok: boolean) => (this.isConnected = ok)
    );

    // live telemetry (accumulate temp + humidity, then combine)
    this.ws.stream$.subscribe((msg: any) => {
      if (!msg) return;

      const ts = msg.timestamp
        ? new Date(msg.timestamp as any).toISOString()
        : new Date().toISOString();

      // What this message actually contains
      const mTemp = msg.temperature ?? msg.raw?.temp_f;
      const mHum  = msg.humidity    ?? msg.raw?.humidity_pct;

      if (typeof mTemp === 'number') this.lastTempF = mTemp;
      if (typeof mHum  === 'number') this.lastHumidity = mHum;

      // Build the combined record the UI expects
      const combined: Telemetry = {
        deviceId: msg.deviceId ?? msg.raw?.deviceId ?? this.deviceName,
        temperature: this.round1(this.lastTempF),
        humidity:    this.round1(this.lastHumidity),
        timestamp: ts,
        raw: msg.raw ?? msg,
      };

      // Update tiles
      this.latest = combined;

      // Only add a row once we've seen BOTH values at least once
      if (this.lastTempF != null && this.lastHumidity != null) {
        this._history.unshift(combined);
        while (this._history.length > this.capacity) this._history.pop();
        this.persist();
      }

      // Maintain device list
      if (combined.deviceId && !this.devices.includes(combined.deviceId)) {
        this.devices = [...new Set([combined.deviceId, ...this.devices])].sort();
      }

      // Charts use the combined record
      this.pushToCharts(combined);
    });


    queueMicrotask(() => this.initCharts());
  }

  ngOnDestroy() {
    try {
      this.tempChart?.destroy();
      this.humChart?.destroy();
    } catch {}
  }

  // -------------- Persistence ----------------
  private persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this._history));
    } catch {}
  }
  private loadPersisted() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const arr: Telemetry[] = JSON.parse(raw);
      // sanitize + newest-first
      this._history = (Array.isArray(arr) ? arr : [])
        .filter((x) => x && x.timestamp)
        .sort((a, b) => +new Date(b.timestamp!) - +new Date(a.timestamp!));
      // Trim to current capacity (5 tabs worth)
      this._history = this._history.slice(0, this.capacity);

      // seed device list
      const set = new Set<string>();
      for (const r of this._history) if (r.deviceId) set.add(r.deviceId);
      this.devices = Array.from(set).sort();

      // hydrate charts with existing data
      queueMicrotask(() => {
        const seed = this._history.slice().reverse();
        for (const r of seed) this.pushToCharts(r, true);
        this.tempChart?.update();
        this.humChart?.update();
      });
    } catch {}
  }

  // ---------------- Derived ------------------
  get lastUpdated(): string {
    if (!this.latest?.timestamp) return '—';
    const d = new Date(this.latest.timestamp);
    return d
      .toLocaleString(undefined, {
        month: '2-digit',
        day: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
      .replace(',', '');
  }

  statusOf(r: Telemetry): Status {
    const t = r.temperature;
    const h = r.humidity;
    if (t != null && (t < this.tempF.low || t > this.tempF.high))
      return 'Alert';
    if (h != null && (h < this.humidityPct.low || h > this.humidityPct.high))
      return 'Alert';
    return 'Within Limit';
  }

  // ------------- Filtering/Sorting -----------
  private passesFilters(r: Telemetry): boolean {
    if (this.filterDevice && r.deviceId !== this.filterDevice) return false;

    if (this.filterStatus !== 'all') {
      if (this.statusOf(r) !== this.filterStatus) return false;
    }

    const dt = r.timestamp ? new Date(r.timestamp) : undefined;
    if (this.filterFrom) {
      const from = new Date(this.filterFrom + 'T00:00:00');
      if (!dt || dt < from) return false;
    }
    if (this.filterTo) {
      const to = new Date(this.filterTo + 'T23:59:59.999');
      if (!dt || dt > to) return false;
    }
    return true;
  }

  private cmp(a: Telemetry, b: Telemetry): number {
    switch (this.sortBy) {
      case 'temperature':
        return numCmp(a.temperature, b.temperature);
      case 'humidity':
        return numCmp(a.humidity, b.humidity);
      case 'status':
        return strCmp(this.statusOf(a), this.statusOf(b));
      default:
        return numCmp(+new Date(a.timestamp || 0), +new Date(b.timestamp || 0));
    }
    function numCmp(x?: number, y?: number) {
      if (x == null && y == null) return 0;
      if (x == null) return -1;
      if (y == null) return 1;
      return x - y;
    }
    function strCmp(x: string, y: string) {
      return x.localeCompare(y);
    }
  }

  get filteredSorted(): Telemetry[] {
    const base = this._history.filter((r) => this.passesFilters(r));
    base.sort((a, b) => this.cmp(a, b));
    if (this.sortDir === 'desc') base.reverse();
    return base;
  }

  // --------------- Pagination ----------------
  get totalPages(): number {
    const n = Math.max(
      1,
      Math.ceil(this.filteredSorted.length / this.pageSize)
    );
    return Math.min(n, MAX_TABS);
  }

  get pageRows(): Telemetry[] {
    const list = this.filteredSorted;
    const start = (this.page - 1) * this.pageSize;
    return list.slice(start, start + this.pageSize);
  }
  goto(p: number) {
    this.page = Math.min(Math.max(1, p), this.totalPages);
  }
  setSort(col: 'date' | 'temperature' | 'humidity' | 'status') {
    if (this.sortBy === col) {
      this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortBy = col;
      this.sortDir = col === 'date' ? 'desc' : 'asc';
    }
    this.goto(1);
  }

  // ---------------- Export CSV ---------------
  exportCSV() {
    const rows = this.filteredSorted;
    const head = [
      'Date',
      'Time',
      'Device',
      'Temperature (°F)',
      'Humidity (%)',
      'Status',
    ];
    const lines = [head.join(',')];
    for (const r of rows) {
      const d = new Date(r.timestamp || Date.now());
      const date = d.toLocaleDateString();
      const time = d
        .toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        .toLowerCase();
      const dev = safe(r.deviceId);
      const t = r.temperature != null ? r.temperature.toFixed(1) : '';
      const h = r.humidity != null ? r.humidity.toFixed(1) : '';

      const s = this.statusOf(r);
      lines.push([date, time, dev, t, h, s].map(csv).join(','));
    }
    const blob = new Blob([lines.join('\n')], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `telemetry_${new Date()
      .toISOString()
      .replace(/[:.]/g, '-')}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    function csv(v: string) {
      return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
    }
    function safe(v?: string) {
      return v ?? '';
    }
  }

  // ---------------- Charts -------------------
  private async initCharts() {
    const tEl = document.getElementById(
      'tempChart'
    ) as HTMLCanvasElement | null;
    const hEl = document.getElementById('humChart') as HTMLCanvasElement | null;
    if (!tEl || !hEl) return;
    const { default: Chart } = await import('chart.js/auto');

    const baseOpts = {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { display: false }, tooltip: { enabled: true } },
      scales: { x: { display: false }, y: { display: false } },
    };

    this.tempChart = new Chart(tEl, {
      type: 'line',
      data: {
        labels: [],
        datasets: [
          {
            data: [],
            borderColor: '#4e73df',
            fill: true,
            backgroundColor: 'rgba(78,115,223,.08)',
            tension: 0.25,
            pointRadius: 0,
          },
        ],
      },
      options: baseOpts as any,
    });

    this.humChart = new Chart(hEl, {
      type: 'line',
      data: {
        labels: [],
        datasets: [
          {
            data: [],
            borderColor: '#2ecc71',
            fill: true,
            backgroundColor: 'rgba(46,204,113,.10)',
            tension: 0.25,
            pointRadius: 0,
          },
        ],
      },
      options: baseOpts as any,
    });

    // seed from persisted history
    const seed = this._history.slice().reverse().slice(-50);
    for (const r of seed) this.pushToCharts(r, true);
    this.tempChart?.update();
    this.humChart?.update();
  }

  private pushToCharts(r: Telemetry, seeding = false) {
    if (!this.tempChart || !this.humChart) return;
    const label = new Date(r.timestamp || Date.now()).toLocaleTimeString();

    const tLab = this.tempChart.data.labels as string[];
    const hLab = this.humChart.data.labels as string[];
    const tData = this.tempChart.data.datasets[0].data as (number | null)[];
    const hData = this.humChart.data.datasets[0].data as (number | null)[];

    tLab.push(label);
    hLab.push(label);
    tData.push(r.temperature ?? null);
    hData.push(r.humidity ?? null);

    const limit = 50;
    while (tLab.length > limit) {
      tLab.shift();
      tData.shift();
    }
    while (hLab.length > limit) {
      hLab.shift();
      hData.shift();
    }

    if (!seeding) {
      this.tempChart.update('quiet');
      this.humChart.update('quiet');
    }
  }

  // -------------- Template utils -------------
  F(v?: number) {
    return v == null ? '—' : `${(Math.round(v * 10) / 10).toFixed(1)}°F`;
  }

  P(v?: number) {
    return v == null ? '—' : `${v.toFixed(1)}%`;
  }
  fmtDate(d?: MaybeDate): string {
    if (!d) return '—';
    const dt = new Date(d);
    const now = new Date();
    const same = dt.toDateString() === now.toDateString();
    return same ? 'Today' : dt.toLocaleDateString();
  }
  fmtTime(d?: MaybeDate): string {
    if (!d) return '—';
    const dt = new Date(d);
    return dt
      .toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      .toLowerCase();
  }
}
