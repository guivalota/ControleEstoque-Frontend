import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PlataformaModuloService } from './plataforma-modulo.service';

const BASE = '/api/v1/plataforma/empresas';

describe('PlataformaModuloService', () => {
  let service: PlataformaModuloService;
  let ctrl: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(PlataformaModuloService);
    ctrl = TestBed.inject(HttpTestingController);
  });

  afterEach(() => ctrl.verify());

  it('lista os módulos da empresa', () => {
    service.listar(3).subscribe();
    expect(ctrl.expectOne(`${BASE}/3/modulos`).request.method).toBe('GET');
  });

  it('liga/desliga com motivo', () => {
    service.definir(3, 'estoque', { ativo: false, motivo: 'inadimplência' }).subscribe();
    const req = ctrl.expectOne(`${BASE}/3/modulos/estoque`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ ativo: false, motivo: 'inadimplência' });
  });

  it('lista eventos paginados', () => {
    service.eventos(3, 1, 20).subscribe();
    const req = ctrl.expectOne(r => r.url === `${BASE}/3/modulos/eventos`);
    expect(req.request.params.get('page')).toBe('1');
    expect(req.request.params.get('pageSize')).toBe('20');
  });
});
