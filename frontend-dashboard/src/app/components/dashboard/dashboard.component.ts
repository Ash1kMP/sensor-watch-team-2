// import { Component, OnInit, OnDestroy } from '@angular/core';
// import { CommonModule } from '@angular/common';
// import { FormsModule } from '@angular/forms';
// import { WsService, Telemetry } from '../../services/ws.service';

// @Component({
//   selector: 'app-dashboard',
//   standalone: true,
//   imports: [CommonModule, FormsModule],
//   template: `
//     <div class="dash-wrap">
//       <!-- Toolbar -->
//       <div class="toolbar card">
//         <div class="title">
//           <div class="kicker">Overview</div>
//           <h1>SensorWatch Dashboard</h1>
//         </div>
//         <div class="controls">
//           <div class="control">
//             <label>Device</label>
//             <select
//               [ngModel]="selectedDevice"
//               (ngModelChange)="setDevice($event)"
//             >
//               <option value="">All devices</option>
//               <option *ngFor="let d of devices" [value]="d">{{ d }}</option>
//             </select>
//           </div>
//           <div class="control">
//             <label>Range</label>
//             <div class="pills">
//               <button
//                 class="pill"
//                 [class.active]="range === 'live'"
//                 (click)="setRange('live')"
//               >
//                 Live
//               </button>
//               <button
//                 class="pill"
//                 [class.active]="range === '1h'"
//                 (click)="setRange('1h')"
//               >
//                 1h
//               </button>
//               <button
//                 class="pill"
//                 [class.active]="range === '24h'"
//                 (click)="setRange('24h')"
//               >
//                 24h
//               </button>
//             </div>
//           </div>
//         </div>
//       </div>

//       <!-- KPI Cards -->
//       <div class="card-grid">
//         <div class="card kpi">
//           <div class="kpi-head">
//             <span class="icon">📟</span>
//             <span class="label">Device</span>
//           </div>
//           <div class="value">{{ deviceIdText }}</div>
//         </div>

//         <div class="card kpi">
//           <div class="kpi-head">
//             <span class="icon">🌡️</span>
//             <span class="label">Temperature</span>
//           </div>
//           <div class="value">
//             {{ temperatureText }}<span class="unit">°</span>
//           </div>
//           <div
//             class="trend"
//             [class.up]="tempDelta > 0"
//             [class.down]="tempDelta < 0"
//           >
//             <span class="arrow">{{
//               tempDelta > 0 ? '▲' : tempDelta < 0 ? '▼' : '–'
//             }}</span>
//             <span class="delta">{{ deltaText(tempDelta) }}</span>
//             <span class="muted">vs last</span>
//           </div>
//         </div>

//         <div class="card kpi">
//           <div class="kpi-head">
//             <span class="icon">💧</span>
//             <span class="label">Humidity</span>
//           </div>
//           <div class="value">{{ humidityText }}<span class="unit">%</span></div>
//           <div
//             class="trend"
//             [class.up]="humDelta > 0"
//             [class.down]="humDelta < 0"
//           >
//             <span class="arrow">{{
//               humDelta > 0 ? '▲' : humDelta < 0 ? '▼' : '–'
//             }}</span>
//             <span class="delta">{{ deltaText(humDelta) }}</span>
//             <span class="muted">vs last</span>
//           </div>
//         </div>

//         <div class="card kpi">
//           <div class="kpi-head">
//             <span class="icon">⏱️</span>
//             <span class="label">Last update</span>
//           </div>
//           <div class="value small">
//             <ng-container *ngIf="latestForFilter?.timestamp as ts; else noTs">{{
//               ts | date : 'medium'
//             }}</ng-container>
//             <ng-template #noTs>—</ng-template>
//           </div>
//         </div>
//       </div>

//       <!-- Chart -->
//       <div class="card chart-card">
//         <div class="chart-header">
//           <div>
//             <div class="label">Environment</div>
//             <div class="subtitle">Live temperature & humidity</div>
//           </div>
//           <div class="legend">
//             <span class="dot temp"></span> Temp
//             <span class="dot hum"></span> Humidity
//           </div>
//         </div>
//         <div class="chart-body"><canvas id="envChart"></canvas></div>
//       </div>

