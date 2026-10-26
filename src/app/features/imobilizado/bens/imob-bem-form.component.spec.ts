import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { ImobBemFormComponent } from './imob-bem-form.component';
import { ImobBem } from '../../../core/models/imob-bem.model';
import { ImobCategoria } from '../../../core/models/imob-categoria.model';
import { hojeIso } from '../../../core/utils/validadores';

const BENS = '/api/v1/imobilizado/bens';

const categoria = (id: number, nome: string, vida: number, pct: number, ativo = true): ImobCategoria => ({
  id, nome, vidaUtilMeses: vida, valorResidualPercentual: pct, metodoDepreciacao: 'linear', ativo,
  criadoEm: '2026-10-22T14:03:11Z'
});

const CATEGORIAS = [categoria(3, 'Informática', 60, 10), categoria(4, 'Móveis', 120, 20), categoria(9, 'Antiga', 24, 5, false)];

const bem = (extra: Partial<ImobBem> = {}): ImobBem => ({
  id: 42, plaqueta: 'NB-0001', descricao: 'Notebook Dell', categoriaId: 3, categoriaNome: 'Informática',
  localId: 7, localNome: 'Sala 101', responsavelId: 12, responsavelNome: 'Ana Souza',
  dataAquisicao: '2024-03-10', valorAquisicao: 4500, valorResidual: 450, vidaUtilMeses: 60, dadosCompletos: true, status: 'ativo',
  fornecedorNome: 'Dell', numeroDocumentoAquisicao: 'NF-1', numeroSerie: 'SN-1', observacao: 'Garantia',
  criadoEm: '2026-10-22T14:03:11Z', atualizadoEm: '2026-10-22T14:03:11Z', ...extra
});

