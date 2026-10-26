import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { Modal } from 'bootstrap';
import { ImobEmpresasComponent } from './imob-empresas.component';
import { ConfirmDialogComponent } from '../shared/confirm-dialog.component';
import { ImobEmpresa } from '../../../core/models/imob-empresa.model';

const BASE = '/api/v1/imobilizado/empresas';

const empresa = (id: number, extra: Partial<ImobEmpresa> = {}): ImobEmpresa => ({
  id, razaoSocial: `Empresa ${id} Ltda`, nomeFantasia: null, cnpj: '11222333000181', ativo: true,
  criadoEm: '2026-10-22T14:03:11Z', ...extra
});

describe('ImobEmpresasComponent', () => {
  let fixture: ComponentFixture<ImobEmpresasComponent>;
  let comp: ImobEmpresasComponent;
  let ctrl: HttpTestingController;
  const el = () => fixture.nativeElement as HTMLElement;

  const listagem = () => ctrl.expectOne(r => r.url === BASE && r.method === 'GET');
  const responderLista = (items: ImobEmpresa[], req: TestRequest = listagem()) =>
    req.flush({ items, page: 1, pageSize: 50, total: items.length });

  beforeEach(() => {
    // a animação do modal terminaria após o teste destruir o componente
    spyOn(Modal.prototype, 'show');
    spyOn(Modal.prototype, 'hide');
    TestBed.configureTestingModule({
      imports: [ImobEmpresasComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()]
    });
    ctrl = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ImobEmpresasComponent);
    comp = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => ctrl.verify());

  function preencher(razao: string, cnpj: string) {
    comp.openCreate();
    comp.form.patchValue({ razaoSocial: razao, cnpj });
  }

  it('mostra carregando e depois as empresas com CNPJ formatado e situação', () => {
    expect(el().textContent).toContain('Carregando');
    responderLista([empresa(1), empresa(2, { ativo: false, nomeFantasia: 'Beta' })]);
    fixture.detectChanges();
    expect(el().textContent).toContain('11.222.333/0001-81');
    expect(el().textContent).toContain('Beta');
    expect(el().textContent).toContain('Ativa');
    expect(el().textContent).toContain('Inativa');
  });

  it('mostra estado vazio', () => {
    responderLista([]);
    fixture.detectChanges();
    expect(el().textContent).toContain('Nenhuma empresa cadastrada');
  });

  it('mostra erro de carregamento com nova tentativa', () => {
    listagem().flush({}, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();
    expect(el().textContent).toContain('Erro ao carregar empresas');
    expect(el().textContent).toContain('Tentar novamente');
  });

  it('não envia o formulário com CNPJ de dígito verificador inválido', () => {
    responderLista([]);
    preencher('Alfa Ltda', '11.222.333/0001-82');
    comp.save();
    ctrl.expectNone(r => r.method === 'POST');
    expect(comp.erroCampo('cnpj')).toContain('CNPJ inválido');
  });

  it('não envia sem razão social', () => {
    responderLista([]);
    preencher('', '11.222.333/0001-81');
    comp.save();
    ctrl.expectNone(r => r.method === 'POST');
    expect(comp.erroCampo('razaoSocial')).toBe('Campo obrigatório.');
  });

  it('aplica a máscara ao digitar o CNPJ', () => {
    responderLista([]);
    comp.openCreate();
    comp.form.controls.cnpj.setValue('11222333000181');
    comp.onCnpjInput();
    expect(comp.form.controls.cnpj.value).toBe('11.222.333/0001-81');
  });

  it('cria a empresa e recarrega as listas', () => {
    responderLista([]);
    preencher('  Alfa Ltda ', '11.222.333/0001-81');
    comp.save();
    const post = ctrl.expectOne(r => r.method === 'POST' && r.url === BASE);
    expect(post.request.body).toEqual({ razaoSocial: 'Alfa Ltda', nomeFantasia: undefined, cnpj: '11.222.333/0001-81' });
    post.flush(empresa(9), { status: 201, statusText: 'Created' });

    expect(comp.saving()).toBeFalse();
    expect(comp.feedback()).toContain('Empresa criada');
    responderLista([empresa(9)]);
    ctrl.expectOne('/api/v1/imobilizado/minhas-empresas').flush([]);
  });

  it('mostra o erro de regra de negócio do servidor no formulário', () => {
    responderLista([]);
    preencher('Alfa Ltda', '11.222.333/0001-81');
    comp.save();
    ctrl.expectOne(r => r.method === 'POST').flush({ error: 'CNPJ já cadastrado.' }, { status: 400, statusText: 'Bad Request' });
    expect(comp.saveError()).toBe('CNPJ já cadastrado.');
    expect(comp.saving()).toBeFalse();
  });

  it('mapeia erros de validação do ASP.NET para os campos', () => {
    responderLista([]);
    preencher('Alfa Ltda', '11.222.333/0001-81');
    comp.save();
    ctrl.expectOne(r => r.method === 'POST').flush(
      { errors: { RazaoSocial: ['Razão social inválida.'] } }, { status: 400, statusText: 'Bad Request' });
    expect(comp.erroCampo('razaoSocial')).toBe('Razão social inválida.');
  });

  it('edita enviando o corpo completo com ativo', () => {
    responderLista([empresa(4, { nomeFantasia: 'Delta' })]);
    comp.openEdit(empresa(4, { nomeFantasia: 'Delta' }));
    comp.form.patchValue({ ativo: false });
    comp.save();
    const put = ctrl.expectOne(r => r.method === 'PUT' && r.url === `${BASE}/4`);
    expect(put.request.body).toEqual({
      razaoSocial: 'Empresa 4 Ltda', nomeFantasia: 'Delta', cnpj: '11.222.333/0001-81', ativo: false
    });
    put.flush(empresa(4, { ativo: false }));
    responderLista([]);
    ctrl.expectOne('/api/v1/imobilizado/minhas-empresas').flush([]);
  });

  it('desativar pede confirmação e só então envia PUT com ativo=false', async () => {
    responderLista([empresa(5)]);
    const abrir = spyOn(ConfirmDialogComponent.prototype, 'abrir').and.resolveTo(true);
    await comp.alternarAtivo(empresa(5));
    expect(abrir).toHaveBeenCalled();
    const put = ctrl.expectOne(r => r.method === 'PUT' && r.url === `${BASE}/5`);
    expect(put.request.body.ativo).toBeFalse();
    put.flush(empresa(5, { ativo: false }));
    responderLista([empresa(5, { ativo: false })]);
    ctrl.expectOne('/api/v1/imobilizado/minhas-empresas').flush([]);
  });

  it('desativar cancelado não faz requisição', async () => {
    responderLista([empresa(5)]);
    spyOn(ConfirmDialogComponent.prototype, 'abrir').and.resolveTo(false);
    await comp.alternarAtivo(empresa(5));
    ctrl.expectNone(r => r.method === 'PUT');
    expect(comp.agindo()).toBeNull();
  });

  it('ativar uma empresa inativa não pede confirmação', async () => {
    responderLista([empresa(6, { ativo: false })]);
    const abrir = spyOn(ConfirmDialogComponent.prototype, 'abrir');
    await comp.alternarAtivo(empresa(6, { ativo: false }));
    expect(abrir).not.toHaveBeenCalled();
    const put = ctrl.expectOne(r => r.method === 'PUT' && r.url === `${BASE}/6`);
    expect(put.request.body.ativo).toBeTrue();
    put.flush(empresa(6));
    responderLista([empresa(6)]);
    ctrl.expectOne('/api/v1/imobilizado/minhas-empresas').flush([]);
  });

  it('excluir confirma e envia DELETE; cancelado não envia', async () => {
    responderLista([empresa(7)]);
    const abrir = spyOn(ConfirmDialogComponent.prototype, 'abrir').and.resolveTo(false);
    await comp.excluir(empresa(7));
    ctrl.expectNone(r => r.method === 'DELETE');

    abrir.and.resolveTo(true);
    await comp.excluir(empresa(7));
    ctrl.expectOne(r => r.method === 'DELETE' && r.url === `${BASE}/7`).flush(null, { status: 204, statusText: 'No Content' });
    responderLista([]);
    ctrl.expectOne('/api/v1/imobilizado/minhas-empresas').flush([]);
    expect(comp.feedback()).toBe('Empresa excluída.');
  });
});