//       <!-- Table -->
//       <div class="card table-card">
//         <div class="table-head">
//           <div class="label">Recent Telemetry</div>
//         </div>
//         <table class="table">
//           <thead>
//             <tr>
//               <th>Time</th>
//               <th>Device</th>
//               <th>Temp</th>
//               <th>Humidity</th>
//             </tr>
//           </thead>
//           <tbody>
//             <tr
//               *ngFor="let r of filteredHistory; let i = index"
//               [attr.data-i]="i"
//             >
//               <td>{{ r.timestamp | date : 'mediumTime' }}</td>
//               <td>{{ r.deviceId || '—' }}</td>
//               <td>{{ r.temperature ?? '—' }}</td>
//               <td>{{ r.humidity ?? '—' }}</td>
//             </tr>
//           </tbody>
//         </table>
//       </div>
//     </div>
//   `,
//   styleUrls: ['./dashboard.component.css'],
// })
// export class DashboardComponent implements OnInit, OnDestroy {
//   latest: Telemetry | null = null;
//   history: Telemetry[] = [];
//   maxHistory = 180; // adjusted by range
//   range: 'live' | '1h' | '24h' = 'live';
//   selectedDevice = '';

//   private chart?: any; // Chart.js instance

//   constructor(private ws: WsService) {}

//   // ——— Derived data for template (strict-safe) ———
//   get devices(): string[] {
//     const set = new Set<string>();
//     for (const r of this.history) if (r.deviceId) set.add(r.deviceId);
//     return Array.from(set).sort();
//   }
//   get filteredHistory(): Telemetry[] {
//     return this.selectedDevice
//       ? this.history.filter((h) => h.deviceId === this.selectedDevice)
//       : this.history;
//   }
//   get latestForFilter(): Telemetry | null {
//     return this.filteredHistory[0] || null;
//   }

//   get deviceIdText(): string {
//     return this.latestForFilter?.deviceId ?? '—';
//   }
//   get temperatureText(): number | string {
//     const t = this.latestForFilter?.temperature;
//     return t === null || t === undefined ? '—' : t;
//   }
//   get humidityText(): number | string {
//     const h = this.latestForFilter?.humidity;
//     return h === null || h === undefined ? '—' : h;
//   }

//   get tempDelta(): number {
//     return this.deltaOf('temperature');
//   }
//   get humDelta(): number {
//     return this.deltaOf('humidity');
//   }
//   deltaText(v: number): string {
//     return v === 0 ? '—' : Math.abs(Number(v.toFixed(2))).toString();
//   }
//   private deltaOf<K extends 'temperature' | 'humidity'>(k: K): number {
//     const arr = this.filteredHistory.filter(
//       (x) => (x as any)[k] !== null && (x as any)[k] !== undefined
//     );
//     if (arr.length < 2) return 0;
//     const cur = (arr[0] as any)[k] as number;
//     const prev = (arr[1] as any)[k] as number;
//     return Number((cur - prev).toFixed(3));
//   }
//   // ————————————————————————————————————————————————

//   ngOnInit() {
//     this.ws.stream$.subscribe((msg) => {
//       if (!msg) return;
//       this.latest = msg;
//       this.history.unshift(msg);
//       if (this.history.length > this.maxHistory) this.history.pop();
//       this.pushToChart(msg);
//     });
//     queueMicrotask(() => this.initChart()); // ensure canvas exists
//   }

//   ngOnDestroy() {
//     try {
//       this.chart?.destroy();
//     } catch {}
//   }

//   setDevice(v: string) {
//     this.selectedDevice = v;
//     this.rebuildChartFromHistory();
//   }

//   setRange(r: 'live' | '1h' | '24h') {
//     this.range = r;
//     this.maxHistory = r === 'live' ? 180 : r === '1h' ? 360 : 720;
//     this.rebuildChartFromHistory();
//   }

//   private async initChart() {
//     const el = document.getElementById('envChart') as HTMLCanvasElement | null;
//     if (!el) return;
//     const { default: Chart } = await import('chart.js/auto');
//     const ctx = el.getContext('2d');

//     let tempGradient: CanvasGradient | undefined;
//     if (ctx) {
//       tempGradient = ctx.createLinearGradient(0, 0, 0, el.height);
//       tempGradient.addColorStop(0, 'rgba(100,181,246,0.35)');
//       tempGradient.addColorStop(1, 'rgba(100,181,246,0.02)');
//     }

//     this.chart = new Chart(el, {
//       type: 'line',
//       data: {
//         labels: [],
//         datasets: [
//           {
//             label: 'Temperature',
//             data: [],
//             tension: 0.25,
//             pointRadius: 0,
//             fill: true,
//             backgroundColor: tempGradient,
//             borderColor: 'rgba(100,181,246,0.9)',
//             yAxisID: 'y',
//           },
//           {
//             label: 'Humidity',
//             data: [],
//             tension: 0.25,
//             pointRadius: 0,
//             fill: false,
//             borderDash: [4, 4],
//             borderColor: 'rgba(129,199,132,0.9)',
//             yAxisID: 'y1',
//           },
//         ],
//       },
//       options: {
//         responsive: true,
//         maintainAspectRatio: false,
//         interaction: { mode: 'index', intersect: false },
//         scales: {
//           x: { display: false },
//           y: {
//             ticks: { color: '#e8eef5' },
//             grid: { color: 'rgba(255,255,255,.06)' },
//           },
//           y1: {
//             position: 'right',
//             ticks: { color: '#9fd3a1' },
//             grid: { display: false },
//           },
//         },
//         plugins: { legend: { labels: { color: '#e8eef5' } } },
//       },
//     });

