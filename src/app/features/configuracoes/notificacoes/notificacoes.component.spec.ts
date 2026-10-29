import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { NotificacoesComponent } from './notificacoes.component';
import { NotificacoesResponse } from '../../../core/models/empresa-config.model';

const URL = '/api/v1/empresa-ativa/notificacoes';
const URL_USU = '/api/v1/empresa-ativa/usuarios';

const usuarios = {
  items: [
    { id: 'u1', nome: 'Ana', email: 'ana@x.com', perfil: 'admin', perfilEfetivo: 'admin', ativo: true },
    { id: 'u2', nome: 'Beto', email: 'beto@x.com', perfil: 'operador', perfilEfetivo: 'operador', ativo: true }
  ],
  page: 1, pageSize: 100, total: 2
};

function resp(destinatarios: NotificacoesResponse['eventos'][0]['destinatarios'] = [], usandoPadrao = destinatarios.length === 0): NotificacoesResponse {
  return { eventos: [{ codigo: 'estoque_baixo', nome: 'Estoque abaixo do mínimo', descricao: 'Avisa quando…', modulo: 'estoque', usandoPadrao, destinatarios }] };
}

describe('NotificacoesComponent', () => {
  let fixture: ComponentFixture<NotificacoesComponent>;
  let ctrl: HttpTestingController;
  const el = () => fixture.nativeElement as HTMLElement;
  const c = () => fixture.componentInstance;

  function iniciar(r: NotificacoesResponse = resp()) {
    fixture.detectChanges();
    ctrl.expectOne(URL).flush(r);
    ctrl.expectOne(r2 => r2.url === URL_USU).flush(usuarios);
    fixture.detectChanges();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [NotificacoesComponent], providers: [provideHttpClient(), provideHttpClientTesting()] });
    ctrl = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(NotificacoesComponent);
  });
  afterEach(() => ctrl.verify());

  it('mostra eventos do servidor e o texto de padrão quando não há destinatários', () => {
    iniciar();
    expect(el().textContent).toContain('Estoque abaixo do mínimo');
    expect(el().querySelector('.usando-padrao')!.textContent).toContain('Usando padrão: administradores');
  });

  it('adiciona usuário e e-mail avulso (minúsculas, sem duplicar) e envia só o evento editado', () => {
    iniciar();
    c().adicionarUsuario('estoque_baixo', 'u1');
    c().adicionarEmail('estoque_baixo', ' Gestor@X.com ');
    c().adicionarEmail('estoque_baixo', 'gestor@x.com');
    fixture.detectChanges();
    expect(el().querySelector('.usando-padrao')).toBeNull();
    expect(el().querySelector('.inp-email')!.classList).toContain('is-invalid');
    expect(c().eventos()[0].destinatarios.length).toBe(2);
    // u1 já usado não aparece mais na lista de seleção
    expect(Array.from(el().querySelectorAll('.sel-usuario option')).map(o => o.textContent)).not.toContain('Ana (ana@x.com)');

    c().salvar('estoque_baixo');
    const req = ctrl.expectOne(r => r.method === 'PUT' && r.url === URL);
    expect(req.request.body).toEqual({ eventos: [{ evento: 'estoque_baixo', destinatarios: [{ usuarioId: 'u1', ativo: true }, { email: 'gestor@x.com', ativo: true }] }] });
    req.flush(resp([
      { tipo: 'usuario', usuarioId: 'u1', nome: 'Ana', email: 'ana@x.com', ativo: true, elegivel: true },
      { tipo: 'email', usuarioId: null, nome: null, email: 'gestor@x.com', ativo: true, elegivel: true }
    ]));
    fixture.detectChanges();
    expect(el().textContent).toContain('Destinatários salvos.');
  });

  it('e-mail inválido é recusado no formulário', () => {
    iniciar();
    c().adicionarEmail('estoque_baixo', 'sem-arroba');
    fixture.detectChanges();
    expect(el().textContent).toContain('E-mail inválido.');
    expect(c().eventos()[0].destinatarios.length).toBe(0);
  });

  it('ativar/desativar e remover; lista vazia volta ao padrão', () => {
    iniciar(resp([{ tipo: 'email', usuarioId: null, nome: null, email: 'a@x.com', ativo: true, elegivel: true }]));
    const d = c().eventos()[0].destinatarios[0];
    c().alternar('estoque_baixo', d);
    expect(c().eventos()[0].destinatarios[0].ativo).toBeFalse();
    c().remover('estoque_baixo', d);
    fixture.detectChanges();
    expect(el().querySelector('.usando-padrao')).not.toBeNull();
    c().salvar('estoque_baixo');
    const req = ctrl.expectOne(r => r.method === 'PUT');
    expect(req.request.body.eventos[0].destinatarios).toEqual([]);
    req.flush(resp());
  });

  it('avisa quando o destinatário é inelegível', () => {
    iniciar(resp([{ tipo: 'usuario', usuarioId: 'u9', nome: 'Caio', email: 'caio@x.com', ativo: true, elegivel: false }]));
    expect(el().querySelector('.inelegivel')!.textContent).toContain('não recebe');
  });

  it('mostra o 400 do servidor como veio', () => {
    iniciar();
    c().salvar('estoque_baixo');
    ctrl.expectOne(r => r.method === 'PUT').flush({ error: 'Usuário não pertence à empresa.' }, { status: 400, statusText: 'Bad Request' });
    fixture.detectChanges();
    expect(el().textContent).toContain('Usuário não pertence à empresa.');
  });
});
