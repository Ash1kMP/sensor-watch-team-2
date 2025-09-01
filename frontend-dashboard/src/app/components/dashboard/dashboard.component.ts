// import { Component, OnInit, OnDestroy, NgZone } from '@angular/core';
// import { CommonModule } from '@angular/common';

// interface SensorData {
//   temperature: number;
//   humidity: number;
//   timestamp: string; // epoch ms or ISO string
// }

// @Component({
//   selector: 'app-dashboard',
//   standalone: true,
//   imports: [CommonModule],
//   templateUrl: './dashboard.component.html',
//   styleUrls: ['./dashboard.component.css']
// })
// export class DashboardComponent implements OnInit, OnDestroy {
//   // displayed values
//   data = {} as SensorData;

//   // config
//   private wsUrl = 'ws://localhost:3000';
//   private ws?: WebSocket;

//   ngOnInit(): void {
//     this.connect();
//   }

//   ngOnDestroy(): void {
//     this.disconnect();
//   }

//   private connect() {
//     this.ws = new WebSocket(this.wsUrl);

//     this.ws.onmessage = (ev: MessageEvent) => {
//       let data = JSON.parse(ev.data) as SensorData;

//       console.log('Received data:', data);

//       this.data.temperature = data.temperature;
//       this.data.humidity = data.humidity;
//       this.data.timestamp = data.timestamp;
//     };

//     this.ws.onclose = () => {
//       // optionally set UI state or attempt reconnect
//     };
//     this.ws.onerror = (err) => {
//       // optionally log error
//       console.warn('WebSocket error', err);
//     };
//   }

//   private disconnect() {
//     if (this.ws) {
//       try { this.ws.close(); } catch {}
//       this.ws = undefined;
//     }
//   }
// }

// import { Component, OnInit, OnDestroy, NgZone } from '@angular/core';
// import { CommonModule } from '@angular/common';

// interface SensorData {
//   temperature: number | null;
//   humidity: number | null;
//   timestamp: string;
// }

// @Component({
//   selector: 'app-dashboard',
//   standalone: true,
//   imports: [CommonModule],
//   templateUrl: './dashboard.component.html',
//   styleUrls: ['./dashboard.component.css']
// })
// export class DashboardComponent implements OnInit, OnDestroy {
//   data: SensorData = { temperature: null, humidity: null, timestamp: '' };
//   private ws?: WebSocket;

//   constructor(private zone: NgZone) {}

//   ngOnInit(): void {
//     // If served by NGINX, this hits /ws proxy. If running locally with port mapping, change to ws://localhost:3000
//     const base = (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host;
//     const url = `${base}/ws`;
//     this.connect(url);
//   }

//   ngOnDestroy(): void {
//     this.disconnect();
//   }

//   private connect(url: string) {
//     this.ws = new WebSocket(url);

//     this.ws.onmessage = (ev) => {
//       try {
//         const payload = JSON.parse(ev.data);
//         // Expect { temperature, humidity, timestamp }
//         this.zone.run(() => {
//           this.data = {
//             temperature: typeof payload.temperature === 'number' ? payload.temperature : null,
//             humidity: typeof payload.humidity === 'number' ? payload.humidity : null,
//             timestamp: typeof payload.timestamp === 'string' ? payload.timestamp : ''
//           };
//         });
//       } catch (e) {
//         console.warn('WS parse error', e);
//       }
//     };

//     this.ws.onclose = () => {
//       // basic retry after 2s
//       setTimeout(() => this.connect(url), 2000);
//     };

//     this.ws.onerror = (err) => {
//       console.warn('WebSocket error', err);
//     };
//   }

//   private disconnect() {
//     try { this.ws?.close(); } catch {}
//     this.ws = undefined;
//   }
// }


// import { Component, OnInit, OnDestroy, NgZone } from '@angular/core';
// import { CommonModule } from '@angular/common';

// interface SensorData {
//   deviceId?: string;
//   temperature: number | null;
//   humidity: number | null;
//   timestamp: string; // ISO string preferred
//   raw?: unknown;
// }

// @Component({
//   selector: 'app-dashboard',
//   standalone: true,
//   imports: [CommonModule],
//   templateUrl: './dashboard.component.html',
//   styleUrls: ['./dashboard.component.css']
// })
// export class DashboardComponent implements OnInit, OnDestroy {
//   data: SensorData = { temperature: null, humidity: null, timestamp: '' };
//   private ws?: WebSocket;
//   private reconnectDelay = 2000;
//   private reconnectTimer?: any;

//   constructor(private zone: NgZone) {}

//   ngOnInit(): void {
//     this.connect();
//   }

//   ngOnDestroy(): void {
//     this.disconnect();
//   }

//   private buildWsUrl(): string {
//     // 1) If you later proxy via nginx to /ws, set USE_PATH=true below
//     const USE_PATH = false; // set to true if nginx routes /ws -> consumer-service-fe:3000

