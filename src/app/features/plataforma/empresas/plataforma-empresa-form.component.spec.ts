import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Modal } from 'bootstrap';
import { PlataformaEmpresaFormComponent } from './plataforma-empresa-form.component';

const BASE = '/api/v1/plataforma/empresas';

describe('PlataformaEmpresaFormComponent', () => {
  let fixture: ComponentFixture<PlataformaEmpresaFormComponent>;
  let comp: PlataformaEmpresaFormComponent;
  let ctrl: HttpTestingController;

  beforeEach(() => {
    spyOn(Modal.prototype, 'show');
    spyOn(Modal.prototype, 'hide');
    TestBed.configureTestingModule({
      imports: [PlataformaEmpresaFormComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    ctrl = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(PlataformaEmpresaFormComponent);
    comp = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => ctrl.verify());

  it('mascara CNPJ alfanumérico em maiúsculas ao digitar', () => {
    comp.abrir();
    comp.form.controls.cnpj.setValue('12abc34501de35');
    comp.onCnpjInput();
    expect(comp.form.controls.cnpj.value).toBe('12.ABC.345/01DE-35');
  });

  it('rejeita dígito verificador errado e não envia', () => {
    comp.abrir();
    comp.form.patchValue({ razaoSocial: 'Acme', cnpj: '12.ABC.345/01DE-36' });
    comp.salvar();
    expect(comp.erroCampo('cnpj')).toContain('CNPJ inválido');
    ctrl.expectNone(BASE);
  });

  it('cria com CNPJ alfanumérico normalizado (sem extrair só dígitos)', () => {
    let emitido: { criada: boolean } | undefined;
    comp.salvo.subscribe(r => (emitido = r));
    comp.abrir();
    comp.form.patchValue({ razaoSocial: ' Acme ', nomeFantasia: '', cnpj: '12.abc.345/01de-35' });
    comp.onCnpjInput();
    comp.salvar();
    const req = ctrl.expectOne(BASE);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ razaoSocial: 'Acme', nomeFantasia: null, cnpj: '12ABC34501DE35' });
    req.flush({ id: 9, razaoSocial: 'Acme', cnpj: '12ABC34501DE35', ativo: true, criadoEm: '2026-10-26T00:00:00Z' });
    expect(emitido?.criada).toBeTrue();
  });

  it('exibe erro de campo vindo do servidor', () => {
    comp.abrir();
    comp.form.patchValue({ razaoSocial: 'Acme', cnpj: '11.222.333/0001-81' });
    comp.salvar();
    ctrl.expectOne(BASE).flush({ errors: { Cnpj: ['CNPJ já cadastrado.'] } }, { status: 400, statusText: 'Bad' });
    expect(comp.erroCampo('cnpj')).toBe('CNPJ já cadastrado.');
    expect(comp.saving()).toBeFalse();
  });

  it('edita enviando PUT com ativo', () => {
    comp.abrir({ id: 4, razaoSocial: 'X', cnpj: '11222333000181', ativo: false, criadoEm: '2026-10-26T00:00:00Z' });
    expect(comp.form.controls.cnpj.value).toBe('11.222.333/0001-81');
    comp.salvar();
    const req = ctrl.expectOne(`${BASE}/4`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body.ativo).toBeFalse();
    expect(req.request.body.cnpj).toBe('11222333000181');
  });
});
