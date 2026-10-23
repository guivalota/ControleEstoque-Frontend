import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { SeletorLocaisComponent } from './seletor-locais.component';
import { ImobLocalArvore } from '../../../core/models/imob-local.model';

const no = (id: number, nome: string, filhos: ImobLocalArvore[] = [], ativo = true): ImobLocalArvore =>
  ({ id, nome, codigo: null, localPaiId: null, ativo, filhos });

@Component({
  standalone: true,
  imports: [ReactiveFormsModule, SeletorLocaisComponent],
  template: `<app-seletor-locais [formControl]="ctrl" [arvore]="arvore" />`
})
class HostComponent {
  ctrl = new FormControl<number[]>([], { nonNullable: true });
  arvore = [no(1, 'Matriz', [no(2, 'Andar 1'), no(3, 'Sala antiga', [], false)]), no(9, 'Filial')];
}

describe('SeletorLocaisComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;
  const caixas = () => Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLInputElement>('input[type=checkbox]'));

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HostComponent] });
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('lista só locais ativos, com os níveis da árvore', () => {
    const rotulos = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('label')).map(l => l.textContent?.trim());
    expect(rotulos).toEqual(['Matriz', 'Andar 1', 'Filial']);
  });

  it('marcar e desmarcar atualiza o valor do formulário', () => {
    caixas()[0].click();
    caixas()[2].click();
    expect(host.ctrl.value).toEqual([1, 9]);
    caixas()[0].click();
    expect(host.ctrl.value).toEqual([9]);
  });

  it('reflete o valor definido pelo formulário e o estado desabilitado', () => {
    host.ctrl.setValue([2]);
    fixture.detectChanges();
    expect(caixas().map(c => c.checked)).toEqual([false, true, false]);

    host.ctrl.disable();
    fixture.detectChanges();
    expect(caixas().every(c => c.disabled)).toBeTrue();
  });

  it('um local inativo já selecionado continua visível para ser desmarcado', () => {
    host.ctrl.setValue([3]);
    fixture.detectChanges();
    expect(caixas().length).toBe(4);
  });
});
