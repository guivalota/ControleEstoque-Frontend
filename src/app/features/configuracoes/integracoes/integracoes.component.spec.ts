import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { IntegracoesComponent } from './integracoes.component';
import { Integracao } from '../../../core/models/empresa-config.model';
import { ConfirmDialogComponent } from '../../imobilizado/shared/confirm-dialog.component';

const URL = '/api/v1/empresa-ativa/integracoes';

function integ(p: Partial<Integracao> = {}): Integracao {
  return {
    id: 'i1', tipo: 'fiscal', provedor: 'SEFAZ-SP', ambiente: 'homologacao', parametros: { serie: '1' }, ativo: true,
    status: 'nao_testada', ultimoTesteEm: null, ultimoTesteResultado: null, atualizadoEm: null,
    credencial: {
      id: 'c1', tipo: 'token', rotulo: 'x', definida: true, mascara: '********', versao: 2,
      atualizadoEm: '2026-10-27T12:00:00Z', atualizadoPorId: 'u', atualizadoPorNome: 'Ana', revogadaEm: null
    },
    ...p
  };
}

describe('IntegracoesComponent', () => {
  let fixture: ComponentFixture<IntegracoesComponent>;
  let ctrl: HttpTestingController;
  const el = () => fixture.nativeElement as HTMLElement;
  const c = () => fixture.componentInstance;

  function iniciar(lista: Integracao[] = [integ()]) {
    fixture.detectChanges();
    ctrl.expectOne(URL).flush(lista);
    fixture.detectChanges();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [IntegracoesComponent], providers: [provideHttpClient(), provideHttpClientTesting()] });
    ctrl = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(IntegracoesComponent);
  });
  afterEach(() => ctrl.verify());

  it('lista integrações com máscara e status, sem exibir segredo', () => {
    iniciar();
    const txt = el().textContent!;
    expect(txt).toContain('SEFAZ-SP');
    expect(txt).toContain('********');
    expect(txt).toContain('Não testada');
  });

  it('mostra estado vazio', () => {
    iniciar([]);
    expect(el().textContent).toContain('Nenhuma integração cadastrada');
  });

  it('cria com parâmetros e segredo e limpa o segredo após salvar', () => {
    iniciar([]);
    c().novo();
    fixture.detectChanges();
    expect(el().querySelector('#int-aviso-param')!.textContent).toContain('recusados');
    c().adicionarParametro();
    c().parametros.at(0).patchValue({ chave: 'serie', valor: '1' });
    c().form.patchValue({ provedor: 'SEFAZ-SP', segredo: 'abc123', credencialTipo: 'senha' });
    c().salvar();
    const req = ctrl.expectOne(r => r.method === 'POST' && r.url === URL);
    expect(req.request.body).toEqual({
      tipo: 'fiscal', provedor: 'SEFAZ-SP', ambiente: 'homologacao', parametros: { serie: '1' },
      credencialTipo: 'senha', segredo: 'abc123', ativo: true
    });
    req.flush(integ());
    expect(c().form.controls.segredo.value).toBe('');
    ctrl.expectOne(URL).flush([integ()]);
    fixture.detectChanges();
    expect(el().textContent).toContain('Integração criada.');
  });

  it('edição com segredo vazio mantém (segredo null) e mostra "definida em" com autor', () => {
    iniciar();
    c().editar(integ());
    fixture.detectChanges();
    const info = el().querySelector('#int-cred-info')!.textContent!;
    expect(info).toContain('definida em 27/10/2026');
    expect(info).toContain('por Ana');
    expect((el().querySelector('#int-segredo') as HTMLInputElement).value).toBe('');
    expect((el().querySelector('#int-segredo') as HTMLInputElement).type).toBe('password');
    c().salvar();
    const req = ctrl.expectOne(r => r.method === 'PUT' && r.url === `${URL}/i1`);
    expect(req.request.body.segredo).toBeNull();
    expect(req.request.body.credencialTipo).toBeNull();
    req.flush(integ());
    ctrl.expectOne(URL).flush([integ()]);
  });

  it('mostra o 400 do servidor como veio e limpa o segredo digitado', () => {
    iniciar([]);
    c().novo();
    c().form.patchValue({ provedor: 'X', segredo: 'seg' });
    c().salvar();
    ctrl.expectOne(r => r.method === 'POST').flush({ error: 'Parâmetro "senha" não é permitido.' }, { status: 400, statusText: 'Bad Request' });
    fixture.detectChanges();
    expect(el().textContent).toContain('Parâmetro "senha" não é permitido.');
    expect(c().form.controls.segredo.value).toBe('');
  });

  it('testar mostra o resultado e recarrega a lista', () => {
    iniciar();
    c().testar(integ());
    ctrl.expectOne(`${URL}/i1/testar`).flush({ status: 'ok', resultado: 'Credencial presente.', testadoEm: '2026-10-27T12:00:00Z' });
    ctrl.expectOne(URL).flush([integ({ status: 'ok' })]);
    fixture.detectChanges();
    expect(el().querySelector('.teste-resultado')!.textContent).toContain('Credencial presente.');
  });

  it('desativar envia o documento completo sem segredo', () => {
    iniciar();
    c().alternarAtivo(integ());
    const req = ctrl.expectOne(r => r.method === 'PUT' && r.url === `${URL}/i1`);
    expect(req.request.body.ativo).toBeFalse();
    expect(req.request.body.segredo).toBeNull();
    expect(req.request.body.parametros).toEqual({ serie: '1' });
    req.flush(integ({ ativo: false }));
    fixture.detectChanges();
    expect(el().querySelector('[data-acao=ativar]')!.textContent).toContain('Ativar');
  });

  it('excluir pede confirmação e só exclui se confirmado', async () => {
    iniciar();
    const abrir = spyOn(ConfirmDialogComponent.prototype, 'abrir').and.resolveTo(false);
    await c().excluir(integ());
    ctrl.expectNone(`${URL}/i1`);
    expect(abrir.calls.mostRecent().args[0].mensagem).toContain('revogada');
    abrir.and.resolveTo(true);
    const p = c().excluir(integ());
    await Promise.resolve(); await Promise.resolve();
    ctrl.expectOne(r => r.method === 'DELETE' && r.url === `${URL}/i1`).flush(null, { status: 204, statusText: 'No Content' });
    await p;
    fixture.detectChanges();
    expect(el().textContent).toContain('Nenhuma integração cadastrada');
  });

  it('erro ao carregar oferece nova tentativa', () => {
    fixture.detectChanges();
    ctrl.expectOne(URL).flush({ error: 'Falhou.' }, { status: 500, statusText: 'Err' });
    fixture.detectChanges();
    expect(el().textContent).toContain('Falhou.');
    el().querySelector<HTMLButtonElement>('button.btn-outline-danger')!.click();
    ctrl.expectOne(URL).flush([]);
  });
});
