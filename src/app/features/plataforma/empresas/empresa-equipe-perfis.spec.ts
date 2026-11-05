import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Modal } from 'bootstrap';
import { provideAuthFake } from '../../../testing/auth-fake';
import { EmpresaAtivaService } from '../../../core/services/empresa-ativa.service';
import { EmpresaEquipeComponent } from './empresa-equipe.component';
import { EquipeMembro } from '../../../core/models/plataforma-equipe.model';
import { PerfilAcesso } from '../../../core/models/perfil-acesso.model';

const BASE = '/api/v1/equipe';
const perfil = (id: number, nome: string, modelo: string | null = null, extra: Partial<PerfilAcesso> = {}): PerfilAcesso => ({
  id, nome, descricao: null, sistema: modelo !== null, modelo, todasPermissoes: false, ativo: true, usuarios: 1, totalPermissoes: 5, ...extra
});
const PERFIS = [perfil(1, 'Administrador', 'administrador', { todasPermissoes: true }), perfil(2, 'Operador', 'operador'),
  perfil(3, 'Leitura', 'leitura'), perfil(4, 'Caixa'), perfil(5, 'Antigo', null, { ativo: false })];
const membro = (id: string, extra: Partial<EquipeMembro> = {}): EquipeMembro => ({
  usuarioId: id, nome: `Pessoa ${id}`, email: `${id}@acme.com`, perfil: 'operador', perfilId: 2, perfilNome: 'Operador', modulos: null,
  ativo: true, criadoEm: '2026-10-22T14:03:11Z', ...extra
});

