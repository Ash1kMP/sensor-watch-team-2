import { Injectable } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';

export interface Telemetry {
  deviceId?: string;
  temperature?: number;   // Fahrenheit
  humidity?: number;      // %
  timestamp?: string | number | Date;
  raw?: any;             
}

@Injectable({ providedIn: 'root' })
export class WsService {
  stream$ = new Subject<Telemetry>();
  connected$ = new BehaviorSubject<boolean>(false);
  public messages$ = this.stream$.asObservable();
  private socket?: WebSocket;
  private reconnectMs = 1500;

  constructor() { this.connect(); }

  private connect() {
    const url = (window.location.port === '4200')
      ? 'ws://localhost:3000'
      : window.location.origin.replace(/^http/, 'ws') + '/ws';

    this.socket = new WebSocket(url);

    this.socket.onopen = () => this.connected$.next(true);
    this.socket.onclose = () => {
      this.connected$.next(false);
      setTimeout(() => this.connect(), this.reconnectMs);
    };
    this.socket.onerror = () => this.socket?.close();

    this.socket.onmessage = (ev) => {
      try {
        const m = JSON.parse(ev.data);

        // Normalize: accept either mapped frames or raw MQTT (temp_f / humidity_pct)
        const norm: Telemetry = {
          deviceId: m.deviceId ?? m.raw?.deviceId ?? m.sensor_id ?? undefined,
          temperature: m.temperature ?? m.temp_f ?? m.raw?.temp_f ?? undefined,
          humidity: m.humidity ?? m.humidity_pct ?? m.raw?.humidity_pct ?? undefined,
          timestamp: m.timestamp ?? m.timestamp_ms ?? Date.now(),
          raw: m
        };

        this.stream$.next(norm);
      } catch {
        // ignore bad frames
      }
    };
  }
}
