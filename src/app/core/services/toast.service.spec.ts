import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { ToastService } from './toast.service';

describe('ToastService', () => {
  let service: ToastService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ToastService);
  });

  it('empilha toasts com tipo e texto', () => {
    service.sucesso('ok');
    service.erro('falhou');
    expect(service.toasts().map(t => [t.tipo, t.texto])).toEqual([['sucesso', 'ok'], ['erro', 'falhou']]);
  });

  it('fechar remove só o toast indicado', () => {
    service.info('a');
    service.info('b');
    service.fechar(service.toasts()[0].id);
    expect(service.toasts().map(t => t.texto)).toEqual(['b']);
  });

  it('some sozinho: info em 5 s, erro em 8 s', fakeAsync(() => {
    service.info('i');
    service.erro('e');
    tick(5000);
    expect(service.toasts().map(t => t.texto)).toEqual(['e']);
    tick(3000);
    expect(service.toasts().length).toBe(0);
  }));

  it('erroApi usa a mensagem do servidor ou o texto de reserva', fakeAsync(() => {
    service.erroApi(new HttpErrorResponse({ status: 400, error: { error: 'Regra violada' } }), 'reserva');
    service.erroApi(new HttpErrorResponse({ status: 500, error: null }), 'reserva');
    expect(service.toasts().map(t => t.texto)).toEqual(['Regra violada', 'reserva']);
    tick(8000);
  }));
});
