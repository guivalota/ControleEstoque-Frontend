import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Modal } from 'bootstrap';
import { ImobBemConferenciasComponent } from './imob-bem-conferencias.component';
import { ImobConferenciaDoBem } from '../../../core/models/imob-leitura.model';

const BASE = '/api/v1/imobilizado/bens/42/conferencias';

const conf = (inventarioId: number, extra: Partial<ImobConferenciaDoBem> = {}): ImobConferenciaDoBem => ({
  inventarioId, inventarioNome: `Ciclo ${inventarioId}`, inventarioStatus: 'concluido', dataBase: '2026-11-01',
  encontrado: true, estadoId: 5, estadoNome: 'ZZC Bom', valorMercado: 750.5, departamentoNome: 'ZZC Tecnologia',
  localLidoNome: 'ZZC Sala 1', conferidoPorNome: 'Admin Testes', conferidoEm: '2026-11-11T12:15:38Z',
  incompleto: false, cicloConcluido: true, qtdFotos: 0, ...extra
});

describe('ImobBemConferenciasComponent', () => {
  let fixture: ComponentFixture<ImobBemConferenciasComponent>;
  let comp: ImobBemConferenciasComponent;
  let ctrl: HttpTestingController;
  const el = () => fixture.nativeElement as HTMLElement;
  const texto = () => (el().textContent ?? '').replace(/\s+/g, ' ').replace(/ /g, ' ');

  function montar() {
    TestBed.configureTestingModule({ imports: [ImobBemConferenciasComponent], providers: [provideHttpClient(), provideHttpClientTesting()] });
    ctrl = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ImobBemConferenciasComponent);
    fixture.componentRef.setInput('bemId', 42);
    comp = fixture.componentInstance;
    fixture.detectChanges();
  }

  const lista = () => ctrl.expectOne(r => r.url === BASE);
  const responder = (itens: ImobConferenciaDoBem[], total = itens.length) => {
    lista().flush({ items: itens, page: 1, pageSize: 20, total });
    fixture.detectChanges();
  };

  beforeEach(() => {
    spyOn(URL, 'createObjectURL').and.callFake(() => `blob:${Math.random()}`);
    spyOn(URL, 'revokeObjectURL').and.stub();
    spyOn(Modal.prototype, 'show').and.stub();
    spyOn(Modal.prototype, 'hide').and.stub();
  });

  afterEach(() => ctrl.verify());

  it('lista uma linha por ciclo, do mais recente ao mais antigo, com estado, valor e fotos', () => {
    montar();
    expect(texto()).toContain('Carregando');
    const req = lista();
    expect(req.request.params.get('page')).toBe('1');
    req.flush({
      items: [
        conf(50, { inventarioNome: 'Ciclo 2026', inventarioStatus: 'em_andamento', cicloConcluido: false, valorMercado: null, incompleto: true, qtdFotos: 2 }),
        conf(40, { inventarioNome: 'Ciclo 2025' })
      ], page: 1, pageSize: 20, total: 2
    });
    fixture.detectChanges();

    const t = texto();
    expect(t).toContain('Ciclo 2026');
    expect(t).toContain('Em andamento');
    expect(t).toContain('Incompleto');
    expect(t).toContain('Ciclo 2025');
    expect(t).toContain('Concluído');
    expect(t).toContain('Completo');
    expect(t).toContain('R$ 750,50');
    expect(t).toContain('ZZC Tecnologia');
    expect(t).toContain('01/11/2026');
    expect(el().querySelector('[aria-label="2 foto(s)"]')).not.toBeNull();
    const nomes = Array.from(el().querySelectorAll('tbody tr td:first-child')).map(td => (td.textContent ?? '').trim());
    expect(nomes[0]).toContain('Ciclo 2026');
    expect(nomes[1]).toContain('Ciclo 2025');
  });

  it('bem não encontrado no ciclo aparece como "Não encontrado"', () => {
    montar();
    responder([conf(40, { encontrado: false, estadoNome: null, valorMercado: null, departamentoNome: null, conferidoEm: null })]);

    expect(texto()).toContain('Não encontrado');
  });

  it('sem conferências mostra a mensagem vazia', () => {
    montar();
    responder([]);

    expect(texto()).toContain('ainda não foi conferido');
  });

  it('erro do servidor aparece na tela', () => {
    montar();
    lista().flush({ error: 'Bem com id 42 não encontrado.' }, { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();

    expect(texto()).toContain('não encontrado');
  });

  it('o botão Detalhe abre o detalhe do ciclo e, ao clicar de novo, fecha', () => {
    montar();
    responder([conf(40)]);
    const botao = () => el().querySelector<HTMLButtonElement>('button[aria-label^="Detalhe da conferência"]')!;

    botao().click();
    fixture.detectChanges();
    expect(comp.aberto()).toBe(40);
    ctrl.expectOne(`/api/v1/imobilizado/inventarios/40/conferencias/42`).flush({
      inventarioId: 40, inventarioNome: 'Ciclo 40', inventarioStatus: 'concluido', bemId: 42, plaqueta: 'ZZC-0001',
      encontrado: true, incompleto: false, somenteLeitura: true, eventos: []
    });
    ctrl.expectOne(`/api/v1/imobilizado/inventarios/40/conferencias/42/fotos`).flush([]);
    fixture.detectChanges();
    expect(texto()).toContain('Conferência · ZZC-0001');

    botao().click();
    fixture.detectChanges();
    expect(comp.aberto()).toBeNull();
    expect(texto()).not.toContain('Conferência · ZZC-0001');
  });
});
