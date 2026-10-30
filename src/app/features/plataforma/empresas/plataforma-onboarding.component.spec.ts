import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Modal } from 'bootstrap';
import { PlataformaOnboardingComponent } from './plataforma-onboarding.component';

const BASE = '/api/v1/plataforma';
const plano = (id: number, ativo = true) => ({ id, codigo: `p${id}`, nome: `Plano ${id}`, modulos: [], limites: {}, padrao: false, ativo, empresasUsando: 0 });

describe('PlataformaOnboardingComponent', () => {
  let fixture: ComponentFixture<PlataformaOnboardingComponent>;
  let comp: PlataformaOnboardingComponent;
  let ctrl: HttpTestingController;
  const el = () => fixture.nativeElement as HTMLElement;

  beforeEach(() => {
    spyOn(Modal.prototype, 'show');
    spyOn(Modal.prototype, 'hide');
    TestBed.configureTestingModule({ imports: [PlataformaOnboardingComponent], providers: [provideHttpClient(), provideHttpClientTesting()] });
    ctrl = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(PlataformaOnboardingComponent);
    comp = fixture.componentInstance;
    fixture.detectChanges();
    comp.abrir();
    ctrl.expectOne(`${BASE}/planos`).flush([plano(1), plano(2, false)]);
  });
  afterEach(() => ctrl.verify());

  const preencher = (extra: Record<string, unknown> = {}) =>
    comp.form.patchValue({ razaoSocial: 'Cliente Ltda', cnpj: '12.ABC.345/01DE-35', adminNome: 'Ana', adminEmail: 'ana@c.com', ...extra });

  it('lista só planos ativos', () => {
    expect(comp.planos().map(p => p.id)).toEqual([1]);
  });

  it('valida campos antes de enviar', () => {
    comp.criar();
    ctrl.expectNone(`${BASE}/empresas/onboarding`);
    expect(comp.msg('razaoSocial')).toBe('Campo obrigatório.');
    preencher({ cnpj: '11111111111111', adminEmail: 'x' });
    comp.criar();
    ctrl.expectNone(`${BASE}/empresas/onboarding`);
    expect(comp.msg('adminEmail')).toBe('E-mail inválido.');
  });

  it('cria numa chamada e exibe a senha uma vez no modal compartilhado', () => {
    let criada: number | undefined;
    comp.criada.subscribe(r => criada = r.empresaId);
    preencher({ planoId: '1', sincronizarModulos: true });
    comp.criar();
    const req = ctrl.expectOne(`${BASE}/empresas/onboarding`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      razaoSocial: 'Cliente Ltda', cnpj: '12ABC34501DE35', planoId: 1, sincronizarModulos: true,
      admin: { nome: 'Ana', email: 'ana@c.com' }
    });
    req.flush({ empresaId: 17, senhaProvisoria: 'Abc123!xyz' });
    expect(Modal.prototype.hide).toHaveBeenCalled();

    comp.aoFechar();
    fixture.detectChanges();
    expect((el().querySelector('#senhaProvCampo') as HTMLInputElement).value).toBe('Abc123!xyz');
    expect(criada).toBeUndefined();
    comp.aoFecharSenha();
    expect(criada).toBe(17);
  });

  it('sem plano escolhido omite planoId e sincronizarModulos', () => {
    preencher();
    comp.criar();
    const req = ctrl.expectOne(`${BASE}/empresas/onboarding`);
    expect(req.request.body.planoId).toBeUndefined();
    expect(req.request.body.sincronizarModulos).toBeUndefined();
    req.flush({ empresaId: 1, senhaProvisoria: 'x' });
  });

  it('exibe o 400 do servidor como veio', () => {
    preencher();
    comp.criar();
    ctrl.expectOne(`${BASE}/empresas/onboarding`).flush({ error: 'Não foi possível criar o usuário com esses dados.' }, { status: 400, statusText: 'Bad' });
    expect(comp.erro()).toBe('Não foi possível criar o usuário com esses dados.');
    expect(Modal.prototype.hide).not.toHaveBeenCalled();
  });
});
