import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PlataformaVinculoService } from './plataforma-vinculo.service';

describe('PlataformaVinculoService', () => {
  let service: PlataformaVinculoService;
  let ctrl: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(PlataformaVinculoService);
    ctrl = TestBed.inject(HttpTestingController);
  });
  afterEach(() => ctrl.verify());

  it('vincula com e sem perfil', () => {
    service.vincular(2, 'u1', 'operador').subscribe();
    const a = ctrl.expectOne('/api/v1/plataforma/empresas/2/usuarios');
    expect(a.request.method).toBe('POST');
    expect(a.request.body).toEqual({ usuarioId: 'u1', perfil: 'operador' });
    a.flush(null, { status: 204, statusText: 'No Content' });
    service.vincular(2, 'u1').subscribe();
    const b = ctrl.expectOne('/api/v1/plataforma/empresas/2/usuarios');
    expect(b.request.body).toEqual({ usuarioId: 'u1' });
    b.flush(null, { status: 204, statusText: 'No Content' });
  });

  it('desvincula', () => {
    service.desvincular(1, 'u1').subscribe();
    const r = ctrl.expectOne('/api/v1/plataforma/empresas/1/usuarios/u1');
    expect(r.request.method).toBe('DELETE');
    r.flush(null, { status: 204, statusText: 'No Content' });
  });
});
