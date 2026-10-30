import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Modal } from 'bootstrap';
import { EmpresaEquipeComponent } from './empresa-equipe.component';
import { SenhaProvisoriaModalComponent } from '../../../shared/senha-provisoria-modal/senha-provisoria-modal.component';
import { ConfirmDialogComponent } from '../../imobilizado/shared/confirm-dialog.component';
import { EquipeMembro } from '../../../core/models/plataforma-equipe.model';

const BASE = '/api/v1/plataforma/empresas/5/equipe';
const membro = (id: string, extra: Partial<EquipeMembro> = {}): EquipeMembro => ({
  usuarioId: id, nome: `Pessoa ${id}`, email: `${id}@acme.com`, perfil: 'operador', ativo: true,
  criadoEm: '2026-10-22T14:03:11Z', ...extra
});

describe('EmpresaEquipeComponent', () => {
  let fixture: ComponentFixture<EmpresaEquipeComponent>;
  let comp: EmpresaEquipeComponent;
  let ctrl: HttpTestingController;
  const el = () => fixture.nativeElement as HTMLElement;

  const iniciar = (membros: EquipeMembro[] = [membro('a'), membro('b')]) => {
    fixture.detectChanges();
    ctrl.expectOne(BASE).flush(membros);
    ctrl.expectOne(r => r.url === `${BASE}/eventos`).flush({ items: [], page: 1, pageSize: 20, total: 0 });
    fixture.detectChanges();
  };
  const reload = () => {
    ctrl.expectOne(BASE).flush([membro('a'), membro('b')]);
    ctrl.expectOne(r => r.url === `${BASE}/eventos`).flush({ items: [], page: 1, pageSize: 20, total: 0 });
  };

  beforeEach(() => {
    spyOn(Modal.prototype, 'show');
    spyOn(Modal.prototype, 'hide');
    TestBed.configureTestingModule({
      imports: [EmpresaEquipeComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    ctrl = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(EmpresaEquipeComponent);
    fixture.componentRef.setInput('empresaId', 5);
    comp = fixture.componentInstance;
  });

  afterEach(() => ctrl.verify());

  it('lista membros e histórico', () => {
    fixture.detectChanges();
    ctrl.expectOne(BASE).flush([membro('a'), membro('b', { ativo: false })]);
    ctrl.expectOne(r => r.url === `${BASE}/eventos`).flush({
      items: [{ id: 1, acao: 'equipe.criar', detalhe: 'x', atorUsuarioId: 'g', atorNome: 'Root', alvoUsuarioId: 'a', alvoNome: 'Pessoa a', criadoEm: '2026-10-22T14:03:11Z' }],
      page: 1, pageSize: 20, total: 1
    });
    fixture.detectChanges();
    expect(el().textContent).toContain('Pessoa a');
    expect(el().textContent).toContain('Inativo');
    expect(el().textContent).toContain('equipe.criar');
    expect(el().textContent).toContain('Root');
  });

  it('cria membro e mostra a senha provisória uma vez no modal compartilhado', () => {
    iniciar();
    const abrir = spyOn(SenhaProvisoriaModalComponent.prototype, 'abrir');
    comp.form.patchValue({ nome: 'Nova', email: 'nova@acme.com', perfil: 'admin' });
    comp.criar();
    const req = ctrl.expectOne(BASE);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ nome: 'Nova', email: 'nova@acme.com', perfil: 'admin' });
    req.flush({ usuario: membro('n', { nome: 'Nova', email: 'nova@acme.com' }), senhaProvisoria: 'Abc123!xyz' });
    expect(abrir).toHaveBeenCalledWith(jasmine.objectContaining({ senha: 'Abc123!xyz' }));
    reload();
  });

  it('exibe o erro do servidor ao criar (limite do plano)', () => {
    iniciar();
    comp.form.patchValue({ nome: 'Nova', email: 'nova@acme.com' });
    comp.criar();
    ctrl.expectOne(BASE).flush({ error: 'Limite do plano atingido: no máximo 5 usuários (em uso: 5).' }, { status: 400, statusText: 'Bad' });
    fixture.detectChanges();
    expect(comp.erro()).toContain('Limite do plano atingido');
    expect(comp.salvando()).toBeFalse();
  });

  it('altera o perfil inline e reverte o select em caso de erro', () => {
    iniciar();
    const select = document.createElement('select');
    select.innerHTML = '<option value="operador">operador</option><option value="admin">admin</option>';
    select.value = 'admin';
    comp.alterarPerfil(membro('a'), 'admin', select);
    const put = ctrl.expectOne(`${BASE}/a/perfil`);
    expect(put.request.method).toBe('PUT');
    expect(put.request.body).toEqual({ perfil: 'admin' });
    put.flush(null, { status: 204, statusText: 'No Content' });
    expect(comp.membros()[0].perfil).toBe('admin');
    expect(comp.feedback()).toContain('Pessoa a');
    expect(comp.feedback()).toContain('Administrador');
    ctrl.expectOne(r => r.url === `${BASE}/eventos`).flush({ items: [], page: 1, pageSize: 20, total: 0 });

    select.value = 'leitura';
    comp.alterarPerfil(membro('b'), 'leitura', select);
    ctrl.expectOne(`${BASE}/b/perfil`).flush({ error: 'Não é possível rebaixar o último administrador.' }, { status: 400, statusText: 'Bad' });
    expect(comp.erro()).toContain('último administrador');
    expect(select.value).toBe('operador');
  });

  it('redefine a senha após confirmar e mostra a nova senha', async () => {
    iniciar();
    spyOn(ConfirmDialogComponent.prototype, 'abrir').and.resolveTo(true);
    const abrir = spyOn(SenhaProvisoriaModalComponent.prototype, 'abrir');
    const p = comp.redefinirSenha(membro('a'));
    await Promise.resolve();
    await p;
    const req = ctrl.expectOne(`${BASE}/a/redefinir-senha`);
    expect(req.request.method).toBe('POST');
    req.flush({ usuario: membro('a'), senhaProvisoria: 'Nova#456' });
    expect(abrir).toHaveBeenCalledWith(jasmine.objectContaining({ senha: 'Nova#456' }));
    ctrl.expectOne(r => r.url === `${BASE}/eventos`).flush({ items: [], page: 1, pageSize: 20, total: 0 });
  });

  it('não redefine se o usuário cancelar', async () => {
    iniciar();
    spyOn(ConfirmDialogComponent.prototype, 'abrir').and.resolveTo(false);
    await comp.redefinirSenha(membro('a'));
    ctrl.expectNone(`${BASE}/a/redefinir-senha`);
    expect(comp.agindo()).toBeNull();
  });

  it('desativa e mostra o 400 do servidor (último admin)', async () => {
    iniciar();
    spyOn(ConfirmDialogComponent.prototype, 'abrir').and.resolveTo(true);
    await comp.alternarAtivo(membro('a'));
    const req = ctrl.expectOne(`${BASE}/a/ativo`);
    expect(req.request.body).toEqual({ ativo: false });
    req.flush({ error: 'A empresa precisa manter ao menos um administrador ativo.' }, { status: 400, statusText: 'Bad' });
    fixture.detectChanges();
    expect(el().textContent).toContain('ao menos um administrador ativo');
    expect(comp.membros()[0].ativo).toBeTrue();
  });

  it('ativa sem pedir confirmação e atualiza a linha', async () => {
    iniciar([membro('a', { ativo: false })]);
    const confirma = spyOn(ConfirmDialogComponent.prototype, 'abrir');
    await comp.alternarAtivo(comp.membros()[0]);
    expect(confirma).not.toHaveBeenCalled();
    ctrl.expectOne(`${BASE}/a/ativo`).flush(null, { status: 204, statusText: 'No Content' });
    expect(comp.membros()[0].ativo).toBeTrue();
    ctrl.expectOne(r => r.url === `${BASE}/eventos`).flush({ items: [], page: 1, pageSize: 20, total: 0 });
  });
});
