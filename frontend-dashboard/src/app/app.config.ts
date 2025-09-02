// import { ApplicationConfig } from '@angular/core';
// import { provideRouter } from '@angular/router';

// import { routes } from './app.routes';

// export const appConfig: ApplicationConfig = {
//   providers: [provideRouter(routes)]
// };

import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { provideHttpClient, withInterceptors } from '@angular/common/http';

export const appConfig: ApplicationConfig = {
providers: [
provideZoneChangeDetection({ eventCoalescing: true }),
provideRouter(routes),
provideHttpClient(withInterceptors([
(req, next) => {
const token = localStorage.getItem('sw_token');
if (token) req = req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
return next(req);
}
]))
]
};