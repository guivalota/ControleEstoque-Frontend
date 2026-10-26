import { Component } from '@angular/core';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { AutocompleteResponsavelComponent } from './autocomplete-responsavel.component';
import { ImobResponsavel } from '../../../core/models/imob-responsavel.model';

const BASE = '/api/v1/imobilizado/responsaveis';

const resp = (id: number, nome: string, matricula: string | null = `M${id}`, extra: Partial<ImobResponsavel> = {}): ImobResponsavel =>
  ({ id, nome, matricula, email: null, setor: null, ativo: true, criadoEm: '2026-10-22T14:03:11Z', ...extra });

@Component({
  standalone: true,
  imports: [ReactiveFormsModule, AutocompleteResponsavelComponent],
  template: `<app-autocomplete-responsavel [formControl]="ctrl" />`
})
class HostComponent {
  ctrl = new FormControl<number | null>(null);
}

describe('AutocompleteResponsavelComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;
  let ctrl: HttpTestingController;
  const el = () => fixture.nativeElement as HTMLElement;
  const input = () => el().querySelector<HTMLInputElement>('input')!;
  const digitar = (t: string) => { input().value = t; input().dispatchEvent(new Event('input')); };

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HostComponent], providers: [provideHttpClient(), provideHttpClientTesting()] });
    ctrl = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => ctrl.verify());

  it('busca só após a pausa na digitação, com ativo=true, busca e pageSize=20', fakeAsync(() => {
    digitar('an');
    digitar('ana');
    tick(299);
    ctrl.expectNone(r => r.url === BASE);
    tick(1);
    const req = ctrl.expectOne(r => r.url === BASE);
    expect(req.request.params.get('busca')).toBe('ana');
    expect(req.request.params.get('ativo')).toBe('true');
    expect(req.request.params.get('pageSize')).toBe('20');
    req.flush({ items: [resp(1, 'Ana Souza', 'M100', { setor: 'TI' })], page: 1, pageSize: 20, total: 1 });
    fixture.detectChanges();
    expect(el().textContent).toContain('Ana Souza (M100)');
    expect(el().textContent).toContain('TI');
  }));

  it('texto vazio não consulta a API', fakeAsync(() => {
    digitar('  ');
    tick(300);
    ctrl.expectNone(r => r.url === BASE);
    expect(el().querySelector('.list-group')).toBeNull();
  }));

  it('escolher emite o id e mostra nome (matrícula), distinguindo homônimos', fakeAsync(() => {
    digitar('ana');
    tick(300);
    ctrl.expectOne(r => r.url === BASE).flush({
      items: [resp(1, 'Ana', 'M100'), resp(2, 'Ana', 'M200')], page: 1, pageSize: 20, total: 2
    });
    fixture.detectChanges();
    const botoes = el().querySelectorAll<HTMLButtonElement>('.list-group-item');
    expect(botoes[0].textContent).toContain('Ana (M100)');
    expect(botoes[1].textContent).toContain('Ana (M200)');

    botoes[1].click();
    fixture.detectChanges();
    expect(host.ctrl.value).toBe(2);
    expect(input().value).toBe('Ana (M200)');
    expect(el().querySelector('.list-group')).toBeNull();
  }));

  it('editar o texto depois de escolher limpa a seleção', fakeAsync(() => {
    digitar('ana');
    tick(300);
    ctrl.expectOne(r => r.url === BASE).flush({ items: [resp(1, 'Ana')], page: 1, pageSize: 20, total: 1 });
    fixture.detectChanges();
    el().querySelector<HTMLButtonElement>('.list-group-item')!.click();
    expect(host.ctrl.value).toBe(1);

    digitar('Ana S');
    expect(host.ctrl.value).toBeNull();
    tick(300);
    ctrl.expectOne(r => r.url === BASE).flush({ items: [], page: 1, pageSize: 20, total: 0 });
  }));

  it('mostra mensagem quando não há resultados e quando a busca falha', fakeAsync(() => {
    digitar('zzz');
    tick(300);
    ctrl.expectOne(r => r.url === BASE).flush({ items: [], page: 1, pageSize: 20, total: 0 });
    fixture.detectChanges();
    expect(el().textContent).toContain('Nenhum responsável encontrado');

    digitar('yyy');
    tick(300);
    ctrl.expectOne(r => r.url === BASE).flush({}, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();
    expect(el().textContent).toContain('Erro ao buscar responsáveis');
  }));

  it('limpar zera o valor e o texto', fakeAsync(() => {
    host.ctrl.setValue(5);
    ctrl.expectOne(`${BASE}/5`).flush(resp(5, 'Beto', 'M5'));
    fixture.detectChanges();
    expect(input().value).toBe('Beto (M5)');

    el().querySelector<HTMLButtonElement>('button[aria-label="Limpar responsável"]')!.click();
    fixture.detectChanges();
    expect(host.ctrl.value).toBeNull();
    expect(input().value).toBe('');
  }));

  it('ao receber um id do formulário resolve o rótulo via GET do responsável', () => {
    host.ctrl.setValue(9);
    fixture.detectChanges();
    expect(input().value).toBe('Responsável #9');
    ctrl.expectOne(`${BASE}/9`).flush(resp(9, 'Caio', null));
    fixture.detectChanges();
    expect(input().value).toBe('Caio');
  });

  it('id inexistente mantém o rótulo provisório sem quebrar', () => {
    host.ctrl.setValue(9);
    ctrl.expectOne(`${BASE}/9`).flush({}, { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();
    expect(input().value).toBe('Responsável #9');
  });

  it('valor null do formulário limpa o campo', () => {
    host.ctrl.setValue(null);
    fixture.detectChanges();
    expect(input().value).toBe('');
  });

  it('respeita o estado desabilitado', () => {
    host.ctrl.disable();
    fixture.detectChanges();
    expect(input().disabled).toBeTrue();
  });
});
