import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { FiscalComponent } from './fiscal.component';
import { opcoesBase, perfilBase } from '../testing-perfil';

const URL = '/api/v1/empresa-ativa';

describe('FiscalComponent', () => {
  let fixture: ComponentFixture<FiscalComponent>;
  let ctrl: HttpTestingController;
  const el = () => fixture.nativeElement as HTMLElement;

  function iniciar() {
    fixture.detectChanges();
    ctrl.expectOne(`${URL}/perfil`).flush(perfilBase({ nomeFantasia: 'Acme', telefone: '1133334444' }));
    ctrl.expectOne(`${URL}/perfil/opcoes`).flush(opcoesBase);
    fixture.detectChanges();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [FiscalComponent], providers: [provideHttpClient(), provideHttpClientTesting()] });
    ctrl = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(FiscalComponent);
  });
  afterEach(() => ctrl.verify());

  it('lista regimes e ambientes vindos do servidor e preenche os campos', () => {
    iniciar();
    const regimes = Array.from(el().querySelectorAll('#cfg-regime option')).map(o => o.textContent!.trim());
    expect(regimes).toEqual(['—', 'Simples Nacional', 'MEI']);
    const ambientes = Array.from(el().querySelectorAll('#cfg-ambiente option')).map(o => o.textContent!.trim());
    expect(ambientes).toEqual(['—', 'Homologação', 'Produção']);
    expect((el().querySelector('#cfg-ie') as HTMLInputElement).value).toBe('ISENTO');
    expect((el().querySelector('#cfg-cnae') as HTMLInputElement).value).toBe('4751201');
  });

  it('PUT leva o documento completo (mantém contato) com os campos fiscais alterados', () => {
    iniciar();
    fixture.componentInstance.form.patchValue({ cnae: '4751-2/01', regimeTributario: 'mei', serieNfe: 2, ambienteNfe: 'producao', inscricaoMunicipal: '' });
    fixture.componentInstance.salvar();
    const req = ctrl.expectOne(r => r.method === 'PUT' && r.url === `${URL}/perfil`);
    expect(req.request.body.telefone).toBe('1133334444');
    expect(req.request.body.nomeFantasia).toBe('Acme');
    expect(req.request.body.cnae).toBe('4751-2/01');
    expect(req.request.body.regimeTributario).toBe('mei');
    expect(req.request.body.serieNfe).toBe(2);
    expect(req.request.body.ambienteNfe).toBe('producao');
    expect(req.request.body.inscricaoMunicipal).toBeNull();
    req.flush(perfilBase({ cnae: '4751201', regimeTributario: 'mei' }));
    fixture.detectChanges();
    expect(el().textContent).toContain('Dados fiscais salvos.');
  });

  it('mostra o erro de CNAE por campo como o servidor devolveu', () => {
    iniciar();
    fixture.componentInstance.salvar();
    ctrl.expectOne(r => r.method === 'PUT').flush({ errors: { Cnae: ['CNAE deve ter 7 dígitos.'] } }, { status: 400, statusText: 'Bad Request' });
    fixture.detectChanges();
    expect(el().querySelector('.invalid-feedback')!.textContent).toContain('CNAE deve ter 7 dígitos.');
  });
});
