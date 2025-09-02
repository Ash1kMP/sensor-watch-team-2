import { CanActivateFn, Router } from '@angular/router';

export const authGuard: CanActivateFn = () => {
  const token = localStorage.getItem('sw_token');
  if (!token) {
    location.href = '/login';
    return false;
  }
  return true;
};
