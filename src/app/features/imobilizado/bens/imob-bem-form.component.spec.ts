import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { ImobBemFormComponent } from './imob-bem-form.component';
import { ImobBem } from '../../../core/models/imob-bem.model';
import { ImobCategoria } from '../../../core/models/imob-categoria.model';
import { ImobCampoCustomizado } from '../../../core/models/imob-campo-customizado.model';
import { hojeIso } from '../../../core/utils/validadores';

const BENS = '/api/v1/imobilizado/bens';

const categoria = (id: number, nome: string, vida: number, pct: number, ativo = true): ImobCategoria => ({
  id, nome, vidaUtilMeses: vida, valorResidualPercentual: pct, metodoDepreciacao: 'linear', ativo,
  criadoEm: '2026-10-22T14:03:11Z'
});

const CATEGORIAS = [
  { ...categoria(3, 'Informática', 60, 10), grupoId: 1 }, { ...categoria(4, 'Móveis', 120, 20), grupoId: 2 }, categoria(9, 'Antiga', 24, 5, false)
];
const GRUPOS = [
  { id: 1, codigo: 'INF', nome: 'Equipamentos de informática', ativo: true, criadoEm: '' },
  { id: 2, codigo: 'MOV', nome: 'Móveis e utensílios', ativo: true, criadoEm: '' }
];