//     this.rebuildChartFromHistory();
//   }

//   private rebuildChartFromHistory() {
//     if (!this.chart) return;
//     const labels: string[] = [];
//     const temps: (number | null)[] = [];
//     const hums: (number | null)[] = [];
//     const source = this.filteredHistory.slice().reverse(); // oldest→newest for labels
//     for (const r of source) {
//       labels.push(new Date(r.timestamp).toLocaleTimeString());
//       temps.push(r.temperature ?? null);
//       hums.push(r.humidity ?? null);
//     }
//     this.chart.data.labels = labels; // apply bulk
//     this.chart.data.datasets[0].data = temps;
//     this.chart.data.datasets[1].data = hums;
//     this.chart.update();
//   }

//   private pushToChart(msg: Telemetry) {
//     if (!this.chart) return;
//     if (this.selectedDevice && msg.deviceId !== this.selectedDevice) return; // filter live stream
//     const ts = new Date(msg.timestamp).toLocaleTimeString();
//     const labels = this.chart.data.labels as string[];
//     const tds = this.chart.data.datasets[0].data as (number | null)[];
//     const hds = this.chart.data.datasets[1].data as (number | null)[];
//     labels.push(ts);
//     tds.push(msg.temperature ?? null);
//     hds.push(msg.humidity ?? null);
//     const limit = Math.min(this.maxHistory, 300);
//     while (labels.length > limit) {
//       labels.shift();
//       tds.shift();
//       hds.shift();
//     }
//     this.chart.update('quiet');
//   }
// }

import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WsService } from '../../services/ws.service';

type MaybeDate = string | number | Date | undefined;

export interface Telemetry {
  deviceId?: string;
  temperature?: number;   // Fahrenheit
  humidity?: number;      // %
  timestamp?: MaybeDate;  // ISO or epoch
  raw?: any;
}

interface Threshold { low: number; high: number; }
type Status = 'Alert' | 'Within Limit';

