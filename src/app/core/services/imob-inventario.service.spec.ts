import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ImobInventarioService } from './imob-inventario.service';
import { inventarioCancelavel, inventarioEditavel, inventarioExcluivel } from '../models/imob-inventario.model';

const BASE = '/api/v1/imobilizado/inventarios';

describe('ImobInventarioService', () => {
  let service: ImobInventarioService;
  let ctrl: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(ImobInventarioService);
    ctrl = TestBed.inject(HttpTestingController);
  });

  afterEach(() => ctrl.verify());

  it('listar envia só os filtros definidos', () => {
    service.listar({ busca: 'anual', status: 'rascunho', page: 2, pageSize: 50 }).subscribe();
    const req = ctrl.expectOne(r => r.url === BASE);
    expect(req.request.params.get('busca')).toBe('anual');
    expect(req.request.params.get('status')).toBe('rascunho');
    expect(req.request.params.get('page')).toBe('2');
    req.flush({ items: [], page: 2, pageSize: 50, total: 0 });

    service.listar({ busca: undefined }).subscribe();
    const req2 = ctrl.expectOne(r => r.url === BASE);
    expect(req2.request.params.keys()).toEqual([]);
    req2.flush({ items: [], page: 1, pageSize: 50, total: 0 });
  });

  it('obter, criar e atualizar usam os endpoints da spec', () => {
    service.obter(7).subscribe();
    ctrl.expectOne(`${BASE}/7`).flush({});

    const corpo = { nome: 'Anual', localIds: [1], usuarioIds: [] };
    service.criar(corpo).subscribe();
    const post = ctrl.expectOne(r => r.method === 'POST' && r.url === BASE);
    expect(post.request.body).toEqual(corpo);
    post.flush({});

    service.atualizar(7, corpo).subscribe();
    const put = ctrl.expectOne(r => r.method === 'PUT' && r.url === `${BASE}/7`);
    expect(put.request.body).toEqual(corpo);
    put.flush({});
  });

  it('iniciar, cancelar e excluir', () => {
    service.iniciar(7).subscribe();
    const ini = ctrl.expectOne(`${BASE}/7/iniciar`);
    expect(ini.request.method).toBe('POST');
    expect(ini.request.body).toBeNull();
    ini.flush({});

    service.cancelar(7).subscribe();
    ctrl.expectOne(`${BASE}/7/cancelar`).flush({});

    service.excluir(7).subscribe();
    const del = ctrl.expectOne(`${BASE}/7`);
    expect(del.request.method).toBe('DELETE');
    del.flush(null, { status: 204, statusText: 'No Content' });
  });

  it('regras por status', () => {
    expect(inventarioEditavel('rascunho')).toBeTrue();
    expect(inventarioEditavel('em_andamento')).toBeTrue();
    expect(inventarioEditavel('concluido')).toBeFalse();
    expect(inventarioEditavel('cancelado')).toBeFalse();
    expect(inventarioCancelavel('em_andamento')).toBeTrue();
    expect(inventarioCancelavel('concluido')).toBeFalse();
    expect(inventarioExcluivel('rascunho')).toBeTrue();
    expect(inventarioExcluivel('cancelado')).toBeTrue();
    expect(inventarioExcluivel('em_andamento')).toBeFalse();
    expect(inventarioExcluivel('concluido')).toBeFalse();
  });
});
