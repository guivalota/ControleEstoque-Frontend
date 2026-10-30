import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PlataformaEmpresaBloqueiosComponent } from './plataforma-empresa-bloqueios.component';

const URL = '/api/v1/plataforma/empresas/4/bloqueios';

describe('PlataformaEmpresaBloqueiosComponent', () => {
  let fixture: ComponentFixture<PlataformaEmpresaBloqueiosComponent>;
  let comp: PlataformaEmpresaBloqueiosComponent;
  let ctrl: HttpTestingController;
  const el = () => fixture.nativeElement as HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [PlataformaEmpresaBloqueiosComponent], providers: [provideHttpClient(), provideHttpClientTesting()] });
    ctrl = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(PlataformaEmpresaBloqueiosComponent);
    fixture.componentRef.setInput('empresaId', 4);
    comp = fixture.componentInstance;
    fixture.detectChanges();
  });
  afterEach(() => ctrl.verify());

  it('lista o histórico com motivo e autor', () => {
    ctrl.expectOne(r => r.url === URL).flush({
      items: [
        { id: 2, acao: 'desbloqueou', motivo: 'Pago', atorUsuarioId: 'g', atorNome: 'Root', criadoEm: '2026-10-26T12:00:00Z' },
        { id: 1, acao: 'bloqueou', motivo: 'Inadimplência', atorUsuarioId: 'g', atorNome: 'Root', criadoEm: '2026-10-20T12:00:00Z' }
      ], page: 1, pageSize: 20, total: 2
    });
    fixture.detectChanges();
    expect(el().textContent).toContain('Inadimplência');
    expect(el().textContent).toContain('Desbloqueou');
    expect(el().textContent).toContain('Root');
  });

  it('mostra estado vazio e erro com tentar novamente', () => {
    ctrl.expectOne(r => r.url === URL).flush({ items: [], page: 1, pageSize: 20, total: 0 });
    fixture.detectChanges();
    expect(el().textContent).toContain('Nenhum bloqueio registrado');
    comp.carregar(1);
    ctrl.expectOne(r => r.url === URL).flush({ error: 'Falhou.' }, { status: 500, statusText: 'x' });
    fixture.detectChanges();
    expect(el().textContent).toContain('Falhou.');
  });
});
