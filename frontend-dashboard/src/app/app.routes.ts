// import { Routes } from '@angular/router';
// import {DashboardComponent} from './components/dashboard/dashboard.component';

// export const routes: Routes = [
//     { path: '', redirectTo: '/dashboard', pathMatch: 'full' },
//     { path: 'dashboard', component: DashboardComponent }
// ];
import { Routes } from '@angular/router';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { LoginComponent } from './components/auth/login.component';
import { SignupComponent } from './components/auth/signup.component';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
{ path: '', redirectTo: '/dashboard', pathMatch: 'full' },
{ path: 'login', component: LoginComponent },
{ path: 'signup', component: SignupComponent },
{ path: 'dashboard', component: DashboardComponent, canActivate: [authGuard] },
{ path: '**', redirectTo: '/dashboard' }
];