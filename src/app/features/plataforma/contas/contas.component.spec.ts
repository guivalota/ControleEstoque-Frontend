import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PlataformaContasComponent } from './contas.component';

const URL = '/api/v1/users';
const conta = (id: string, tipo: string, nome = `Conta ${id}`) => ({
  id, nome, email: `${id}@x.com`, role: 'admin', tipo, ativo: true, criadoEm: '2026-10-22T14:03:11Z'
});

describe('PlataformaContasComponent', () => {
  let fixture: ComponentFixture<PlataformaContasComponent>;
  let comp: PlataformaContasComponent;
  let ctrl: HttpTestingController;
  const el = () => fixture.nativeElement as HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [PlataformaContasComponent], providers: [provideHttpClient(), provideHttpClientTesting()] });
    ctrl = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(PlataformaContasComponent);
    comp = fixture.componentInstance;
    fixture.detectChanges();
  });
  afterEach(() => ctrl.verify());

  it('lista contas com coluna tipo', () => {
    const r = ctrl.expectOne(x => x.url === URL);
    expect(r.request.params.get('page')).toBe('1');
    expect(r.request.params.get('pageSize')).toBe('50');
    r.flush({ items: [conta('a', 'cliente'), conta('b', 'superadmin')], page: 1, pageSize: 50, total: 2 });
    fixture.detectChanges();
    expect(el().textContent).toContain('Cliente');
    expect(el().textContent).toContain('Super admin');
  });

  it('busca por nome ou e-mail na página', () => {
    ctrl.expectOne(x => x.url === URL).flush({ items: [conta('a', 'cliente', 'Ana'), conta('b', 'cliente', 'Bia')], page: 1, pageSize: 50, total: 2 });
    comp.busca.set('bia');
    fixture.detectChanges();
    expect(el().textContent).toContain('Bia');
    expect(el().textContent).not.toContain('Ana');
  });

  it('pagina para a próxima página', () => {
    ctrl.expectOne(x => x.url === URL).flush({ items: [conta('a', 'cliente')], page: 1, pageSize: 50, total: 120 });
    expect(comp.temProxima()).toBeTrue();
    comp.carregar(2);
    const r = ctrl.expectOne(x => x.url === URL);
    expect(r.request.params.get('page')).toBe('2');
    r.flush({ items: [conta('z', 'plataforma')], page: 2, pageSize: 50, total: 120 });
    expect(comp.pagina()).toBe(2);
  });

  it('mostra erro com tentar novamente', () => {
    ctrl.expectOne(x => x.url === URL).flush({ error: 'Falhou.' }, { status: 500, statusText: 'x' });
    fixture.detectChanges();
    expect(el().textContent).toContain('Falhou.');
    expect(el().textContent).toContain('Tentar novamente');
  });
});
