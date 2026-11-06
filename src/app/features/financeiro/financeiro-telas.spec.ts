import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { provideAuthFake } from '../../testing/auth-fake';
import { EmpresaAtivaService } from '../../core/services/empresa-ativa.service';
import { ToastService } from '../../core/services/toast.service';
import { Aprovacao } from '../../core/models/aprovacao.model';
import { FluxoCaixa, Importacao, RelatorioTabela } from '../../core/models/financeiro-relatorios.model';
import { Recorrencia } from '../../core/models/financeiro-titulos.model';
import { AprovacoesComponent } from '../aprovacoes/aprovacoes.component';
import { FinanceiroInicioComponent } from './financeiro-inicio.component';
import { FluxoCaixaComponent } from './fluxo-caixa/fluxo-caixa.component';
import { ImportacoesComponent } from './importacoes/importacoes.component';
import { RelatoriosFinanceiroComponent } from './relatorios/relatorios-financeiro.component';
import { ContasFixasComponent } from './recorrencias/contas-fixas.component';
import { CadastrosFinanceiroComponent } from './cadastros/cadastros-financeiro.component';

const API = '/api/v1';
const pagina = <T>(items: T[]) => ({ items, page: 1, pageSize: 100, total: items.length });

function preparar(permissoes: string[], extras: unknown[] = []) {
  TestBed.configureTestingModule({
    providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), provideAuthFake('admin'), ...(extras as never[])]
  });
  const empresa = TestBed.inject(EmpresaAtivaService);
  empresa.empresas.set([{ id: 1, razaoSocial: 'X', cnpj: '', ativo: true, criadoEm: '', perfil: 'admin', modulos: ['financeiro'], permissoes }]);
  empresa.id.set(1);
  return TestBed.inject(HttpTestingController);
}

function auxiliares(ctrl: HttpTestingController, dados: Record<string, unknown[]> = {}) {
  for (const p of ctrl.match(r => /\/v1\/(fornecedores|clientes|financeiro\/(categorias|centros-custo|contas))$/.test(r.url)))
    p.flush(pagina(dados[p.request.url.split('/').pop()!] ?? []));
}

const aprovacao = (id: number, extra: Partial<Aprovacao> = {}): Aprovacao => ({
  id, tipo: 'fin_titulo_pagamento', tipoNome: 'Pagamento de título', entidadeTipo: 'fin_titulo', entidadeId: String(id + 100), titulo: `Pedido ${id}`, valor: 2000,
  solicitanteId: 'u1', solicitanteNome: 'Ana', status: 'pendente', decisorNome: null, decididoEm: null, decisaoMotivo: null, criadoEm: '2026-11-05T12:00:00Z', podeDecidir: true, ...extra
});

