import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = inject(AuthService).getToken();

  // Túnel ngrok (free) mostra uma página HTML de aviso pra visitantes sem esse header,
  // quebrando o CORS pra quem acessa de fora da máquina que roda o ngrok.
  const headers: Record<string, string> = { 'ngrok-skip-browser-warning': 'true' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return next(req.clone({ setHeaders: headers }));
};
