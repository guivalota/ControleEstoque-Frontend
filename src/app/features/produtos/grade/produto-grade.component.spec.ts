import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { MAX_VARIACOES, ProdutoGradeComponent } from './produto-grade.component';
import { GradeEixo, GradeProduto } from '../../../core/models/grade.model';
import { provideAuthFake } from '../../../testing/auth-fake';

const val = (id: number, eixoId: number, codigo: string, nome = codigo, ativo = true) => ({ id, eixoId, codigo, nome, ordem: id, ativo });

const EIXOS = (): GradeEixo[] => [
  { id: 1, codigo: 'tamanho', nome: 'Tamanho', ordem: 1, ativo: true, valores: [val(10, 1, 'P'), val(11, 1, 'M'), val(12, 1, 'G'), val(13, 1, 'XX', 'Inativo', false)] },
  { id: 2, codigo: 'cor', nome: 'Cor', ordem: 2, ativo: true, valores: [val(20, 2, 'BRA', 'Branco'), val(21, 2, 'PRE', 'Preto')] }
];

const SEM_GRADE = (): GradeProduto => ({
  produtoId: 5, sku: 'CAM-001', nome: 'Camiseta', usaGrade: false, unidadeCodigo: 'pc', saldoTotal: 0, eixos: [], variacoes: []
});

const COM_GRADE = (): GradeProduto => ({
  produtoId: 5, sku: 'CAM-001', nome: 'Camiseta', usaGrade: true, unidadeCodigo: 'pc', saldoTotal: 9.5,
  eixos: EIXOS(),
  variacoes: [
    { produtoId: 100, sku: 'CAM-001-P-BRA', nome: 'Camiseta P Branco', ativo: true, saldo: 4, valores: { 1: 10, 2: 20 } },
    { produtoId: 101, sku: 'CAM-001-P-PRE', nome: 'Camiseta P Preto', ativo: true, saldo: 2.5, valores: { 1: 10, 2: 21 } },
    { produtoId: 102, sku: 'CAM-001-M-BRA', nome: 'Camiseta M Branco', ativo: false, saldo: 3, valores: { 1: 11, 2: 20 } }
  ]
});

