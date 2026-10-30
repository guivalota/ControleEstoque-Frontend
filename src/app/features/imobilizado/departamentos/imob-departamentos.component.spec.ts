import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { Modal } from 'bootstrap';
import { ImobDepartamentosComponent } from './imob-departamentos.component';
import { ConfirmDialogComponent } from '../shared/confirm-dialog.component';
import { ImobDepartamento } from '../../../core/models/imob-departamento.model';
import { provideAuthFake } from '../../../testing/auth-fake';

const BASE = '/api/v1/imobilizado/departamentos';

const dep = (id: number, codigo: string, nome: string, ativo = true): ImobDepartamento => ({
  id, codigo, nome, ativo, criadoEm: '2026-10-27T14:03:11Z'
});

describe('ImobDepartamentosComponent', () => {
  let fixture: ComponentFixture<ImobDepartamentosComponent>;
  let comp: ImobDepartamentosComponent;
  let ctrl: HttpTestingController;
  const el = () => fixture.nativeElement as HTMLElement;
  const botaoNovo = () => Array.from(el().querySelectorAll('button')).some(b => b.textContent?.includes('Novo departamento'));

  const listagem = () => ctrl.expectOne(r => r.url === BASE && r.method === 'GET');
  const responder = (items: ImobDepartamento[], req: TestRequest = listagem()) =>
    req.flush({ items, page: 1, pageSize: 50, total: items.length });

  function montar(role: 'admin' | 'operador' | 'leitura' = 'admin', itens = [dep(1, 'TI', 'Tecnologia'), dep(2, 'ADM', 'Administrativo', false)]) {
    spyOn(Modal.prototype, 'show');
    spyOn(Modal.prototype, 'hide');
    TestBed.configureTestingModule({
      imports: [ImobDepartamentosComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), provideAuthFake(role)]
    });
    ctrl = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ImobDepartamentosComponent);
    comp = fixture.componentInstance;
    fixture.detectChanges();
    const req = listagem();
    expect(req.request.params.get('page')).toBe('1');
    expect(req.request.params.get('pageSize')).toBe('50');
    responder(itens, req);
    fixture.detectChanges();
  }

  afterEach(() => ctrl.verify());

  describe('lista', () => {
    beforeEach(() => montar());

    it('mostra código, nome e situação', () => {
      const linhas = el().querySelectorAll('tbody tr');
      expect(linhas[0].textContent).toContain('TI');
      expect(linhas[0].textContent).toContain('Tecnologia');
      expect(linhas[0].textContent).toContain('Ativo');
      expect(linhas[1].textContent).toContain('Inativo');
    });

    it('filtros enviam busca e ativo', () => {
      comp.busca = ' tec ';
      comp.ativoFiltro = 'false';
      comp.carregar(1);
      const req = listagem();
      expect(req.request.params.get('busca')).toBe('tec');
      expect(req.request.params.get('ativo')).toBe('false');
      responder([], req);
      fixture.detectChanges();
      expect(el().textContent).toContain('Nenhum departamento encontrado');
    });

    it('erro de carga mostra a mensagem do servidor', () => {
      comp.carregar();
      listagem().flush({ error: 'Falhou.' }, { status: 400, statusText: 'Bad Request' });
      expect(comp.erro()).toBe('Falhou.');
    });
  });

  describe('formulário', () => {
    beforeEach(() => montar());

    it('exige código e nome e respeita os limites (50 e 255)', () => {
      comp.openCreate();
      comp.save();
      expect(comp.erroCampo('codigo')).toBe('Campo obrigatório.');
      expect(comp.erroCampo('nome')).toBe('Campo obrigatório.');
      comp.form.patchValue({ codigo: 'x'.repeat(51), nome: 'y'.repeat(256) });
      expect(comp.erroCampo('codigo')).toBe('Máximo de 50 caracteres.');
      expect(comp.erroCampo('nome')).toBe('Máximo de 255 caracteres.');
      ctrl.expectNone(r => r.method === 'POST');
    });

    it('cria com código e nome aparados e recarrega', () => {
      comp.openCreate();
      comp.form.patchValue({ codigo: ' FIN ', nome: ' Financeiro ' });
      comp.save();
      const post = ctrl.expectOne(r => r.method === 'POST' && r.url === BASE);
      expect(post.request.body).toEqual({ codigo: 'FIN', nome: 'Financeiro' });
      post.flush(dep(9, 'FIN', 'Financeiro'), { status: 201, statusText: 'Created' });
      expect(comp.feedback()).toBe('Departamento criado.');
      responder([]);
    });

    it('editar envia código, nome e ativo', () => {
      comp.openEdit(dep(2, 'ADM', 'Administrativo', false));
      comp.form.patchValue({ ativo: true });
      comp.save();
      const put = ctrl.expectOne(r => r.method === 'PUT' && r.url === `${BASE}/2`);
      expect(put.request.body).toEqual({ codigo: 'ADM', nome: 'Administrativo', ativo: true });
      put.flush(dep(2, 'ADM', 'Administrativo'));
      responder([]);
    });

    it('código ou nome duplicado ({ error }) vai para o campo', () => {
      comp.openCreate();
      comp.form.patchValue({ codigo: 'TI', nome: 'Outro' });
      comp.save();
      ctrl.expectOne(r => r.method === 'POST').flush(
        { error: "Já existe um departamento com o código 'TI'." }, { status: 400, statusText: 'Bad Request' });
      expect(comp.erroCampo('codigo')).toContain('Já existe');
      expect(comp.saveError()).toBe('');
      expect(comp.saving()).toBeFalse();
    });

    it('erros por campo do ASP.NET são mapeados', () => {
      comp.openCreate();
      comp.form.patchValue({ codigo: 'TI', nome: 'Tec' });
      comp.save();
      ctrl.expectOne(r => r.method === 'POST').flush(
        { errors: { Nome: ['O nome é obrigatório.'] } }, { status: 400, statusText: 'Bad Request' });
      expect(comp.erroCampo('nome')).toBe('O nome é obrigatório.');
    });
  });

  describe('exclusão', () => {
    beforeEach(() => montar());

    it('exclui após confirmar', async () => {
      spyOn(ConfirmDialogComponent.prototype, 'abrir').and.resolveTo(true);
      await comp.excluir(comp.departamentos()[0]);
      ctrl.expectOne(r => r.method === 'DELETE' && r.url === `${BASE}/1`).flush(null, { status: 204, statusText: 'No Content' });
      expect(comp.feedback()).toBe('Departamento excluído.');
      responder([]);
    });

    it('"possui bens": oferece desativar e link para os bens do departamento', async () => {
      spyOn(ConfirmDialogComponent.prototype, 'abrir').and.resolveTo(true);
      await comp.excluir(comp.departamentos()[0]);
      ctrl.expectOne(r => r.method === 'DELETE').flush(
        { error: 'Não é possível excluir um departamento que possui bens.' }, { status: 400, statusText: 'Bad Request' });
      fixture.detectChanges();
      expect(el().textContent).toContain('possui bens');
      expect(el().querySelector<HTMLAnchorElement>('a[href*="/imobilizado/bens"]')!.getAttribute('href')).toContain('departamentoId=1');

      comp.desativar();
      const put = ctrl.expectOne(r => r.method === 'PUT' && r.url === `${BASE}/1`);
      expect(put.request.body).toEqual({ codigo: 'TI', nome: 'Tecnologia', ativo: false });
      put.flush(dep(1, 'TI', 'Tecnologia', false));
      expect(comp.feedback()).toContain('desativado');
      responder([]);
    });

    it('cancelar a confirmação não exclui', async () => {
      spyOn(ConfirmDialogComponent.prototype, 'abrir').and.resolveTo(false);
      await comp.excluir(comp.departamentos()[0]);
      ctrl.expectNone(r => r.method === 'DELETE');
    });
  });

  describe('papéis', () => {
    it('admin vê criar, editar e excluir', () => {
      montar('admin');
      expect(botaoNovo()).toBeTrue();
      expect(el().querySelector('[aria-label^="Editar"]')).not.toBeNull();
      expect(el().querySelector('[aria-label^="Excluir"]')).not.toBeNull();
    });

    it('operador cria e edita, mas não exclui', () => {
      montar('operador');
      expect(botaoNovo()).toBeTrue();
      expect(el().querySelector('[aria-label^="Editar"]')).not.toBeNull();
      expect(el().querySelector('[aria-label^="Excluir"]')).toBeNull();
    });

    it('leitura só consulta', () => {
      montar('leitura');
      expect(botaoNovo()).toBeFalse();
      expect(el().querySelector('[aria-label^="Editar"]')).toBeNull();
      expect(el().querySelector('[aria-label^="Excluir"]')).toBeNull();
    });
  });
});
