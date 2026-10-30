import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { FormControl, FormGroup } from '@angular/forms';
import { EnderecoComponent } from './endereco.component';

describe('EnderecoComponent (busca de CEP)', () => {
  let fixture: ComponentFixture<EnderecoComponent>;
  let ctrl: HttpTestingController;
  let form: FormGroup;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [EnderecoComponent], providers: [provideHttpClient(), provideHttpClientTesting()] });
    ctrl = TestBed.inject(HttpTestingController);
    form = new FormGroup({
      cep: new FormControl<string | null>(null), logradouro: new FormControl<string | null>(null),
      numero: new FormControl<string | null>(null), complemento: new FormControl<string | null>(null),
      bairro: new FormControl<string | null>(null), municipio: new FormControl<string | null>(null),
      uf: new FormControl<string | null>(null), codigoIbge: new FormControl<string | null>(null)
    });
    fixture = TestBed.createComponent(EnderecoComponent);
    fixture.componentRef.setInput('form', form);
    fixture.componentRef.setInput('ufs', ['SP', 'RJ']);
    fixture.detectChanges();
  });
  afterEach(() => ctrl.verify());

  it('preenche logradouro, bairro, município e UF ao digitar 8 dígitos', () => {
    const input = fixture.nativeElement.querySelector('#cfg-cep') as HTMLInputElement;
    input.value = '01310-100';
    input.dispatchEvent(new Event('input'));
    ctrl.expectOne('/api/v1/cep/01310100').flush({ logradouro: 'Av Paulista', bairro: 'Bela Vista', localidade: 'São Paulo', uf: 'SP' });
    fixture.detectChanges();
    expect(form.value.logradouro).toBe('Av Paulista');
    expect(form.value.bairro).toBe('Bela Vista');
    expect(form.value.municipio).toBe('São Paulo');
    expect(form.value.uf).toBe('SP');
    expect(fixture.nativeElement.textContent).toContain('Endereço preenchido.');
  });

  it('CEP não encontrado mantém os campos e avisa', () => {
    form.patchValue({ cep: '99999999', logradouro: 'Rua X' });
    fixture.componentInstance.buscarCep();
    ctrl.expectOne('/api/v1/cep/99999999').flush({ error: 'CEP não encontrado.' }, { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();
    expect(form.value.logradouro).toBe('Rua X');
    expect(fixture.nativeElement.textContent).toContain('CEP não encontrado.');
  });

  it('CEP incompleto não chama a API', () => {
    form.patchValue({ cep: '123' });
    fixture.componentInstance.buscarCep();
    expect(fixture.componentInstance.cepMsg()).toBe('CEP deve ter 8 dígitos.');
  });
});