describe('ProdutoGradeComponent', () => {
  let fixture: ComponentFixture<ProdutoGradeComponent>;
  let comp: ProdutoGradeComponent;
  let ctrl: HttpTestingController;
  const el = () => fixture.nativeElement as HTMLElement;

  function montar(grade: GradeProduto, role: 'admin' | 'operador' | 'leitura' = 'admin') {
    TestBed.configureTestingModule({
      imports: [ProdutoGradeComponent],
      providers: [
        provideRouter([]), provideHttpClient(), provideHttpClientTesting(), provideAuthFake(role),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: '5' }) } } }
      ]
    });
    ctrl = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ProdutoGradeComponent);
    comp = fixture.componentInstance;
    fixture.detectChanges();
    ctrl.expectOne('/api/v1/grade/eixos').flush(EIXOS());
    ctrl.expectOne('/api/v1/produtos/5/grade').flush(grade);
    fixture.detectChanges();
  }

  afterEach(() => ctrl.verify());

  it('sem grade: explica o que acontece e oferece os eixos', () => {
    montar(SEM_GRADE());

    expect(el().textContent).toContain('ainda não tem grade');
    expect(el().textContent).toContain('Tamanho');
    expect(el().textContent).toContain('Cor');
    expect(el().textContent).not.toContain('Inativo'); // valor inativo não é oferecido
  });

  it('leitura vê a grade mas não o painel de gerar', () => {
    montar(COM_GRADE(), 'leitura');

    expect(el().textContent).toContain('Estoque por variação');
    expect(el().textContent).not.toContain('Gerar variações');
  });

  describe('seleção', () => {
    beforeEach(() => montar(SEM_GRADE()));

    it('conta o produto cartesiano dos eixos escolhidos', () => {
      comp.alternar(1, 10, true);
      comp.alternar(1, 11, true);
      comp.alternar(1, 12, true);
      comp.alternar(2, 20, true);
      comp.alternar(2, 21, true);

      expect(comp.totalSelecionado()).toBe(6);
    });

    it('um só eixo gera uma variação por valor', () => {
      comp.alternar(1, 10, true);
      comp.alternar(1, 11, true);

      expect(comp.totalSelecionado()).toBe(2);
    });

    it('desmarcar volta a contar menos', () => {
      comp.alternar(1, 10, true);
      comp.alternar(1, 10, false);

      expect(comp.totalSelecionado()).toBe(0);
    });

    it('todos / nenhum marcam só os valores ativos', () => {
      comp.marcarTodos(comp.eixos()[0], true);
      expect(comp.selecao()[1]).toEqual([10, 11, 12]);

      comp.marcarTodos(comp.eixos()[0], false);
      expect(comp.selecao()[1]).toEqual([]);
    });

    it('passar de 200 variações bloqueia o botão', () => {
      expect(MAX_VARIACOES).toBe(200);
      comp.selecao.set({ 1: Array.from({ length: 15 }, (_, i) => i), 2: Array.from({ length: 14 }, (_, i) => 100 + i) });
      fixture.detectChanges();

      expect(comp.totalSelecionado()).toBe(210);
      expect(comp.excedeLimite()).toBeTrue();
      const botao = Array.from(el().querySelectorAll('button')).find(b => b.textContent?.includes('Gerar 210')) as HTMLButtonElement;
      expect(botao.disabled).toBeTrue();
    });

    it('sem nada marcado o botão fica desabilitado', () => {
      const botao = Array.from(el().querySelectorAll('button')).find(b => b.textContent?.includes('Gerar 0')) as HTMLButtonElement;
      expect(botao.disabled).toBeTrue();
    });
  });

  describe('gerar', () => {
    beforeEach(() => montar(SEM_GRADE()));

    it('envia só os eixos com valores e mostra o resultado', () => {
      comp.alternar(1, 10, true);
      comp.alternar(1, 11, true);
      comp.alternar(2, 20, true);
      comp.marcarTodos(comp.eixos()[1], false); // cor sem valores não vai na requisição
      comp.alternar(2, 20, true);

      comp.gerar();

      const req = ctrl.expectOne(r => r.method === 'POST' && r.url === '/api/v1/produtos/5/grade');
      expect(req.request.body).toEqual({ eixos: [{ eixoId: 1, valorIds: [10, 11] }, { eixoId: 2, valorIds: [20] }] });
      req.flush({ criadas: 2, puladas: 0, grade: COM_GRADE() });
      fixture.detectChanges();

      expect(comp.aviso()).toBe('2 variação(ões) criada(s).');
      expect(comp.grade()!.variacoes.length).toBe(3);
      expect(comp.selecao()).toEqual({});
      expect(el().textContent).toContain('CAM-001-P-BRA');
    });

    it('informa quando tudo já existia', () => {
      comp.alternar(1, 10, true);

      comp.gerar();
      ctrl.expectOne(r => r.method === 'POST').flush({ criadas: 0, puladas: 1, grade: COM_GRADE() });

      expect(comp.aviso()).toBe('Todas essas variações já existiam.');
    });

    it('informa quantas foram puladas', () => {
      comp.alternar(1, 10, true);
      comp.alternar(1, 11, true);

      comp.gerar();
      ctrl.expectOne(r => r.method === 'POST').flush({ criadas: 1, puladas: 1, grade: COM_GRADE() });

      expect(comp.aviso()).toBe('1 variação(ões) criada(s); 1 já existia(m).');
    });

    it('sem seleção não chama o servidor', () => {
      comp.gerar();

      expect(comp.erro()).toContain('Escolha ao menos um valor');
    });

    it('mostra o erro do servidor', () => {
      comp.alternar(1, 10, true);

      comp.gerar();
      ctrl.expectOne(r => r.method === 'POST').flush(
        { error: 'Este produto já tem movimentação, lote ou pedido e não pode virar modelo de grade; cadastre um produto novo para o modelo.' },
        { status: 400, statusText: 'Bad Request' });

      expect(comp.erro()).toContain('não pode virar modelo');
      expect(comp.gerando()).toBeFalse();
    });
  });

  describe('matriz', () => {
    beforeEach(() => montar(COM_GRADE()));

    it('linhas e colunas só trazem valores em uso', () => {
      expect(comp.matrizPossivel()).toBeTrue();
      expect(comp.linhas().map(l => l.codigo)).toEqual(['P', 'M']);
      expect(comp.colunas().map(c => c.codigo)).toEqual(['BRA', 'PRE']);
    });

    it('cada célula é o saldo da variação e combinação inexistente é vazia', () => {
      expect(comp.celula(10, 20)!.saldo).toBe(4);
      expect(comp.celula(10, 21)!.saldo).toBe(2.5);
      expect(comp.celula(11, 21)).toBeNull();
    });

    it('totaliza por linha e por coluna', () => {
      expect(comp.totalLinha(10)).toBe(6.5);
      expect(comp.totalLinha(11)).toBe(3);
      expect(comp.totalColuna(20)).toBe(7);
      expect(comp.totalColuna(21)).toBe(2.5);
    });

    it('mostra o saldo no padrão pt-BR e o total', () => {
      const texto = el().textContent ?? '';
      expect(texto).toContain('2,5');
      expect(texto).toContain('9,5');
    });

    it('variação inativa aparece marcada', () => {
      expect(el().textContent).toContain('Inativo');
    });
  });

  describe('novo valor', () => {
    beforeEach(() => montar(SEM_GRADE()));

    it('cria o valor no eixo e o oferece na lista', () => {
      comp.novoValor[1] = { codigo: 'EG', nome: 'Extra grande' };

      comp.adicionarValor(comp.eixos()[0]);

      const req = ctrl.expectOne(r => r.method === 'POST' && r.url === '/api/v1/grade/eixos/1/valores');
      expect(req.request.body).toEqual({ codigo: 'EG', nome: 'Extra grande', ordem: 5 });
      req.flush(val(30, 1, 'EG', 'Extra grande'));
      fixture.detectChanges();

      expect(comp.eixos()[0].valores.map(v => v.codigo)).toContain('EG');
      expect(comp.novoValor[1]).toEqual({ codigo: '', nome: '' });
    });

    it('exige código e nome', () => {
      comp.novoValor[1] = { codigo: '', nome: 'Sem código' };

      comp.adicionarValor(comp.eixos()[0]);

      expect(comp.erro()).toContain('código e o nome');
    });

    it('valor repetido mostra a mensagem do servidor', () => {
      comp.novoValor[1] = { codigo: 'P', nome: 'Outro P' };

      comp.adicionarValor(comp.eixos()[0]);
      ctrl.expectOne(r => r.method === 'POST').flush({ error: "Já existe um valor com o código 'P' neste eixo." }, { status: 400, statusText: 'Bad Request' });

      expect(comp.erro()).toContain("'P'");
    });
  });

  it('falha ao carregar mostra o erro', () => {
    TestBed.configureTestingModule({
      imports: [ProdutoGradeComponent],
      providers: [
        provideRouter([]), provideHttpClient(), provideHttpClientTesting(), provideAuthFake('admin'),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: '5' }) } } }
      ]
    });
    ctrl = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ProdutoGradeComponent);
    fixture.detectChanges();
    ctrl.expectOne('/api/v1/grade/eixos').flush(EIXOS());
    ctrl.expectOne('/api/v1/produtos/5/grade').flush({ error: 'Produto com id 5 não encontrado.' }, { status: 400, statusText: 'Bad Request' });
    fixture.detectChanges();

    expect(el().textContent).toContain('não encontrado');
  });
});
