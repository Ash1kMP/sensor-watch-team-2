import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './signup.component.html',
  styleUrls: ['./auth.css'],
})
export class SignupComponent {
  name = '';
  email = '';
  password = '';
  loading = false;
  error = '';
  constructor(private auth: AuthService, private router: Router) {}
  async submit() {
    this.loading = true;
    this.error = '';
    try {
      await this.auth.signup(this.name, this.email, this.password);
      this.router.navigateByUrl('/dashboard');
    } catch (e: any) {
      this.error = e?.message || 'Signup failed';
    } finally {
      this.loading = false;
    }
  }
}