const DEPARTAMENTOS = [
  { id: 2, codigo: 'TI', nome: 'Tecnologia', ativo: true, criadoEm: '' },
  { id: 3, codigo: 'ADM', nome: 'Administrativo', ativo: true, criadoEm: '' },
  { id: 8, codigo: 'OLD', nome: 'Extinto', ativo: false, criadoEm: '' }
];

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

  function montar(id: string | null = null, categorias = CATEGORIAS, depoisDeCriar?: () => void, campos: ImobCampoCustomizado[] = []) {
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
    ctrl.expectOne('/api/v1/imobilizado/bens/codigo-anterior').flush({ oculto: false, bensComCodigoAnterior: 0 });
    ctrl.expectOne('/api/v1/imobilizado/campos-customizados').flush(campos);
    ctrl.expectOne(r => r.url === '/api/v1/imobilizado/categorias').flush({ items: categorias, page: 1, pageSize: 100, total: categorias.length });
    ctrl.expectOne(r => r.url === '/api/v1/imobilizado/grupos').flush({ items: GRUPOS, page: 1, pageSize: 100, total: GRUPOS.length });
    ctrl.expectOne(r => r.url === '/api/v1/imobilizado/departamentos').flush({
      items: DEPARTAMENTOS, page: 1, pageSize: 100, total: DEPARTAMENTOS.length
    });
    ctrl.expectOne(r => r.url === '/api/v1/fornecedores').flush({
      items: [{ id: 5, cnpj: '11222333000181', razaoSocial: 'Dell Computadores', ativo: true, criadoEm: '' }], page: 1, pageSize: 100, total: 1
    });
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

    it('grupo filtra as categorias, escolher a categoria mostra o grupo e o grupo não vai no corpo', () => {
      const nomes = () => Array.from(el().querySelectorAll('#bemCategoriaForm option')).map(o => o.textContent?.trim());
      expect(Array.from(el().querySelectorAll('#bemGrupoForm option')).map(o => o.textContent?.trim()))
        .toEqual(['Todos os grupos', 'Equipamentos de informática', 'Móveis e utensílios']);
      expect(nomes()).toContain('Informática');
      expect(nomes()).toContain('Móveis');

      comp.form.patchValue({ grupoId: 2 });
      fixture.detectChanges();
      expect(nomes()).toContain('Móveis');
      expect(nomes()).not.toContain('Informática');

      // categoria de outro grupo: limpa a categoria; categoria do grupo: sincroniza o grupo
      comp.form.patchValue({ categoriaId: 4 });
      comp.form.patchValue({ grupoId: 1 });
      expect(comp.form.value.categoriaId).toBeNull();
      comp.form.patchValue({ categoriaId: 3 });
      expect(comp.form.value.grupoId).toBe(1);

      comp.form.patchValue({ plaqueta: 'G-1', descricao: 'Item', localId: 7 });
      comp.save();
      const post = ctrl.expectOne(r => r.method === 'POST' && r.url === BENS);
      expect(post.request.body.categoriaId).toBe(3);
      expect('grupoId' in post.request.body).toBeFalse();
      post.flush(bem({ id: 90 }), { status: 201, statusText: 'Created' });
    });

    it('só lista categorias ativas', () => {
      const opcoes = Array.from(el().querySelectorAll('#bemCategoriaForm option')).map(o => o.textContent?.trim());
      expect(opcoes).toContain('Informática');
      expect(opcoes).not.toContain('Antiga (inativa)');
    });

    it('ao escolher a categoria sugere só a vida útil; o residual NÃO vem do percentual da categoria (D-036)', () => {
      comp.form.patchValue({ categoriaId: 3 });
      expect(comp.form.value.vidaUtilMeses).toBe(60);
      comp.form.patchValue({ valorAquisicao: 4500 });
      expect(comp.form.value.valorResidual).toBeNull();

      comp.form.patchValue({ categoriaId: 4 });
      expect(comp.form.value.vidaUtilMeses).toBe(120);
      expect(comp.form.value.valorResidual).toBeNull();
      fixture.detectChanges();
      expect(el().textContent).toContain('Sugerida pela categoria');
      expect(el().textContent).not.toContain('Sugerido pela categoria');
    });

    it('mostra a ajuda "vazio = zero" no residual', () => {
      expect(el().textContent).toContain('vazio = zero');
    });

    it('vida útil intocada e residual vazio são omitidos (servidor usa a categoria e zero)', () => {
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
      expect(comp.mostrarSugestaoVida()).toBeFalse();

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

    it('fornecedor do cadastro envia fornecedorId e copia a razão social; digitar à mão desfaz o vínculo', () => {
      preencherCadastro();
      comp.escolherFornecedor('5');
      expect(comp.form.controls.fornecedorNome.value).toBe('Dell Computadores');
      comp.save();
      const body = ctrl.expectOne(r => r.method === 'POST').request.body;
      expect(body.fornecedorId).toBe(5);
      expect(body.fornecedorNome).toBe('Dell Computadores');
    });

    it('digitar o nome do fornecedor limpa o fornecedorId', () => {
      preencherCadastro();
      comp.escolherFornecedor('5');
      digitar('bemFornecedor', 'Outro');
      comp.save();
      const body = ctrl.expectOne(r => r.method === 'POST').request.body;
      expect(body.fornecedorId).toBeUndefined();
      expect(body.fornecedorNome).toBe('Outro');
    });

    it('valida residual maior que a aquisição, mesmo quando a aquisição muda depois', () => {
      preencherCadastro();
      digitar('bemResidual', '5000');
      comp.form.controls.valorResidual.markAsTouched();
      expect(comp.erroCampo('valorResidual')).toContain('deve ser menor');
      comp.form.patchValue({ valorAquisicao: 6000 });
      expect(comp.erroCampo('valorResidual')).toBe('');
      comp.form.patchValue({ valorAquisicao: 100 });
      comp.form.controls.valorResidual.markAsTouched();
      expect(comp.erroCampo('valorResidual')).toContain('deve ser menor');
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

    it('residual igual ao valor de aquisição é rejeitado; zero é aceito', () => {
      preencherCadastro();
      comp.form.patchValue({ valorResidual: 4500 });
      comp.form.controls.valorResidual.markAsTouched();
      expect(comp.erroCampo('valorResidual')).toContain('deve ser menor');
      comp.form.patchValue({ valorResidual: 0 });
      expect(comp.form.controls.valorResidual.valid).toBeTrue();
    });

    it('departamento é opcional e só lista os ativos', () => {
      const opcoes = Array.from(el().querySelectorAll('#bemDepartamentoForm option')).map(o => o.textContent?.trim());
      expect(opcoes).toContain('TI — Tecnologia');
      expect(opcoes).not.toContain('OLD — Extinto (inativo)');
      preencherCadastro();
      comp.save();
      const post = ctrl.expectOne(r => r.method === 'POST');
      expect(post.request.body.departamentoId).toBeNull();
      post.flush(bem(), { status: 201, statusText: 'Created' });
    });

    it('envia o departamentoId escolhido', () => {
      preencherCadastro();
      comp.form.patchValue({ departamentoId: 2 });
      comp.save();
      const post = ctrl.expectOne(r => r.method === 'POST');
      expect(post.request.body.departamentoId).toBe(2);
      post.flush(bem({ departamentoId: 2, departamentoNome: 'Tecnologia' }), { status: 201, statusText: 'Created' });
    });

    it('erro de departamento inativo cai no campo departamento', () => {
      preencherCadastro();
      comp.form.patchValue({ departamentoId: 2 });
      comp.save();
      ctrl.expectOne(r => r.method === 'POST').flush(
        { error: "O departamento 'Tecnologia' está inativo." }, { status: 400, statusText: 'Bad Request' });
      expect(comp.erroCampo('departamentoId')).toContain('inativo');
      expect(comp.saveError()).toBe('');
    });

    it('erros por campo do servidor (DataAquisicao e ValorResidual) aparecem nos campos', () => {
      preencherCadastro();
      comp.save();
      ctrl.expectOne(r => r.method === 'POST').flush({
        title: 'One or more validation errors occurred.',
        errors: {
          DataAquisicao: ['Data de aquisição não pode ser futura.'],
          ValorResidual: ['Valor residual deve ser menor que o valor de aquisição.']
        }
      }, { status: 400, statusText: 'Bad Request' });
      expect(comp.erroCampo('dataAquisicao')).toBe('Data de aquisição não pode ser futura.');
      expect(comp.erroCampo('valorResidual')).toBe('Valor residual deve ser menor que o valor de aquisição.');
      expect(comp.saveError()).toBe('');
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
        plaqueta: 'NB-0001', descricao: 'Notebook Dell 2', categoriaId: 3, localId: 7, responsavelId: 12, departamentoId: null,
        dataAquisicao: '2024-03-10', valorAquisicao: 4500, valorResidual: 450, vidaUtilMeses: 60,
        fornecedorNome: 'Dell', numeroDocumentoAquisicao: 'NF-1', numeroSerie: 'SN-1', observacao: 'Garantia'
      });
      put.flush(bem());
      expect(navegar).toHaveBeenCalledWith(['/imobilizado/bens', 42]);
    });

    it('o departamento atual continua listado mesmo inativo e vai no PUT', () => {
      montarEdicao(bem({ departamentoId: 8, departamentoNome: 'Extinto' }));
      const opcoes = Array.from(el().querySelectorAll('#bemDepartamentoForm option')).map(o => o.textContent?.trim());
      expect(opcoes).toContain('OLD — Extinto (inativo)');
      expect(comp.form.value.departamentoId).toBe(8);
      comp.save();
      const put = ctrl.expectOne(r => r.method === 'PUT');
      expect(put.request.body.departamentoId).toBe(8);
      put.flush(bem());
    });

    it('na edição a ajuda do residual explica que vazio mantém o atual', () => {
      montarEdicao();
      expect(el().textContent).toContain('Vazio mantém o valor atual');
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

  describe('campos customizados', () => {
    const def = (id: number, nome: string, extra: Partial<ImobCampoCustomizado> = {}): ImobCampoCustomizado => ({
      id, nome, tipo: 'texto', obrigatorio: false, opcoes: [], categoriaId: null, ativo: true, ordem: id, bensComValor: 0, ...extra
    });
    const CAMPOS = [
      def(1, 'Cor'),
      def(2, 'Peso (kg)', { tipo: 'numero' }),
      def(3, 'Garantia até', { tipo: 'data' }),
      def(4, 'Estado', { tipo: 'lista', opcoes: ['Novo', 'Usado'] }),
      def(5, 'Só TI', { categoriaId: 3 }),
      def(6, 'Só Móveis', { categoriaId: 4 })
    ];
    const rotulos = () => Array.from(el().querySelectorAll('[data-testid="campos-customizados"] label')).map(l => l.textContent?.replace(/\s+/g, ' ').trim());
    const selecionar = (id: string, valor: string) => { campo(id).value = valor; campo(id).dispatchEvent(new Event('change')); };

    it('mostra os campos que valem para a categoria escolhida', () => {
      montar(null, CATEGORIAS, undefined, CAMPOS);
      fixture.detectChanges();
      expect(rotulos()).toEqual(['Cor', 'Peso (kg)', 'Garantia até', 'Estado']);

      comp.form.patchValue({ categoriaId: 3 });
      fixture.detectChanges();
      expect(rotulos()).toEqual(['Cor', 'Peso (kg)', 'Garantia até', 'Estado', 'Só TI']);

      comp.form.patchValue({ categoriaId: 4 });
      fixture.detectChanges();
      expect(rotulos()).toContain('Só Móveis');
      expect(rotulos()).not.toContain('Só TI');
    });

    it('sem campos cadastrados não mostra a seção nem envia a lista', () => {
      montar();
      fixture.detectChanges();
      expect(el().querySelector('[data-testid="campos-customizados"]')).toBeNull();
      preencherCadastro();
      comp.save();
      const post = ctrl.expectOne(r => r.method === 'POST' && r.url === BENS);
      expect('camposCustomizados' in post.request.body).toBeFalse();
      post.flush(bem({ id: 90 }), { status: 201, statusText: 'Created' });
    });

    it('envia o valor de cada campo da categoria (vazio vai como null)', () => {
      montar(null, CATEGORIAS, undefined, CAMPOS);
      fixture.detectChanges();
      preencherCadastro();
      fixture.detectChanges();
      digitar('campoCustom1', ' Azul ');
      digitar('campoCustom2', '12,5');
      digitar('campoCustom3', '2026-03-10');
      selecionar('campoCustom4', 'Usado');

      comp.save();

      const post = ctrl.expectOne(r => r.method === 'POST' && r.url === BENS);
      expect(post.request.body.camposCustomizados).toEqual([
        { campoId: 1, valor: 'Azul' }, { campoId: 2, valor: '12,5' }, { campoId: 3, valor: '2026-03-10' }, { campoId: 4, valor: 'Usado' },
        { campoId: 5, valor: null }
      ]);
      post.flush(bem({ id: 91 }), { status: 201, statusText: 'Created' });
    });

    it('campo obrigatório vazio no cadastro bloqueia o envio e mostra o erro no campo', () => {
      montar(null, CATEGORIAS, undefined, [def(1, 'Responsável técnico', { obrigatorio: true })]);
      fixture.detectChanges();
      preencherCadastro();
      fixture.detectChanges();
      expect(rotulos()).toEqual(['Responsável técnico *']);

      comp.save();
      fixture.detectChanges();

      ctrl.expectNone(r => r.method === 'POST');
      expect(el().querySelector('[data-testid="campos-customizados"]')!.textContent).toContain('Campo obrigatório.');
      digitar('campoCustom1', 'Ana');
      fixture.detectChanges();
      expect(el().querySelector('[data-testid="campos-customizados"]')!.textContent).not.toContain('Campo obrigatório.');
      comp.save();
      ctrl.expectOne(r => r.method === 'POST' && r.url === BENS).flush(bem({ id: 92 }), { status: 201, statusText: 'Created' });
    });

    it('valor que não bate com o tipo bloqueia o envio', () => {
      montar(null, CATEGORIAS, undefined, CAMPOS);
      fixture.detectChanges();
      preencherCadastro();
      fixture.detectChanges();
      digitar('campoCustom2', 'pesado');

      comp.save();
      fixture.detectChanges();

      ctrl.expectNone(r => r.method === 'POST');
      expect(el().textContent).toContain('Informe um número');
    });

    it('edição: carrega os valores gravados, permite limpar um opcional e manda tudo no PUT', () => {
      montar('42', CATEGORIAS, () => undefined, CAMPOS);
      ctrl.expectOne(`${BENS}/42`).flush(bem({
        camposCustomizados: [
          { campoId: 1, nome: 'Cor', tipo: 'texto', ativo: true, valor: 'Azul' },
          { campoId: 2, nome: 'Peso (kg)', tipo: 'numero', ativo: true, valor: '12.5' }
        ]
      }));
      fixture.detectChanges();
      ctrl.expectOne('/api/v1/imobilizado/responsaveis/12').flush({ id: 12, nome: 'Ana Souza', matricula: 'M100', ativo: true, criadoEm: '' });
      fixture.detectChanges();
      expect(campo('campoCustom1').value).toBe('Azul');
      expect(campo('campoCustom2').value).toBe('12,5');

      digitar('campoCustom2', '');
      comp.save();

      const put = ctrl.expectOne(r => r.method === 'PUT' && r.url === `${BENS}/42`);
      expect(put.request.body.camposCustomizados).toEqual([
        { campoId: 1, valor: 'Azul' }, { campoId: 2, valor: null }, { campoId: 3, valor: null }, { campoId: 4, valor: null }, { campoId: 5, valor: null }
      ]);
      put.flush(bem());
    });

    it('edição: obrigatório que já tinha valor não pode ser apagado; bem antigo sem valor segue editável', () => {
      const obrig = [def(1, 'Responsável técnico', { obrigatorio: true })];
      montar('42', CATEGORIAS, () => undefined, obrig);
      ctrl.expectOne(`${BENS}/42`).flush(bem({ camposCustomizados: [{ campoId: 1, nome: 'Responsável técnico', tipo: 'texto', ativo: true, valor: 'Ana' }] }));
      fixture.detectChanges();
      ctrl.expectOne('/api/v1/imobilizado/responsaveis/12').flush({ id: 12, nome: 'Ana Souza', matricula: 'M100', ativo: true, criadoEm: '' });
      fixture.detectChanges();

      digitar('campoCustom1', '');
      comp.save();
      fixture.detectChanges();

      ctrl.expectNone(r => r.method === 'PUT');
      expect(el().textContent).toContain('Campo obrigatório.');
    });

    it('edição de bem antigo sem valor no campo obrigatório não bloqueia o PUT', () => {
      montar('42', CATEGORIAS, () => undefined, [def(1, 'Responsável técnico', { obrigatorio: true })]);
      ctrl.expectOne(`${BENS}/42`).flush(bem({ camposCustomizados: [] }));
      fixture.detectChanges();
      ctrl.expectOne('/api/v1/imobilizado/responsaveis/12').flush({ id: 12, nome: 'Ana Souza', matricula: 'M100', ativo: true, criadoEm: '' });
      fixture.detectChanges();

      comp.save();

      ctrl.expectOne(r => r.method === 'PUT' && r.url === `${BENS}/42`).flush(bem());
    });
  });
});