describe('AprovacoesComponent', () => {
  let ctrl: HttpTestingController;
  afterEach(() => ctrl.verify());

  function iniciar(permissoes = ['core.aprovacoes.ver', 'core.aprovacoes.decidir']) {
    ctrl = preparar(permissoes, [{ provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap({}) } } }]);
    const f = TestBed.createComponent(AprovacoesComponent);
    f.detectChanges();
    return f;
  }
  const lista = () => ctrl.expectOne(r => r.url === `${API}/aprovacoes`);
  const botao = (f: { nativeElement: HTMLElement }, rotulo: string) => f.nativeElement.querySelector<HTMLButtonElement>(`button[aria-label="${rotulo}"]`);

  it('lista pendentes por padrão e leva ao título da origem', () => {
    const f = iniciar();
    const req = lista();
    expect(req.request.params.get('status')).toBe('pendente');
    req.flush(pagina([aprovacao(1)]));
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('Pedido 1');
    expect(f.nativeElement.querySelector('a[href="/financeiro/titulos/101"]')).not.toBeNull();
  });

  it('o solicitante não decide o próprio pedido: pede a outro administrador', () => {
    const f = iniciar();
    lista().flush(pagina([aprovacao(1, { podeDecidir: false })]));
    f.detectChanges();
    expect(botao(f, 'Aprovar Pedido 1')).toBeNull();
    expect(f.nativeElement.textContent).toContain('Peça a outro administrador');
  });

  it('aprova com um clique e recarrega', () => {
    const f = iniciar();
    lista().flush(pagina([aprovacao(1)]));
    f.detectChanges();
    const toast = TestBed.inject(ToastService);
    spyOn(toast, 'sucesso');
    botao(f, 'Aprovar Pedido 1')!.click();
    const req = ctrl.expectOne(r => r.method === 'POST' && r.url === `${API}/aprovacoes/1/decidir`);
    expect(req.request.body).toEqual({ aprovar: true, motivo: null });
    req.flush({ ...aprovacao(1, { status: 'aprovada' }), historico: [] });
    lista().flush(pagina([]));
    expect(toast.sucesso).toHaveBeenCalledWith('Pedido aprovado.');
  });

  it('recusar exige motivo', () => {
    const f = iniciar();
    lista().flush(pagina([aprovacao(1)]));
    f.detectChanges();
    botao(f, 'Recusar Pedido 1')!.click();
    f.detectChanges();
    const confirmar = Array.from((f.nativeElement as HTMLElement).querySelectorAll('button')).find(b => b.textContent?.includes('Confirmar recusa'))!;
    expect(confirmar.disabled).toBeTrue();

    f.componentInstance.motivo = ' fora do orçamento ';
    f.componentInstance.recusar(aprovacao(1));
    const req = ctrl.expectOne(r => r.method === 'POST' && r.url === `${API}/aprovacoes/1/decidir`);
    expect(req.request.body).toEqual({ aprovar: false, motivo: 'fora do orçamento' });
    req.flush({ ...aprovacao(1, { status: 'recusada' }), historico: [] });
    lista().flush(pagina([]));
  });

  it('quem só consulta não vê botões de decisão', () => {
    const f = iniciar(['core.aprovacoes.ver']);
    lista().flush(pagina([aprovacao(1)]));
    f.detectChanges();
    expect(botao(f, 'Aprovar Pedido 1')).toBeNull();
    expect(botao(f, 'Recusar Pedido 1')).toBeNull();
  });
});

describe('ImportacoesComponent', () => {
  let ctrl: HttpTestingController;
  afterEach(() => ctrl.verify());

  const importacao = (id: number, extra: Partial<Importacao> = {}): Importacao => ({
    id, tipo: 'estoque.nota_fiscal_entrada_confirmada', tipoNome: 'Nota fiscal de entrada', descricao: `NF ${id}/1`, pessoa: 'Tecidos Alfa', valor: 300, data: '2026-10-20',
    situacao: 'aguardando', tentativas: 0, ultimoErro: null, criadoEm: '', ...extra
  });

  function iniciar() {
    ctrl = preparar(['financeiro.importacoes.gerenciar']);
    const f = TestBed.createComponent(ImportacoesComponent);
    f.detectChanges();
    auxiliares(ctrl, { 'categorias': [{ id: 1, nome: 'Matéria-prima', natureza: 'despesa', paiId: null, nivel: 1, ativo: true, criadoEm: '' }, { id: 2, nome: 'Vendas', natureza: 'receita', paiId: null, nivel: 1, ativo: true, criadoEm: '' }] });
    ctrl.expectOne(r => r.url === `${API}/financeiro/importacoes`).flush([importacao(1), importacao(2, { situacao: 'erro', ultimoErro: 'Limite do plano atingido' })]);
    f.detectChanges();
    return f;
  }

  it('lista os lançamentos com situação e erro; só categorias de despesa nos ajustes', () => {
    const f = iniciar();
    const texto = f.nativeElement.textContent ?? '';
    expect(texto).toContain('Aguardando confirmação');
    expect(texto).toContain('Limite do plano atingido');
    expect(f.componentInstance.categorias().map(c => c.nome)).toEqual(['Matéria-prima']);
  });

  it('importar envia vencimento e categoria informados e recarrega', () => {
    const f = iniciar();
    f.componentInstance.abrirAjustes(f.componentInstance.itens()[0]);
    f.componentInstance.vencimento = '2027-01-15';
    f.componentInstance.categoriaId = 1;
    const toast = TestBed.inject(ToastService);
    spyOn(toast, 'sucesso');

    f.componentInstance.confirmar(f.componentInstance.itens()[0]);

    const req = ctrl.expectOne(r => r.method === 'POST' && r.url === `${API}/financeiro/importacoes/1/confirmar`);
    expect(req.request.body).toEqual({ vencimento: '2027-01-15', categoriaId: 1 });
    req.flush(null);
    ctrl.expectOne(r => r.url === `${API}/financeiro/importacoes`).flush([]);
    expect(toast.sucesso).toHaveBeenCalledWith('Título gerado.');
  });

  it('descartar pede confirmação', () => {
    const f = iniciar();
    spyOn(window, 'confirm').and.returnValues(false, true);
    f.componentInstance.descartar(f.componentInstance.itens()[0]);
    ctrl.expectNone(r => r.method === 'POST');
    f.componentInstance.descartar(f.componentInstance.itens()[0]);
    ctrl.expectOne(r => r.method === 'POST' && r.url === `${API}/financeiro/importacoes/1/descartar`).flush(null);
    ctrl.expectOne(r => r.url === `${API}/financeiro/importacoes`).flush([]);
  });

  it('erro ao importar mostra a mensagem do servidor', () => {
    const f = iniciar();
    const toast = TestBed.inject(ToastService);
    spyOn(toast, 'erro');
    f.componentInstance.confirmar(f.componentInstance.itens()[0]);
    ctrl.expectOne(r => r.method === 'POST').flush({ error: 'Limite do plano atingido' }, { status: 400, statusText: 'Bad Request' });
    expect(toast.erro).toHaveBeenCalledWith('Limite do plano atingido');
  });
});

