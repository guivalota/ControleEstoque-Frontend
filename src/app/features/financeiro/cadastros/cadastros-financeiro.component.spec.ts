import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideAuthFake } from '../../../testing/auth-fake';
import { EmpresaAtivaService } from '../../../core/services/empresa-ativa.service';
import { ToastService } from '../../../core/services/toast.service';
import { CategoriaFin, ContaFin, montarArvoreCategorias } from '../../../core/models/financeiro-cadastros.model';
import { CadastrosFinanceiroComponent } from './cadastros-financeiro.component';

const BASE = '/api/v1/financeiro';
const pagina = <T>(items: T[]) => ({ items, page: 1, pageSize: 100, total: items.length });
const conta = (id: number, extra: Partial<ContaFin> = {}): ContaFin =>
  ({ id, nome: `Conta ${id}`, tipo: 'banco', saldoInicial: 100, dataSaldoInicial: '2026-01-01', ativo: true, criadoEm: '', ...extra });
const cat = (id: number, nome: string, paiId: number | null, nivel: number, extra: Partial<CategoriaFin> = {}): CategoriaFin =>
  ({ id, nome, natureza: 'despesa', paiId, nivel, ativo: true, criadoEm: '', ...extra });

describe('montarArvoreCategorias', () => {
  it('põe cada filha logo abaixo do pai, com o nível, ordenando por natureza e nome', () => {
    const lista = [
      cat(3, 'Sede', 2, 3), cat(2, 'Aluguel', 1, 2), cat(1, 'Despesas', null, 1),
      cat(4, 'Vendas', null, 1, { natureza: 'receita' }), cat(5, 'Água', 1, 2)
    ];
    const r = montarArvoreCategorias(lista).map(n => `${n.nivel}:${n.categoria.nome}`);
    expect(r).toEqual(['0:Despesas', '1:Água', '1:Aluguel', '2:Sede', '0:Vendas']);
  });

  it('categoria cujo pai não veio na lista vira raiz', () => {
    expect(montarArvoreCategorias([cat(9, 'Órfã', 77, 2)]).map(n => n.nivel)).toEqual([0]);
  });
});

