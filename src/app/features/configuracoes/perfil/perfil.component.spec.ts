import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PerfilComponent } from './perfil.component';
import { perfilBase, opcoesBase } from '../testing-perfil';

const URL = '/api/v1/empresa-ativa';

describe('PerfilComponent', () => {
  let fixture: ComponentFixture<PerfilComponent>;
  let ctrl: HttpTestingController;
  const el = () => fixture.nativeElement as HTMLElement;

  function iniciar(perfil = perfilBase()) {
    fixture.detectChanges();
    ctrl.expectOne(`${URL}/perfil`).flush(perfil);
    ctrl.expectOne(`${URL}/perfil/opcoes`).flush(opcoesBase);
    fixture.detectChanges();
    ctrl.expectOne(`${URL}/logo`).flush(new Blob(['']), { status: 404, statusText: 'Not Found' });
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [PerfilComponent], providers: [provideHttpClient(), provideHttpClientTesting()] });
    ctrl = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(PerfilComponent);
  });
  afterEach(() => ctrl.verify());

  it('mostra razão social e CNPJ somente leitura e campos editáveis', () => {
    iniciar();
    const razao = el().querySelector('#cfg-razao') as HTMLInputElement;
    const cnpj = el().querySelector('#cfg-cnpj') as HTMLInputElement;
    expect(razao.value).toBe('Acme Ltda');
    expect(razao.readOnly).toBeTrue();
    expect(cnpj.value).toBe('11.222.333/0001-81');
    expect(cnpj.readOnly).toBeTrue();
    expect((el().querySelector('#cfg-fantasia') as HTMLInputElement).value).toBe('Acme');
    expect(el().querySelector('#cfg-tel')).toBeTruthy();
    expect(el().querySelector('#cfg-email')).toBeTruthy();
    expect(el().querySelector('#cfg-site')).toBeTruthy();
    expect(el().querySelector('#cfg-cep')).toBeTruthy();
  });

  it('PUT envia o documento completo, preservando os campos fiscais e limpando vazios', () => {
    iniciar();
    fixture.componentInstance.form.patchValue({ nomeFantasia: ' Loja ', telefone: '(11) 99999-8888', site: '' });
    fixture.componentInstance.salvar();
    const req = ctrl.expectOne(r => r.method === 'PUT' && r.url === `${URL}/perfil`);
    expect(req.request.body.nomeFantasia).toBe('Loja');
    expect(req.request.body.telefone).toBe('(11) 99999-8888');
    expect(req.request.body.site).toBeNull();
    expect(req.request.body.inscricaoEstadual).toBe('ISENTO');
    expect(req.request.body.cnae).toBe('4751201');
    expect(req.request.body.regimeTributario).toBe('simples_nacional');
    expect(req.request.body.serieNfe).toBe(1);
    expect(req.request.body.razaoSocial).toBeUndefined();
    req.flush(perfilBase({ nomeFantasia: 'Loja' }));
    fixture.detectChanges();
    expect(el().textContent).toContain('Perfil salvo.');
  });

  it('exibe o erro por campo e a mensagem do servidor como vieram', () => {
    iniciar();
    fixture.componentInstance.salvar();
    ctrl.expectOne(r => r.method === 'PUT').flush({ errors: { Telefone: ['Telefone deve ter de 10 a 13 dígitos.'] } }, { status: 400, statusText: 'Bad Request' });
    fixture.detectChanges();
    expect(el().textContent).toContain('Telefone deve ter de 10 a 13 dígitos.');

    fixture.componentInstance.salvar();
    ctrl.expectOne(r => r.method === 'PUT').flush({ error: 'Regra do servidor.' }, { status: 400, statusText: 'Bad Request' });
    fixture.detectChanges();
    expect(el().querySelector('.alert-danger')!.textContent).toContain('Regra do servidor.');
  });

  it('403 na carga mostra a mensagem do servidor', () => {
    fixture.detectChanges();
    ctrl.expectOne(`${URL}/perfil`).flush({ error: 'Somente administradores.' }, { status: 403, statusText: 'Forbidden' });
    ctrl.match(`${URL}/perfil/opcoes`);
    fixture.detectChanges();
    expect(el().textContent).toContain('Somente administradores.');
  });
});