describe('ContasFixasComponent', () => {
  let ctrl: HttpTestingController;
  afterEach(() => ctrl.verify());

  const conta = (id: number, extra: Partial<Recorrencia> = {}): Recorrencia => ({
    id, tipo: 'pagar', fornecedorId: null, clienteId: null, pessoaNome: 'Locador', descricao: 'Aluguel', documento: null, valor: 1500, diaVencimento: 5,
    categoriaId: 1, categoriaNome: 'Aluguel', centroCustoId: null, centroCustoNome: null, inicio: '2026-01-01', fim: null, ativo: true, ultimaCompetencia: '2026-12-01', criadoEm: '', ...extra
  });

  function iniciar() {
    ctrl = preparar(['financeiro.titulos.ver', 'financeiro.titulos.criar', 'financeiro.titulos.editar']);
    const f = TestBed.createComponent(ContasFixasComponent);
    f.detectChanges();
    auxiliares(ctrl, { categorias: [{ id: 1, nome: 'Aluguel', natureza: 'despesa', paiId: null, nivel: 1, ativo: true, criadoEm: '' }] });
    ctrl.expectOne(r => r.url === `${API}/financeiro/recorrencias`).flush(pagina([conta(1), conta(2, { ativo: false, descricao: 'Internet' })]));
    f.detectChanges();
    return f;
  }

  it('lista com a situação (ativa/encerrada)', () => {
    const f = iniciar();
    const texto = f.nativeElement.textContent ?? '';
    expect(texto).toContain('Ativa');
    expect(texto).toContain('Encerrada');
    expect(texto).toContain('sem fim');
  });

  it('cria com o corpo certo e recarrega', () => {
    const f = iniciar();
    f.componentInstance.nova();
    f.componentInstance.form.patchValue({ pessoaNome: ' Locador ', descricao: 'Aluguel', valor: 1500, diaVencimento: 31, categoriaId: 1, inicio: '2026-02-01' });
    f.componentInstance.salvar();

    const req = ctrl.expectOne(r => r.method === 'POST' && r.url === `${API}/financeiro/recorrencias`);
    expect(req.request.body).toEqual(jasmine.objectContaining({ tipo: 'pagar', pessoaNome: 'Locador', valor: 1500, diaVencimento: 31, categoriaId: 1, inicio: '2026-02-01', fim: null }));
    req.flush(conta(3));
    ctrl.expectOne(r => r.url === `${API}/financeiro/recorrencias`).flush(pagina([]));
  });

  it('dia fora de 1 a 31 não envia', () => {
    const f = iniciar();
    f.componentInstance.nova();
    f.componentInstance.form.patchValue({ pessoaNome: 'x', descricao: 'x', valor: 1, diaVencimento: 32, categoriaId: 1 });
    f.componentInstance.salvar();
    ctrl.expectNone(r => r.method === 'POST');
  });

  it('alterar manda só os campos editáveis, e sem data final pede para limpar o fim', () => {
    const f = iniciar();
    f.componentInstance.alterar(conta(1));
    f.componentInstance.form.patchValue({ valor: 1700 });
    f.componentInstance.salvar();
    const req = ctrl.expectOne(r => r.method === 'PUT' && r.url === `${API}/financeiro/recorrencias/1`);
    expect(req.request.body.valor).toBe(1700);
    expect(req.request.body.limparFim).toBeTrue();
    expect('tipo' in req.request.body).toBeFalse();
    req.flush(conta(1));
    ctrl.expectOne(r => r.url === `${API}/financeiro/recorrencias`).flush(pagina([]));
  });

  it('encerrar envia ativo=false', () => {
    const f = iniciar();
    f.componentInstance.alternar(conta(1));
    const req = ctrl.expectOne(r => r.method === 'PUT' && r.url === `${API}/financeiro/recorrencias/1`);
    expect(req.request.body).toEqual({ ativo: false });
    req.flush(conta(1, { ativo: false }));
    ctrl.expectOne(r => r.url === `${API}/financeiro/recorrencias`).flush(pagina([]));
  });
});