describe('CadastrosFinanceiroComponent', () => {
  let ctrl: HttpTestingController;

  function iniciar(permissoes: string[] = ['financeiro.cadastros.ver', 'financeiro.cadastros.editar']) {
    TestBed.configureTestingModule({
      imports: [CadastrosFinanceiroComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideAuthFake('admin')]
    });
    const empresa = TestBed.inject(EmpresaAtivaService);
    empresa.empresas.set([{ id: 1, razaoSocial: 'X', cnpj: '', ativo: true, criadoEm: '', perfil: 'admin', modulos: ['financeiro'], permissoes }]);
    empresa.id.set(1);
    ctrl = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(CadastrosFinanceiroComponent);
    fixture.detectChanges();
    ctrl.expectOne(r => r.url === `${BASE}/contas`).flush(pagina([conta(1), conta(2, { nome: 'Caixa', tipo: 'caixa', ativo: false })]));
    fixture.detectChanges();
    return fixture;
  }
  const el = (f: { nativeElement: HTMLElement }) => f.nativeElement;
  const botao = (f: { nativeElement: HTMLElement }, rotulo: string) =>
    el(f).querySelector<HTMLButtonElement>(`button[aria-label="${rotulo}"]`);

  afterEach(() => ctrl.verify());

  it('lista as contas com tipo, saldo e situação', () => {
    const f = iniciar();
    const texto = el(f).textContent ?? '';
    expect(texto).toContain('Conta 1');
    expect(texto).toContain('Caixa');
    expect(texto).toContain('Inativa');
  });

  it('quem só consulta não vê nenhum botão de escrita', () => {
    const f = iniciar(['financeiro.cadastros.ver']);
    expect(el(f).textContent).not.toContain('Nova conta');
    expect(botao(f, 'Editar Conta 1')).toBeNull();
    expect(botao(f, 'Excluir Conta 1')).toBeNull();
  });

  it('cria uma conta pelo formulário e recarrega a lista', () => {
    const f = iniciar();
    const toast = TestBed.inject(ToastService);
    spyOn(toast, 'sucesso');
    Array.from(el(f).querySelectorAll('button')).find(b => b.textContent?.includes('Nova conta'))!.click();
    f.detectChanges();
    f.componentInstance.formConta.patchValue({ nome: ' Banco X ', tipo: 'banco', saldoInicial: 50.5, dataSaldoInicial: '2026-02-01' });
    el(f).querySelector<HTMLButtonElement>('form button[type="submit"]')!.click();

    const req = ctrl.expectOne(r => r.method === 'POST' && r.url === `${BASE}/contas`);
    expect(req.request.body).toEqual({ nome: 'Banco X', tipo: 'banco', saldoInicial: 50.5, dataSaldoInicial: '2026-02-01' });
    req.flush(conta(3));
    ctrl.expectOne(r => r.method === 'GET' && r.url === `${BASE}/contas`).flush(pagina([conta(3)]));
    expect(toast.sucesso).toHaveBeenCalledWith('Conta salva.');
    expect(f.componentInstance.editando()).toBeNull();
  });

  it('nome em branco não envia', () => {
    const f = iniciar();
    f.componentInstance.novaConta();
    f.detectChanges();
    el(f).querySelector<HTMLButtonElement>('form button[type="submit"]')!.click();
    ctrl.expectNone(r => r.method === 'POST');
  });

  it('inativar envia só o campo ativo', () => {
    const f = iniciar();
    botao(f, 'Inativar Conta 1')!.click();
    const req = ctrl.expectOne(r => r.method === 'PUT' && r.url === `${BASE}/contas/1`);
    expect(req.request.body).toEqual({ ativo: false });
    req.flush(conta(1, { ativo: false }));
    ctrl.expectOne(r => r.method === 'GET').flush(pagina([conta(1, { ativo: false })]));
  });

  it('exclusão recusada pelo servidor mostra a mensagem e sugere inativar', () => {
    const f = iniciar();
    const toast = TestBed.inject(ToastService);
    spyOn(toast, 'erro');
    spyOn(window, 'confirm').and.returnValue(true);
    botao(f, 'Excluir Conta 1')!.click();
    ctrl.expectOne(r => r.method === 'DELETE' && r.url === `${BASE}/contas/1`)
      .flush({ error: 'Há títulos vinculados.' }, { status: 400, statusText: 'Bad Request' });
    expect(toast.erro).toHaveBeenCalledWith(jasmine.stringMatching(/Há títulos vinculados\..*inativar em vez de excluir/));
  });

  it('categorias: mostra em árvore e a subcategoria envia o pai sem a natureza', () => {
    const f = iniciar();
    f.componentInstance.trocarAba('categorias');
    ctrl.expectOne(r => r.url === `${BASE}/categorias`).flush(pagina([cat(1, 'Despesas', null, 1), cat(2, 'Aluguel', 1, 2)]));
    f.detectChanges();
    expect(el(f).textContent).toContain('— Aluguel');

    botao(f, 'Nova subcategoria de Despesas')!.click();
    f.detectChanges();
    f.componentInstance.formCategoria.patchValue({ nome: 'Água' });
    el(f).querySelector<HTMLButtonElement>('form button[type="submit"]')!.click();
    const req = ctrl.expectOne(r => r.method === 'POST' && r.url === `${BASE}/categorias`);
    expect(req.request.body).toEqual({ nome: 'Água', paiId: 1, natureza: null });
    req.flush(cat(3, 'Água', 1, 2));
    ctrl.expectOne(r => r.method === 'GET' && r.url === `${BASE}/categorias`).flush(pagina([]));
  });

  it('categorias: no último nível não oferece subcategoria; categoria raiz exige a natureza', () => {
    const f = iniciar();
    f.componentInstance.trocarAba('categorias');
    ctrl.expectOne(r => r.url === `${BASE}/categorias`).flush(pagina([cat(1, 'A', null, 1), cat(2, 'B', 1, 2), cat(3, 'C', 2, 3)]));
    f.detectChanges();
    expect(botao(f, 'Nova subcategoria de C')).toBeNull();
    expect(botao(f, 'Nova subcategoria de B')).not.toBeNull();

    f.componentInstance.novaCategoria(null);
    f.componentInstance.formCategoria.patchValue({ nome: 'Receitas', natureza: 'receita' });
    f.componentInstance.salvarCategoria();
    expect(ctrl.expectOne(r => r.method === 'POST').request.body).toEqual({ nome: 'Receitas', paiId: null, natureza: 'receita' });
  });

  it('centros de custo: cria e edita', () => {
    const f = iniciar();
    f.componentInstance.trocarAba('centros');
    ctrl.expectOne(r => r.url === `${BASE}/centros-custo`).flush(pagina([{ id: 1, nome: 'Geral', ativo: true, criadoEm: '' }]));
    f.detectChanges();
    botao(f, 'Editar Geral')!.click();
    f.detectChanges();
    f.componentInstance.formCentro.patchValue({ nome: 'Comercial' });
    el(f).querySelector<HTMLButtonElement>('form button[type="submit"]')!.click();
    const req = ctrl.expectOne(r => r.method === 'PUT' && r.url === `${BASE}/centros-custo/1`);
    expect(req.request.body).toEqual({ nome: 'Comercial' });
    req.flush({ id: 1, nome: 'Comercial', ativo: true, criadoEm: '' });
    ctrl.expectOne(r => r.method === 'GET').flush(pagina([]));
  });
});
