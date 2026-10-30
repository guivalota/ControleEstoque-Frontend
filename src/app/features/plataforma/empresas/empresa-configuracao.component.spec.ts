import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { EmpresaConfiguracaoComponent } from './empresa-configuracao.component';

const URL = '/api/v1/plataforma/empresas/5/configuracao-resumo';
const resumo = (extra = {}) => ({
  empresaId: 5, razaoSocial: 'Acme Ltda', cnpj: '11222333000181', nomeFantasia: null, estado: 'incompleto',
  pendencias: ['endereco', 'fiscal'], temLogo: false, emailVerificado: true, integracoes: 2, perfilAtualizadoEm: null, ...extra
});

describe('EmpresaConfiguracaoComponent (SA)', () => {
  let fixture: ComponentFixture<EmpresaConfiguracaoComponent>;
  let ctrl: HttpTestingController;
  const el = () => fixture.nativeElement as HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [EmpresaConfiguracaoComponent], providers: [provideHttpClient(), provideHttpClientTesting()] });
    ctrl = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(EmpresaConfiguracaoComponent);
    fixture.componentRef.setInput('empresaId', 5);
  });
  afterEach(() => ctrl.verify());

  it('mostra estado, pendências, logo, e-mail verificado e integrações', () => {
    fixture.detectChanges();
    ctrl.expectOne(URL).flush(resumo());
    fixture.detectChanges();
    const t = el().textContent!;
    expect(t).toContain('Acme Ltda');
    expect(t).toContain('11.222.333/0001-81');
    expect(t).toContain('Incompleto');
    expect(t).toContain('Endereço');
    expect(t).toContain('Fiscal');
    const dd = Array.from(el().querySelectorAll('dd')).map(d => d.textContent!.trim());
    expect(dd[5]).toBe('Não');   // logo
    expect(dd[6]).toBe('Sim');   // e-mail verificado
    expect(dd[7]).toBe('2');     // integrações
  });

  it('empresa completa sem pendências', () => {
    fixture.detectChanges();
    ctrl.expectOne(URL).flush(resumo({ estado: 'completo', pendencias: [], temLogo: true }));
    fixture.detectChanges();
    expect(el().textContent).toContain('Completo');
    expect(el().textContent).toContain('Nenhuma');
  });

  it('404 mostra a mensagem do servidor', () => {
    fixture.detectChanges();
    ctrl.expectOne(URL).flush({ error: 'Empresa não encontrada.' }, { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();
    expect(el().textContent).toContain('Empresa não encontrada.');
  });
});