describe('FluxoCaixaComponent', () => {
  let ctrl: HttpTestingController;
  afterEach(() => ctrl.verify());

  const fluxo = (extra: Partial<FluxoCaixa> = {}): FluxoCaixa => ({
    de: '2026-11-01', ate: '2026-11-30', agrupar: 'semana', contaId: null, previstoIncluido: true,
    periodos: [
      { inicio: '2026-11-01', fim: '2026-11-08', entradasPrevistas: 400, saidasPrevistas: 300, entradasRealizadas: 480, saidasRealizadas: 105, saldoRealizado: 1375, saldoProjetado: 1475 },
      { inicio: '2026-11-09', fim: '2026-11-15', entradasPrevistas: 0, saidasPrevistas: 100, entradasRealizadas: 0, saidasRealizadas: 0, saldoRealizado: 1375, saldoProjetado: 1375 }
    ],
    contas: [{ contaId: 1, nome: 'Banco', tipo: 'banco', ativo: true, saldoInicial: 1000, dataSaldoInicial: '2026-11-01', saldoFinal: 1375 }],
    totalEntradasPrevistas: 400, totalSaidasPrevistas: 400, totalEntradasRealizadas: 480, totalSaidasRealizadas: 105, ...extra
  });

  function iniciar() {
    ctrl = preparar(['financeiro.relatorios.ver']);
    const f = TestBed.createComponent(FluxoCaixaComponent);
    f.detectChanges();
    auxiliares(ctrl, { contas: [{ id: 1, nome: 'Banco', tipo: 'banco', saldoInicial: 0, dataSaldoInicial: '2026-01-01', ativo: true, criadoEm: '' }] });
    return f;
  }

  it('pede o fluxo do mês corrente agrupado por dia, desenha as barras e mostra a tabela com os mesmos números', () => {
    const f = iniciar();
    const req = ctrl.expectOne(r => r.url === `${API}/financeiro/fluxo-caixa`);
    expect(req.request.params.get('agrupar')).toBe('dia');
    req.flush(fluxo());
    f.detectChanges();

    const el = f.nativeElement as HTMLElement;
    expect(el.querySelectorAll('rect.barra-entrada').length).toBe(2);
    expect(el.querySelectorAll('rect.barra-saida').length).toBe(2);
    expect(el.querySelectorAll('polyline').length).toBe(2);
    expect((el.textContent ?? '').replace(/\u00a0/g, ' ')).toContain('R$ 1.375,00');
    expect(el.querySelectorAll('svg[role="img"]').length).toBe(2);
    expect(el.textContent).toContain('Entradas');
    expect(el.textContent).toContain('Saídas');
  });

  it('com uma conta só o previsto some: sem aviso de projeção e o botão Previsto fica desabilitado', () => {
    const f = iniciar();
    ctrl.expectOne(r => r.url === `${API}/financeiro/fluxo-caixa`).flush(fluxo({ previstoIncluido: false, contaId: 1 }));
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    expect(el.textContent).toContain('o previsto não aparece');
    expect(el.querySelectorAll('polyline').length).toBe(1);
    const previsto = Array.from(el.querySelectorAll('button')).find(b => b.textContent?.trim() === 'Previsto')!;
    expect(previsto.disabled).toBeTrue();
  });

  it('alternar para o previsto muda os valores do gráfico', () => {
    const f = iniciar();
    ctrl.expectOne(r => r.url === `${API}/financeiro/fluxo-caixa`).flush(fluxo());
    const antes = f.componentInstance.valor(f.componentInstance.fluxo()!.periodos[0], 'saida');
    f.componentInstance.medida.set('previsto');
    expect(antes).toBe(105);
    expect(f.componentInstance.valor(f.componentInstance.fluxo()!.periodos[0], 'saida')).toBe(300);
  });

  it('eixo: o topo é arredondado e o saldo negativo cabe no desenho', () => {
    const f = iniciar();
    ctrl.expectOne(r => r.url === `${API}/financeiro/fluxo-caixa`).flush(fluxo({ periodos: [
      { inicio: '2026-11-01', fim: '2026-11-01', entradasPrevistas: 0, saidasPrevistas: 0, entradasRealizadas: 0, saidasRealizadas: 780, saldoRealizado: -780, saldoProjetado: -780 }
    ] }));
    const eixo = f.componentInstance.eixoSaldo();
    expect(eixo.ticks[0].valor).toBe(-1000);
    expect(eixo.y(-780)).toBeLessThan(f.componentInstance.altura);
    expect(f.componentInstance.eixoBarras().topo).toBe(1000);
  });

  it('erro do servidor aparece sem quebrar a tela', () => {
    const f = iniciar();
    ctrl.expectOne(r => r.url === `${API}/financeiro/fluxo-caixa`).flush({ error: 'O período pode ter no máximo 366 dias.' }, { status: 400, statusText: 'Bad Request' });
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('366 dias');
  });
});

