import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PlataformaEquipeService } from './plataforma-equipe.service';

const BASE = '/api/v1/plataforma/empresas/5/equipe';

describe('PlataformaEquipeService', () => {
  let service: PlataformaEquipeService;
  let ctrl: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(PlataformaEquipeService);
    ctrl = TestBed.inject(HttpTestingController);
  });
  afterEach(() => ctrl.verify());

  it('lista e cria membros', () => {
    service.listar(5).subscribe();
    expect(ctrl.expectOne(BASE).request.method).toBe('GET');
    const corpo = { nome: 'Ana', email: 'a@a.com', perfil: 'operador' as const };
    service.criar(5, corpo).subscribe();
    const post = ctrl.expectOne(BASE);
    expect(post.request.method).toBe('POST');
    expect(post.request.body).toEqual(corpo);
  });

  it('altera perfil, redefine senha e ativa/desativa', () => {
    service.alterarPerfil(5, 'u1', 'admin').subscribe();
    const put = ctrl.expectOne(`${BASE}/u1/perfil`);
    expect(put.request.method).toBe('PUT');
    expect(put.request.body).toEqual({ perfil: 'admin' });

    service.redefinirSenha(5, 'u1').subscribe();
    expect(ctrl.expectOne(`${BASE}/u1/redefinir-senha`).request.method).toBe('POST');

    service.definirAtivo(5, 'u1', false).subscribe();
    const ativo = ctrl.expectOne(`${BASE}/u1/ativo`);
    expect(ativo.request.method).toBe('PUT');
    expect(ativo.request.body).toEqual({ ativo: false });
  });

  it('lê o histórico paginado', () => {
    service.eventos(5, 2, 20).subscribe();
    const r = ctrl.expectOne(x => x.url === `${BASE}/eventos`);
    expect(r.request.params.get('page')).toBe('2');
    expect(r.request.params.get('pageSize')).toBe('20');
  });
});
