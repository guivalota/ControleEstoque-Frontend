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
  dataAquisicao: '2024-03-10', valorAquisicao: 4500, valorResidual: 450, vidaUtilMeses: 60, status: 'ativo',
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
