import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { ImobContagemComponent } from './imob-contagem.component';
import { ImobInventario } from '../../../core/models/imob-inventario.model';
import { provideAuthFake } from '../../../testing/auth-fake';

const API = '/api/v1/imobilizado';

const inv = (extra: Partial<ImobInventario> = {}): ImobInventario => ({
  id: 7, nome: 'Reavaliação 2026', descricao: '', status: 'em_andamento', dataInicio: '2026-10-22T14:03:11Z', dataFim: null,
  criadoPorId: 'u1', criadoPorNome: 'Maria', criadoEm: '2026-10-20T09:00:00Z', atualizadoEm: '2026-10-20T09:00:00Z',
  totalLocais: 1, totalEsperados: 10, reavaliacao: true, locais: [{ localId: 1, localNome: 'Matriz' }], equipe: [], ...extra
});

describe('ImobContagemComponent — conferência da reavaliação', () => {
  let fixture: ComponentFixture<ImobContagemComponent>;
  let comp: ImobContagemComponent;
  let ctrl: HttpTestingController;
  const el = () => fixture.nativeElement as HTMLElement;
  const texto = () => (el().textContent ?? '').replace(/\s+/g, ' ');
  const listaLeituras = (r: { url: string }) => r.url === `${API}/inventarios/7/leituras`;
  const listaConferencias = (r: { url: string }) => r.url === `${API}/inventarios/7/conferencias`;
  const linha = (extra: object = {}) => ({
    bemId: 1, plaqueta: 'NB-1', descricao: 'Notebook', localEsperadoNome: 'Matriz', encontrado: true, estadoNome: 'Bom',
    valorMercado: 150, departamentoNome: 'Tecnologia', conferidoPorNome: 'Maria', conferidoEm: '2026-11-09T11:00:00Z', incompleto: false, ...extra
  });
  const resumo = { esperados: 3, encontrados: 2, naoEncontrados: 1, completos: 1, incompletos: 1 };
  const respostaConferencias = (items: object[] = [linha(), linha({ bemId: 2, plaqueta: 'NB-2', estadoNome: null, valorMercado: null, incompleto: true }),
    linha({ bemId: 3, plaqueta: 'NB-3', encontrado: false, estadoNome: null, valorMercado: null, conferidoEm: null })]) =>
    ({ inventarioReavaliacao: true, items, page: 1, pageSize: 20, total: items.length, resumo });
  /** Lista de um inventário comum: bens lidos, sem estado nem valor. */
  const respostaComum = (items: object[] = []) =>
    ({ inventarioReavaliacao: false, items, page: 1, pageSize: 20, total: items.length, resumo: { esperados: 10, encontrados: items.length, naoEncontrados: 10 - items.length, completos: 0, incompletos: 0 } });
  /** Atende o recarregamento da lista feito depois de gravar algo. */
  const recarregouConferencias = (corpo = respostaConferencias()) => ctrl.expectOne(listaConferencias).flush(corpo);

  let itensComuns: object[] = [];

  function montar(i: ImobInventario = inv()) {
    TestBed.configureTestingModule({
      imports: [ImobContagemComponent],
      providers: [
        provideRouter([]), provideHttpClient(), provideHttpClientTesting(), provideAuthFake('admin'),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: '7' }) } } }
      ]
    });
    ctrl = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ImobContagemComponent);
    comp = fixture.componentInstance;
    fixture.detectChanges();
    ctrl.expectOne(`${API}/inventarios/7`).flush(i);
    ctrl.expectOne(`${API}/locais/arvore`).flush([]);
    if (i.status === 'em_andamento') ctrl.expectOne(listaLeituras).flush({ items: [], page: 1, pageSize: 20, total: 0 });
    if (i.reavaliacao) {
      ctrl.expectOne(r => r.url === `${API}/estados-conservacao`).flush({
        items: [{ id: 2, nome: 'Bom', notaEc: 1, notaVidaRemanescente: 1, ativo: true }], page: 1, pageSize: 200, total: 1
      });
      ctrl.expectOne(r => r.url === `${API}/departamentos`).flush({
        items: [{ id: 5, codigo: 'TI', nome: 'Tecnologia', ativo: true }], page: 1, pageSize: 1000, total: 1
      });
      ctrl.expectOne(listaConferencias).flush(respostaConferencias());
    } else {
      // a conferência existe em todo inventário: a leitura do bem cria a dele
      ctrl.expectOne(listaConferencias).flush(respostaComum(itensComuns));
    }
    fixture.detectChanges();
  }

  afterEach(() => ctrl.verify());

  it('inventário comum não mostra campos nem CSV de conferência e não carrega as listas de estado e departamento', () => {
    montar(inv({ reavaliacao: false }));
    expect(texto()).not.toContain('Conferência da reavaliação');
    expect(texto()).not.toContain('Importar conferências');
    expect(texto()).not.toContain('Conferências do ciclo');
  });

  describe('inventário comum: itens conferidos (E28 / DSG-30 R15)', () => {
    const item = (extra: object = {}) => ({
      bemId: 17, plaqueta: 'DEMO-0009', descricao: 'Estacao de trabalho', localEsperadoNome: 'Filial Sul', encontrado: true,
      conferidoPorNome: 'Usuario', conferidoEm: '2026-11-11T17:06:00Z', incompleto: false, qtdFotos: 3, primeiraFotoId: 1, ...extra
    });

    it('mostra o cartão "Itens conferidos" com o resumo, as fotos e o botão Detalhe', () => {
      itensComuns = [item(), item({ bemId: 18, plaqueta: 'DEMO-0010', localEsperadoNome: null, qtdFotos: 0 })];
      montar(inv({ reavaliacao: false }));

      expect(el().querySelector('[data-testid="itens-conferidos"]')).not.toBeNull();
      const t = texto();
      expect(t).toContain('DEMO-0009');
      expect(t).toContain('Fora do esperado');
      expect(t).toContain('10 esperados');
      expect(t).toContain('2 lidos');
      expect(el().querySelector('[aria-label="3 foto(s)"]')).not.toBeNull();
      expect(el().querySelector('button[aria-label="Detalhe do item DEMO-0009"]')).not.toBeNull();
    });

    it('sem leituras mostra a mensagem vazia', () => {
      itensComuns = [];
      montar(inv({ reavaliacao: false }));
      expect(texto()).toContain('Nenhum bem foi lido neste inventário ainda');
    });

    it('item com a leitura anulada é sinalizado', () => {
      itensComuns = [item({ encontrado: false })];
      montar(inv({ reavaliacao: false }));
      expect(texto()).toContain('Leitura anulada');
    });

    it('Detalhe abre a conferência do item e os atalhos para o bem seguem as permissões', () => {
      itensComuns = [item()];
      montar(inv({ reavaliacao: false }));

      el().querySelector<HTMLButtonElement>('button[aria-label="Detalhe do item DEMO-0009"]')!.click();
      fixture.detectChanges();

      expect(comp.confDetalheBemId()).toBe(17);
      ctrl.expectOne(`${API}/inventarios/7/conferencias/17`).flush({
        inventarioId: 7, inventarioReavaliacao: false, inventarioNome: 'Conferencia 11/2026', inventarioStatus: 'em_andamento', bemId: 17,
        plaqueta: 'DEMO-0009', encontrado: true, incompleto: false, somenteLeitura: false, eventos: []
      });
      ctrl.expectOne(`${API}/inventarios/7/conferencias/17/fotos`).flush([]);
      fixture.detectChanges();
      expect(texto()).toContain('Conferência · DEMO-0009');
      expect(el().querySelector('[data-testid="abrir-bem"]')).not.toBeNull();
      expect(el().querySelector('[data-testid="editar-bem"]')).not.toBeNull();
    });
  });

  it('reavaliação mostra os campos de conferência, o botão e o CSV de conferências', () => {
    montar();
    expect(texto()).toContain('Estado de conservação');
    expect(texto()).toContain('Bom');
    expect(texto()).toContain('Tecnologia');
    expect(texto()).toContain('Só conferir');
    expect(texto()).toContain('Importar conferências por CSV');
  });

  it('a leitura leva a conferência preenchida e mostra o resultado', () => {
    montar();
    comp.local.setValue(1);
    comp.plaqueta.setValue('NB-1');
    comp.estado.setValue(2);
    comp.valorMercado.setValue(150);
    comp.registrar();
    const req = ctrl.expectOne(listaLeituras);
    expect(req.request.method).toBe('POST');
    expect(req.request.body.conferencia).toEqual({ estadoId: 2, valorMercado: 150 });
    req.flush({
      id: 1, clientId: 'c', plaqueta: 'NB-1', localLidoId: 1, localLidoNome: 'Matriz', usuarioId: 'u', lidoEm: '2026-11-08T10:00:00Z',
      origem: 'web', criadoEm: '2026-11-08T10:00:00Z', anulada: false, reaproveitada: false, conferencia: 'gravada',
      info: { plaqueta: 'NB-1', noEsperado: true, leiturasAtivas: 1, situacaoPrevista: 'no_local_esperado' }
    });
    ctrl.expectOne(r => listaLeituras(r) && r.method === 'GET').flush({ items: [], page: 1, pageSize: 20, total: 0 });
    recarregouConferencias();
    fixture.detectChanges();
    expect(texto()).toContain('Conferência gravada');
    expect(comp.estado.value).toBeNull();
  });

  it('a leitura sem campos de conferência não envia o objeto', () => {
    montar();
    comp.local.setValue(1);
    comp.plaqueta.setValue('NB-2');
    comp.registrar();
    const req = ctrl.expectOne(listaLeituras);
    expect(req.request.body.conferencia).toBeUndefined();
    req.flush({ error: 'x' }, { status: 400, statusText: 'Bad Request' });
  });

  it('valor de mercado negativo é barrado antes de enviar', () => {
    montar();
    comp.local.setValue(1);
    comp.plaqueta.setValue('NB-3');
    comp.valorMercado.setValue(-1);
    comp.registrar();
    expect(comp.erro()).toContain('negativo');
  });

  it('"Só conferir" exige algum campo e envia o lote por plaqueta sem local', () => {
    montar();
    comp.plaqueta.setValue('NB-4');
    comp.soConferir();
    expect(comp.erro()).toContain('ao menos');

    comp.departamento.setValue(5);
    comp.soConferir();
    const req = ctrl.expectOne(`${API}/inventarios/7/conferencias/lote`);
    expect(req.request.body).toEqual({ itens: [{ plaqueta: 'NB-4', departamentoId: 5 }] });
    req.flush({ gravadas: 1, ignoradas: 0, foraDoEsperado: 0, comErro: 0, itens: [{ indice: 0, plaqueta: 'NB-4', resultado: 'gravada' }] });
    recarregouConferencias();
    fixture.detectChanges();
    expect(texto()).toContain('NB-4: Conferência gravada');
    expect(comp.plaqueta.value).toBe('');
  });

  it('"Só conferir" mantém os dados quando o bem está fora do esperado', () => {
    montar();
    comp.plaqueta.setValue('NB-5');
    comp.estado.setValue(2);
    comp.soConferir();
    ctrl.expectOne(`${API}/inventarios/7/conferencias/lote`).flush({
      gravadas: 0, ignoradas: 0, foraDoEsperado: 1, comErro: 0, itens: [{ indice: 0, plaqueta: 'NB-5', resultado: 'fora_do_esperado' }]
    });
    recarregouConferencias();
    fixture.detectChanges();
    expect(texto()).toContain('fora do esperado');
    expect(comp.plaqueta.value).toBe('NB-5');
  });

  it('mostra o resumo e uma linha por bem esperado, marcando os incompletos', () => {
    montar();
    const c = el().querySelector('[data-testid="conferencias-ciclo"]') as HTMLElement;
    const txt = (c.textContent ?? '').replace(/\s+/g, ' ');
    expect(txt).toContain('3 esperados');
    expect(txt).toContain('2 encontrados');
    expect(txt).toContain('1 não encontrados');
    expect(txt).toContain('1 sem estado ou sem valor');
    expect(c.querySelectorAll('tbody tr').length).toBe(3);
    expect(txt).toContain('NB-1');
    expect(txt).toContain('Completo');
    expect(txt).toContain('Incompleto');
    expect(txt).toContain('Não encontrado');
    expect(txt).toContain('R$');
    expect(txt).toContain('Maria');
  });

  it('o filtro de situação e a busca vão para a API e voltam à primeira página', () => {
    montar();
    comp.confSituacao.setValue('incompletos');
    comp.confBusca.setValue(' nb ');
    comp.carregarConferencias(1);
    const req = ctrl.expectOne(listaConferencias);
    expect(req.request.params.get('situacao')).toBe('incompletos');
    expect(req.request.params.get('busca')).toBe('nb');
    expect(req.request.params.get('page')).toBe('1');
    req.flush(respostaConferencias([linha({ bemId: 2, plaqueta: 'NB-2', incompleto: true })]));
    fixture.detectChanges();
    expect(el().querySelectorAll('[data-testid="conferencias-ciclo"] tbody tr').length).toBe(1);
  });

  it('"todos" não envia o filtro de situação', () => {
    montar();
    comp.carregarConferencias(1);
    const req = ctrl.expectOne(listaConferencias);
    expect(req.request.params.has('situacao')).toBeFalse();
    req.flush(respostaConferencias());
  });

  it('erro ao listar as conferências mostra a mensagem do servidor', () => {
    montar();
    comp.carregarConferencias(1);
    ctrl.expectOne(listaConferencias).flush({ error: 'Este inventário não é de reavaliação.' }, { status: 400, statusText: 'Bad Request' });
    fixture.detectChanges();
    expect(texto()).toContain('não é de reavaliação');
  });

  it('importar o CSV (e não só validar) recarrega a lista', () => {
    montar();
    comp.arquivoConf.set(new File(['plaqueta\nNB-1'], 'c.csv'));
    comp.validarConf();
    ctrl.expectOne(`${API}/inventarios/7/conferencias/importacao`).flush({ somenteValidacao: true, erros: [], colunasIgnoradas: [] });
    comp.importarConf();
    ctrl.expectOne(`${API}/inventarios/7/conferencias/importacao`).flush({ somenteValidacao: false, erros: [], colunasIgnoradas: [] });
    recarregouConferencias();
    expect(comp.relatorioConf()?.somenteValidacao).toBeFalse();
  });
});
