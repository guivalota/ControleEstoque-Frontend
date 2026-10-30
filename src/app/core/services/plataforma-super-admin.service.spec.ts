import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PlataformaSuperAdminService } from './plataforma-super-admin.service';

const BASE = '/api/v1/plataforma/super-admins';

describe('PlataformaSuperAdminService', () => {
  let service: PlataformaSuperAdminService;
  let ctrl: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(PlataformaSuperAdminService);
    ctrl = TestBed.inject(HttpTestingController);
  });
  afterEach(() => ctrl.verify());

  it('lista, cria, redefine senha e ativa/desativa', () => {
    service.listar().subscribe();
    expect(ctrl.expectOne(BASE).request.method).toBe('GET');

    service.criar({ nome: 'Ana', email: 'a@a.com' }).subscribe();
    const post = ctrl.expectOne(BASE);
    expect(post.request.method).toBe('POST');
    expect(post.request.body).toEqual({ nome: 'Ana', email: 'a@a.com' });

    service.redefinirSenha('g1').subscribe();
    expect(ctrl.expectOne(`${BASE}/g1/redefinir-senha`).request.method).toBe('POST');

    service.definirAtivo('g1', true).subscribe();
    const put = ctrl.expectOne(`${BASE}/g1/ativo`);
    expect(put.request.method).toBe('PUT');
    expect(put.request.body).toEqual({ ativo: true });
  });
});
