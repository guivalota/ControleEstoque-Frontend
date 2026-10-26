import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { ImobInventarioDetalheComponent } from './imob-inventario-detalhe.component';
import { ConfirmDialogComponent } from '../shared/confirm-dialog.component';
import { ImobInventario } from '../../../core/models/imob-inventario.model';
import { provideAuthFake } from '../../../testing/auth-fake';

const URL_INV = '/api/v1/imobilizado/inventarios/7';

const inv = (extra: Partial<ImobInventario> = {}): ImobInventario => ({
  id: 7, nome: 'Inventário anual 2026', descricao: 'Contagem geral', status: 'rascunho', dataInicio: null, dataFim: null,
  criadoPorId: 'u1', criadoPorNome: 'Maria Operadora', criadoEm: '2026-10-20T09:00:00Z', atualizadoEm: '2026-10-20T09:00:00Z',
  totalLocais: 2, totalEsperados: 0,
  locais: [{ localId: 1, localNome: 'Matriz' }, { localId: 9, localNome: 'Filial' }],
  equipe: [{ usuarioId: '8a1c0000-1111', nome: 'Carlos Contador' }, { usuarioId: '99990000-2222', nome: null }],
  ...extra
});

describe('ImobInventarioDetalheComponent', () => {
  let fixture: ComponentFixture<ImobInventarioDetalheComponent>;
  let comp: ImobInventarioDetalheComponent;
  let ctrl: HttpTestingController;
  let navegar: jasmine.Spy;
  const el = () => fixture.nativeElement as HTMLElement;
  const texto = () => (el().textContent ?? '').replace(/\s+/g, ' ');

  function montar(role: 'admin' | 'operador' | 'leitura' = 'admin', i: ImobInventario = inv()) {
    TestBed.configureTestingModule({
      imports: [ImobInventarioDetalheComponent],
      providers: [
        provideRouter([]), provideHttpClient(), provideHttpClientTesting(), provideAuthFake(role),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: '7' }) } } }
      ]
    });
    ctrl = TestBed.inject(HttpTestingController);
    navegar = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    fixture = TestBed.createComponent(ImobInventarioDetalheComponent);
    comp = fixture.componentInstance;
    fixture.detectChanges();
    ctrl.expectOne(URL_INV).flush(i);
    fixture.detectChanges();
  }
  const botao = (rotulo: string) => Array.from(el().querySelectorAll('.btn-sm')).find(b => b.textContent?.includes(rotulo));

  afterEach(() => ctrl.verify());

  it('mostra escopo, equipe (com id abreviado sem nome) e que o esperado só existe ao iniciar', () => {
    montar();
    expect(texto()).toContain('Inventário anual 2026');
    expect(texto()).toContain('Rascunho');
    expect(texto()).toContain('Matriz');
    expect(texto()).toContain('Filial');
    expect(texto()).toContain('Carlos Contador');
    expect(texto()).toContain('Usuário 99990000');
    expect(texto()).toContain('Definido ao iniciar a contagem');
  });

  it('em andamento mostra o total esperado', () => {
    montar('admin', inv({ status: 'em_andamento', dataInicio: '2026-10-22T14:03:11Z', totalEsperados: 155 }));
    expect(texto()).toContain('155');
    expect(texto()).not.toContain('Definido ao iniciar');
  });

  it('404 mostra "não encontrado"', () => {
    TestBed.configureTestingModule({
      imports: [ImobInventarioDetalheComponent],
      providers: [
        provideRouter([]), provideHttpClient(), provideHttpClientTesting(), provideAuthFake('admin'),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: '7' }) } } }
      ]
    });
    ctrl = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ImobInventarioDetalheComponent);
    fixture.detectChanges();
    ctrl.expectOne(URL_INV).flush({ error: 'x' }, { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();
    expect(texto()).toContain('Inventário não encontrado nesta empresa.');
  });

  describe('ações por status e papel', () => {
    it('rascunho (admin): editar, iniciar, cancelar e excluir', () => {
      montar('admin');
      for (const r of ['Editar', 'Iniciar contagem', 'Cancelar', 'Excluir']) expect(botao(r)).withContext(r).toBeTruthy();
    });

    it('rascunho (operador): sem excluir', () => {
      montar('operador');
      expect(botao('Iniciar contagem')).toBeTruthy();
      expect(botao('Excluir')).toBeUndefined();
    });

    it('leitura não vê nenhuma ação de escrita', () => {
      montar('leitura');
      for (const r of ['Editar', 'Iniciar contagem', 'Cancelar', 'Excluir']) expect(botao(r)).withContext(r).toBeUndefined();
    });

    it('em andamento: editar e cancelar, mas não iniciar nem excluir', () => {
      montar('admin', inv({ status: 'em_andamento' }));
      expect(botao('Editar')).toBeTruthy();
      expect(botao('Cancelar')).toBeTruthy();
      expect(botao('Iniciar contagem')).toBeUndefined();
      expect(botao('Excluir')).toBeUndefined();
    });

    it('concluído é somente leitura', () => {
      montar('admin', inv({ status: 'concluido' }));
      for (const r of ['Editar', 'Iniciar contagem', 'Cancelar', 'Excluir']) expect(botao(r)).withContext(r).toBeUndefined();
      expect(texto()).toContain('somente consulta');
    });

    it('cancelado: só excluir (admin)', () => {
      montar('admin', inv({ status: 'cancelado' }));
      expect(botao('Excluir')).toBeTruthy();
      expect(botao('Editar')).toBeUndefined();
      expect(botao('Cancelar')).toBeUndefined();
    });
  });

  describe('iniciar', () => {
    it('avisa que congela o esperado, só inicia após confirmar e atualiza o detalhe', async () => {
      montar('operador');
      const abrir = spyOn(ConfirmDialogComponent.prototype, 'abrir').and.resolveTo(false);
      await comp.iniciar();
      expect(abrir.calls.mostRecent().args[0].mensagem).toContain('congelada');
      expect(abrir.calls.mostRecent().args[0].mensagem).toContain('Matriz, Filial');
      ctrl.expectNone(`${URL_INV}/iniciar`);

      abrir.and.resolveTo(true);
      await comp.iniciar();
      expect(comp.agindo()).toBe('iniciar');
      ctrl.expectOne(`${URL_INV}/iniciar`).flush(inv({ status: 'em_andamento', dataInicio: '2026-10-22T14:03:11Z', totalEsperados: 155 }));
      fixture.detectChanges();
      expect(comp.agindo()).toBeNull();
      expect(texto()).toContain('Em andamento');
      expect(texto()).toContain('155');
    });

    it('mostra o erro do servidor e mantém o rascunho', async () => {
      montar('operador');
      spyOn(ConfirmDialogComponent.prototype, 'abrir').and.resolveTo(true);
      await comp.iniciar();
      ctrl.expectOne(`${URL_INV}/iniciar`).flush({ error: 'Um local do escopo foi excluído. Edite o escopo.' }, { status: 400, statusText: 'Bad Request' });
      fixture.detectChanges();
      expect(texto()).toContain('Um local do escopo foi excluído.');
      expect(comp.inventario()!.status).toBe('rascunho');
    });
  });

  describe('cancelar e excluir', () => {
    it('cancelar só após confirmar', async () => {
      montar('operador', inv({ status: 'em_andamento' }));
      const abrir = spyOn(ConfirmDialogComponent.prototype, 'abrir').and.resolveTo(false);
      await comp.cancelar();
      ctrl.expectNone(`${URL_INV}/cancelar`);

      abrir.and.resolveTo(true);
      await comp.cancelar();
      ctrl.expectOne(`${URL_INV}/cancelar`).flush(inv({ status: 'cancelado', dataFim: '2026-10-23T10:00:00Z' }));
      fixture.detectChanges();
      expect(texto()).toContain('Cancelado');
    });

    it('excluir só após confirmar e volta para a lista', async () => {
      montar('admin');
      const abrir = spyOn(ConfirmDialogComponent.prototype, 'abrir').and.resolveTo(false);
      await comp.excluir();
      ctrl.expectNone(r => r.method === 'DELETE');

      abrir.and.resolveTo(true);
      await comp.excluir();
      ctrl.expectOne(r => r.method === 'DELETE' && r.url === URL_INV).flush(null, { status: 204, statusText: 'No Content' });
      expect(navegar).toHaveBeenCalledWith(['/imobilizado/inventarios']);
    });
  });
});
