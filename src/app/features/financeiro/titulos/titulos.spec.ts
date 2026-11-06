import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { provideAuthFake } from '../../../testing/auth-fake';
import { EmpresaAtivaService } from '../../../core/services/empresa-ativa.service';
import { ToastService } from '../../../core/services/toast.service';
import { Baixa, Titulo, TituloDetalhe, podeBaixar } from '../../../core/models/financeiro-titulos.model';
import { TitulosListaComponent } from './titulos-lista.component';
import { TituloFormComponent } from './titulo-form.component';
import { TituloDetalheComponent } from './titulo-detalhe.component';

const API = '/api/v1';
const pagina = <T>(items: T[]) => ({ items, page: 1, pageSize: 100, total: items.length });

const titulo = (id: number, extra: Partial<Titulo> = {}): Titulo => ({
  id, tipo: 'pagar', fornecedorId: null, clienteId: null, pessoaNome: 'Fulano', descricao: `Título ${id}`, documento: null, valor: 100, saldo: 100,
  emissao: '2026-11-01', vencimento: '2026-12-01', competencia: '2026-11-01', categoriaId: 1, categoriaNome: 'Aluguel', centroCustoId: null, centroCustoNome: null,
  status: 'aberto', vencido: false, origem: null, origemId: null, aprovacaoId: null, aprovacaoStatus: null, grupoId: null, parcela: null, totalParcelas: null,
  recorrenciaId: null, canceladoMotivo: null, criadoEm: '', atualizadoEm: '', ...extra
});

const baixa = (id: number, extra: Partial<Baixa> = {}): Baixa => ({
  id, contaId: 1, contaNome: 'Banco', data: '2026-11-05', forma: 'pix', valor: 30, juros: 0, multa: 0, desconto: 0, totalPago: 30, observacao: null,
  estornada: false, estornadaEm: null, estornoMotivo: null, estornadaPorNome: null, criadoPorNome: null, criadoEm: '', ...extra
});

const detalhe = (id: number, extra: Partial<TituloDetalhe> = {}): TituloDetalhe => ({ ...titulo(id), eventos: [], baixas: [], ...extra });

function preparar(permissoes: string[], extras: unknown[] = []) {
  TestBed.configureTestingModule({
    providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), provideAuthFake('admin'), ...(extras as never[])]
  });
  const empresa = TestBed.inject(EmpresaAtivaService);
  empresa.empresas.set([{ id: 1, razaoSocial: 'X', cnpj: '', ativo: true, criadoEm: '', perfil: 'admin', modulos: ['financeiro'], permissoes }]);
  empresa.id.set(1);
  return TestBed.inject(HttpTestingController);
}

/** Responde às listas auxiliares (cadastros e pessoas) que as telas pedem ao abrir. */
function auxiliares(ctrl: HttpTestingController, dados: Record<string, unknown[]> = {}) {
  const pedidos: TestRequest[] = ctrl.match(r => /\/v1\/(fornecedores|clientes|financeiro\/(categorias|centros-custo|contas))$/.test(r.url));
  for (const p of pedidos) {
    const chave = p.request.url.split('/').pop()!;
    p.flush(pagina(dados[chave] ?? []));
  }
}

describe('podeBaixar', () => {
  it('só título aberto ou parcial, e sem aprovação pendente', () => {
    expect(podeBaixar({ status: 'aberto', aprovacaoId: null, aprovacaoStatus: null })).toBeTrue();
    expect(podeBaixar({ status: 'parcial', aprovacaoId: 5, aprovacaoStatus: 'aprovada' })).toBeTrue();
    expect(podeBaixar({ status: 'aberto', aprovacaoId: 5, aprovacaoStatus: 'pendente' })).toBeFalse();
    expect(podeBaixar({ status: 'quitado', aprovacaoId: null, aprovacaoStatus: null })).toBeFalse();
    expect(podeBaixar({ status: 'cancelado', aprovacaoId: null, aprovacaoStatus: null })).toBeFalse();
  });
});

