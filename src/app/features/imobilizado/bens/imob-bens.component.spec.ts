import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { NavigationEnd, Params, Router, provideRouter } from '@angular/router';
import { filter, firstValueFrom } from 'rxjs';
import { ImobBensComponent } from './imob-bens.component';
import { ConfirmDialogComponent } from '../shared/confirm-dialog.component';
import { ImobBem } from '../../../core/models/imob-bem.model';
import { ImobCategoria } from '../../../core/models/imob-categoria.model';
import { provideAuthFake } from '../../../testing/auth-fake';

const BENS = '/api/v1/imobilizado/bens';
const CATEGORIAS = '/api/v1/imobilizado/categorias';
const ARVORE = '/api/v1/imobilizado/locais/arvore';
const DEPARTAMENTOS = '/api/v1/imobilizado/departamentos';
const GRUPOS = '/api/v1/imobilizado/grupos';

const bem = (id: number, extra: Partial<ImobBem> = {}): ImobBem => ({
  id, plaqueta: `NB-000${id}`, descricao: `Notebook ${id}`, categoriaId: 3, categoriaNome: 'Informática',
  localId: 7, localNome: 'Sala 101', responsavelId: 12, responsavelNome: 'Ana Souza',
  dataAquisicao: '2024-03-10', valorAquisicao: 4500, valorResidual: 450, vidaUtilMeses: 60, dadosCompletos: true, status: 'ativo',
  criadoEm: '2026-10-22T14:03:11Z', atualizadoEm: '2026-10-22T14:03:11Z', ...extra
});

const categoria = (id: number, nome: string, ativo = true): ImobCategoria => ({
  id, nome, vidaUtilMeses: 60, valorResidualPercentual: 10, metodoDepreciacao: 'linear', ativo, criadoEm: '2026-10-22T14:03:11Z'
});