describe('RelatoriosFinanceiroComponent', () => {
  let ctrl: HttpTestingController;
  afterEach(() => ctrl.verify());

  const tabela = (extra: Partial<RelatorioTabela> = {}): RelatorioTabela => ({
    titulo: 'Vencimentos', contexto: ['Títulos em aberto'], colunas: [{ titulo: 'Vencimento', numerica: false }, { titulo: 'Saldo', numerica: true }, { titulo: 'Dias de atraso', numerica: true }],
    linhas: [['2026-12-01', 300, 12]], totais: ['Total', 300, null], ...extra
  });

  function iniciar(permissoes: string[]) {
    ctrl = preparar(permissoes);
    const f = TestBed.createComponent(RelatoriosFinanceiroComponent);
    f.detectChanges();
    auxiliares(ctrl);
    return f;
  }

  it('formata datas, valores e contagens da tabela do servidor', () => {
    const f = iniciar(['financeiro.relatorios.ver']);
    ctrl.expectOne(r => r.url === `${API}/financeiro/relatorios/vencimentos`).flush(tabela());
    f.detectChanges();
    const texto = (f.nativeElement.textContent ?? '').replace(/\u00a0/g, ' ');
    expect(texto).toContain('01/12/2026');
    expect(texto).toContain('R$ 300,00');
    expect(texto).toMatch(/\b12\b/);
  });

  it('exportar só aparece com a permissão; sem ela fica só a tela', () => {
    const sem = iniciar(['financeiro.relatorios.ver']);
    ctrl.expectOne(r => r.url.endsWith('/relatorios/vencimentos')).flush(tabela());
    sem.detectChanges();
    expect(Array.from((sem.nativeElement as HTMLElement).querySelectorAll('button')).some(b => b.textContent?.trim() === 'PDF')).toBeFalse();
    TestBed.resetTestingModule();

    const com = iniciar(['financeiro.relatorios.ver', 'financeiro.relatorios.exportar']);
    ctrl.expectOne(r => r.url.endsWith('/relatorios/vencimentos')).flush(tabela());
    com.detectChanges();
    expect(Array.from((com.nativeElement as HTMLElement).querySelectorAll('button')).some(b => b.textContent?.trim() === 'PDF')).toBeTrue();
  });

  it('trocar para o aging pede o tipo e a posição; extrato exige escolher a pessoa', () => {
    const f = iniciar(['financeiro.relatorios.ver']);
    ctrl.expectOne(r => r.url.endsWith('/relatorios/vencimentos')).flush(tabela());
    f.componentInstance.trocar('aging');
    const aging = ctrl.expectOne(r => r.url.endsWith('/relatorios/aging'));
    expect(aging.request.params.get('tipo')).toBe('pagar');
    expect(aging.request.params.has('posicao')).toBeTrue();
    aging.flush(tabela({ titulo: 'Aging' }));

    f.componentInstance.trocar('extrato-pessoa');
    f.componentInstance.gerar();
    ctrl.expectNone(r => r.url.endsWith('/relatorios/extrato-pessoa'));
    expect(f.componentInstance.erro()).toContain('Escolha o fornecedor ou o cliente');
    f.componentInstance.quem = 'cliente';
    f.componentInstance.pessoaId = 4;
    f.componentInstance.gerar();
    const extrato = ctrl.expectOne(r => r.url.endsWith('/relatorios/extrato-pessoa'));
    expect(extrato.request.params.get('clienteId')).toBe('4');
    expect(extrato.request.params.has('fornecedorId')).toBeFalse();
    extrato.flush(tabela({ titulo: 'Extrato' }));
  });
});

