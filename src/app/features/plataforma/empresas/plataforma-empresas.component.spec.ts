import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { Modal } from 'bootstrap';
import { PlataformaEmpresasComponent } from './plataforma-empresas.component';
import { PlataformaEmpresa } from '../../../core/models/plataforma-empresa.model';

const BASE = '/api/v1/plataforma/empresas';

const empresa = (id: number, extra: Partial<PlataformaEmpresa> = {}): PlataformaEmpresa => ({
  id, razaoSocial: `Empresa ${id} Ltda`, nomeFantasia: null, cnpj: '11222333000181', ativo: true,
  criadoEm: '2026-10-22T14:03:11Z', ...extra
});

describe('PlataformaEmpresasComponent', () => {
  let fixture: ComponentFixture<PlataformaEmpresasComponent>;
  let comp: PlataformaEmpresasComponent;
  let ctrl: HttpTestingController;
  const el = () => fixture.nativeElement as HTMLElement;

  const responder = (items: PlataformaEmpresa[]) =>
    ctrl.expectOne(r => r.url === BASE && r.method === 'GET').flush({ items, page: 1, pageSize: 100, total: items.length });

  beforeEach(() => {
    spyOn(Modal.prototype, 'show');
    spyOn(Modal.prototype, 'hide');
    TestBed.configureTestingModule({
      imports: [PlataformaEmpresasComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()]
    });
    ctrl = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(PlataformaEmpresasComponent);
    comp = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => ctrl.verify());

  it('mostra carregando e depois as empresas com CNPJ formatado', () => {
    expect(el().textContent).toContain('Carregando');
    responder([empresa(1), empresa(2, { ativo: false, cnpj: '12ABC34501DE35' })]);
    fixture.detectChanges();
    expect(el().textContent).toContain('11.222.333/0001-81');
    expect(el().textContent).toContain('12.ABC.345/01DE-35');
    expect(el().textContent).toContain('Bloqueada');
  });

  it('mostra estado vazio', () => {
    responder([]);
    fixture.detectChanges();
    expect(el().textContent).toContain('Nenhuma empresa cadastrada');
  });

  it('mostra erro do servidor com tentar novamente', () => {
    ctrl.expectOne(r => r.url === BASE).flush({ error: 'Falhou feio.' }, { status: 500, statusText: 'x' });
    fixture.detectChanges();
    expect(el().textContent).toContain('Falhou feio.');
    expect(el().textContent).toContain('Tentar novamente');
  });

  it('filtra por busca (razão ou CNPJ) e situação', () => {
    responder([empresa(1), empresa(2, { razaoSocial: 'Beta SA', ativo: false, cnpj: '12ABC34501DE35' })]);
    comp.busca.set('beta');
    expect(comp.filtradas().map(e => e.id)).toEqual([2]);
    comp.busca.set('12.abc');
    expect(comp.filtradas().map(e => e.id)).toEqual([2]);
    comp.busca.set('');
    comp.filtroAtivo.set('ativas');
    expect(comp.filtradas().map(e => e.id)).toEqual([1]);
    comp.filtroAtivo.set('bloqueadas');
    expect(comp.filtradas().map(e => e.id)).toEqual([2]);
  });

  it('o botão de bloqueio abre o modal com motivo para a empresa', () => {
    const e = empresa(2, { ativo: false });
    responder([e]);
    fixture.detectChanges();
    const abrir = spyOn(comp.bloqueio(), 'abrir');
    (el().querySelector('button[aria-label^="Desbloquear"]') as HTMLButtonElement).click();
    expect(abrir).toHaveBeenCalledWith(e);
  });

  it('após bloquear/desbloquear mostra o aviso e recarrega a lista', () => {
    responder([empresa(1)]);
    comp.aoBloqueio({ empresa: empresa(1, { ativo: false }), bloqueou: true });
    expect(comp.feedback()).toBe('Empresa bloqueada.');
    ctrl.expectOne(r => r.url === BASE && r.method === 'GET').flush({ items: [], page: 1, pageSize: 100, total: 0 });
  });

  it('Nova empresa abre o assistente de onboarding', () => {
    responder([]);
    const abrir = spyOn(comp.onboarding(), 'abrir');
    (Array.from(el().querySelectorAll('button')).find(b => b.textContent?.includes('Nova empresa')) as HTMLButtonElement).click();
    expect(abrir).toHaveBeenCalled();
  });
});
