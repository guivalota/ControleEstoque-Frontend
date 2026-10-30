import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PlataformaPlanoService } from './plataforma-plano.service';

const BASE = '/api/v1/plataforma';

describe('PlataformaPlanoService', () => {
  let service: PlataformaPlanoService;
  let ctrl: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(PlataformaPlanoService);
    ctrl = TestBed.inject(HttpTestingController);
  });

  afterEach(() => ctrl.verify());

  it('lista, obtém, cria e atualiza planos', () => {
    service.listar().subscribe();
    expect(ctrl.expectOne(`${BASE}/planos`).request.method).toBe('GET');

    service.obter(1).subscribe();
    expect(ctrl.expectOne(`${BASE}/planos/1`).request.method).toBe('GET');

    const corpo = { codigo: 'basico', nome: 'Básico', modulos: ['estoque'], limites: { max_usuarios: 5 }, padrao: true };
    service.criar(corpo).subscribe();
    const post = ctrl.expectOne(`${BASE}/planos`);
    expect(post.request.method).toBe('POST');
    expect(post.request.body).toEqual(corpo);

    service.atualizar(1, corpo).subscribe();
    const put = ctrl.expectOne(`${BASE}/planos/1`);
    expect(put.request.method).toBe('PUT');
  });

  it('ativa/desativa o plano', () => {
    service.definirAtivo(2, false).subscribe();
    const req = ctrl.expectOne(`${BASE}/planos/2/ativo`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ ativo: false });
  });

  it('define plano, limites e consulta uso da empresa', () => {
    service.definirPlanoDaEmpresa(4, { planoId: 2, sincronizarModulos: true }).subscribe();
    const plano = ctrl.expectOne(`${BASE}/empresas/4/plano`);
    expect(plano.request.method).toBe('PUT');
    expect(plano.request.body).toEqual({ planoId: 2, sincronizarModulos: true });

    service.definirLimitesDaEmpresa(4, { max_bens: 10 }).subscribe();
    const lim = ctrl.expectOne(`${BASE}/empresas/4/limites`);
    expect(lim.request.method).toBe('PUT');
    expect(lim.request.body).toEqual({ limites: { max_bens: 10 } });

    service.uso(4).subscribe();
    expect(ctrl.expectOne(`${BASE}/empresas/4/uso`).request.method).toBe('GET');
  });
});
