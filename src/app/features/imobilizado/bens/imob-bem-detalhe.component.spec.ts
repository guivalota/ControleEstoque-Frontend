import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { ImobBemDetalheComponent } from './imob-bem-detalhe.component';
import { ConfirmDialogComponent } from '../shared/confirm-dialog.component';
import { ImobBem } from '../../../core/models/imob-bem.model';
import { provideAuthFake } from '../../../testing/auth-fake';

const URL_BEM = '/api/v1/imobilizado/bens/42';

const bem = (extra: Partial<ImobBem> = {}): ImobBem => ({
  id: 42, plaqueta: 'NB-0001', descricao: 'Notebook Dell Latitude', categoriaId: 3, categoriaNome: 'Informática',
  localId: 7, localNome: 'Sala 101', responsavelId: 12, responsavelNome: 'Ana Souza',
  dataAquisicao: '2024-03-10', valorAquisicao: 4500, valorResidual: 450, vidaUtilMeses: 60, dadosCompletos: true, status: 'ativo',
  fornecedorNome: 'Dell Brasil', numeroDocumentoAquisicao: 'NF-12345', numeroSerie: null, observacao: null,
  criadoEm: '2026-10-22T14:03:11Z', atualizadoEm: '2026-10-22T14:03:11Z', ...extra
});