describe('TitulosListaComponent', () => {
  let ctrl: HttpTestingController;

  function iniciar(query: Record<string, string> = {}) {
    const rota = { snapshot: { queryParamMap: convertToParamMap(query) } };
    ctrl = preparar(['financeiro.titulos.ver', 'financeiro.titulos.criar', 'financeiro.cadastros.ver'], [{ provide: ActivatedRoute, useValue: rota }]);
    spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    const f = TestBed.createComponent(TitulosListaComponent);
    f.detectChanges();
    return f;
  }
  const lista = () => ctrl.expectOne(r => r.url === `${API}/financeiro/titulos`);
  const el = (f: { nativeElement: HTMLElement }) => f.nativeElement;

  afterEach(() => ctrl.verify());

  it('lista os títulos: vencido em destaque, aprovação pendente e origem de outro módulo', () => {
    const f = iniciar();
    lista().flush({ items: [titulo(1, { vencido: true }), titulo(2, { aprovacaoStatus: 'pendente', aprovacaoId: 9 }), titulo(3, { origem: 'estoque/nota_fiscal' })], total: 3, page: 1, pageSize: 20 });
    auxiliares(ctrl);
    f.detectChanges();

    const texto = el(f).textContent ?? '';
    expect(texto).toContain('Vencido');
    expect(texto).toContain('Aguardando aprovação');
    expect(texto).toContain('Estoque');
    expect(el(f).querySelectorAll('tbody tr').length).toBe(3);
    expect(el(f).querySelector('.text-danger')?.textContent).toContain('01/12/2026');
  });

  it('o filtro vai para o servidor e para a URL; o botão de criar só aparece com permissão', () => {
    const f = iniciar();
    lista().flush(pagina([]));
    auxiliares(ctrl);
    f.componentInstance.status = 'vencido';
    f.componentInstance.busca = ' luz ';
    f.componentInstance.trocarTipo('pagar');

    const req = lista();
    expect(req.request.params.get('status')).toBe('vencido');
    expect(req.request.params.get('tipo')).toBe('pagar');
    expect(req.request.params.get('busca')).toBe('luz');
    expect(req.request.params.get('pageSize')).toBe('20');
    req.flush(pagina([]));
    expect(TestBed.inject(Router).navigate).toHaveBeenCalledWith([], jasmine.objectContaining({ queryParams: jasmine.objectContaining({ status: 'vencido', tipo: 'pagar' }) }));
    f.detectChanges();
    expect(el(f).textContent).toContain('Novo título');
  });

  it('lê os filtros da URL (atalhos do painel) e o grupo de parcelas', () => {
    const f = iniciar({ status: 'vencido', grupoId: 'abc', page: '2' });
    const req = lista();
    expect(req.request.params.get('status')).toBe('vencido');
    expect(req.request.params.get('grupoId')).toBe('abc');
    expect(req.request.params.get('page')).toBe('2');
    req.flush({ items: [], total: 45, page: 2, pageSize: 20 });
    auxiliares(ctrl);
    f.detectChanges();
    expect(el(f).textContent).toContain('parcelas do mesmo lançamento');
    expect(el(f).textContent).toContain('página 2 de 3');
  });
});

