import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { ImobInventarioFormComponent } from './imob-inventario-form.component';
import { EmpresaAtivaService } from '../../../core/services/empresa-ativa.service';
import { ImobInventario } from '../../../core/models/imob-inventario.model';
import { provideAuthFake } from '../../../testing/auth-fake';

const INV = '/api/v1/imobilizado/inventarios';
const ARVORE = '/api/v1/imobilizado/locais/arvore';
const USUARIOS = '/api/v1/empresa-ativa/usuarios';

const arvore = [
  { id: 1, nome: 'Matriz', codigo: null, localPaiId: null, ativo: true, filhos: [{ id: 2, nome: 'Andar 1', codigo: null, localPaiId: 1, ativo: true, filhos: [] }] },
  { id: 9, nome: 'Filial', codigo: null, localPaiId: null, ativo: true, filhos: [] }
];
const usuarios = {
  items: [
    { id: 'u-1', nome: 'Carlos Contador', email: 'c@x.com', perfil: 'leitura', perfilEfetivo: 'operador', ativo: true },
    { id: 'u-2', nome: 'Beatriz Auditora', email: 'b@x.com', perfil: 'leitura', perfilEfetivo: 'leitura', ativo: true }
  ],
  page: 1, pageSize: 100, total: 2
};

const inv = (extra: Partial<ImobInventario> = {}): ImobInventario => ({
  id: 7, nome: 'Anual', descricao: 'Geral', status: 'rascunho', dataInicio: null, dataFim: null, criadoPorId: 'x',
  criadoPorNome: 'Maria', criadoEm: '2026-10-20T09:00:00Z', atualizadoEm: '2026-10-20T09:00:00Z', totalLocais: 1, totalEsperados: 0, reavaliacao: false,
  locais: [{ localId: 1, localNome: 'Matriz' }], equipe: [{ usuarioId: 'u-1', nome: 'Carlos Contador' }, { usuarioId: 'u-9', nome: 'Ex-membro' }],
  ...extra
});

