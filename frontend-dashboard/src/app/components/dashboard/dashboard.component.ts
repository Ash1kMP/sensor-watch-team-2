import { Component, OnInit, OnDestroy, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';

interface SensorData {
  ts: number | string; // epoch ms or ISO string
  temp: number;
  humidity: number;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit, OnDestroy {
  // displayed values
  temp = 0;
  humidity = 0;
  lastTs = new Date();

  // config
  private wsUrl = 'ws://localhost:3000';
  private ws?: WebSocket;

  constructor(private ngZone: NgZone) {}

  ngOnInit(): void {
    this.connect();
  }

  ngOnDestroy(): void {
    this.disconnect();
  }

  private connect() {
    this.ws = new WebSocket(this.wsUrl);

    this.ws.onmessage = (ev: MessageEvent) => {
      let parsed: Partial<SensorData> | null = null;
      try {
        parsed = JSON.parse(ev.data);
      } catch {
        return;
      }
      if (!parsed) return;

      this.ngZone.run(() => {
        if (typeof parsed.temp === 'number') this.temp = parsed.temp;
        if (typeof parsed.humidity === 'number') this.humidity = parsed.humidity;

        if (parsed.ts !== undefined) {
          const t = typeof parsed.ts === 'number' ? new Date(parsed.ts) : new Date(String(parsed.ts));
          if (!isNaN(t.getTime())) this.lastTs = t;
        } else {
          this.lastTs = new Date();
        }
      });
    };

    this.ws.onclose = () => {
      // optionally set UI state or attempt reconnect
    };
    this.ws.onerror = (err) => {
      // optionally log error
      console.warn('WebSocket error', err);
    };
  }

  private disconnect() {
    if (this.ws) {
      try { this.ws.close(); } catch {}
      this.ws = undefined;
    }
  }
}