describe('TituloFormComponent', () => {
  let ctrl: HttpTestingController;

  function iniciar(id?: string) {
    const rota = { snapshot: { paramMap: convertToParamMap(id ? { id } : {}), queryParamMap: convertToParamMap({}) } };
    ctrl = preparar(['financeiro.titulos.criar', 'financeiro.titulos.editar'], [{ provide: ActivatedRoute, useValue: rota }]);
    spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    const f = TestBed.createComponent(TituloFormComponent);
    f.detectChanges();
    return f;
  }

  afterEach(() => ctrl.verify());

  const categorias = [
    { id: 1, nome: 'Aluguel', natureza: 'despesa', paiId: null, nivel: 1, ativo: true, criadoEm: '' },
    { id: 2, nome: 'Vendas', natureza: 'receita', paiId: null, nivel: 1, ativo: true, criadoEm: '' }
  ];

  it('cria título a pagar: categoria só de despesa, pessoa digitada e payload correto', () => {
    const f = iniciar();
    auxiliares(ctrl, { categorias });
    f.detectChanges();
    expect(f.componentInstance.categoriasDoTipo().map(c => c.nome)).toEqual(['Aluguel']);

    f.componentInstance.form.patchValue({ pessoaNome: ' Locador ', descricao: ' Aluguel ', valor: 150.5, vencimento: '2026-12-10', categoriaId: 1 });
    f.componentInstance.salvar();

    const req = ctrl.expectOne(r => r.method === 'POST' && r.url === `${API}/financeiro/titulos`);
    expect(req.request.body).toEqual(jasmine.objectContaining({
      tipo: 'pagar', fornecedorId: null, clienteId: null, pessoaNome: 'Locador', descricao: 'Aluguel', valor: 150.5, vencimento: '2026-12-10', categoriaId: 1
    }));
    req.flush(detalhe(7));
    expect(TestBed.inject(Router).navigate).toHaveBeenCalledWith(['/financeiro/titulos', 7]);
  });

  it('trocar para a receber limpa a categoria e mostra só as de receita', () => {
    const f = iniciar();
    auxiliares(ctrl, { categorias });
    f.componentInstance.form.patchValue({ categoriaId: 1 });
    f.componentInstance.form.controls.tipo.setValue('receber');
    f.componentInstance.aoTrocarTipo();
    f.detectChanges();

    expect(f.componentInstance.form.controls.categoriaId.value).toBeNull();
    expect(f.componentInstance.categoriasDoTipo().map(c => c.nome)).toEqual(['Vendas']);
  });

  it('parcelar mostra a prévia com a soma exata e vencimento mensal, e envia ao endpoint de parcelado', () => {
    const f = iniciar();
    auxiliares(ctrl, { categorias });
    f.componentInstance.form.patchValue({ pessoaNome: 'Loja', descricao: 'Máquina', valor: 100, vencimento: '2026-01-31', categoriaId: 1, parcelar: true, parcelas: 3 });
    f.detectChanges();

    expect(f.componentInstance.previa().map(p => [p.valor, p.vencimento])).toEqual([[33.33, '2026-01-31'], [33.33, '2026-02-28'], [33.34, '2026-03-31']]);
    expect((f.nativeElement as HTMLElement).textContent).toContain('3 parcela(s)');

    f.componentInstance.salvar();
    const req = ctrl.expectOne(r => r.method === 'POST' && r.url === `${API}/financeiro/titulos/parcelado`);
    expect(req.request.body.parcelas).toBe(3);
    expect(req.request.body.valor).toBe(100);
    req.flush({ grupoId: 'g1', valorTotal: 100, titulos: [titulo(1), titulo(2), titulo(3)] });
    expect(TestBed.inject(Router).navigate).toHaveBeenCalledWith(['/financeiro/titulos'], { queryParams: { grupoId: 'g1' } });
  });

  it('valor total pequeno demais para as parcelas não envia', () => {
    const f = iniciar();
    auxiliares(ctrl, { categorias });
    f.componentInstance.form.patchValue({ pessoaNome: 'Loja', descricao: 'x', valor: 0.02, vencimento: '2026-01-10', categoriaId: 1, parcelar: true, parcelas: 3 });
    f.componentInstance.salvar();
    ctrl.expectNone(r => r.method === 'POST');
    expect(f.componentInstance.erro()).toContain('pequeno demais');
  });

  it('sem nome nem cadastro a pessoa é obrigatória', () => {
    const f = iniciar();
    auxiliares(ctrl, { categorias });
    f.componentInstance.form.patchValue({ descricao: 'x', valor: 10, vencimento: '2026-01-10', categoriaId: 1 });
    f.componentInstance.salvar();
    ctrl.expectNone(r => r.method === 'POST');
    expect(f.componentInstance.form.controls.pessoaNome.errors).toEqual({ required: true });
  });

  it('edição de título com baixa trava valor e pessoa e envia PUT', () => {
    const f = iniciar('7');
    ctrl.expectOne(`${API}/financeiro/titulos/7`).flush(detalhe(7, { status: 'parcial', saldo: 40, fornecedorId: 3, pessoaNome: 'Alfa', categoriaId: 1 }));
    auxiliares(ctrl, { categorias, fornecedores: [{ id: 3, razaoSocial: 'Alfa', ativo: true }] });
    f.detectChanges();

    expect(f.componentInstance.bloqueado()).toBeTrue();
    expect(f.componentInstance.form.controls.valor.disabled).toBeTrue();
    expect(f.componentInstance.form.controls.pessoaId.disabled).toBeTrue();

    f.componentInstance.form.patchValue({ vencimento: '2027-01-15' });
    f.componentInstance.salvar();
    const req = ctrl.expectOne(r => r.method === 'PUT' && r.url === `${API}/financeiro/titulos/7`);
    expect(req.request.body.vencimento).toBe('2027-01-15');
    expect(req.request.body.valor).toBe(100);
    req.flush(detalhe(7));
  });
});

