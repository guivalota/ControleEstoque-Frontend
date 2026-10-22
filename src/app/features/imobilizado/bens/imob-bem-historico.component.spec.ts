import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { ImobBemHistoricoComponent } from './imob-bem-historico.component';
import { ImobBemHistorico } from '../../../core/models/imob-bem.model';

const URL_HIST = '/api/v1/imobilizado/bens/42/historico';

const e = (id: number, extra: Partial<ImobBemHistorico> = {}): ImobBemHistorico => ({
  id, campo: 'descricao', valorAnterior: 'Notebook Dell', valorNovo: 'Notebook Dell Latitude',
  valorAnteriorDescricao: null, valorNovoDescricao: null, usuarioId: '3f2b9a52-aaaa-bbbb-cccc-ddddeeeeffff',
  usuarioNome: 'Maria Operadora', criadoEm: '2026-10-22T14:03:11Z', ...extra
});

describe('ImobBemHistoricoComponent', () => {
  let fixture: ComponentFixture<ImobBemHistoricoComponent>;
  let comp: ImobBemHistoricoComponent;
  let ctrl: HttpTestingController;
  const texto = () => ((fixture.nativeElement as HTMLElement).textContent ?? '').replace(/\s+/g, ' ');

  const pedido = (page: number) =>
    ctrl.expectOne(r => r.url === URL_HIST && r.params.get('page') === String(page));
  const responder = (req: TestRequest, items: ImobBemHistorico[], total = items.length, page = 1) => {
    req.flush({ items, page, pageSize: 20, total });
    fixture.detectChanges();
  };

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [ImobBemHistoricoComponent], providers: [provideHttpClient(), provideHttpClientTesting()] });
    ctrl = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ImobBemHistoricoComponent);
    comp = fixture.componentInstance;
    fixture.componentRef.setInput('bemId', 42);
    fixture.detectChanges();
  });

  afterEach(() => ctrl.verify());

  it('mostra carregando e pede a primeira página com pageSize 20', () => {
    expect(texto()).toContain('Carregando histórico');
    const req = pedido(1);
    expect(req.request.params.get('pageSize')).toBe('20');
    responder(req, []);
  });

  it('estado vazio', () => {
    responder(pedido(1), []);
    expect(texto()).toContain('Nenhuma alteração registrada');
  });

  it('mostra o cadastro do bem, com a plaqueta', () => {
    responder(pedido(1), [e(12, { campo: 'criacao', valorAnterior: null, valorNovo: 'NB-0001', usuarioNome: 'João Admin',
      criadoEm: '2026-10-20T09:15:40Z' })]);
    expect(texto()).toContain('João Admin');
    expect(texto()).toContain('Bem cadastrado (plaqueta NB-0001)');
  });

  it('mostra a exclusão do bem, com a plaqueta', () => {
    responder(pedido(1), [e(13, { campo: 'exclusao', valorAnterior: 'NB-0001', valorNovo: null })]);
    expect(texto()).toContain('Bem excluído (plaqueta NB-0001)');
  });

  it('mostra rótulos amigáveis e valores formatados: nomes de referência, BRL, data e "—"', () => {
    responder(pedido(1), [
      e(20, { campo: 'local_id', valorAnterior: '7', valorNovo: '9', valorAnteriorDescricao: 'Sala 101', valorNovoDescricao: 'Almoxarifado' }),
      e(21, { campo: 'responsavel_id', valorAnterior: null, valorNovo: '12', valorAnteriorDescricao: null, valorNovoDescricao: 'Ana Souza' }),
      e(22, { campo: 'categoria_id', valorAnterior: '3', valorNovo: '4', valorAnteriorDescricao: null, valorNovoDescricao: null }),
      e(23, { campo: 'valor_aquisicao', valorAnterior: '1500.00', valorNovo: '1800.5' }),
      e(24, { campo: 'data_aquisicao', valorAnterior: '2024-03-10', valorNovo: '2024-04-01' }),
      e(25, { campo: 'numero_serie', valorAnterior: 'SN-1', valorNovo: null }),
      e(26, { campo: 'vida_util_meses', valorAnterior: '60', valorNovo: '48' })
    ]);
    // o espaço entre elementos não existe no texto do DOM: compara sem espaços
    const t = texto().replace(/\s/g, '');
    const tem = (trecho: string) => expect(t).toContain(trecho.replace(/\s/g, ''));
    tem('Local: Sala 101');
    tem('Almoxarifado');
    tem('Responsável: — ');
    tem('Ana Souza');
    tem('Categoria: #3');
    tem('#4');
    tem('R$ 1.500,00');
    tem('R$ 1.800,50');
    tem('10/03/2024');
    tem('01/04/2024');
    tem('Nº de série: SN-1');
    tem('Vida útil (meses): 60');
  });

  it('agrupa as entradas de uma mesma edição sob um só usuário e horário', () => {
    responder(pedido(1), [
      e(3, { campo: 'local_id', valorAnterior: '7', valorNovo: '9', valorAnteriorDescricao: 'Sala 101', valorNovoDescricao: 'Almoxarifado' }),
      e(2, { campo: 'descricao' }),
      e(1, { campo: 'criacao', valorAnterior: null, valorNovo: 'NB-1', criadoEm: '2026-10-20T09:15:40Z' })
    ]);
    const cartoes = (fixture.nativeElement as HTMLElement).querySelectorAll('ol > li');
    expect(cartoes.length).toBe(2);
    expect(cartoes[0].querySelectorAll('ul > li').length).toBe(2);
    expect(cartoes[0].textContent).toContain('Maria Operadora');
    expect(cartoes[1].querySelectorAll('ul > li').length).toBe(1);
  });

  it('sem nome de usuário, mostra o id abreviado', () => {
    responder(pedido(1), [e(1, { usuarioNome: null })]);
    expect(texto()).toContain('Usuário 3f2b9a52');
  });

  it('exibe a data e hora de cada grupo', () => {
    responder(pedido(1), [e(1)]);
    const time = (fixture.nativeElement as HTMLElement).querySelector('time')!;
    expect(time.getAttribute('datetime')).toBe('2026-10-22T14:03:11Z');
    expect(time.textContent).toMatch(/\d{2}\/\d{2}\/\d{2,4} \d{2}:\d{2}/);
  });

  describe('carregar mais', () => {
    const pagina1 = () => [e(30, { campo: 'local_id', criadoEm: '2026-10-22T14:03:11Z' }), e(29, { criadoEm: '2026-10-21T10:00:00Z' })];

    it('só aparece quando há mais itens e mostra o andamento', () => {
      responder(pedido(1), pagina1(), 2);
      expect(texto()).toContain('Exibindo 2 de 2');
      expect(texto()).not.toContain('Carregar mais');
    });

    it('busca a próxima página e acrescenta ao final', () => {
      responder(pedido(1), pagina1(), 3);
      expect(texto()).toContain('Exibindo 2 de 3');
      expect(texto()).toContain('Carregar mais');

      comp.carregarMais();
      expect(comp.carregandoMais()).toBeTrue();
      responder(pedido(2), [e(28, { criadoEm: '2026-10-20T09:00:00Z', valorNovo: 'Antigo' })], 3, 2);

      expect(comp.itens().map(i => i.id)).toEqual([30, 29, 28]);
      expect(texto()).toContain('Exibindo 3 de 3');
      expect(texto()).not.toContain('Carregar mais');
      expect(comp.carregandoMais()).toBeFalse();
    });

    it('junta no mesmo grupo entradas da mesma edição que caíram em páginas diferentes', () => {
      responder(pedido(1), [e(10, { criadoEm: '2026-10-22T14:03:11Z', campo: 'descricao' })], 2);
      comp.carregarMais();
      responder(pedido(2), [e(9, { criadoEm: '2026-10-22T14:03:11Z', campo: 'plaqueta' })], 2, 2);
      expect(comp.grupos().length).toBe(1);
      expect(comp.grupos()[0].entradas.length).toBe(2);
    });

    it('ignora entradas repetidas quando novas alterações deslocam as páginas', () => {
      responder(pedido(1), pagina1(), 4);
      comp.carregarMais();
      responder(pedido(2), [e(29), e(28)], 4, 2);
      expect(comp.itens().map(i => i.id)).toEqual([30, 29, 28]);
    });

    it('cliques repetidos não disparam requisições duplicadas', () => {
      responder(pedido(1), pagina1(), 4);
      comp.carregarMais();
      comp.carregarMais();
      responder(pedido(2), [e(28)], 4, 2);
      expect(comp.itens().length).toBe(3);
    });

    it('falha ao carregar mais mantém o que já foi carregado e permite tentar de novo', () => {
      responder(pedido(1), pagina1(), 4);
      comp.carregarMais();
      pedido(2).flush({}, { status: 500, statusText: 'Server Error' });
      fixture.detectChanges();
      expect(comp.itens().length).toBe(2);
      expect(texto()).toContain('Erro ao carregar o histórico');
      expect(texto()).toContain('Carregar mais');

      comp.carregarMais();
      expect(comp.erroMais()).toBe('');
      responder(pedido(2), [e(28), e(27)], 4, 2);
      expect(comp.itens().length).toBe(4);
    });
  });

  describe('erros', () => {
    it('falha na primeira carga oferece tentar novamente', () => {
      pedido(1).flush({}, { status: 500, statusText: 'Server Error' });
      fixture.detectChanges();
      expect(texto()).toContain('Erro ao carregar o histórico');
      expect(texto()).toContain('Tentar novamente');

      comp.carregar();
      responder(pedido(1), [e(1)]);
      expect(texto()).not.toContain('Erro ao carregar');
      expect(texto()).toContain('Maria Operadora');
    });

    it('404 informa que o histórico está indisponível', () => {
      pedido(1).flush({ error: 'Bem não encontrado.' }, { status: 404, statusText: 'Not Found' });
      fixture.detectChanges();
      expect(texto()).toContain('Histórico indisponível');
    });
  });
});