describe('FinanceiroInicioComponent (painel)', () => {
  let ctrl: HttpTestingController;
  afterEach(() => ctrl.verify());

  const venc = (n: number, saldo: number): RelatorioTabela => ({
    titulo: 'Vencimentos', contexto: [], colunas: [], linhas: Array.from({ length: n }, () => []), totais: ['Total', null, null, null, null, null, saldo, saldo, null, null]
  });

  function iniciar(permissoes: string[]) {
    ctrl = preparar(permissoes);
    const f = TestBed.createComponent(FinanceiroInicioComponent);
    f.detectChanges();
    return f;
  }

  it('cada bloco carrega sozinho: um que falha não derruba os outros', () => {
    const f = iniciar(['financeiro.relatorios.ver', 'core.aprovacoes.ver', 'financeiro.importacoes.gerenciar']);
    const vencimentos = ctrl.match(r => r.url === `${API}/financeiro/relatorios/vencimentos`);
    expect(vencimentos.length).toBe(2);
    vencimentos[0].flush(venc(2, 800));
    vencimentos[1].flush({ error: 'falhou' }, { status: 500, statusText: 'Erro' });
    ctrl.expectOne(r => r.url === `${API}/financeiro/fluxo-caixa`).flush({
      de: '', ate: '', agrupar: 'mes', contaId: null, previstoIncluido: true, contas: [], totalEntradasPrevistas: 0, totalSaidasPrevistas: 0, totalEntradasRealizadas: 0, totalSaidasRealizadas: 0,
      periodos: [{ inicio: '', fim: '', entradasPrevistas: 0, saidasPrevistas: 0, entradasRealizadas: 0, saidasRealizadas: 0, saldoRealizado: 1000, saldoProjetado: 750 }]
    });
    ctrl.expectOne(r => r.url === `${API}/aprovacoes`).flush({ items: [], total: 3, page: 1, pageSize: 1 });
    ctrl.expectOne(r => r.url === `${API}/financeiro/importacoes`).flush([]);
    f.detectChanges();

    const texto = (f.nativeElement.textContent ?? '').replace(/\u00a0/g, ' ');
    expect(texto).toContain('R$ 800,00');
    expect(texto).toContain('2 título(s)');
    expect(texto).toContain('Não foi possível carregar');
    expect(texto).toContain('R$ 750,00');
    expect(texto).toContain('3 pedido(s) aguardando decisão');
    expect(texto).toContain('0 lançamento(s)');
  });

  it('sem permissão de relatórios não pede os números; atalhos seguem as permissões', () => {
    const f = iniciar(['financeiro.titulos.ver', 'financeiro.titulos.criar']);
    ctrl.expectNone(r => r.url.includes('/relatorios/') || r.url.includes('/fluxo-caixa'));
    f.detectChanges();
    const links = Array.from((f.nativeElement as HTMLElement).querySelectorAll('a')).map(a => a.textContent?.trim());
    expect(links).toContain('Novo título a pagar');
    expect(links).toContain('Contas fixas');
    expect(links).not.toContain('Fluxo de caixa');
    expect(links).not.toContain('Cadastros');
  });
});