//     // 2) Prefer runtime-config via a global, if present (edit index.html to set window.__WS_URL__)
//     const anyWin = window as any;
//     if (anyWin.__WS_URL__) return anyWin.__WS_URL__ as string;

//     // 3) Default to same host, port 3000 (consumer-service-fe)
//     const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
//     const host = location.hostname;

//     if (USE_PATH) {
//       // same-origin path (nginx must proxy /ws to consumer-service-fe:3000)
//       return `${proto}//${host}/ws`;
//     } else {
//       const port = 3000;
//       return `${proto}//${host}:${port}`;
//     }
//   }

//   private connect(): void {
//     const url = this.buildWsUrl();
//     try {
//       this.ws = new WebSocket(url);
//       this.ws.onopen = () => {
//         console.log('WS connected:', url);
//         // reset backoff
//         this.reconnectDelay = 2000;
//       };

//       this.ws.onmessage = (ev: MessageEvent) => {
//         this.zone.run(() => {
//           try {
//             const msg = JSON.parse(ev.data) as Partial<SensorData>;
//             // update bound data defensively
//             this.data.temperature = (msg.temperature as number) ?? this.data.temperature;
//             this.data.humidity = (msg.humidity as number) ?? this.data.humidity;
//             this.data.timestamp = (msg.timestamp as string) ?? this.data.timestamp;
//           } catch {
//             // non-JSON payload; ignore or show somewhere if needed
//             console.warn('WS non-JSON message', ev.data);
//           }
//         });
//       };

//       this.ws.onclose = () => {
//         console.warn('WS closed, will reconnect…');
//         this.scheduleReconnect();
//       };

//       this.ws.onerror = (err) => {
//         console.warn('WS error', err);
//         try { this.ws?.close(); } catch {}
//       };
//     } catch (e) {
//       console.error('WS connect failed:', e);
//       this.scheduleReconnect();
//     }
//   }

//   private scheduleReconnect(): void {
//     if (this.reconnectTimer) return;
//     this.reconnectTimer = setTimeout(() => {
//       this.reconnectTimer = undefined;
//       // simple backoff
//       this.reconnectDelay = Math.min(this.reconnectDelay * 1.5, 15000);
//       this.connect();
//     }, this.reconnectDelay);
//   }

//   private disconnect(): void {
//     if (this.reconnectTimer) {
//       clearTimeout(this.reconnectTimer);
//       this.reconnectTimer = undefined;
//     }
//     if (this.ws) {
//       try { this.ws.close(); } catch {}
//       this.ws = undefined;
//     }
//   }
// }

import { Component, OnInit, OnDestroy, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';

interface SensorData {
  deviceId?: string;
  temperature: number | null;
  humidity: number | null;
  timestamp: string;  // ISO string from bridge
  raw?: unknown;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit, OnDestroy {
  // latest reading shown in the header
  data: SensorData = { temperature: null, humidity: null, timestamp: '' };

  // rolling buffer of recent readings for the table
  history: SensorData[] = [];
  private maxHistory = 100;

  private ws?: WebSocket;
  private reconnectDelay = 2000;
  private reconnectTimer?: any;

  constructor(private zone: NgZone) {}

  ngOnInit(): void {
    this.connect();
  }

  ngOnDestroy(): void {
    this.disconnect();
  }

  private buildWsUrl(): string {
    const anyWin = window as any;
    if (anyWin.__WS_URL__) return anyWin.__WS_URL__ as string;

    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = location.hostname;
    const port = 3000; // consumer-service-fe
    return `${proto}//${host}:${port}`;
  }

  private connect(): void {
    const url = this.buildWsUrl();
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      console.log('WS connected:', url);
      this.reconnectDelay = 2000; // reset backoff
    };

    this.ws.onmessage = (ev: MessageEvent) => {
      // Ensure Angular change detection runs
      this.zone.run(() => {
        try {
          const incoming = JSON.parse(ev.data) as Partial<SensorData>;
          const item: SensorData = {
            deviceId: (incoming.deviceId as string) ?? this.data.deviceId,
            temperature: (incoming.temperature as number) ?? null,
            humidity: (incoming.humidity as number) ?? null,
            timestamp: (incoming.timestamp as string) ?? new Date().toISOString(),
            raw: incoming.raw
          };

          // update latest
          this.data = item;

          // push to rolling history (newest first)
          this.history.unshift(item);
          if (this.history.length > this.maxHistory) this.history.pop();
        } catch {
          // non-JSON payloads are ignored
          console.warn('WS non-JSON message', ev.data);
        }
      });
    };

    this.ws.onclose = () => {
      console.warn('WS closed; reconnecting…');
      this.scheduleReconnect();
    };

    this.ws.onerror = (err) => {
      console.warn('WS error', err);
      try { this.ws?.close(); } catch {}
    };
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;
      this.reconnectDelay = Math.min(this.reconnectDelay * 1.5, 15000);
      this.connect();
    }, this.reconnectDelay);
  }

  private disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
    if (this.ws) {
      try { this.ws.close(); } catch {}
      this.ws = undefined;
    }
  }
}
