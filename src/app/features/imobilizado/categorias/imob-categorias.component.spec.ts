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

const cat = (id: number, nome: string, vida = 120, residual = 10, ativo = true, codigo: string | null = null): ImobCategoria => ({
  id, codigo, depreciacaoAnualPercentual: Math.round(1200 / vida * 100) / 100, nome, vidaUtilMeses: vida, valorResidualPercentual: residual, metodoDepreciacao: 'linear', ativo,
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

    it('mostra código, depreciação anual derivada e o residual como referência', () => {
      const linhas = el().querySelectorAll('tbody tr');
      expect(linhas[0].textContent).toContain('10% ao ano');
      expect(linhas[1].textContent).toContain('20% ao ano');
      expect(linhas[0].textContent).toContain('(ref.)');
      expect(Array.from(el().querySelectorAll('thead th')).map(t => t.textContent?.trim())).toContain('Residual (referência)');
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

    it('envia o código aparado e o mostra ao editar; vazio não vai no corpo', () => {
      preencher({ codigo: ' MOV ' });
      comp.save();
      const post = ctrl.expectOne(r => r.method === 'POST' && r.url === BASE);
      expect(post.request.body.codigo).toBe('MOV');
      post.flush(cat(9, 'Veículos', 60, 20, true, 'MOV'), { status: 201, statusText: 'Created' });
      responder([]);

      comp.openEdit(cat(5, 'Máquinas', 120, 10, true, 'MAQ'));
      expect(comp.form.value.codigo).toBe('MAQ');
      comp.form.patchValue({ codigo: '  ' });
      comp.save();
      const put = ctrl.expectOne(r => r.method === 'PUT' && r.url === `${BASE}/5`);
      expect('codigo' in put.request.body).toBeFalse();
      put.flush(cat(5, 'Máquinas'));
      responder([]);
    });

    it('limita o código a 50 caracteres', () => {
      preencher({ codigo: 'x'.repeat(51) });
      comp.save();
      expect(comp.erroCampo('codigo')).toBe('Máximo de 50 caracteres.');
      ctrl.expectNone(r => r.method === 'POST');
    });

    it('código duplicado ({ error }) vai para o campo código', () => {
      preencher({ codigo: 'MOV' });
      comp.save();
      ctrl.expectOne(r => r.method === 'POST').flush(
        { error: "Já existe uma categoria com o código 'MOV'." }, { status: 400, statusText: 'Bad Request' });
      expect(comp.erroCampo('codigo')).toContain('Já existe');
      expect(comp.saveError()).toBe('');
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

  describe('categorias padrão', () => {
    it('admin vê o botão; confirma, chama POST categorias/padrao e mostra criadas e já existentes', async () => {
      montar('admin');
      expect(el().textContent).toContain('Carregar categorias padrão');
      spyOn(ConfirmDialogComponent.prototype, 'abrir').and.resolveTo(true);
      await comp.carregarPadrao();
      const post = ctrl.expectOne(r => r.method === 'POST' && r.url === `${BASE}/padrao`);
      post.flush({ criadas: 2, jaExistentes: 1, categorias: [cat(7, 'Hardwares', 60, 10, true, 'HW')] });
      expect(comp.feedback()).toBe('Categorias padrão: 2 criadas, 1 já existente.');
      responder([]);
    });

    it('repetir mostra zero criadas', async () => {
      montar('admin');
      spyOn(ConfirmDialogComponent.prototype, 'abrir').and.resolveTo(true);
      await comp.carregarPadrao();
      ctrl.expectOne(r => r.method === 'POST').flush({ criadas: 0, jaExistentes: 3, categorias: [] });
      expect(comp.feedback()).toBe('Categorias padrão: 0 criadas, 3 já existentes.');
      responder([]);
    });

    it('cancelar a confirmação não chama a API', async () => {
      montar('admin');
      spyOn(ConfirmDialogComponent.prototype, 'abrir').and.resolveTo(false);
      await comp.carregarPadrao();
      ctrl.expectNone(r => r.method === 'POST');
    });

    it('403 do servidor aparece como erro', async () => {
      montar('admin');
      spyOn(ConfirmDialogComponent.prototype, 'abrir').and.resolveTo(true);
      await comp.carregarPadrao();
      ctrl.expectOne(r => r.method === 'POST').flush({ error: 'Apenas administradores.' }, { status: 403, statusText: 'Forbidden' });
      expect(comp.erro()).toBe('Apenas administradores.');
      expect(comp.carregandoPadrao()).toBeFalse();
    });

    it('operador e leitura não veem o botão', () => {
      montar('operador');
      expect(el().textContent).not.toContain('Carregar categorias padrão');
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