describe('CadastrosFinanceiroComponent — configurações', () => {
  let ctrl: HttpTestingController;
  afterEach(() => ctrl.verify());

  function iniciar(permissoes: string[]) {
    ctrl = preparar(permissoes);
    const f = TestBed.createComponent(CadastrosFinanceiroComponent);
    f.detectChanges();
    ctrl.expectOne(r => r.url === `${API}/financeiro/contas`).flush(pagina([]));
    f.componentInstance.trocarAba('config');
    ctrl.expectOne(r => r.url === `${API}/financeiro/categorias`).flush(pagina([{ id: 1, nome: 'Compras', natureza: 'despesa', paiId: null, nivel: 1, ativo: true, criadoEm: '' }]));
    ctrl.expectOne(r => r.url === `${API}/financeiro/configuracoes`).flush({
      aprovacaoValorMinimo: 1000, prazoPadraoDias: 15, categoriaPadraoPagarId: null, categoriaPadraoPagarNome: null, recorrenciaHorizonteMeses: 4
    });
    f.detectChanges();
    return f;
  }

  it('mostra a configuração e salva com permissão', () => {
    const f = iniciar(['financeiro.cadastros.ver', 'financeiro.aprovacao.configurar']);
    expect(f.componentInstance.formConfig.controls.aprovacaoValorMinimo.value).toBe(1000);
    f.componentInstance.formConfig.patchValue({ aprovacaoValorMinimo: 2500, categoriaPadraoPagarId: 1 });
    f.componentInstance.salvarConfig();

    const req = ctrl.expectOne(r => r.method === 'PUT' && r.url === `${API}/financeiro/configuracoes`);
    expect(req.request.body).toEqual({ aprovacaoValorMinimo: 2500, prazoPadraoDias: 15, categoriaPadraoPagarId: 1, recorrenciaHorizonteMeses: 4 });
    req.flush({ aprovacaoValorMinimo: 2500, prazoPadraoDias: 15, categoriaPadraoPagarId: 1, categoriaPadraoPagarNome: 'Compras', recorrenciaHorizonteMeses: 4 });
    ctrl.expectOne(r => r.url === `${API}/financeiro/categorias`).flush(pagina([]));
    ctrl.expectOne(r => r.url === `${API}/financeiro/configuracoes`).flush({ aprovacaoValorMinimo: 2500, prazoPadraoDias: 15, categoriaPadraoPagarId: 1, categoriaPadraoPagarNome: 'Compras', recorrenciaHorizonteMeses: 4 });
  });

  it('sem a permissão de configurar a aprovação o formulário fica somente leitura', () => {
    const f = iniciar(['financeiro.cadastros.ver']);
    expect(f.componentInstance.formConfig.disabled).toBeTrue();
    expect(Array.from((f.nativeElement as HTMLElement).querySelectorAll('button')).some(b => b.textContent?.includes('Salvar configurações'))).toBeFalse();
  });
});
