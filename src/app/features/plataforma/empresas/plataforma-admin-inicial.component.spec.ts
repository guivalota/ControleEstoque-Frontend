import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Modal } from 'bootstrap';
import { PlataformaAdminInicialComponent } from './plataforma-admin-inicial.component';

const EMPRESA = { id: 7, razaoSocial: 'Acme', cnpj: '11222333000181', ativo: true, criadoEm: '2026-10-26T00:00:00Z' };

describe('PlataformaAdminInicialComponent', () => {
  let fixture: ComponentFixture<PlataformaAdminInicialComponent>;
  let comp: PlataformaAdminInicialComponent;
  let ctrl: HttpTestingController;
  const el = () => fixture.nativeElement as HTMLElement;

  beforeEach(() => {
    spyOn(Modal.prototype, 'show');
    spyOn(Modal.prototype, 'hide');
    TestBed.configureTestingModule({
      imports: [PlataformaAdminInicialComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    ctrl = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(PlataformaAdminInicialComponent);
    comp = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => ctrl.verify());

  it('valida campos obrigatórios e e-mail', () => {
    comp.abrir(EMPRESA);
    comp.form.patchValue({ nome: 'Ana', email: 'invalido' });
    comp.criar();
    ctrl.expectNone('/api/v1/plataforma/empresas/7/admin-inicial');
    expect(comp.msg('email')).toBe('E-mail inválido.');
  });

  it('cria o admin, fecha o formulário e exibe a senha uma única vez no modal compartilhado', () => {
    let criados = 0;
    comp.criado.subscribe(() => criados++);
    comp.abrir(EMPRESA);
    comp.form.patchValue({ nome: 'Ana', email: 'ana@acme.com' });
    comp.criar();
    const req = ctrl.expectOne('/api/v1/plataforma/empresas/7/admin-inicial');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ nome: 'Ana', email: 'ana@acme.com' });
    req.flush({ usuario: { usuarioId: 'u1', nome: 'Ana', email: 'ana@acme.com', ativo: true, criadoEm: '2026-10-26T00:00:00Z' }, senhaProvisoria: 'Abc123!xyz' });
    expect(Modal.prototype.hide).toHaveBeenCalled();

    comp.aoFechar();
    fixture.detectChanges();
    expect((el().querySelector('#senhaProvCampo') as HTMLInputElement).value).toBe('Abc123!xyz');
    expect(criados).toBe(0);

    comp.aoFecharSenha();
    expect(criados).toBe(1);
    // fechar de novo o formulário não reabre a senha
    comp.aoFechar();
    expect(Modal.prototype.show).toHaveBeenCalledTimes(2);
  });

  it('mostra erro do servidor (ex.: empresa sem plano)', () => {
    comp.abrir(EMPRESA);
    comp.form.patchValue({ nome: 'Ana', email: 'ana@acme.com' });
    comp.criar();
    ctrl.expectOne('/api/v1/plataforma/empresas/7/admin-inicial').flush({ error: 'Empresa sem plano.' }, { status: 400, statusText: 'Bad' });
    fixture.detectChanges();
    expect(comp.erro()).toBe('Empresa sem plano.');
    expect(Modal.prototype.hide).not.toHaveBeenCalled();
  });
});
