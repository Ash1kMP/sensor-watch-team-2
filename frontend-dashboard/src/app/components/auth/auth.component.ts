import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-auth',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './auth.component.html',
  styleUrls: ['./auth.component.css']
})
export class AuthComponent {
  mode: 'login' | 'signup' = 'login'; // toggle between login and signup

  email = '';
  username = '';
  password = '';

  toggleMode(mode: 'login' | 'signup') {
    this.mode = mode;
    this.email = '';
    this.username = '';
    this.password = '';
  }

  async onSubmit() {
    const payload: any = {
      email: this.email,
      password: this.password,
    };

    if (this.mode === 'signup') {
      payload.username = this.username;
    }

    const endpoint = this.mode === 'login' ? 'login' : 'signup';

    try {
      const res = await fetch(`http://localhost:5000/${endpoint}`, {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!res.ok) {
        throw new Error('Request failed');
      }

      const data = await res.json();
      console.log(`${this.mode} successful`, data);

      localStorage.setItem('token', data.token);
    } catch (err) {
      console.error(`${this.mode} failed`, err);
    }
  }
}