const STORAGE_KEY = 'sensorwatch.logs.v1';   // localStorage key
const MAX_PERSISTED = 2000;                  // hard cap to avoid unbounded growth

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
  private _history: Telemetry[] = [];       // raw (unsorted)
  get history(): Telemetry[] { return this._history; }

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
  filterDevice = '';          // empty = all
  filterFrom?: string;        // ISO date (yyyy-mm-dd)
  filterTo?: string;

  // Sorting
  sortBy: 'date' | 'temperature' | 'humidity' | 'status' = 'date';
  sortDir: 'asc' | 'desc' = 'desc';

  // Pagination
  page = 1;
  pageSize = 10;

  // Derived cache
  devices: string[] = [];

  constructor(private ws: WsService) {}

  // ---------------- Lifecycle ----------------
  ngOnInit() {
    // load persisted logs first
    this.loadPersisted();

    // socket status
    (this.ws as any).connected$?.subscribe((ok: boolean) => (this.isConnected = ok));

    // live telemetry
    this.ws.stream$.subscribe((msg) => {
      if (!msg) return;
      const ts =
        msg.timestamp ? new Date(msg.timestamp as any).toISOString() : new Date().toISOString();

      const rec: Telemetry = {
        deviceId: msg.deviceId ?? msg.raw?.deviceId ?? this.deviceName,
        temperature: msg.temperature ?? msg.raw?.temp_f ?? undefined,
        humidity: msg.humidity ?? msg.raw?.humidity_pct ?? undefined,
        timestamp: ts,
        raw: msg.raw ?? msg,
      };

      this.latest = rec;
      this._history.unshift(rec);
      if (this._history.length > MAX_PERSISTED) this._history.pop();
      this.persist();

      // maintain device list
      if (rec.deviceId && !this.devices.includes(rec.deviceId)) {
        this.devices = [...new Set([rec.deviceId, ...this.devices])].sort();
      }

      // charts
      this.pushToCharts(rec);
    });

    queueMicrotask(() => this.initCharts());
  }

  ngOnDestroy() {
    try { this.tempChart?.destroy(); this.humChart?.destroy(); } catch {}
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
        .filter(x => x && x.timestamp)
        .sort((a, b) => +new Date(b.timestamp!) - +new Date(a.timestamp!));
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
    return d.toLocaleString(undefined, { month: '2-digit', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace(',', '');
  }

  statusOf(r: Telemetry): Status {
    const t = r.temperature;
    const h = r.humidity;
    if (t != null && (t < this.tempF.low || t > this.tempF.high)) return 'Alert';
    if (h != null && (h < this.humidityPct.low || h > this.humidityPct.high)) return 'Alert';
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
      case 'temperature': return numCmp(a.temperature, b.temperature);
      case 'humidity':    return numCmp(a.humidity, b.humidity);
      case 'status':      return strCmp(this.statusOf(a), this.statusOf(b));
      default:            return numCmp(+new Date(a.timestamp || 0), +new Date(b.timestamp || 0));
    }
    function numCmp(x?: number, y?: number) {
      if (x == null && y == null) return 0;
      if (x == null) return -1;
      if (y == null) return  1;
      return x - y;
    }
    function strCmp(x: string, y: string) { return x.localeCompare(y); }
  }

  get filteredSorted(): Telemetry[] {
    const base = this._history.filter(r => this.passesFilters(r));
    base.sort((a, b) => this.cmp(a, b));
    if (this.sortDir === 'desc') base.reverse();
    return base;
  }

  // --------------- Pagination ----------------
  get totalPages(): number {
    const n = Math.max(1, Math.ceil(this.filteredSorted.length / this.pageSize));
    return n;
  }
  get pageRows(): Telemetry[] {
    const list = this.filteredSorted;
    const start = (this.page - 1) * this.pageSize;
    return list.slice(start, start + this.pageSize);
  }
  goto(p: number) {
    this.page = Math.min(Math.max(1, p), this.totalPages);
  }
  setSort(col: 'date'|'temperature'|'humidity'|'status') {
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
    const head = ['Date','Time','Device','Temperature (°F)','Humidity (%)','Status'];
    const lines = [head.join(',')];
    for (const r of rows) {
      const d = new Date(r.timestamp || Date.now());
      const date = d.toLocaleDateString();
      const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }).toLowerCase();
      const dev  = safe(r.deviceId);
      const t    = r.temperature != null ? r.temperature.toString() : '';
      const h    = r.humidity != null ? r.humidity.toFixed(1) : '';
      const s    = this.statusOf(r);
      lines.push([date, time, dev, t, h, s].map(csv).join(','));
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `telemetry_${new Date().toISOString().replace(/[:.]/g,'-')}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    function csv(v: string) { return /[",\n]/.test(v) ? `"${v.replace(/"/g,'""')}"` : v; }
    function safe(v?: string) { return v ?? ''; }
  }

  // ---------------- Charts -------------------
  private async initCharts() {
    const tEl = document.getElementById('tempChart') as HTMLCanvasElement | null;
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
      data: { labels: [], datasets: [{ data: [], borderColor: '#4e73df', fill: true, backgroundColor: 'rgba(78,115,223,.08)', tension: 0.25, pointRadius: 0 }] },
      options: baseOpts as any,
    });

    this.humChart = new Chart(hEl, {
      type: 'line',
      data: { labels: [], datasets: [{ data: [], borderColor: '#2ecc71', fill: true, backgroundColor: 'rgba(46,204,113,.10)', tension: 0.25, pointRadius: 0 }] },
      options: baseOpts as any,
    });

    // seed from persisted history
    const seed = this._history.slice().reverse().slice(-50);
    for (const r of seed) this.pushToCharts(r, true);
    this.tempChart?.update(); this.humChart?.update();
  }

  private pushToCharts(r: Telemetry, seeding = false) {
    if (!this.tempChart || !this.humChart) return;
    const label = new Date(r.timestamp || Date.now()).toLocaleTimeString();

    const tLab = this.tempChart.data.labels as string[];
    const hLab = this.humChart.data.labels as string[];
    const tData = this.tempChart.data.datasets[0].data as (number|null)[];
    const hData = this.humChart.data.datasets[0].data as (number|null)[];

    tLab.push(label); hLab.push(label);
    tData.push(r.temperature ?? null);
    hData.push(r.humidity ?? null);

    const limit = 50;
    while (tLab.length > limit) { tLab.shift(); tData.shift(); }
    while (hLab.length > limit) { hLab.shift(); hData.shift(); }

    if (!seeding) { this.tempChart.update('quiet'); this.humChart.update('quiet'); }
  }

  // -------------- Template utils -------------
  F(v?: number) { return v == null ? '—' : `${v}°F`; }
  P(v?: number) { return v == null ? '—' : `${v.toFixed(1)}%`; }
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
    return dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }).toLowerCase();
  }
}