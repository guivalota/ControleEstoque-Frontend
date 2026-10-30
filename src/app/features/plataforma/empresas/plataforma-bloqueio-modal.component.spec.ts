import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Modal } from 'bootstrap';
import { PlataformaBloqueioModalComponent } from './plataforma-bloqueio-modal.component';
import { PlataformaEmpresa } from '../../../core/models/plataforma-empresa.model';

const BASE = '/api/v1/plataforma/empresas';
const empresa = (ativo: boolean): PlataformaEmpresa => ({ id: 4, razaoSocial: 'Acme', cnpj: '11222333000181', ativo, criadoEm: '2026-10-26T00:00:00Z' });

describe('PlataformaBloqueioModalComponent', () => {
  let fixture: ComponentFixture<PlataformaBloqueioModalComponent>;
  let comp: PlataformaBloqueioModalComponent;
  let ctrl: HttpTestingController;

  beforeEach(() => {
    spyOn(Modal.prototype, 'show');
    spyOn(Modal.prototype, 'hide');
    TestBed.configureTestingModule({ imports: [PlataformaBloqueioModalComponent], providers: [provideHttpClient(), provideHttpClientTesting()] });
    ctrl = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(PlataformaBloqueioModalComponent);
    comp = fixture.componentInstance;
    fixture.detectChanges();
  });
  afterEach(() => ctrl.verify());

  it('exige motivo para bloquear', () => {
    comp.abrir(empresa(true));
    comp.form.patchValue({ motivo: '   ' });
    comp.confirmar();
    ctrl.expectNone(`${BASE}/4/bloquear`);
    expect(comp.msg()).toBe('Informe o motivo do bloqueio.');
  });

  it('bloqueia com o motivo e emite a empresa atualizada', () => {
    let saida: { empresa: PlataformaEmpresa; bloqueou: boolean } | undefined;
    comp.concluido.subscribe(r => saida = r);
    comp.abrir(empresa(true));
    comp.form.patchValue({ motivo: ' Inadimplência ' });
    comp.confirmar();
    const req = ctrl.expectOne(`${BASE}/4/bloquear`);
    expect(req.request.body).toEqual({ motivo: 'Inadimplência' });
    req.flush(empresa(false));
    expect(saida?.bloqueou).toBeTrue();
    expect(saida?.empresa.ativo).toBeFalse();
    expect(Modal.prototype.hide).toHaveBeenCalled();
  });

  it('desbloqueia sem motivo (opcional)', () => {
    comp.abrir(empresa(false));
    comp.confirmar();
    const req = ctrl.expectOne(`${BASE}/4/desbloquear`);
    expect(req.request.body).toEqual({});
    req.flush(empresa(true));
  });

  it('mostra o 400 do servidor (já estava bloqueada)', () => {
    comp.abrir(empresa(true));
    comp.form.patchValue({ motivo: 'x' });
    comp.confirmar();
    ctrl.expectOne(`${BASE}/4/bloquear`).flush({ error: 'A empresa já está bloqueada.' }, { status: 400, statusText: 'Bad' });
    expect(comp.erro()).toBe('A empresa já está bloqueada.');
    expect(comp.saving()).toBeFalse();
    expect(Modal.prototype.hide).not.toHaveBeenCalled();
  });
});
