import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { Modal } from 'bootstrap';
import { ImobCategoriasComponent } from './imob-categorias.component';
import { ConfirmDialogComponent } from '../shared/confirm-dialog.component';
import { ImobCategoria } from '../../../core/models/imob-categoria.model';
import { provideAuthFake } from '../../../testing/auth-fake';

const BASE = '/api/v1/imobilizado/categorias';

const cat = (id: number, nome: string, vida = 120, residual = 10, ativo = true): ImobCategoria => ({
  id, nome, vidaUtilMeses: vida, valorResidualPercentual: residual, metodoDepreciacao: 'linear', ativo,
  criadoEm: '2026-10-22T14:03:11Z'
});

describe('ImobCategoriasComponent', () => {
  let fixture: ComponentFixture<ImobCategoriasComponent>;
  let comp: ImobCategoriasComponent;
  let ctrl: HttpTestingController;
  const el = () => fixture.nativeElement as HTMLElement;

  const listagem = () => ctrl.expectOne(r => r.url === BASE && r.method === 'GET');
  const responder = (items: ImobCategoria[], req: TestRequest = listagem()) =>
    req.flush({ items, page: 1, pageSize: 50, total: items.length });

  function montar(role: 'admin' | 'operador' | 'leitura' = 'admin', itens: ImobCategoria[] = [cat(1, 'Móveis e utensílios'), cat(2, 'Veículos', 60, 20)]) {
    spyOn(Modal.prototype, 'show');
    spyOn(Modal.prototype, 'hide');
    TestBed.configureTestingModule({
      imports: [ImobCategoriasComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), provideAuthFake(role)]
    });
    ctrl = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ImobCategoriasComponent);
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

    it('mostra vida útil em meses e anos, residual em % e método', () => {
      expect(el().textContent).toContain('120 meses (10 anos)');
      expect(el().textContent).toContain('60 meses (5 anos)');
      expect(el().textContent).toContain('10%');
      expect(el().textContent).toContain('Linear'.toLowerCase());
    });

    it('filtros enviam busca e ativo e voltam para a página 1', () => {
      comp.busca = ' mov ';
      comp.ativoFiltro = 'true';
      comp.carregar(1);
      const req = listagem();
      expect(req.request.params.get('busca')).toBe('mov');
      expect(req.request.params.get('ativo')).toBe('true');
      responder([], req);
      fixture.detectChanges();
      expect(el().textContent).toContain('Nenhuma categoria encontrada');
    });

    it('limpar filtros recarrega sem parâmetros de filtro', () => {
      comp.busca = 'x';
      comp.ativoFiltro = 'false';
      comp.limparFiltros();
      const req = listagem();
      expect(req.request.params.has('busca')).toBeFalse();
      expect(req.request.params.has('ativo')).toBeFalse();
      responder([], req);
    });
  });

  describe('formulário', () => {
    beforeEach(() => montar());

    function preencher(valores: Record<string, unknown>) {
      comp.openCreate();
      comp.form.patchValue({ nome: 'Veículos', vidaUtilMeses: 60, valorResidualPercentual: 20, ...valores });
    }

    it('rejeita vida útil fora de 1–1200 ou não inteira', () => {
      for (const v of [0, 1201, 18.5]) {
        preencher({ vidaUtilMeses: v });
        comp.save();
        expect(comp.form.invalid).toBeTrue();
        expect(comp.erroCampo('vidaUtilMeses')).not.toBe('');
      }
      ctrl.expectNone(r => r.method === 'POST');
    });

    it('rejeita residual fora de 0–100 ou com mais de 2 casas', () => {
      for (const v of [-1, 100.01, 12.345]) {
        preencher({ valorResidualPercentual: v });
        comp.save();
        expect(comp.erroCampo('valorResidualPercentual')).not.toBe('');
      }
      ctrl.expectNone(r => r.method === 'POST');
    });

    it('aceita os limites (1 e 1200 meses; 0 e 100 %)', () => {
      for (const [vida, res] of [[1, 0], [1200, 100], [60, 12.5]]) {
        preencher({ vidaUtilMeses: vida, valorResidualPercentual: res });
        expect(comp.form.valid).toBeTrue();
      }
    });

    it('exige nome, vida útil e residual', () => {
      comp.openCreate();
      comp.save();
      expect(comp.erroCampo('nome')).toBe('Campo obrigatório.');
      expect(comp.erroCampo('vidaUtilMeses')).toBe('Campo obrigatório.');
      expect(comp.erroCampo('valorResidualPercentual')).toBe('Campo obrigatório.');
    });

    it('mostra a dica em anos enquanto digita a vida útil', () => {
      comp.openCreate();
      comp.form.patchValue({ vidaUtilMeses: 120 });
      expect(comp.dicaVidaUtil()).toBe('120 meses (10 anos)');
      comp.form.patchValue({ vidaUtilMeses: 0 });
      expect(comp.dicaVidaUtil()).toBe('');
    });

    it('cria enviando o método linear e recarrega', () => {
      preencher({ nome: '  Veículos ' });
      comp.save();
      const post = ctrl.expectOne(r => r.method === 'POST' && r.url === BASE);
      expect(post.request.body).toEqual({
        nome: 'Veículos', vidaUtilMeses: 60, valorResidualPercentual: 20, metodoDepreciacao: 'linear'
      });
      post.flush(cat(9, 'Veículos', 60, 20), { status: 201, statusText: 'Created' });
      expect(comp.feedback()).toBe('Categoria criada.');
      responder([]);
    });

    it('editar envia o corpo completo com ativo', () => {
      comp.openEdit(cat(2, 'Veículos', 60, 20));
      comp.form.patchValue({ ativo: false });
      comp.save();
      const put = ctrl.expectOne(r => r.method === 'PUT' && r.url === `${BASE}/2`);
      expect(put.request.body).toEqual({
        nome: 'Veículos', vidaUtilMeses: 60, valorResidualPercentual: 20, metodoDepreciacao: 'linear', ativo: false
      });
      put.flush(cat(2, 'Veículos', 60, 20, false));
      responder([]);
    });

    it('nome duplicado ({ error }) vai para o campo nome', () => {
      preencher({});
      comp.save();
      ctrl.expectOne(r => r.method === 'POST').flush(
        { error: 'Já existe uma categoria com o nome "Veículos".' }, { status: 400, statusText: 'Bad Request' });
      expect(comp.erroCampo('nome')).toContain('Já existe');
      expect(comp.saveError()).toBe('');
      expect(comp.saving()).toBeFalse();
    });

    it('erros de validação do ASP.NET (errors) são mapeados para os campos', () => {
      preencher({});
      comp.save();
      ctrl.expectOne(r => r.method === 'POST').flush(
        { errors: { VidaUtilMeses: ['Deve estar entre 1 e 1200.'] } }, { status: 400, statusText: 'Bad Request' });
      expect(comp.erroCampo('vidaUtilMeses')).toBe('Deve estar entre 1 e 1200.');
    });

  });

  describe('exclusão', () => {
    beforeEach(() => montar());

    it('exclui após confirmar', async () => {
      spyOn(ConfirmDialogComponent.prototype, 'abrir').and.resolveTo(true);
      await comp.excluir(comp.categorias()[0]);
      ctrl.expectOne(r => r.method === 'DELETE' && r.url === `${BASE}/1`).flush(null, { status: 204, statusText: 'No Content' });
      expect(comp.feedback()).toBe('Categoria excluída.');
      responder([]);
    });

    it('"possui bens": oferece Desativar e link para os bens da categoria', async () => {
      spyOn(ConfirmDialogComponent.prototype, 'abrir').and.resolveTo(true);
      await comp.excluir(comp.categorias()[1]);
      ctrl.expectOne(r => r.method === 'DELETE').flush(
        { error: 'Não é possível excluir uma categoria que possui bens.' }, { status: 400, statusText: 'Bad Request' });
      fixture.detectChanges();
      expect(el().textContent).toContain('possui bens');
      expect(el().querySelector<HTMLAnchorElement>('a[href*="/imobilizado/bens"]')!.getAttribute('href')).toContain('categoriaId=2');

      comp.desativar();
      const put = ctrl.expectOne(r => r.method === 'PUT' && r.url === `${BASE}/2`);
      expect(put.request.body).toEqual({
        nome: 'Veículos', vidaUtilMeses: 60, valorResidualPercentual: 20, metodoDepreciacao: 'linear', ativo: false
      });
      put.flush(cat(2, 'Veículos', 60, 20, false));
      expect(comp.bloqueio()).toBeNull();
      responder([]);
    });
  });

  describe('papéis', () => {
    const botoes = () => Array.from(el().querySelectorAll('button')).map(b =>
      (b.getAttribute('aria-label') ?? '') + ' ' + (b.textContent ?? '')).join('|');

    it('leitura não vê botões de escrita', () => {
      montar('leitura');
      expect(botoes()).not.toContain('Nova categoria');
      expect(botoes()).not.toContain('Editar');
      expect(botoes()).not.toContain('Excluir');
    });

    it('operador cria e edita, mas não exclui', () => {
      montar('operador');
      expect(botoes()).toContain('Nova categoria');
      expect(botoes()).toContain('Editar Veículos');
      expect(botoes()).not.toContain('Excluir');
    });

    it('admin exclui', () => {
      montar('admin');
      expect(botoes()).toContain('Excluir Veículos');
    });
  });
});