describe('ImobInventarioFormComponent', () => {
  let fixture: ComponentFixture<ImobInventarioFormComponent>;
  let comp: ImobInventarioFormComponent;
  let ctrl: HttpTestingController;
  let navegar: jasmine.Spy;
  const el = () => fixture.nativeElement as HTMLElement;
  const texto = () => (el().textContent ?? '').replace(/\s+/g, ' ');

  /** `id` presente = edição; o admin carrega os usuários da empresa 1. */
  function montar(role: 'admin' | 'operador' = 'admin', id: string | null = null, inventario?: ImobInventario) {
    TestBed.configureTestingModule({
      imports: [ImobInventarioFormComponent],
      providers: [
        provideRouter([]), provideHttpClient(), provideHttpClientTesting(), provideAuthFake(role),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap(id ? { id } : {}) } } }
      ]
    });
    TestBed.inject(EmpresaAtivaService).id.set(1);
    ctrl = TestBed.inject(HttpTestingController);
    navegar = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    fixture = TestBed.createComponent(ImobInventarioFormComponent);
    comp = fixture.componentInstance;
    fixture.detectChanges();
    ctrl.expectOne(ARVORE).flush(arvore);
    if (role === 'admin') {
      const reqUsuarios = ctrl.expectOne(r => r.url === USUARIOS);
      expect(reqUsuarios.request.params.get('ativo')).toBe('true');
      expect(reqUsuarios.request.params.get('pageSize')).toBe('100');
      reqUsuarios.flush(usuarios);
    }
    if (id) ctrl.expectOne(`${INV}/${id}`).flush(inventario ?? inv());
    else ctrl.expectNone(r => r.url.startsWith(`${INV}/`));
    fixture.detectChanges();
  }

  afterEach(() => ctrl.verify());

  describe('cadastro', () => {
    beforeEach(() => montar());

    it('não envia vazio e pede nome e ao menos um local', () => {
      comp.save();
      ctrl.expectNone(r => r.method === 'POST');
      expect(comp.erroNome()).toBe('Campo obrigatório.');
      expect(comp.erroLocais()).toBe('Selecione ao menos um local.');
    });

    it('lista os usuários ativos da empresa ativa (ativo=true, pageSize 100) para a equipe', () => {
      expect(texto()).toContain('Carlos Contador');
      expect(texto()).toContain('Beatriz Auditora');
      expect(texto()).not.toContain('Inativo');
    });

    it('envia nome sem espaços, locais e equipe e vai para o detalhe', () => {
      comp.form.patchValue({ nome: '  Anual  ', descricao: '  ', localIds: [1, 9] });
      comp.alternarMembro('u-2', true);
      comp.save();
      const req = ctrl.expectOne(r => r.method === 'POST' && r.url === INV);
      expect(req.request.body).toEqual({ nome: 'Anual', descricao: undefined, localIds: [1, 9], usuarioIds: ['u-2'], reavaliacao: false, dataBase: undefined });
      req.flush(inv({ id: 55 }), { status: 201, statusText: 'Created' });
      expect(navegar).toHaveBeenCalledWith(['/imobilizado/inventarios', 55]);
    });

    it('ciclo de reavaliação exige a data-base e a envia', () => {
      comp.form.patchValue({ nome: 'Ciclo 2026', localIds: [1], reavaliacao: true });
      fixture.detectChanges();
      expect(el().querySelector('#invDataBase')).not.toBeNull();
      comp.save();
      ctrl.expectNone(r => r.method === 'POST');
      expect(comp.erroDataBase()).toBe('Informe a data-base.');

      comp.form.patchValue({ dataBase: '2026-09-30' });
      comp.save();
      const req = ctrl.expectOne(r => r.method === 'POST' && r.url === INV);
      expect(req.request.body.reavaliacao).toBeTrue();
      expect(req.request.body.dataBase).toBe('2026-09-30');
      req.flush(inv({ id: 56, reavaliacao: true, dataBase: '2026-09-30' }), { status: 201, statusText: 'Created' });
    });

    it('inventário comum não mostra nem envia data-base', () => {
      expect(el().querySelector('#invDataBase')).toBeNull();
    });

    it('nome duplicado do servidor aparece no campo', () => {
      comp.form.patchValue({ nome: 'Anual', localIds: [1] });
      comp.save();
      ctrl.expectOne(INV).flush({ error: 'Já existe um inventário com o nome informado.' }, { status: 400, statusText: 'Bad Request' });
      fixture.detectChanges();
      expect(comp.erroNome()).toBe('Já existe um inventário com o nome informado.');
      expect(comp.saving()).toBeFalse();
    });

    it('erro geral do servidor aparece no topo', () => {
      comp.form.patchValue({ nome: 'Anual', localIds: [1] });
      comp.save();
      ctrl.expectOne(INV).flush({ error: 'Usuário sem vínculo ativo com a empresa.' }, { status: 400, statusText: 'Bad Request' });
      fixture.detectChanges();
      expect(texto()).toContain('Usuário sem vínculo ativo com a empresa.');
    });
  });

  describe('edição', () => {
    it('rascunho carrega os valores e salva tudo com PUT', () => {
      montar('admin', '7');
      expect(comp.form.value.nome).toBe('Anual');
      expect(comp.form.controls.localIds.enabled).toBeTrue();
      // o ex-membro (sem vínculo atual) continua listado para poder ser removido
      expect(texto()).toContain('Ex-membro');

      comp.alternarMembro('u-9', false);
      comp.form.patchValue({ localIds: [1, 9] });
      comp.save();
      const req = ctrl.expectOne(r => r.method === 'PUT' && r.url === `${INV}/7`);
      expect(req.request.body.localIds).toEqual([1, 9]);
      expect(req.request.body.usuarioIds).toEqual(['u-1']);
      req.flush(inv());
      expect(navegar).toHaveBeenCalledWith(['/imobilizado/inventarios', 7]);
    });

    it('em andamento: escopo bloqueado (mas enviado igual ao atual), nome e equipe editáveis', () => {
      montar('admin', '7', inv({ status: 'em_andamento' }));
      expect(comp.form.controls.localIds.disabled).toBeTrue();
      expect(texto()).toContain('O escopo (locais) não pode ser alterado');

      comp.form.patchValue({ nome: 'Anual revisado' });
      comp.alternarMembro('u-2', true);
      comp.save();
      const req = ctrl.expectOne(r => r.method === 'PUT');
      expect(req.request.body.localIds).toEqual([1]);
      expect(req.request.body.nome).toBe('Anual revisado');
      expect(req.request.body.usuarioIds).toEqual(['u-1', 'u-9', 'u-2']);
      req.flush(inv({ status: 'em_andamento' }));
    });

    it('concluído ou cancelado não pode ser editado', () => {
      montar('admin', '7', inv({ status: 'concluido' }));
      expect(comp.form.disabled).toBeTrue();
      expect(texto()).toContain('não podem ser editados');
      const salvar = Array.from(el().querySelectorAll('button')).find(b => b.textContent?.includes('Salvar'))!;
      expect(salvar.disabled).toBeTrue();
    });

    it('operador não lista usuários da empresa e a equipe atual é preservada no envio', () => {
      montar('operador', '7');
      expect(texto()).toContain('Carlos Contador');
      expect(texto()).toContain('só pode ser alterada por um administrador');
      expect(el().querySelector('input[id^="invEq-"]')).toBeNull();

      comp.save();
      const req = ctrl.expectOne(r => r.method === 'PUT');
      expect(req.request.body.usuarioIds).toEqual(['u-1', 'u-9']);
      req.flush(inv());
    });

    it('404 mostra "não encontrado"', () => {
      TestBed.configureTestingModule({
        imports: [ImobInventarioFormComponent],
        providers: [
          provideRouter([]), provideHttpClient(), provideHttpClientTesting(), provideAuthFake('operador'),
          { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: '7' }) } } }
        ]
      });
      ctrl = TestBed.inject(HttpTestingController);
      fixture = TestBed.createComponent(ImobInventarioFormComponent);
      fixture.detectChanges();
      ctrl.expectOne(ARVORE).flush(arvore);
      ctrl.expectOne(`${INV}/7`).flush({ error: 'x' }, { status: 404, statusText: 'Not Found' });
      fixture.detectChanges();
      expect(texto()).toContain('Inventário não encontrado nesta empresa.');
    });
  });
});
