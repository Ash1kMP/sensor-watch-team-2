import { Component, OnInit, OnDestroy, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';

interface SensorData {
  deviceId: number;
  locationId: number;
  temperature: number;
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
  sensors: SensorData[] = [];

  private wsUrl = 'ws://localhost:3000';
  private ws?: WebSocket;

  // mock data
  // sensors: SensorData[] = [];
  user = {
    name: 'Jane Doe',
    email: 'jane.doe@email.com',
    avatar: 'https://via.placeholder.com/60'
  };

  ngOnInit(): void {
    // this.connect();

    this.sensors = [
      { deviceId: 0, locationId: 0, temperature: 18, humidity: 57.6 },
      { deviceId: 1, locationId: 0, temperature: 16, humidity: 57.6 },
      { deviceId: 2, locationId: 0, temperature: 18, humidity: 57.6 },
      { deviceId: 3, locationId: 0, temperature: 18, humidity: 57.6 },
      { deviceId: 4, locationId: 0, temperature: 18, humidity: 57.6 },
      { deviceId: 5, locationId: 0, temperature: NaN, humidity: NaN } // simulate inactive
    ];
  }

  ngOnDestroy(): void {
    this.disconnect();
  }

  private connect() {
    this.ws = new WebSocket(this.wsUrl);

    this.ws.onmessage = (ev: MessageEvent) => {
      const data = JSON.parse(ev.data) as SensorData;
      console.log('Received data:', data);

      // Update or add sensor
      const idx = this.sensors.findIndex(s => s.deviceId === data.deviceId);
      if (idx > -1) {
        this.sensors[idx] = data;
      } else {
        this.sensors.push(data);
      }
    };
  }

  private disconnect() {
    if (this.ws) {
      try { this.ws.close(); } catch {}
      this.ws = undefined;
    }
  }

  getTemperaturePosition(temp: number): number {
    if (isNaN(temp)) return 0;
    const min = 18, max = 100;
    return Math.min(100, Math.max(0, ((temp - min) / (max - min)) * 100));
  }

  getHumidityPosition(hum: number): number {
    if (isNaN(hum)) return 0;
    const min = 20, max = 100;
    return Math.min(100, Math.max(0, ((hum - min) / (max - min)) * 100));
  }
}
