import { Injectable, signal } from '@angular/core';
import { lerErroApi, textoDoErro } from '../utils/erros-api';

export type ToastTipo = 'sucesso' | 'erro' | 'info';

export interface Toast {
  id: number;
  tipo: ToastTipo;
  texto: string;
}

/** Feedback não bloqueante (substitui `alert()`). O host `app-toast-host` desenha a lista. */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private proximoId = 1;
  private readonly _toasts = signal<Toast[]>([]);
  readonly toasts = this._toasts.asReadonly();

  sucesso(texto: string) { this.mostrar('sucesso', texto); }
  info(texto: string) { this.mostrar('info', texto); }
  erro(texto: string) { this.mostrar('erro', texto); }

  /** Erro vindo da API: usa a mensagem do servidor (`{ error }`/campos) ou o texto de reserva. */
  erroApi(err: unknown, fallback: string) {
    this.erro(textoDoErro(lerErroApi(err, fallback), fallback));
  }

  fechar(id: number) {
    this._toasts.update(lista => lista.filter(t => t.id !== id));
  }

  private mostrar(tipo: ToastTipo, texto: string) {
    const id = this.proximoId++;
    this._toasts.update(lista => [...lista, { id, tipo, texto }]);
    // Erros ficam mais tempo na tela.
    setTimeout(() => this.fechar(id), tipo === 'erro' ? 8000 : 5000);
  }
}
