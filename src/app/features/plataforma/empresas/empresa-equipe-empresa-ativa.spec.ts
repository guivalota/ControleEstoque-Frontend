import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Modal } from 'bootstrap';
import { EmpresaEquipeComponent } from './empresa-equipe.component';
import { EquipeMembro } from '../../../core/models/plataforma-equipe.model';

const BASE = '/api/v1/equipe';
const membro = (id: string, extra: Partial<EquipeMembro> = {}): EquipeMembro => ({
  usuarioId: id, nome: `Pessoa ${id}`, email: `${id}@acme.com`, perfil: 'operador', ativo: true,
  criadoEm: '2026-10-22T14:03:11Z', ...extra
});

/** Mesma tela, sem `empresaId`: é a equipe da empresa ativa para o administrador da empresa (`v1/equipe`). */
describe('EmpresaEquipeComponent — administrador da empresa ativa', () => {
  let fixture: ComponentFixture<EmpresaEquipeComponent>;
  let comp: EmpresaEquipeComponent;
  let ctrl: HttpTestingController;

  const iniciar = (membros: EquipeMembro[] = [membro('a'), membro('b')]) => {
    fixture.detectChanges();
    ctrl.expectOne(BASE).flush(membros);
    ctrl.expectOne(r => r.url === `${BASE}/eventos`).flush({ items: [], page: 1, pageSize: 20, total: 0 });
    fixture.detectChanges();
  };

  beforeEach(() => {
    spyOn(Modal.prototype, 'show');
    spyOn(Modal.prototype, 'hide');
    TestBed.configureTestingModule({
      imports: [EmpresaEquipeComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    ctrl = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(EmpresaEquipeComponent); // sem empresaId
    comp = fixture.componentInstance;
  });

  afterEach(() => ctrl.verify());

  it('carrega equipe e histórico de v1/equipe (nunca da rota da plataforma)', () => {
    iniciar();
    expect((fixture.nativeElement as HTMLElement).querySelectorAll('tbody tr').length).toBeGreaterThanOrEqual(2);
    ctrl.expectNone(r => r.url.includes('/plataforma/'));
  });

  it('cria o membro por POST v1/equipe e abre a senha provisória', () => {
    iniciar([]);
    comp.novo.set(true);
    fixture.detectChanges();
    comp.form.patchValue({ nome: 'Ana', email: 'ana@acme.com', perfil: 'operador' });
    comp.criar();
    const req = ctrl.expectOne(r => r.method === 'POST' && r.url === BASE);
    expect(req.request.body).toEqual({ nome: 'Ana', email: 'ana@acme.com', perfil: 'operador' });
    req.flush({ usuario: membro('n', { nome: 'Ana', email: 'ana@acme.com' }), senhaProvisoria: 'Tmp@12345' });
    ctrl.expectOne(BASE).flush([membro('n')]);
    ctrl.expectOne(r => r.url === `${BASE}/eventos`).flush({ items: [], page: 1, pageSize: 20, total: 0 });
  });

  it('altera o perfil por PUT v1/equipe/{id}/perfil', () => {
    iniciar();
    comp.alterarPerfil(membro('a'), 'leitura');
    const req = ctrl.expectOne(`${BASE}/a/perfil`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ perfil: 'leitura' });
    req.flush(null);
    ctrl.expectOne(r => r.url === `${BASE}/eventos`).flush({ items: [], page: 1, pageSize: 20, total: 0 });
  });

  it('mostra a mensagem do servidor ao recusar (ex.: último administrador)', () => {
    iniciar();
    comp.alterarPerfil(membro('a', { perfil: 'admin' }), 'leitura');
    ctrl.expectOne(`${BASE}/a/perfil`).flush({ error: 'A empresa não pode ficar sem administrador.' }, { status: 400, statusText: 'Bad' });
    expect(comp.erro()).toContain('sem administrador');
  });
});
