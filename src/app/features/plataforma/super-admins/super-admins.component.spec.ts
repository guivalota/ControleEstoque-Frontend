import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Modal } from 'bootstrap';
import { PlataformaSuperAdminsComponent } from './super-admins.component';
import { SenhaProvisoriaModalComponent } from '../../../shared/senha-provisoria-modal/senha-provisoria-modal.component';
import { ConfirmDialogComponent } from '../../imobilizado/shared/confirm-dialog.component';
import { SuperAdmin } from '../../../core/models/plataforma-super-admin.model';

const BASE = '/api/v1/plataforma/super-admins';
const sa = (id: string, extra: Partial<SuperAdmin> = {}): SuperAdmin => ({
  id, nome: `SA ${id}`, email: `${id}@root.com`, ativo: true, criadoEm: '2026-10-22T14:03:11Z', ...extra
});

describe('PlataformaSuperAdminsComponent', () => {
  let fixture: ComponentFixture<PlataformaSuperAdminsComponent>;
  let comp: PlataformaSuperAdminsComponent;
  let ctrl: HttpTestingController;
  const el = () => fixture.nativeElement as HTMLElement;

  beforeEach(() => {
    spyOn(Modal.prototype, 'show');
    spyOn(Modal.prototype, 'hide');
    TestBed.configureTestingModule({ imports: [PlataformaSuperAdminsComponent], providers: [provideHttpClient(), provideHttpClientTesting()] });
    ctrl = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(PlataformaSuperAdminsComponent);
    comp = fixture.componentInstance;
    fixture.detectChanges();
    ctrl.expectOne(BASE).flush([sa('a'), sa('b', { ativo: false })]);
    fixture.detectChanges();
  });
  afterEach(() => ctrl.verify());

  it('lista os super admins', () => {
    expect(el().textContent).toContain('SA a');
    expect(el().textContent).toContain('Inativo');
  });

  it('cria e mostra a senha provisória uma vez', () => {
    const abrir = spyOn(SenhaProvisoriaModalComponent.prototype, 'abrir');
    comp.form.patchValue({ nome: 'Novo', email: 'novo@root.com' });
    comp.criar();
    const req = ctrl.expectOne(BASE);
    expect(req.request.method).toBe('POST');
    req.flush({ superAdmin: sa('n', { nome: 'Novo', email: 'novo@root.com' }), senhaProvisoria: 'Abc123!xyz' });
    expect(abrir).toHaveBeenCalledWith(jasmine.objectContaining({ senha: 'Abc123!xyz' }));
    ctrl.expectOne(BASE).flush([sa('a')]);
  });

  it('mostra a falha genérica de criação como veio do servidor', () => {
    comp.form.patchValue({ nome: 'Novo', email: 'novo@root.com' });
    comp.criar();
    ctrl.expectOne(BASE).flush({ error: 'Não foi possível criar o usuário com esses dados.' }, { status: 400, statusText: 'Bad' });
    expect(comp.erro()).toBe('Não foi possível criar o usuário com esses dados.');
  });

  it('desativar o último SA ou a si mesmo mostra o 400 do servidor', async () => {
    spyOn(ConfirmDialogComponent.prototype, 'abrir').and.resolveTo(true);
    await comp.alternarAtivo(sa('a'));
    const req = ctrl.expectOne(`${BASE}/a/ativo`);
    expect(req.request.body).toEqual({ ativo: false });
    req.flush({ error: 'Não é possível desativar o último super administrador ativo.' }, { status: 400, statusText: 'Bad' });
    fixture.detectChanges();
    expect(el().textContent).toContain('último super administrador ativo');
    expect(comp.lista()[0].ativo).toBeTrue();
  });

  it('ativa sem confirmação e atualiza a linha', async () => {
    const confirma = spyOn(ConfirmDialogComponent.prototype, 'abrir');
    await comp.alternarAtivo(comp.lista()[1]);
    expect(confirma).not.toHaveBeenCalled();
    ctrl.expectOne(`${BASE}/b/ativo`).flush(null, { status: 204, statusText: 'No Content' });
    expect(comp.lista()[1].ativo).toBeTrue();
  });

  it('redefine a senha após confirmar', async () => {
    spyOn(ConfirmDialogComponent.prototype, 'abrir').and.resolveTo(true);
    const abrir = spyOn(SenhaProvisoriaModalComponent.prototype, 'abrir');
    await comp.redefinirSenha(sa('a'));
    ctrl.expectOne(`${BASE}/a/redefinir-senha`).flush({ superAdmin: sa('a'), senhaProvisoria: 'Nova#456' });
    expect(abrir).toHaveBeenCalledWith(jasmine.objectContaining({ senha: 'Nova#456' }));
  });
});
