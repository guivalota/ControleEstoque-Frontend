import { TestBed, ComponentFixture, fakeAsync, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AutocompleteProdutoComponent } from './autocomplete-produto.component';
import { ToastService } from '../../core/services/toast.service';
import { Produto } from '../../core/models/produto.model';

const prod = (id: number, nome: string, extra: Partial<Produto> = {}): Produto =>
  ({ id, sku: `S${id}`, nome, categoriaId: 1, precoUnitario: 1, ativo: true, fazParteEstoque: true, ...extra });

describe('AutocompleteProdutoComponent', () => {
  let fixture: ComponentFixture<AutocompleteProdutoComponent>;
  let comp: AutocompleteProdutoComponent;
  let ctrl: HttpTestingController;
  let mudancas: (number | null)[];

  const buscas = () => ctrl.match(r => r.url === '/api/v1/produtos' && r.params.has('busca'));

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [AutocompleteProdutoComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    fixture = TestBed.createComponent(AutocompleteProdutoComponent);
    comp = fixture.componentInstance;
    ctrl = TestBed.inject(HttpTestingController);
    mudancas = [];
    comp.registerOnChange(v => mudancas.push(v));
  });

  afterEach(() => ctrl.verify());

  it('só busca com 2+ caracteres e depois do debounce de 300 ms', fakeAsync(() => {
    comp.aoDigitar('c');
    tick(300);
    expect(buscas().length).toBe(0);

    comp.aoDigitar('ca');
    tick(299);
    expect(buscas().length).toBe(0);
    tick(1);
    const [req] = buscas();
    expect(req.request.params.get('busca')).toBe('ca');
    expect(req.request.params.get('pageSize')).toBe('20');
    req.flush({ items: [prod(1, 'Camisa')], total: 1 });
    expect(comp.sugestoes().map(p => p.id)).toEqual([1]);
    expect(comp.aberto()).toBeTrue();
  }));

  it('digitação seguida cancela a requisição anterior (switchMap) e usa o último termo', fakeAsync(() => {
    comp.aoDigitar('ca');
    tick(300);
    const [primeira] = buscas();
    comp.aoDigitar('cam');
    tick(300);
    expect(primeira.cancelled).toBeTrue();
    const [segunda] = buscas().filter(r => !r.cancelled);
    expect(segunda.request.params.get('busca')).toBe('cam');
    segunda.flush({ items: [], total: 0 });
  }));

  it('escolher grava o id, mostra "nome (sku)" e fecha a lista', fakeAsync(() => {
    comp.aoDigitar('cam');
    tick(300);
    buscas()[0].flush({ items: [prod(7, 'Camisa')], total: 1 });
    comp.escolher(comp.sugestoes()[0]);
    expect(mudancas).toEqual([7]);
    expect(comp.termo()).toBe('Camisa (S7)');
    expect(comp.aberto()).toBeFalse();
  }));

  it('limpar remove o filtro (valor null)', fakeAsync(() => {
    comp.escolher(prod(7, 'Camisa'));
    comp.limpar();
    tick(300);
    expect(mudancas).toEqual([7, null]);
    expect(comp.termo()).toBe('');
    expect(buscas().length).toBe(0);
  }));

  it('sem resultados mostra "Nenhum produto encontrado"', fakeAsync(() => {
    comp.aoDigitar('zzz');
    tick(300);
    buscas()[0].flush({ items: [], total: 0 });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Nenhum produto encontrado');
  }));

  it('erro de rede mostra toast e mensagem na lista', fakeAsync(() => {
    const erro = spyOn(TestBed.inject(ToastService), 'erroApi');
    comp.aoDigitar('cam');
    tick(300);
    buscas()[0].flush({}, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();
    expect(erro).toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Erro ao buscar produtos');
  }));

  it('somenteMovimentaveis esconde inativos e o modelo de grade', fakeAsync(() => {
    fixture.componentRef.setInput('somenteMovimentaveis', true);
    comp.aoDigitar('cam');
    tick(300);
    buscas()[0].flush({
      items: [prod(1, 'Ok'), prod(2, 'Inativo', { ativo: false }), prod(3, 'Modelo', { usaGrade: true })], total: 3
    });
    expect(comp.sugestoes().map(p => p.id)).toEqual([1]);
  }));

  it('writeValue carrega o rótulo do produto pelo id', () => {
    comp.writeValue(9);
    expect(comp.termo()).toBe('Produto #9');
    ctrl.expectOne('/api/v1/produtos/9').flush(prod(9, 'Calça'));
    expect(comp.termo()).toBe('Calça (S9)');
    comp.writeValue(null);
    expect(comp.termo()).toBe('');
  });
});