describe('ImobBensComponent', () => {
  let fixture: ComponentFixture<ImobBensComponent>;
  let comp: ImobBensComponent;
  let ctrl: HttpTestingController;
  let router: Router;
  const el = () => fixture.nativeElement as HTMLElement;

  const listagem = () => ctrl.expectOne(r => r.url === BENS && r.method === 'GET');
  const responder = (items: ImobBem[], req: TestRequest = listagem(), total = items.length) =>
    req.flush({ items, page: 1, pageSize: 50, total });

  async function montar(role: 'admin' | 'operador' | 'leitura' = 'admin', query: Params = {}, itens: ImobBem[] = [bem(1), bem(2, { plaqueta: 'MS-0002', responsavelId: null, responsavelNome: null })]) {
    TestBed.configureTestingModule({
      imports: [ImobBensComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), provideAuthFake(role)]
    });
    ctrl = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    if (Object.keys(query).length) await router.navigate([], { queryParams: query });
    fixture = TestBed.createComponent(ImobBensComponent);
    comp = fixture.componentInstance;
    fixture.detectChanges();
    const req = listagem();
    responder(itens, req);
    ctrl.expectOne(r => r.url === CATEGORIAS).flush({
      items: [categoria(3, 'Informática'), categoria(4, 'Móveis', false)], page: 1, pageSize: 100, total: 2
    });
    ctrl.expectOne(ARVORE).flush([]);
    ctrl.expectOne(r => r.url === GRUPOS).flush({
      items: [{ id: 3, codigo: 'MOV', nome: 'Móveis', ativo: true, criadoEm: '' }], page: 1, pageSize: 100, total: 1
    });
    ctrl.expectOne(r => r.url === DEPARTAMENTOS).flush({
      items: [{ id: 2, codigo: 'TI', nome: 'Tecnologia', ativo: true, criadoEm: '' }], page: 1, pageSize: 100, total: 1
    });
    if (query['responsavelId']) {
      ctrl.expectOne(r => r.url === `/api/v1/imobilizado/responsaveis/${query['responsavelId']}`)
        .flush({ id: Number(query['responsavelId']), nome: 'Ana Souza', matricula: 'M100', ativo: true, criadoEm: '' });
    }
    fixture.detectChanges();
    return req;
  }

  /** Executa a ação e espera a navegação do router terminar (o whenStable não a acompanha). */
  async function navegando(acao: () => void) {
    const fim = firstValueFrom(router.events.pipe(filter(e => e instanceof NavigationEnd)));
    acao();
    await fim;
  }

  /** O corpo de erro do export é um Blob; sua leitura é assíncrona fora do zone. */
  async function esperar(condicao: () => boolean) {
    for (let i = 0; i < 50 && !condicao(); i++) await new Promise(r => setTimeout(r, 10));
  }

  afterEach(() => ctrl.verify());

  describe('lista', () => {
    it('carrega a página 1 sem filtros e mostra valor em BRL, status e responsável ausente', async () => {
      const req = await montar();
      expect(req.request.params.get('page')).toBe('1');
      expect(req.request.params.get('pageSize')).toBe('50');
      expect(req.request.params.keys().sort()).toEqual(['page', 'pageSize']);
      expect(el().textContent).toContain('NB-0001');
      expect(el().textContent).toContain('Sala 101');
      expect(el().textContent).toContain('Ana Souza');
      expect(el().textContent).toContain('Ativo');
      expect(el().textContent?.replace(/\s/g, ' ')).toContain('R$ 4.500,00');
      expect(el().textContent).toContain('—');
    });

    it('bem com dados incompletos mostra o selo e "—" no valor', async () => {
      await montar('admin', {}, [bem(1), bem(2, { dadosCompletos: false, dataAquisicao: null, valorAquisicao: null, valorResidual: null })]);
      const linhas = el().querySelectorAll('tbody tr');
      expect(linhas[0].textContent).not.toContain('Dados incompletos');
      expect(linhas[1].textContent).toContain('Dados incompletos');
      expect(linhas[1].textContent).toContain('—');
    });

    it('estados: vazio sem filtro, vazio com filtro e erro com nova tentativa', async () => {
      await montar('admin', {}, []);
      expect(el().textContent).toContain('Nenhum bem cadastrado');

      comp.carregar();
      listagem().flush({}, { status: 500, statusText: 'Server Error' });
      fixture.detectChanges();
      expect(el().textContent).toContain('Erro ao carregar bens');
      expect(el().textContent).toContain('Tentar novamente');
    });

    it('com filtro ativo o vazio diz que nada foi encontrado com os filtros', async () => {
      await montar('admin', { busca: 'xyz' }, []);
      expect(el().textContent).toContain('Nenhum bem encontrado com os filtros atuais');
    });

    it('mostra "carregando" enquanto busca', async () => {
      TestBed.configureTestingModule({
        imports: [ImobBensComponent],
        providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), provideAuthFake('admin')]
      });
      ctrl = TestBed.inject(HttpTestingController);
      fixture = TestBed.createComponent(ImobBensComponent);
      fixture.detectChanges();
      expect(el().textContent).toContain('Carregando');
      responder([]);
      ctrl.expectOne(r => r.url === CATEGORIAS).flush({ items: [], page: 1, pageSize: 100, total: 0 });
      ctrl.expectOne(ARVORE).flush([]);
      ctrl.expectOne(r => r.url === GRUPOS).flush({ items: [], page: 1, pageSize: 100, total: 0 });
      ctrl.expectOne(r => r.url === DEPARTAMENTOS).flush({ items: [], page: 1, pageSize: 100, total: 0 });
    });

    it('mostra a coluna Departamento com o nome ou traço', async () => {
      await montar('admin', {}, [bem(1, { departamentoId: 2, departamentoNome: 'Tecnologia' }), bem(2)]);
      const cabecalhos = Array.from(el().querySelectorAll('thead th')).map(t => t.textContent?.trim());
      expect(cabecalhos).toContain('Departamento');
      const linhas = el().querySelectorAll('tbody tr');
      expect(linhas[0].textContent).toContain('Tecnologia');
      expect(linhas[1].textContent).not.toContain('Tecnologia');
    });

    it('mostra a coluna Grupo (herdado da categoria) com o nome ou traço', async () => {
      await montar('admin', {}, [bem(1, { grupoId: 3, grupoNome: 'Móveis' }), bem(2)]);
      const cabecalhos = Array.from(el().querySelectorAll('thead th')).map(t => t.textContent?.trim());
      expect(cabecalhos).toContain('Grupo');
      const linhas = el().querySelectorAll('tbody tr');
      expect(linhas[0].textContent).toContain('Móveis');
      expect(linhas[1].textContent).not.toContain('Móveis');
    });
  });

  describe('filtros e URL', () => {
    it('lê os filtros da URL (link "Ver bens") e os envia à API', async () => {
      const req = await montar('admin', {
        busca: 'nb', localId: 7, incluirSublocais: 'false', categoriaId: 3, responsavelId: 12, status: 'ativo', page: 2
      });
      const p = req.request.params;
      expect(p.get('busca')).toBe('nb');
      expect(p.get('localId')).toBe('7');
      expect(p.get('incluirSublocais')).toBe('false');
      expect(p.get('categoriaId')).toBe('3');
      expect(p.get('responsavelId')).toBe('12');
      expect(p.get('status')).toBe('ativo');
      expect(p.get('page')).toBe('2');
      expect(comp.filtros.value.localId).toBe(7);
      expect(comp.filtros.value.incluirSublocais).toBeFalse();
    });

    it('"Pendentes de completar" usa dadosCompletos=false na URL e na API', async () => {
      const req = await montar('admin', { dadosCompletos: 'false' });
      expect(req.request.params.get('dadosCompletos')).toBe('false');
      expect(comp.filtros.value.pendentes).toBeTrue();
      expect(comp.temFiltro()).toBeTrue();
    });

    it('marcar o filtro atualiza a URL e recarrega', async () => {
      await montar('admin');
      await navegando(() => comp.filtros.controls.pendentes.setValue(true));
      expect(router.url).toContain('dadosCompletos=false');
      const req = listagem();
      expect(req.request.params.get('dadosCompletos')).toBe('false');
      responder([], req);
    });

    it('lê departamento, período de compra e ordenação da URL e os envia à API', async () => {
      const req = await montar('admin', {
        departamentoId: 2, compraDe: '2024-01-01', compraAte: '2024-12-31', ordenarPor: 'valorAquisicao', direcao: 'desc'
      });
      const p = req.request.params;
      expect(p.get('departamentoId')).toBe('2');
      expect(p.get('compraDe')).toBe('2024-01-01');
      expect(p.get('compraAte')).toBe('2024-12-31');
      expect(p.get('ordenarPor')).toBe('valorAquisicao');
      expect(p.get('direcao')).toBe('desc');
      expect(comp.filtros.value.departamentoId).toBe(2);
      expect(comp.filtros.value.compraDe).toBe('2024-01-01');
      expect(comp.filtros.value.ordenarPor).toBe('valorAquisicao');
      expect(comp.filtros.value.direcao).toBe('desc');
    });

    it('só ordenar não conta como filtro ativo', async () => {
      await montar('admin', { ordenarPor: 'dataAquisicao' }, []);
      expect(comp.temFiltro()).toBeFalse();
      expect(el().textContent).toContain('Nenhum bem cadastrado');
    });

    it('escolher departamento atualiza a URL e recarrega', async () => {
      await montar();
      await navegando(() => comp.filtros.controls.departamentoId.setValue(2));
      expect(router.url).toContain('departamentoId=2');
      const req = listagem();
      expect(req.request.params.get('departamentoId')).toBe('2');
      responder([], req);
    });

    it('escolher grupo atualiza a URL e recarrega', async () => {
      await montar();
      await navegando(() => comp.filtros.controls.grupoId.setValue(3));
      expect(router.url).toContain('grupoId=3');
      const req = listagem();
      expect(req.request.params.get('grupoId')).toBe('3');
      responder([], req);
    });

    it('escolher a ordenação coloca ordenarPor e direcao na URL; plaqueta crescente (padrão) não vai', async () => {
      await montar();
      await navegando(() => comp.filtros.controls.ordenarPor.setValue('dataAquisicao'));
      expect(router.url).toContain('ordenarPor=dataAquisicao');
      expect(router.url).not.toContain('direcao=');
      responder([], listagem());
      await navegando(() => comp.filtros.controls.direcao.setValue('desc'));
      expect(router.url).toContain('direcao=desc');
      const req = listagem();
      expect(req.request.params.get('ordenarPor')).toBe('dataAquisicao');
      expect(req.request.params.get('direcao')).toBe('desc');
      responder([], req);
    });

    it('plaqueta decrescente envia ordenarPor=plaqueta&direcao=desc', async () => {
      await montar();
      await navegando(() => comp.filtros.controls.direcao.setValue('desc'));
      const req = listagem();
      expect(req.request.params.get('ordenarPor')).toBe('plaqueta');
      expect(req.request.params.get('direcao')).toBe('desc');
      responder([], req);
    });

    it('compra de depois de compra até não é enviada e mostra o aviso', async () => {
      await montar();
      comp.filtros.patchValue({ compraDe: '2024-12-31', compraAte: '2024-01-01' }, { emitEvent: false });
      comp.aplicar(1);
      fixture.detectChanges();
      expect(comp.erroPeriodo()).toContain('não pode ser posterior');
      expect(el().textContent).toContain('não pode ser posterior');
      ctrl.expectNone(r => r.url === BENS);
    });

    it('limpar zera os novos filtros', async () => {
      await montar('admin', { departamentoId: 2, compraDe: '2024-01-01', ordenarPor: 'valorAquisicao' });
      await navegando(() => comp.limparFiltros());
      const req = listagem();
      for (const k of ['departamentoId', 'compraDe', 'compraAte', 'ordenarPor', 'direcao']) expect(req.request.params.has(k)).toBeFalse();
      responder([], req);
    });

    it('valores inválidos na URL são ignorados', async () => {
      const req = await montar('admin', {
        localId: 'abc', categoriaId: '-1', status: 'xyz', incluirSublocais: 'false', departamentoId: '0',
        compraDe: '10/10/2024', ordenarPor: 'nome', direcao: 'desc'
      });
      expect(req.request.params.keys().sort()).toEqual(['page', 'pageSize']);
    });

    it('incluir sublocais fica ligado por padrão e só vai à API quando desligado com um local', async () => {
      await montar('admin', { localId: 7 });
      expect(comp.filtros.value.incluirSublocais).toBeTrue();
    });

    it('filtrar atualiza a URL e recarrega a partir da página 1', async () => {
      await montar('admin', { page: 3 });
      comp.filtros.patchValue({ busca: ' mesa ', status: 'em_manutencao' }, { emitEvent: false });
      await navegando(() => comp.aplicar(1));
      const req = listagem();
      expect(req.request.params.get('busca')).toBe('mesa');
      expect(req.request.params.get('status')).toBe('em_manutencao');
      expect(req.request.params.get('page')).toBe('1');
      expect(router.url).toContain('busca=mesa');
      expect(router.url).not.toContain('page=');
      responder([], req);
    });

    it('selects aplicam na hora (categoria)', async () => {
      await montar();
      await navegando(() => comp.filtros.controls.categoriaId.setValue(3));
      expect(listagem().request.params.get('categoriaId')).toBe('3');
    });

    it('aplicar com os mesmos filtros apenas recarrega', async () => {
      await montar('admin', { busca: 'nb' });
      comp.aplicar(1);
      responder([]);
      expect(comp.loading()).toBeFalse();
    });

    it('trocar de página mantém o filtro aplicado, não o que foi digitado e não enviado', async () => {
      await montar('admin', { busca: 'nb' });
      comp.filtros.patchValue({ busca: 'outro' }, { emitEvent: false });
      await navegando(() => comp.mudarPagina(2));
      const req = listagem();
      expect(req.request.params.get('busca')).toBe('nb');
      expect(req.request.params.get('page')).toBe('2');
      responder([], req);
    });

    it('limpar remove todos os filtros', async () => {
      await montar('admin', { busca: 'nb', status: 'ativo', localId: 7 });
      await navegando(() => comp.limparFiltros());
      const req = listagem();
      expect(req.request.params.keys().sort()).toEqual(['page', 'pageSize']);
      expect(router.url).not.toContain('busca');
      responder([], req);
    });

    it('lista categorias inativas no filtro com a marcação', async () => {
      await montar();
      expect(el().querySelector('#bemCategoria')!.textContent).toContain('Móveis (inativa)');
    });
  });

  describe('busca por plaqueta', () => {
    it('encontrando, abre o detalhe do bem', async () => {
      await montar();
      const nav = spyOn(router, 'navigate').and.resolveTo(true);
      comp.plaquetaBusca.setValue(' NB/0001 ');
      comp.buscarPlaqueta();
      const req = ctrl.expectOne(r => r.url === `${BENS}/por-plaqueta`);
      expect(req.request.params.get('plaqueta')).toBe('NB/0001');
      req.flush(bem(42));
      expect(nav).toHaveBeenCalledWith(['/imobilizado/bens', 42]);
    });

    it('404 mostra "plaqueta não encontrada"', async () => {
      await montar();
      comp.plaquetaBusca.setValue('XX-1');
      comp.buscarPlaqueta();
      ctrl.expectOne(r => r.url === `${BENS}/por-plaqueta`).flush(
        { error: 'x' }, { status: 404, statusText: 'Not Found' });
      fixture.detectChanges();
      expect(el().textContent).toContain('Plaqueta "XX-1" não encontrada.');
    });

    it('campo vazio não consulta', async () => {
      await montar();
      comp.plaquetaBusca.setValue('  ');
      comp.buscarPlaqueta();
      ctrl.expectNone(r => r.url === `${BENS}/por-plaqueta`);
      expect(comp.buscandoPlaqueta()).toBeFalse();
    });
  });

  describe('exportação CSV', () => {
    it('baixa via HttpClient respeitando os filtros aplicados', async () => {
      await montar('admin', { categoriaId: 3, localId: 7, incluirSublocais: 'false' });
      const criar = spyOn(URL, 'createObjectURL').and.returnValue('blob:csv');
      const clicar = spyOn(HTMLAnchorElement.prototype, 'click');
      comp.exportar();
      expect(comp.exportando()).toBeTrue();

      const req = ctrl.expectOne(r => r.url === `${BENS}/exportar`);
      expect(req.request.responseType).toBe('blob');
      expect(req.request.params.get('categoriaId')).toBe('3');
      expect(req.request.params.get('localId')).toBe('7');
      expect(req.request.params.get('incluirSublocais')).toBe('false');
      expect(req.request.params.has('page')).toBeFalse();
      req.flush(new Blob(['Plaqueta']), { headers: { 'Content-Disposition': 'attachment; filename="bens.csv"' } });

      expect(criar).toHaveBeenCalled();
      expect(clicar).toHaveBeenCalledTimes(1);
      expect(comp.exportando()).toBeFalse();
    });

    it('acima do limite mostra a mensagem do servidor e sugere filtrar', async () => {
      await montar();
      const msg = 'A exportação é limitada a 20000 bens e o filtro retornou 25000. Refine os filtros.';
      comp.exportar();
      ctrl.expectOne(r => r.url === `${BENS}/exportar`).flush(
        new Blob([JSON.stringify({ error: msg })], { type: 'application/json' }), { status: 400, statusText: 'Bad Request' });
      await esperar(() => !comp.exportando());
      fixture.detectChanges();
      expect(comp.erroExportacao()).toContain(msg);
      expect(comp.erroExportacao()).toContain('filtrar por local ou categoria');
      expect(el().textContent).toContain('limitada a 20000 bens');
      expect(comp.exportando()).toBeFalse();
    });
  });

  describe('exclusão', () => {
    it('só exclui após confirmar e recarrega', async () => {
      await montar();
      const abrir = spyOn(ConfirmDialogComponent.prototype, 'abrir').and.resolveTo(false);
      await comp.excluir(comp.bens()[0]);
      ctrl.expectNone(r => r.method === 'DELETE');

      abrir.and.resolveTo(true);
      await comp.excluir(comp.bens()[0]);
      ctrl.expectOne(r => r.method === 'DELETE' && r.url === `${BENS}/1`).flush(null, { status: 204, statusText: 'No Content' });
      expect(comp.feedback()).toBe('Bem NB-0001 excluído.');
      responder([]);
    });

    it('mostra o erro do servidor se a exclusão falhar', async () => {
      await montar();
      spyOn(ConfirmDialogComponent.prototype, 'abrir').and.resolveTo(true);
      await comp.excluir(comp.bens()[0]);
      ctrl.expectOne(r => r.method === 'DELETE').flush({ error: 'Não foi possível.' }, { status: 400, statusText: 'Bad Request' });
      expect(comp.erro()).toBe('Não foi possível.');
    });
  });

  describe('papéis', () => {
    const acoes = () => Array.from(el().querySelectorAll('a, button')).map(b =>
      (b.getAttribute('aria-label') ?? '') + ' ' + (b.textContent ?? '')).join('|');

    it('leitura vê, busca e exporta, mas não tem botões de escrita', async () => {
      await montar('leitura');
      expect(acoes()).toContain('Ver NB-0001');
      expect(acoes()).toContain('Exportar CSV');
      expect(acoes()).not.toContain('Novo bem');
      expect(acoes()).not.toContain('Editar');
      expect(acoes()).not.toContain('Excluir');
    });

    it('operador cria e edita, mas não exclui', async () => {
      await montar('operador');
      expect(acoes()).toContain('Novo bem');
      expect(acoes()).toContain('Editar NB-0001');
      expect(acoes()).not.toContain('Excluir');
    });

    it('admin exclui', async () => {
      await montar('admin');
      expect(acoes()).toContain('Excluir NB-0001');
    });

    it('bem baixado ou vendido não oferece edição, nem para admin', async () => {
      await montar('admin', {}, [bem(1, { status: 'baixado' }), bem(2, { status: 'vendido' }), bem(3)]);
      expect(acoes()).not.toContain('Editar NB-0001');
      expect(acoes()).not.toContain('Editar NB-0002');
      expect(acoes()).toContain('Editar NB-0003');
    });
  });
});