describe('ImobBemFormComponent', () => {
  let fixture: ComponentFixture<ImobBemFormComponent>;
  let comp: ImobBemFormComponent;
  let ctrl: HttpTestingController;
  let navegar: jasmine.Spy;
  const el = () => fixture.nativeElement as HTMLElement;
  const campo = (id: string) => el().querySelector<HTMLInputElement>(`#${id}`)!;

  function digitar(id: string, valor: string) {
    campo(id).value = valor;
    campo(id).dispatchEvent(new Event('input'));
  }

  function montar(id: string | null = null, categorias = CATEGORIAS, depoisDeCriar?: () => void) {
    TestBed.configureTestingModule({
      imports: [ImobBemFormComponent],
      providers: [
        provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap(id ? { id } : {}) } } }
      ]
    });
    ctrl = TestBed.inject(HttpTestingController);
    navegar = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    fixture = TestBed.createComponent(ImobBemFormComponent);
    comp = fixture.componentInstance;
    depoisDeCriar?.();
    fixture.detectChanges();
    ctrl.expectOne(r => r.url === '/api/v1/imobilizado/categorias').flush({ items: categorias, page: 1, pageSize: 100, total: categorias.length });
    ctrl.expectOne('/api/v1/imobilizado/locais/arvore').flush([
      { id: 7, nome: 'Sala 101', codigo: null, localPaiId: null, ativo: true, filhos: [] }
    ]);
  }

  /** Cadastro válido, sem mexer nos campos sugeridos pela categoria. */
  function preencherCadastro() {
    comp.form.patchValue({
      plaqueta: ' NB-0002 ', descricao: ' Notebook ', categoriaId: 3, localId: 7,
      dataAquisicao: '2024-03-10', valorAquisicao: 4500
    });
  }

  afterEach(() => ctrl.verify());

  describe('cadastro', () => {
    beforeEach(() => { montar(); fixture.detectChanges(); });

    it('não envia vazio e mostra os obrigatórios', () => {
      comp.save();
      ctrl.expectNone(r => r.method === 'POST');
      for (const c of ['plaqueta', 'descricao', 'categoriaId', 'localId'] as const) {
        expect(comp.erroCampo(c)).toBe('Campo obrigatório.');
      }
      expect(comp.form.controls.dataAquisicao.valid).toBeTrue();
      expect(comp.form.controls.valorAquisicao.valid).toBeTrue();
    });

    it('data e valor de aquisição são opcionais: sem eles vão como null e o residual é omitido', () => {
      comp.form.patchValue({ plaqueta: 'NB-9', descricao: 'Sem histórico', categoriaId: 3, localId: 7 });
      comp.save();
      const post = ctrl.expectOne(r => r.method === 'POST' && r.url === BENS);
      expect(post.request.body.dataAquisicao).toBeNull();
      expect(post.request.body.valorAquisicao).toBeNull();
      expect(post.request.body.valorResidual).toBeUndefined();
      post.flush(bem({ id: 78, dadosCompletos: false }), { status: 201, statusText: 'Created' });
    });

    it('residual informado sem valor de aquisição é rejeitado no cliente', () => {
      comp.form.controls.valorResidual.setValue(100);
      comp.form.controls.valorResidual.markAsTouched();
      expect(comp.erroCampo('valorResidual')).toBe('Informe o valor de aquisição para definir o residual.');
    });

    it('só lista categorias ativas', () => {
      const opcoes = Array.from(el().querySelectorAll('#bemCategoriaForm option')).map(o => o.textContent?.trim());
      expect(opcoes).toContain('Informática');
      expect(opcoes).not.toContain('Antiga (inativa)');
    });

    it('ao escolher a categoria pré-preenche vida útil e residual (percentual sobre a aquisição)', () => {
      comp.form.patchValue({ categoriaId: 3 });
      expect(comp.form.value.vidaUtilMeses).toBe(60);
      expect(comp.form.value.valorResidual).toBeNull();

      comp.form.patchValue({ valorAquisicao: 4500 });
      expect(comp.form.value.valorResidual).toBe(450);

      comp.form.patchValue({ valorAquisicao: 1234.56 });
      expect(comp.form.value.valorResidual).toBe(123.46);

      comp.form.patchValue({ categoriaId: 4 });
      expect(comp.form.value.vidaUtilMeses).toBe(120);
      expect(comp.form.value.valorResidual).toBe(246.91);
      fixture.detectChanges();
      expect(el().textContent).toContain('Sugerida pela categoria');
      expect(el().textContent).toContain('Sugerido pela categoria');
    });

    it('intocados, vida útil e residual são omitidos para o servidor usar os da categoria', () => {
      preencherCadastro();
      comp.save();
      const post = ctrl.expectOne(r => r.method === 'POST' && r.url === BENS);
      expect(post.request.body.vidaUtilMeses).toBeUndefined();
      expect(post.request.body.valorResidual).toBeUndefined();
      expect(post.request.body).toEqual(jasmine.objectContaining({
        plaqueta: 'NB-0002', descricao: 'Notebook', categoriaId: 3, localId: 7, responsavelId: null,
        dataAquisicao: '2024-03-10', valorAquisicao: 4500
      }));
      post.flush(bem({ id: 77 }), { status: 201, statusText: 'Created' });
      expect(navegar).toHaveBeenCalledWith(['/imobilizado/bens', 77]);
    });

    it('editados pelo usuário, vida útil e residual passam a ser enviados e deixam de ser sobrescritos', () => {
      preencherCadastro();
      fixture.detectChanges();
      digitar('bemVida', '48');
      digitar('bemResidual', '300');
      expect(comp.mostrarSugestao('vida')).toBeFalse();

      comp.form.patchValue({ categoriaId: 4, valorAquisicao: 9000 });
      expect(comp.form.value.vidaUtilMeses).toBe(48);
      expect(comp.form.value.valorResidual).toBe(300);

      comp.save();
      const post = ctrl.expectOne(r => r.method === 'POST');
      expect(post.request.body.vidaUtilMeses).toBe(48);
      expect(post.request.body.valorResidual).toBe(300);
      post.flush(bem(), { status: 201, statusText: 'Created' });
    });

    it('opcionais de texto vazios são omitidos; preenchidos vão aparados', () => {
      preencherCadastro();
      comp.form.patchValue({ fornecedorNome: ' Dell ', numeroSerie: '  ', observacao: '' });
      comp.save();
      const body = ctrl.expectOne(r => r.method === 'POST').request.body;
      expect(body.fornecedorNome).toBe('Dell');
      expect(body.numeroSerie).toBeUndefined();
      expect(body.observacao).toBeUndefined();
    });

    it('valida residual maior que a aquisição, mesmo quando a aquisição muda depois', () => {
      preencherCadastro();
      digitar('bemResidual', '5000');
      comp.form.controls.valorResidual.markAsTouched();
      expect(comp.erroCampo('valorResidual')).toContain('não pode ser maior');
      comp.form.patchValue({ valorAquisicao: 6000 });
      expect(comp.erroCampo('valorResidual')).toBe('');
      comp.form.patchValue({ valorAquisicao: 100 });
      comp.form.controls.valorResidual.markAsTouched();
      expect(comp.erroCampo('valorResidual')).toContain('não pode ser maior');
      comp.save();
      ctrl.expectNone(r => r.method === 'POST');
    });

    it('valida valores e datas', () => {
      preencherCadastro();
      comp.form.patchValue({ valorAquisicao: -1 });
      comp.form.controls.valorAquisicao.markAsTouched();
      expect(comp.erroCampo('valorAquisicao')).toContain('maior ou igual a zero');
      comp.form.patchValue({ valorAquisicao: 10.555 });
      expect(comp.erroCampo('valorAquisicao')).toContain('2 casas');

      comp.form.controls.dataAquisicao.markAsTouched();
      comp.form.patchValue({ dataAquisicao: '2999-01-01' });
      expect(comp.erroCampo('dataAquisicao')).toContain('futura');
      comp.form.patchValue({ dataAquisicao: '1899-12-31' });
      expect(comp.erroCampo('dataAquisicao')).toContain('1900');
      comp.form.patchValue({ dataAquisicao: hojeIso() });
      expect(comp.erroCampo('dataAquisicao')).toBe('');

      comp.form.patchValue({ vidaUtilMeses: 1201 });
      comp.form.controls.vidaUtilMeses.markAsTouched();
      expect(comp.erroCampo('vidaUtilMeses')).toContain('1 a 1200');
    });

    it('limites de tamanho dos textos', () => {
      comp.form.patchValue({ plaqueta: 'x'.repeat(51), descricao: 'x'.repeat(501), observacao: 'x'.repeat(2001) });
      comp.form.markAllAsTouched();
      expect(comp.erroCampo('plaqueta')).toBe('Máximo de 50 caracteres.');
      expect(comp.erroCampo('descricao')).toBe('Máximo de 500 caracteres.');
      expect(comp.erroCampo('observacao')).toBe('Máximo de 2000 caracteres.');
    });

    it('plaqueta duplicada ({ error }) vai para o campo plaqueta', () => {
      preencherCadastro();
      comp.save();
      ctrl.expectOne(r => r.method === 'POST').flush(
        { error: 'Já existe um bem com a plaqueta "NB-0002".' }, { status: 400, statusText: 'Bad Request' });
      expect(comp.erroCampo('plaqueta')).toContain('Já existe');
      expect(comp.saveError()).toBe('');
      expect(comp.saving()).toBeFalse();
      expect(navegar).not.toHaveBeenCalled();
    });

    it('referências inativas/inexistentes caem no campo correspondente', () => {
      preencherCadastro();
      comp.save();
      ctrl.expectOne(r => r.method === 'POST').flush(
        { error: 'O local informado está inativo.' }, { status: 400, statusText: 'Bad Request' });
      expect(comp.erroCampo('localId')).toContain('inativo');
    });

    it('mensagem desconhecida aparece como erro geral', () => {
      preencherCadastro();
      comp.save();
      ctrl.expectOne(r => r.method === 'POST').flush({ error: 'Algo inesperado.' }, { status: 400, statusText: 'Bad Request' });
      expect(comp.saveError()).toBe('Algo inesperado.');
    });

    it('erros de formato do ASP.NET são mapeados para os campos', () => {
      preencherCadastro();
      comp.save();
      ctrl.expectOne(r => r.method === 'POST').flush(
        { errors: { Descricao: ['Descrição inválida.'], VidaUtilMeses: ['Fora do intervalo.'] } },
        { status: 400, statusText: 'Bad Request' });
      expect(comp.erroCampo('descricao')).toBe('Descrição inválida.');
      expect(comp.erroCampo('vidaUtilMeses')).toBe('Fora do intervalo.');
    });

    it('não oferece edição de status', () => {
      expect(el().querySelector('#bemStatus')).toBeNull();
    });
  });

  describe('edição', () => {
    function montarEdicao(b: ImobBem = bem()) {
      montar('42', CATEGORIAS, () => undefined);
      ctrl.expectOne(`${BENS}/42`).flush(b);
      if (b.responsavelId) {
        fixture.detectChanges();
        ctrl.expectOne(`/api/v1/imobilizado/responsaveis/${b.responsavelId}`)
          .flush({ id: b.responsavelId, nome: 'Ana Souza', matricula: 'M100', ativo: true, criadoEm: '' });
      }
      fixture.detectChanges();
    }

    it('carrega os valores atuais e não sobrescreve vida útil/residual ao trocar a categoria', () => {
      montarEdicao();
      expect(comp.form.value.plaqueta).toBe('NB-0001');
      expect(comp.form.value.valorResidual).toBe(450);
      expect(comp.form.value.vidaUtilMeses).toBe(60);
      comp.form.patchValue({ categoriaId: 4, valorAquisicao: 9000 });
      expect(comp.form.value.vidaUtilMeses).toBe(60);
      expect(comp.form.value.valorResidual).toBe(450);
      expect(el().textContent).not.toContain('Sugerida pela categoria');
      expect(el().textContent).toContain('Editar bem NB-0001');
    });

    it('envia o corpo completo com os valores efetivos e volta ao detalhe', () => {
      montarEdicao();
      comp.form.patchValue({ descricao: 'Notebook Dell 2' });
      comp.save();
      const put = ctrl.expectOne(r => r.method === 'PUT' && r.url === `${BENS}/42`);
      expect(put.request.body).toEqual({
        plaqueta: 'NB-0001', descricao: 'Notebook Dell 2', categoriaId: 3, localId: 7, responsavelId: 12,
        dataAquisicao: '2024-03-10', valorAquisicao: 4500, valorResidual: 450, vidaUtilMeses: 60,
        fornecedorNome: 'Dell', numeroDocumentoAquisicao: 'NF-1', numeroSerie: 'SN-1', observacao: 'Garantia'
      });
      put.flush(bem());
      expect(navegar).toHaveBeenCalledWith(['/imobilizado/bens', 42]);
    });

    it('a categoria atual continua listada mesmo inativa', () => {
      montarEdicao(bem({ categoriaId: 9, categoriaNome: 'Antiga' }));
      const opcoes = Array.from(el().querySelectorAll('#bemCategoriaForm option')).map(o => o.textContent?.trim());
      expect(opcoes).toContain('Antiga (inativa)');
    });

    it('bem baixado ou vendido não pode ser editado: aviso, formulário e botão desabilitados', () => {
      montarEdicao(bem({ status: 'baixado' }));
      expect(el().textContent).toContain('Bens baixados ou vendidos não podem ser editados');
      expect(comp.form.disabled).toBeTrue();
      expect(el().querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBeTrue();
    });

    it('bem inexistente mostra "não encontrado"', () => {
      montar('99');
      ctrl.expectOne(`${BENS}/99`).flush({ error: 'x' }, { status: 404, statusText: 'Not Found' });
      fixture.detectChanges();
      expect(el().textContent).toContain('Bem não encontrado');
      expect(el().querySelector('form')).toBeNull();
    });

    it('erro do servidor ao salvar não navega', () => {
      montarEdicao();
      comp.save();
      ctrl.expectOne(r => r.method === 'PUT').flush(
        { error: 'O bem não pode ser editado.' }, { status: 400, statusText: 'Bad Request' });
      expect(comp.saveError()).toBe('O bem não pode ser editado.');
      expect(navegar).not.toHaveBeenCalled();
    });
  });
});