/** Equipe da empresa com perfis de acesso (E25): seletor por perfil e módulos por usuário. */
describe('EmpresaEquipeComponent — perfis e módulos', () => {
  let fixture: ComponentFixture<EmpresaEquipeComponent>;
  let comp: EmpresaEquipeComponent;
  let ctrl: HttpTestingController;

  function iniciar(permissoes: string[], membros: EquipeMembro[] = [membro('a')]) {
    spyOn(Modal.prototype, 'show');
    spyOn(Modal.prototype, 'hide');
    TestBed.configureTestingModule({ imports: [EmpresaEquipeComponent], providers: [provideHttpClient(), provideHttpClientTesting(), provideAuthFake('admin')] });
    const empresa = TestBed.inject(EmpresaAtivaService);
    empresa.empresas.set([{ id: 1, razaoSocial: 'X', cnpj: '', ativo: true, criadoEm: '', perfil: 'admin', modulos: ['estoque', 'imobilizado'], permissoes }]);
    empresa.id.set(1);
    ctrl = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(EmpresaEquipeComponent);
    comp = fixture.componentInstance;
    fixture.detectChanges();
    if (permissoes.includes('core.acesso.ver')) ctrl.expectOne('/api/v1/perfis').flush(PERFIS);
    ctrl.expectOne(BASE).flush(membros);
    ctrl.expectOne(r => r.url === `${BASE}/eventos`).flush({ items: [], page: 1, pageSize: 20, total: 0 });
    fixture.detectChanges();
  }
  const el = () => fixture.nativeElement as HTMLElement;
  const recarregar = (membros: EquipeMembro[]) => {
    ctrl.expectOne(BASE).flush(membros);
    ctrl.expectOne(r => r.url === `${BASE}/eventos`).flush({ items: [], page: 1, pageSize: 20, total: 0 });
  };

  afterEach(() => ctrl.verify());

  it('oferece só os perfis ativos da empresa no seletor de cada pessoa', () => {
    iniciar(['core.equipe.ver', 'core.acesso.ver', 'core.acesso.gerir']);

    const opcoes = Array.from(el().querySelectorAll('select[aria-label="Perfil de Pessoa a"] option')).map(o => o.textContent!.trim());
    expect(opcoes).toEqual(['Administrador', 'Operador', 'Leitura', 'Caixa']);
  });

  it('trocar o perfil envia perfilId por PUT v1/equipe/{id}/perfil e recarrega', () => {
    iniciar(['core.equipe.ver', 'core.acesso.ver', 'core.acesso.gerir']);

    comp.alterarPerfilId(membro('a'), 4);
    const req = ctrl.expectOne(`${BASE}/a/perfil`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ perfilId: 4 });
    req.flush(null);
    recarregar([membro('a', { perfilId: 4, perfilNome: 'Caixa' })]);
  });

  it('mostra a mensagem do servidor (ex.: último administrador) e volta o seletor', () => {
    iniciar(['core.equipe.ver', 'core.acesso.ver', 'core.acesso.gerir']);
    const select = el().querySelector<HTMLSelectElement>('select[aria-label="Perfil de Pessoa a"]')!;

    comp.alterarPerfilId(membro('a'), 3, select);
    ctrl.expectOne(`${BASE}/a/perfil`).flush({ error: 'A empresa precisa de ao menos um Administrador ativo.' }, { status: 400, statusText: 'Bad Request' });
    fixture.detectChanges();

    expect(el().textContent).toContain('ao menos um Administrador');
    expect(select.value).toBe('2');
  });

  it('cria o membro com perfilId do perfil escolhido (padrão: Leitura)', () => {
    iniciar(['core.equipe.ver', 'core.acesso.ver', 'core.acesso.gerir'], []);
    comp.novo.set(true);
    fixture.detectChanges();

    expect(comp.form.controls.perfilId.value).toBe(3);
    comp.form.patchValue({ nome: 'Ana', email: 'ana@acme.com', perfilId: 4 });
    comp.criar();
    const req = ctrl.expectOne(r => r.method === 'POST' && r.url === BASE);
    expect(req.request.body).toEqual({ nome: 'Ana', email: 'ana@acme.com', perfil: 'leitura', perfilId: 4 });
    req.flush({ usuario: membro('n'), senhaProvisoria: 'Tmp@12345' });
    recarregar([membro('n')]);
  });

  it('sem core.acesso.ver não carrega perfis e mantém o seletor legado', () => {
    iniciar(['core.equipe.ver']);

    ctrl.expectNone('/api/v1/perfis');
    const opcoes = Array.from(el().querySelectorAll('select[aria-label="Perfil de Pessoa a"] option')).map(o => o.textContent!.trim());
    expect(opcoes.length).toBe(4);
    expect(el().textContent).not.toContain('Módulos');
  });

  it('com core.acesso.gerir mostra os módulos de cada pessoa ("Todos" quando nulo)', () => {
    iniciar(['core.equipe.ver', 'core.acesso.ver', 'core.acesso.gerir'], [membro('a'), membro('b', { modulos: ['estoque'] })]);

    expect(el().textContent).toContain('Módulos');
    const celulas = Array.from(el().querySelectorAll('tbody tr')).map(tr => tr.textContent);
    expect(celulas[0]).toContain('Todos');
    expect(celulas[1]).toContain('Estoque');
  });

  it('define os módulos por PUT v1/equipe/{id}/modulos', () => {
    iniciar(['core.equipe.ver', 'core.acesso.ver', 'core.acesso.gerir']);

    comp.editarModulos(membro('a'));
    comp.todosModulos.set(false);
    comp.alternarModulo('imobilizado'); // começou com todos marcados; desmarca o Imobilizado
    comp.salvarModulos(membro('a'));
    const req = ctrl.expectOne(`${BASE}/a/modulos`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ modulos: ['estoque'] });
    req.flush(null);
    ctrl.expectOne(r => r.url === `${BASE}/eventos`).flush({ items: [], page: 1, pageSize: 20, total: 0 });

    expect(comp.membros()[0].modulos).toEqual(['estoque']);
  });

  it('"Todos os da empresa" envia modulos nulo', () => {
    iniciar(['core.equipe.ver', 'core.acesso.ver', 'core.acesso.gerir'], [membro('a', { modulos: ['estoque'] })]);

    comp.editarModulos(membro('a', { modulos: ['estoque'] }));
    comp.todosModulos.set(true);
    comp.salvarModulos(membro('a'));
    const req = ctrl.expectOne(`${BASE}/a/modulos`);
    expect(req.request.body).toEqual({ modulos: null });
    req.flush(null);
    ctrl.expectOne(r => r.url === `${BASE}/eventos`).flush({ items: [], page: 1, pageSize: 20, total: 0 });
  });

  it('não deixa salvar sem nenhum módulo marcado', () => {
    iniciar(['core.equipe.ver', 'core.acesso.ver', 'core.acesso.gerir']);

    comp.editarModulos(membro('a'));
    comp.todosModulos.set(false);
    comp.modulosSel.set([]);
    comp.salvarModulos(membro('a'));

    ctrl.expectNone(`${BASE}/a/modulos`);
    expect(comp.erro()).toContain('ao menos um módulo');
  });
});
