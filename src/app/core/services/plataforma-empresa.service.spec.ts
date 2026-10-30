import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PlataformaEmpresaService } from './plataforma-empresa.service';

const BASE = '/api/v1/plataforma/empresas';

describe('PlataformaEmpresaService', () => {
  let service: PlataformaEmpresaService;
  let ctrl: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(PlataformaEmpresaService);
    ctrl = TestBed.inject(HttpTestingController);
  });

  afterEach(() => ctrl.verify());

  it('lista com page e pageSize', () => {
    service.listar(2, 100).subscribe();
    const req = ctrl.expectOne(r => r.url === BASE);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('pageSize')).toBe('100');
    req.flush({ items: [], page: 2, pageSize: 100, total: 0 });
  });

  it('obtém, cria, atualiza e exclui', () => {
    service.obter(5).subscribe();
    expect(ctrl.expectOne(`${BASE}/5`).request.method).toBe('GET');

    service.criar({ razaoSocial: 'A', cnpj: '12ABC34501DE35' }).subscribe();
    const post = ctrl.expectOne(BASE);
    expect(post.request.method).toBe('POST');
    expect(post.request.body).toEqual({ razaoSocial: 'A', cnpj: '12ABC34501DE35' });

    service.atualizar(5, { razaoSocial: 'A', cnpj: '12ABC34501DE35', ativo: false }).subscribe();
    const put = ctrl.expectOne(`${BASE}/5`);
    expect(put.request.method).toBe('PUT');
    expect(put.request.body.ativo).toBeFalse();

    service.excluir(5).subscribe();
    const del = ctrl.expectOne(`${BASE}/5`);
    expect(del.request.method).toBe('DELETE');
  });

  it('cria o administrador inicial', () => {
    service.criarAdminInicial(7, { nome: 'Ana', email: 'ana@x.com' }).subscribe();
    const req = ctrl.expectOne(`${BASE}/7/admin-inicial`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ nome: 'Ana', email: 'ana@x.com' });
  });

  it('onboarding envia empresa, plano e admin numa chamada', () => {
    const corpo = { razaoSocial: 'A', cnpj: '12ABC34501DE35', planoId: 2, sincronizarModulos: true, admin: { nome: 'Ana', email: 'ana@x.com' } };
    service.onboarding(corpo).subscribe();
    const req = ctrl.expectOne(BASE + '/onboarding');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(corpo);
  });

  it('bloqueia com motivo, desbloqueia com ou sem motivo e lê o histórico', () => {
    service.bloquear(3, 'Inadimplência').subscribe();
    const b = ctrl.expectOne(BASE + '/3/bloquear');
    expect(b.request.method).toBe('POST');
    expect(b.request.body).toEqual({ motivo: 'Inadimplência' });

    service.desbloquear(3, 'Pago').subscribe();
    expect(ctrl.expectOne(BASE + '/3/desbloquear').request.body).toEqual({ motivo: 'Pago' });
    service.desbloquear(3).subscribe();
    expect(ctrl.expectOne(BASE + '/3/desbloquear').request.body).toEqual({});

    service.bloqueios(3, 2, 500).subscribe();
    const g = ctrl.expectOne(r => r.url === BASE + '/3/bloqueios');
    expect(g.request.params.get('page')).toBe('2');
    expect(g.request.params.get('pageSize')).toBe('100');
  });
});
