import { Component, OnInit, OnDestroy, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';

interface SensorData {
  temperature: number;
  humidity: number;
  timestamp: string; // epoch ms or ISO string
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
  data = {} as SensorData;

  // config
  private wsUrl = 'ws://localhost:3000';
  private ws?: WebSocket;

  ngOnInit(): void {
    this.connect();
  }

  ngOnDestroy(): void {
    this.disconnect();
  }

  private connect() {
    this.ws = new WebSocket(this.wsUrl);

    this.ws.onmessage = (ev: MessageEvent) => {
      let data = JSON.parse(ev.data) as SensorData;

      console.log('Received data:', data);

      this.data.temperature = data.temperature;
      this.data.humidity = data.humidity;
      this.data.timestamp = data.timestamp;
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