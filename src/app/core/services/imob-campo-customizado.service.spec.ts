import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ImobCampoCustomizadoService } from './imob-campo-customizado.service';

const BASE = '/api/v1/imobilizado/campos-customizados';

describe('ImobCampoCustomizadoService', () => {
  let service: ImobCampoCustomizadoService;
  let ctrl: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(ImobCampoCustomizadoService);
    ctrl = TestBed.inject(HttpTestingController);
  });

  afterEach(() => ctrl.verify());

  it('listar: por padrão só os ativos (sem parâmetro)', () => {
    service.listar().subscribe();
    const req = ctrl.expectOne(BASE);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.keys()).toEqual([]);
    req.flush([]);
  });

  it('listar(true): pede também os inativos', () => {
    service.listar(true).subscribe();
    const req = ctrl.expectOne(r => r.url === BASE);
    expect(req.request.params.get('incluirInativos')).toBe('true');
    req.flush([]);
  });

  it('criar, atualizar e excluir usam POST, PUT e DELETE', () => {
    service.criar({ nome: 'Cor', tipo: 'texto', obrigatorio: false, ordem: 0 }).subscribe();
    const post = ctrl.expectOne(BASE);
    expect(post.request.method).toBe('POST');
    expect(post.request.body.nome).toBe('Cor');
    post.flush({});

    service.atualizar(4, { nome: 'Cor', obrigatorio: true, ativo: false, ordem: 1 }).subscribe();
    const put = ctrl.expectOne(`${BASE}/4`);
    expect(put.request.method).toBe('PUT');
    put.flush({});

    service.excluir(4).subscribe();
    const del = ctrl.expectOne(`${BASE}/4`);
    expect(del.request.method).toBe('DELETE');
    del.flush(null);
  });
});
