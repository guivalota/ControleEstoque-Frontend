import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { EmailComponent } from './email.component';
import { EmailEmpresa } from '../../../core/models/empresa-config.model';

const URL = '/api/v1/empresa-ativa/email';

function cfg(p: Partial<EmailEmpresa> = {}): EmailEmpresa {
  return {
    configurado: true, host: 'smtp.empresa.com.br', porta: 465, seguranca: 'SSL', usuario: 'avisos@empresa.com.br',
    senha: { definida: true, mascara: '********', atualizadaEm: '2026-10-27T12:00:00Z', atualizadaPorNome: 'Ana' },
    remetenteNome: 'Empresa', remetenteEmail: 'avisos@empresa.com.br', ativo: true, verificadoEm: null,
    atualizadoEm: '2026-10-27T12:00:00Z', usandoEmailProprio: false, ...p
  };
}
const vazio: EmailEmpresa = {
  configurado: false, host: null, porta: null, seguranca: null, usuario: null, senha: null, remetenteNome: null,
  remetenteEmail: null, ativo: false, verificadoEm: null, atualizadoEm: null, usandoEmailProprio: false
};

describe('EmailComponent', () => {
  let fixture: ComponentFixture<EmailComponent>;
  let ctrl: HttpTestingController;
  const el = () => fixture.nativeElement as HTMLElement;
  const c = () => fixture.componentInstance;

  function iniciar(r: EmailEmpresa = cfg()) {
    fixture.detectChanges();
    ctrl.expectOne(URL).flush(r);
    fixture.detectChanges();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [EmailComponent], providers: [provideHttpClient(), provideHttpClientTesting()] });
    ctrl = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(EmailComponent);
  });
  afterEach(() => ctrl.verify());

  it('preenche o formulário, não exibe a senha e indica a data/autor', () => {
    iniciar();
    expect((el().querySelector('#em-host') as HTMLInputElement).value).toBe('smtp.empresa.com.br');
    const senha = el().querySelector('#em-senha') as HTMLInputElement;
    expect(senha.value).toBe('');
    expect(senha.type).toBe('password');
    const info = el().querySelector('#em-senha-info')!.textContent!;
    expect(info).toContain('definida em 27/10/2026');
    expect(info).toContain('por Ana');
  });

  it('indicador: plataforma x e-mail próprio', () => {
    iniciar(cfg({ usandoEmailProprio: false }));
    expect(el().querySelector('#email-origem')!.textContent).toContain('Usando e-mail da plataforma');
    c().carregar();
    ctrl.expectOne(URL).flush(cfg({ usandoEmailProprio: true, verificadoEm: '2026-10-27T12:00:00Z' }));
    fixture.detectChanges();
    expect(el().querySelector('#email-origem')!.textContent).toContain('Usando e-mail próprio');
  });

  it('sem configuração: defaults, aviso para salvar antes de testar', () => {
    iniciar(vazio);
    expect((el().querySelector('#em-porta') as HTMLInputElement).value).toBe('587');
    expect(el().textContent).toContain('Salve a configuração antes de testar');
    expect(el().querySelector('#btn-testar')).toBeNull();
  });

  it('salvar com senha vazia mantém (senha null); com senha envia e limpa o campo', () => {
    iniciar();
    c().salvar();
    let req = ctrl.expectOne(r => r.method === 'PUT' && r.url === URL);
    expect(req.request.body.senha).toBeNull();
    expect(req.request.body.porta).toBe(465);
    req.flush(cfg());
    fixture.detectChanges();
    expect(el().textContent).toContain('Configuração de e-mail salva.');

    c().form.patchValue({ senha: 'nova-senha' });
    c().salvar();
    req = ctrl.expectOne(r => r.method === 'PUT');
    expect(req.request.body.senha).toBe('nova-senha');
    req.flush(cfg());
    expect(c().form.controls.senha.value).toBe('');
  });

  it('400 do servidor aparece como veio e limpa a senha digitada', () => {
    iniciar();
    c().form.patchValue({ senha: 'x', host: 'localhost' });
    c().salvar();
    ctrl.expectOne(r => r.method === 'PUT').flush({ error: 'Host inválido.' }, { status: 400, statusText: 'Bad Request' });
    fixture.detectChanges();
    expect(el().textContent).toContain('Host inválido.');
    expect(c().form.controls.senha.value).toBe('');
  });

  it('e-mail de teste com sucesso recarrega o estado', () => {
    iniciar();
    c().destinatario.setValue('eu@x.com');
    c().testar();
    const req = ctrl.expectOne(`${URL}/testar`);
    expect(req.request.body).toEqual({ destinatario: 'eu@x.com' });
    req.flush({ sucesso: true, erro: null, verificadoEm: '2026-10-27T12:00:00Z' });
    ctrl.expectOne(URL).flush(cfg({ usandoEmailProprio: true }));
    fixture.detectChanges();
    expect(el().querySelector('#em-teste-resultado')!.textContent).toContain('enviado');
    expect(el().querySelector('#email-origem')!.textContent).toContain('próprio');
  });

  it('e-mail de teste com falha mostra o erro técnico', () => {
    iniciar();
    c().destinatario.setValue('eu@x.com');
    c().testar();
    ctrl.expectOne(`${URL}/testar`).flush({ sucesso: false, erro: 'SmtpException: 535', verificadoEm: null });
    fixture.detectChanges();
    expect(el().querySelector('#em-teste-resultado')!.textContent).toContain('SmtpException: 535');
  });

  it('teste: 400 do servidor mostrado como veio; destinatário inválido bloqueia', () => {
    iniciar();
    c().destinatario.setValue('invalido');
    c().testar();
    ctrl.expectNone(`${URL}/testar`);
    c().destinatario.setValue('eu@x.com');
    c().testar();
    ctrl.expectOne(`${URL}/testar`).flush({ error: 'Não há configuração.' }, { status: 400, statusText: 'Bad Request' });
    fixture.detectChanges();
    expect(el().textContent).toContain('Não há configuração.');
  });
});