describe('ImobBemDetalheComponent', () => {
  let fixture: ComponentFixture<ImobBemDetalheComponent>;
  let comp: ImobBemDetalheComponent;
  let ctrl: HttpTestingController;
  let navegar: jasmine.Spy;
  const el = () => fixture.nativeElement as HTMLElement;
  const texto = () => (el().textContent ?? '').replace(/\s+/g, ' ');

  function montar(role: 'admin' | 'operador' | 'leitura' = 'admin') {
    TestBed.configureTestingModule({
      imports: [ImobBemDetalheComponent],
      providers: [
        provideRouter([]), provideHttpClient(), provideHttpClientTesting(), provideAuthFake(role),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: '42' }) } } }
      ]
    });
    ctrl = TestBed.inject(HttpTestingController);
    navegar = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    fixture = TestBed.createComponent(ImobBemDetalheComponent);
    comp = fixture.componentInstance;
    fixture.detectChanges();
  }

  const carregar = (b: ImobBem = bem()) => { ctrl.expectOne(URL_BEM).flush(b); fixture.detectChanges(); };

  afterEach(() => ctrl.verify());

  it('mostra carregando e depois todos os dados formatados', () => {
    montar();
    expect(texto()).toContain('Carregando');
    carregar();
    expect(texto()).toContain('Bem NB-0001');
    expect(texto()).toContain('Notebook Dell Latitude');
    expect(texto()).toContain('Informática');
    expect(texto()).toContain('Sala 101');
    expect(texto()).toContain('Ana Souza');
    expect(texto()).toContain('10/03/2024');
    expect(texto()).toContain('R$ 4.500,00');
    expect(texto()).toContain('R$ 450,00');
    expect(texto()).toContain('60 meses (5 anos)');
    expect(texto()).toContain('Dell Brasil');
    expect(texto()).toContain('Ativo');
  });

  it('campos vazios aparecem como "—"', () => {
    montar();
    carregar(bem({ responsavelId: null, responsavelNome: null }));
    expect(el().querySelectorAll('dd')[2].textContent).toBe('—');
    expect(texto()).toContain('Número de série—');
  });

  it('bem com dados incompletos mostra o selo e "—" nos campos pendentes', () => {
    montar();
    carregar(bem({ dadosCompletos: false, dataAquisicao: null, valorAquisicao: null, valorResidual: null }));
    expect(texto()).toContain('Dados incompletos');
    expect(texto()).toContain('Data de aquisição—');
  });

  it('bem completo não mostra o selo', () => {
    montar();
    carregar();
    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('Dados incompletos');
  });

  it('bem inexistente mostra "não encontrado"', () => {
    montar();
    ctrl.expectOne(URL_BEM).flush({ error: 'x' }, { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();
    expect(texto()).toContain('Bem não encontrado nesta empresa');
  });

  it('falha de carregamento oferece tentar novamente', () => {
    montar();
    ctrl.expectOne(URL_BEM).flush({}, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();
    expect(texto()).toContain('Erro ao carregar o bem');
    expect(texto()).toContain('Tentar novamente');
    comp.carregar();
    ctrl.expectOne(URL_BEM).flush(bem());
  });

  describe('excluir', () => {
    it('só exclui após confirmar e volta para a lista', async () => {
      montar();
      carregar();
      const abrir = spyOn(ConfirmDialogComponent.prototype, 'abrir').and.resolveTo(false);
      await comp.excluir();
      ctrl.expectNone(r => r.method === 'DELETE');

      abrir.and.resolveTo(true);
      await comp.excluir();
      ctrl.expectOne(r => r.method === 'DELETE' && r.url === URL_BEM).flush(null, { status: 204, statusText: 'No Content' });
      expect(navegar).toHaveBeenCalledWith(['/imobilizado/bens']);
    });

    it('mostra o erro do servidor e permanece na tela', async () => {
      montar();
      carregar();
      spyOn(ConfirmDialogComponent.prototype, 'abrir').and.resolveTo(true);
      await comp.excluir();
      ctrl.expectOne(r => r.method === 'DELETE').flush({ error: 'Não foi possível excluir.' }, { status: 400, statusText: 'Bad Request' });
      fixture.detectChanges();
      expect(texto()).toContain('Não foi possível excluir.');
      expect(navegar).not.toHaveBeenCalled();
    });
  });

  describe('abas', () => {
    const HIST = `${URL_BEM}/historico`;
    const vazio = { items: [], page: 1, pageSize: 20, total: 0 };
    const abaDados = () => el().querySelector<HTMLButtonElement>('#abaDados')!;
    const abaHist = () => el().querySelector<HTMLButtonElement>('#abaHistorico')!;
    const tecla = (b: HTMLElement, key: string) =>
      b.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));

    beforeEach(() => { montar(); carregar(); });

    it('abre em Dados e só consulta o histórico ao abrir a aba', () => {
      expect(abaDados().getAttribute('aria-selected')).toBe('true');
      expect(abaHist().getAttribute('aria-selected')).toBe('false');
      expect(el().querySelector('app-imob-bem-historico')).toBeNull();
      ctrl.expectNone(r => r.url === HIST);

      abaHist().click();
      fixture.detectChanges();
      expect(abaHist().getAttribute('aria-selected')).toBe('true');
      const req = ctrl.expectOne(r => r.url === HIST);
      expect(req.request.params.get('page')).toBe('1');
      req.flush(vazio);
      fixture.detectChanges();
      expect(texto()).toContain('Nenhuma alteração registrada');
    });

    it('alternar entre as abas não busca o histórico de novo e alterna os painéis', () => {
      abaHist().click();
      fixture.detectChanges();
      ctrl.expectOne(r => r.url === HIST).flush(vazio);

      abaDados().click();
      fixture.detectChanges();
      expect(el().querySelector<HTMLElement>('#painelDados')!.hidden).toBeFalse();
      expect(el().querySelector<HTMLElement>('#painelHistorico')!.hidden).toBeTrue();

      abaHist().click();
      fixture.detectChanges();
      expect(el().querySelector<HTMLElement>('#painelDados')!.hidden).toBeTrue();
      expect(el().querySelector<HTMLElement>('#painelHistorico')!.hidden).toBeFalse();
      ctrl.expectNone(r => r.url === HIST);
    });

    it('as abas têm a semântica de tablist e só a ativa é alcançável por Tab', () => {
      expect(el().querySelector('[role="tablist"]')).not.toBeNull();
      expect(abaDados().getAttribute('tabindex')).toBe('0');
      expect(abaHist().getAttribute('tabindex')).toBe('-1');
      expect(abaHist().getAttribute('aria-controls')).toBe('painelHistorico');
      expect(el().querySelector('#painelDados')!.getAttribute('role')).toBe('tabpanel');
    });

    it('setas, Home e End trocam de aba e movem o foco', () => {
      tecla(abaDados(), 'ArrowRight');
      fixture.detectChanges();
      expect(comp.aba()).toBe('historico');
      expect(document.activeElement).toBe(abaHist());
      ctrl.expectOne(r => r.url === HIST).flush(vazio);

      tecla(abaHist(), 'ArrowLeft');
      fixture.detectChanges();
      expect(comp.aba()).toBe('dados');
      expect(document.activeElement).toBe(abaDados());

      tecla(abaDados(), 'End');
      expect(comp.aba()).toBe('depreciacao');
      fixture.detectChanges();
      ctrl.expectOne(r => r.url === '/api/v1/imobilizado/depreciacao/bens/42').flush({ memoriaDeCalculo: [], cronograma: { items: [], page: 1, pageSize: 50, total: 0 } });
      tecla(abaHist(), 'Home');
      expect(comp.aba()).toBe('dados');
    });
  });

  describe('histórico para leitura', () => {
    it('usuário leitura vê a trilha, sem nenhuma ação de escrita', () => {
      montar('leitura');
      carregar();
      el().querySelector<HTMLButtonElement>('#abaHistorico')!.click();
      fixture.detectChanges();
      ctrl.expectOne(r => r.url === `${URL_BEM}/historico`).flush({
        items: [{ id: 1, campo: 'criacao', valorNovo: 'NB-0001', usuarioId: 'u', usuarioNome: 'João', criadoEm: '2026-10-20T09:15:40Z' }],
        page: 1, pageSize: 20, total: 1
      });
      fixture.detectChanges();
      expect(texto()).toContain('Bem cadastrado (plaqueta NB-0001)');
      expect(texto()).not.toContain('Editar');
      expect(texto()).not.toContain('Excluir');
    });
  });

  describe('papéis', () => {
    const acoes = () => Array.from(el().querySelectorAll('a, button')).map(b => (b.textContent ?? '').trim()).join('|');

    it('leitura não vê Editar nem Excluir', () => {
      montar('leitura');
      carregar();
      expect(acoes()).not.toContain('Editar');
      expect(acoes()).not.toContain('Excluir');
    });

    it('operador edita, mas não exclui', () => {
      montar('operador');
      carregar();
      expect(acoes()).toContain('Editar');
      expect(acoes()).not.toContain('Excluir');
    });

    it('admin edita e exclui', () => {
      montar('admin');
      carregar();
      expect(acoes()).toContain('Editar');
      expect(acoes()).toContain('Excluir');
    });

    it('bem vendido não oferece Editar, nem para admin', () => {
      montar('admin');
      carregar(bem({ status: 'vendido' }));
      expect(acoes()).not.toContain('Editar');
      expect(texto()).toContain('Vendido');
    });
  });
});
