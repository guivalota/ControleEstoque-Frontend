import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { Modal } from 'bootstrap';
import { ProdutosComponent } from './produtos.component';
import { Produto, UnidadeMedida } from '../../core/models/produto.model';
import { provideAuthFake } from '../../testing/auth-fake';

const UNIDADES: UnidadeMedida[] = [
  { codigo: 'un', nome: 'Unidade', casasDecimais: 0 },
  { codigo: 'rolo', nome: 'Rolo', casasDecimais: 0 },
  { codigo: 'm', nome: 'Metro', casasDecimais: 3 },
  { codigo: 'kg', nome: 'Quilograma', casasDecimais: 3 }
];

/** Campos do corpo da requisição que estes testes conferem. */
interface Corpo { tipoItem?: string; unidadeCodigo?: string; unidadeCompraCodigo?: string | null; fatorConversao?: number | null; }

const prod = (id: number, p: Partial<Produto> = {}): Produto => ({
  id, sku: `SKU-${id}`, nome: `Produto ${id}`, categoriaId: 1, precoUnitario: 10, ativo: true, fazParteEstoque: true,
  tipoItem: 'revenda', unidadeCodigo: 'un', unidadeCasasDecimais: 0, ...p
});

describe('ProdutosComponent (tipo, unidade e conversão)', () => {
  let fixture: ComponentFixture<ProdutosComponent>;
  let comp: ProdutosComponent;
  let ctrl: HttpTestingController;
  const el = () => fixture.nativeElement as HTMLElement;

  function montar(produtos: Produto[], role: 'admin' | 'operador' | 'leitura' = 'admin') {
    spyOn(Modal.prototype, 'show');
    spyOn(Modal.prototype, 'hide');
    TestBed.configureTestingModule({
      imports: [ProdutosComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), provideAuthFake(role)]
    });
    ctrl = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ProdutosComponent);
    comp = fixture.componentInstance;
    fixture.detectChanges();
    ctrl.expectOne(r => r.url === '/api/v1/produtos' && r.params.get('page') === '1')
      .flush({ items: produtos, total: produtos.length, page: 1, pageSize: 100 });
    ctrl.expectOne('/api/v1/produtos/unidades-medida').flush(UNIDADES);
    ctrl.match(r => r.url.includes('/categorias')).forEach(r => r.flush({ items: [{ id: 1, nome: 'Tecidos', ativo: true }], total: 1 }));
    fixture.detectChanges();
  }

  afterEach(() => ctrl.verify());

  it('lista tipo e unidade de cada produto', () => {
    montar([prod(1), prod(2, { tipoItem: 'materia_prima', unidadeCodigo: 'm' })]);

    const linhas = Array.from(el().querySelectorAll('tbody tr')).map(tr => tr.textContent ?? '');
    expect(linhas[0]).toContain('Revenda');
    expect(linhas[1]).toContain('Matéria-prima');
    expect(linhas[1]).toContain('m');
  });

  it('filtra por tipo', () => {
    montar([prod(1), prod(2, { tipoItem: 'materia_prima' }), prod(3, { tipoItem: 'materia_prima' })]);

    comp.tipoFiltro.set('materia_prima');

    expect(comp.filteredProdutos().map(p => p.id)).toEqual([2, 3]);
  });

  it('produto sem tipo (resposta antiga) conta como revenda', () => {
    montar([prod(1, { tipoItem: undefined }), prod(2, { tipoItem: 'acabado' })]);

    comp.tipoFiltro.set('revenda');

    expect(comp.filteredProdutos().map(p => p.id)).toEqual([1]);
  });

  it('mostra Modelo e Variação e só dá link de grade ao que não é variação', () => {
    montar([prod(1, { usaGrade: true }), prod(2, { produtoPaiId: 1 })]);

    const [modelo, variacao] = Array.from(el().querySelectorAll('tbody tr'));
    expect(modelo.textContent).toContain('Modelo');
    expect(modelo.querySelector('a[href="/produtos/1/grade"]')).not.toBeNull();
    expect(variacao.textContent).toContain('Variação');
    expect(variacao.querySelector('a[href*="/grade"]')).toBeNull();
  });

  describe('formulário', () => {
    beforeEach(() => montar([]));

    it('novo produto começa como revenda em unidade, só inteiros', () => {
      comp.openCreate();

      expect(comp.form.value.tipoItem).toBe('revenda');
      expect(comp.form.value.unidadeCodigo).toBe('un');
      expect(comp.stepQuantidade()).toBe('1');
      expect(comp.usaConversao()).toBeFalse();
    });

    it('trocar para metro libera 3 casas decimais nos campos de quantidade', () => {
      comp.openCreate();

      comp.form.controls.unidadeCodigo.setValue('m');
      fixture.detectChanges();

      expect(comp.casasEscolhidas()).toBe(3);
      expect(comp.stepQuantidade()).toBe('0.001');
      expect(el().querySelector<HTMLInputElement>('input[formControlName="estoqueMinimo"]')!.getAttribute('step')).toBe('0.001');
    });

    it('sem conversão, criar envia unidade de compra nula', () => {
      comp.openCreate();
      comp.form.patchValue({ sku: 'A', nome: 'A', categoriaId: 1, precoUnitario: 5 });

      const body = comp.montarPayload(false) as unknown as Corpo;

      expect(body.unidadeCompraCodigo).toBeNull();
      expect(body.fatorConversao).toBeNull();
      expect(body.tipoItem).toBe('revenda');
      expect(body.unidadeCodigo).toBe('un');
    });

    it('com conversão, envia unidade de compra e fator', () => {
      comp.openCreate();
      comp.alternarConversao(true);
      comp.form.patchValue({ sku: 'T', nome: 'Malha', categoriaId: 1, tipoItem: 'materia_prima', unidadeCodigo: 'm', unidadeCompraCodigo: 'rolo', fatorConversao: 50 });

      const body = comp.montarPayload(false) as unknown as Corpo;

      expect(body).toEqual(jasmine.objectContaining({ tipoItem: 'materia_prima', unidadeCodigo: 'm', unidadeCompraCodigo: 'rolo', fatorConversao: 50 }));
    });

    it('editar sem conversão envia texto vazio para remover a conversão', () => {
      comp.openEdit(prod(7, { unidadeCodigo: 'm', unidadeCompraCodigo: 'rolo', fatorConversao: 50 }));
      expect(comp.usaConversao()).toBeTrue();

      comp.alternarConversao(false);
      const body = comp.montarPayload(true) as unknown as Corpo;

      expect(body.unidadeCompraCodigo).toBe('');
      expect(body.fatorConversao).toBeNull();
      expect(comp.form.value.fatorConversao).toBeNull();
    });

    it('abrir um produto com conversão preenche os campos', () => {
      comp.openEdit(prod(7, { tipoItem: 'materia_prima', unidadeCodigo: 'm', unidadeCompraCodigo: 'rolo', fatorConversao: 50 }));

      expect(comp.form.value.tipoItem).toBe('materia_prima');
      expect(comp.form.value.unidadeCompraCodigo).toBe('rolo');
      expect(comp.form.value.fatorConversao).toBe(50);
      expect(comp.unidadeEscolhida()).toBe('m');
    });

    it('conversão ligada sem fator não envia nada e avisa', () => {
      comp.openCreate();
      comp.form.patchValue({ sku: 'T', nome: 'Malha', categoriaId: 1 });
      comp.alternarConversao(true);
      comp.form.patchValue({ unidadeCompraCodigo: 'rolo', fatorConversao: null });

      comp.save();

      expect(comp.saveError()).toContain('fator de conversão');
      expect(comp.saving()).toBeFalse();
    });

    it('salvar um produto novo envia tipo e unidade ao servidor', () => {
      comp.openCreate();
      comp.form.patchValue({ sku: 'N-1', nome: 'Botão', categoriaId: 1, precoUnitario: 1, tipoItem: 'aviamento' });

      comp.save();

      const req = ctrl.expectOne(r => r.method === 'POST' && r.url === '/api/v1/produtos');
      expect(req.request.body.tipoItem).toBe('aviamento');
      expect(req.request.body.unidadeCodigo).toBe('un');
      req.flush(prod(9));
      ctrl.expectOne(r => r.method === 'GET' && r.url === '/api/v1/produtos').flush({ items: [], total: 0 });
    });

    it('erro do servidor aparece no formulário', () => {
      comp.openCreate();
      comp.form.patchValue({ sku: 'N-2', nome: 'X', categoriaId: 1, unidadeCodigo: 'zz' });

      comp.save();
      ctrl.expectOne(r => r.method === 'POST').flush({ error: "Unidade de medida 'zz' não encontrada." }, { status: 400, statusText: 'Bad Request' });

      expect(comp.saveError()).toContain("'zz' não encontrada");
      expect(comp.saving()).toBeFalse();
    });
  });

  it('excluir variação com movimentação mostra o motivo na lista, sem alert', () => {
    montar([prod(2, { produtoPaiId: 1 })]);
    spyOn(window, 'confirm').and.returnValue(true);
    const alerta = spyOn(window, 'alert');

    comp.delete(prod(2, { produtoPaiId: 1 }));
    ctrl.expectOne(r => r.method === 'DELETE' && r.url === '/api/v1/produtos/2')
      .flush({ error: 'Esta variação já tem movimentação, lote ou pedido e não pode ser excluída; inative-a.' }, { status: 400, statusText: 'Bad Request' });
    fixture.detectChanges();

    expect(el().textContent).toContain('inative-a');
    expect(alerta).not.toHaveBeenCalled();
  });

  it('leitura não vê o botão de novo produto', () => {
    montar([prod(1)], 'leitura');

    // "Novo Produto" também é o título do modal; o que não pode existir é o botão do cabeçalho
    expect(el().querySelector('.d-flex.justify-content-between button.btn-primary')).toBeNull();
  });
});
