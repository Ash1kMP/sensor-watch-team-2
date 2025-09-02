import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

const API = '/api/auth'; // nginx will proxy to auth-service

@Injectable({ providedIn: 'root' })
export class AuthService {
  constructor(private http: HttpClient) {}
  async login(email: string, password: string) {
    const res: any = await firstValueFrom(
      this.http.post(`${API}/login`, { email, password })
    );
    localStorage.setItem('sw_token', res.token);
    localStorage.setItem('sw_username', res.user?.name || '');
  }
  async signup(name: string, email: string, password: string) {
    const res: any = await firstValueFrom(
      this.http.post(`${API}/signup`, { name, email, password })
    );
    localStorage.setItem('sw_token', res.token);
    localStorage.setItem('sw_username', res.user?.name || '');
  }
  get token() {
    return localStorage.getItem('sw_token');
  }
  get isAuthed() {
    return !!this.token;
  }
}