describe('TituloDetalheComponent', () => {
  let ctrl: HttpTestingController;

  function iniciar(t: TituloDetalhe, permissoes = ['financeiro.titulos.ver', 'financeiro.titulos.editar', 'financeiro.titulos.cancelar', 'financeiro.baixas.registrar', 'financeiro.baixas.estornar']) {
    const rota = { snapshot: { paramMap: convertToParamMap({ id: String(t.id) }) } };
    ctrl = preparar(permissoes, [{ provide: ActivatedRoute, useValue: rota }]);
    const f = TestBed.createComponent(TituloDetalheComponent);
    f.detectChanges();
    ctrl.expectOne(`${API}/financeiro/titulos/${t.id}`).flush(t);
    f.detectChanges();
    return f;
  }
  const botao = (f: { nativeElement: HTMLElement }, texto: string) =>
    Array.from((f.nativeElement as HTMLElement).querySelectorAll('button')).find(b => b.textContent?.includes(texto));

  afterEach(() => ctrl.verify());

  it('pagamento com aprovação pendente: avisa e não oferece a baixa', () => {
    const f = iniciar(detalhe(1, { aprovacaoId: 5, aprovacaoStatus: 'pendente' }));
    expect(f.nativeElement.textContent).toContain('aguarda a aprovação');
    expect(botao(f, 'Registrar pagamento')).toBeUndefined();
  });

  it('registra uma baixa: valor sugerido é o saldo, mostra abatimento e movimento e envia o corpo certo', () => {
    const f = iniciar(detalhe(1, { saldo: 100, valor: 100 }));
    botao(f, 'Registrar pagamento')!.click();
    ctrl.expectOne(r => r.url.endsWith('/financeiro/contas')).flush(pagina([
      { id: 4, nome: 'Banco', tipo: 'banco', saldoInicial: 0, dataSaldoInicial: '2026-01-01', ativo: true, criadoEm: '' },
      { id: 5, nome: 'Antiga', tipo: 'caixa', saldoInicial: 0, dataSaldoInicial: '2026-01-01', ativo: false, criadoEm: '' }
    ]));
    f.detectChanges();

    expect(f.componentInstance.contas().map(c => c.nome)).toEqual(['Banco']);
    expect(f.componentInstance.formBaixa.controls.valor.value).toBe(100);
    f.componentInstance.formBaixa.patchValue({ contaId: 4, valor: 90, desconto: 10, juros: 2, multa: 1, forma: 'boleto' });
    expect(f.componentInstance.abatimento()).toBe(100);
    expect(f.componentInstance.movimento()).toBe(93);

    f.componentInstance.registrarBaixa();
    const req = ctrl.expectOne(r => r.method === 'POST' && r.url === `${API}/financeiro/titulos/1/baixas`);
    expect(req.request.body).toEqual(jasmine.objectContaining({ contaId: 4, forma: 'boleto', valor: 90, juros: 2, multa: 1, desconto: 10 }));
    req.flush(detalhe(1, { status: 'quitado', saldo: 0, baixas: [baixa(1, { valor: 90, desconto: 10, totalPago: 93 })] }));
    f.detectChanges();
    expect(f.componentInstance.titulo()?.status).toBe('quitado');
    expect(f.componentInstance.painel()).toBeNull();
    expect(botao(f, 'Registrar pagamento')).toBeUndefined();
  });

  it('valor acima do saldo trava o botão de confirmar', () => {
    const f = iniciar(detalhe(1, { saldo: 50 }));
    botao(f, 'Registrar pagamento')!.click();
    ctrl.match(r => r.url.endsWith('/financeiro/contas')).forEach(r => r.flush(pagina([])));
    f.componentInstance.formBaixa.patchValue({ valor: 40, desconto: 20 });
    f.detectChanges();
    expect(f.componentInstance.abatimento()).toBe(60);
    expect((f.nativeElement as HTMLElement).textContent).toContain('excede o saldo');
    expect(botao(f, 'Confirmar')!.disabled).toBeTrue();
  });

  it('estorno exige motivo, aparece só com a permissão e atualiza o título', () => {
    const t = detalhe(1, { status: 'parcial', saldo: 70, baixas: [baixa(9), baixa(10, { estornada: true, estornoMotivo: 'erro' })] });
    const f = iniciar(t);
    expect(f.nativeElement.querySelectorAll('button[aria-label^="Estornar baixa"]').length).toBe(1);
    expect(f.nativeElement.textContent).toContain('Estornada');

    f.componentInstance.iniciarEstorno(t.baixas[0]);
    f.componentInstance.estornar(t.baixas[0]);
    ctrl.expectNone(r => r.method === 'POST');

    f.componentInstance.formEstorno.patchValue({ motivo: ' pagamento devolvido ' });
    f.componentInstance.estornar(t.baixas[0]);
    const req = ctrl.expectOne(r => r.method === 'POST' && r.url === `${API}/financeiro/baixas/9/estornar`);
    expect(req.request.body).toEqual({ motivo: 'pagamento devolvido' });
    req.flush(detalhe(1, { status: 'aberto', saldo: 100 }));
    expect(f.componentInstance.titulo()?.status).toBe('aberto');
  });

  it('quem não tem a permissão de estornar não vê o botão', () => {
    const f = iniciar(detalhe(1, { baixas: [baixa(9)] }), ['financeiro.titulos.ver']);
    expect(f.nativeElement.querySelectorAll('button[aria-label^="Estornar baixa"]').length).toBe(0);
    expect(botao(f, 'Registrar pagamento')).toBeUndefined();
    expect(botao(f, 'Cancelar título')).toBeUndefined();
  });

  it('cancelar exige motivo e envia', () => {
    const f = iniciar(detalhe(1));
    botao(f, 'Cancelar título')!.click();
    f.componentInstance.cancelar();
    ctrl.expectNone(r => r.method === 'POST');
    f.componentInstance.formCancelar.patchValue({ motivo: ' duplicado ' });
    f.componentInstance.cancelar();
    const req = ctrl.expectOne(r => r.method === 'POST' && r.url === `${API}/financeiro/titulos/1/cancelar`);
    expect(req.request.body).toEqual({ motivo: 'duplicado' });
    const toast = TestBed.inject(ToastService);
    spyOn(toast, 'sucesso');
    req.flush(detalhe(1, { status: 'cancelado', canceladoMotivo: 'duplicado' }));
    expect(toast.sucesso).toHaveBeenCalledWith('Título cancelado.');
  });

  it('histórico traduz os eventos e resume o motivo', () => {
    const f = iniciar(detalhe(1, { eventos: [
      { id: 1, tipo: 'criacao', usuarioNome: 'Ana', detalhe: null, criadoEm: '2026-11-05T12:00:00Z' },
      { id: 2, tipo: 'aprovacao_recusada', usuarioNome: 'Beto', detalhe: '{"motivo":"fora do orçamento"}', criadoEm: '2026-11-06T12:00:00Z' }
    ] }));
    const texto = f.nativeElement.textContent ?? '';
    expect(texto).toContain('Título criado');
    expect(texto).toContain('Pagamento recusado');
    expect(texto).toContain('fora do orçamento');
  });
});
