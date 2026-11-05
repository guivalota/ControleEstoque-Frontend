import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { EquipeEmpresaService } from './equipe-empresa.service';

const BASE = '/api/v1/equipe';

describe('EquipeEmpresaService', () => {
  let service: EquipeEmpresaService;
  let ctrl: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(EquipeEmpresaService);
    ctrl = TestBed.inject(HttpTestingController);
  });

  afterEach(() => ctrl.verify());

  it('lista a equipe da empresa ativa (sem id na rota)', () => {
    service.listar().subscribe();
    const req = ctrl.expectOne(BASE);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('cria o membro e devolve a senha provisória', () => {
    let senha = '';
    service.criar({ nome: 'Ana', email: 'ana@x.com', perfil: 'operador' }).subscribe(r => (senha = r.senhaProvisoria));
    const req = ctrl.expectOne(BASE);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ nome: 'Ana', email: 'ana@x.com', perfil: 'operador' });
    req.flush({ usuario: { usuarioId: 'u1' }, senhaProvisoria: 'Tmp@1234' });
    expect(senha).toBe('Tmp@1234');
  });

  it('altera perfil, redefine senha e ativa/desativa', () => {
    service.alterarPerfil('u1', 'leitura').subscribe();
    const a = ctrl.expectOne(`${BASE}/u1/perfil`);
    expect(a.request.method).toBe('PUT');
    expect(a.request.body).toEqual({ perfil: 'leitura' });
    a.flush(null);

    service.redefinirSenha('u1').subscribe();
    const b = ctrl.expectOne(`${BASE}/u1/redefinir-senha`);
    expect(b.request.method).toBe('POST');
    b.flush({ usuario: {}, senhaProvisoria: 'x' });

    service.definirAtivo('u1', false).subscribe();
    const c = ctrl.expectOne(`${BASE}/u1/ativo`);
    expect(c.request.method).toBe('PUT');
    expect(c.request.body).toEqual({ ativo: false });
    c.flush(null);
  });

  it('pagina o histórico', () => {
    service.eventos(2, 20).subscribe();
    const req = ctrl.expectOne(r => r.url === `${BASE}/eventos`);
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('pageSize')).toBe('20');
    req.flush({ items: [], page: 2, pageSize: 20, total: 0 });
  });
});
