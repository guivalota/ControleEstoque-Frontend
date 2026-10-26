import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { SeletorLocalComponent } from './seletor-local.component';
import { ImobLocalArvore } from '../../../core/models/imob-local.model';

const no = (id: number, nome: string, filhos: ImobLocalArvore[] = [], ativo = true, codigo: string | null = null): ImobLocalArvore =>
  ({ id, nome, codigo, localPaiId: null, ativo, filhos });

const ARVORE = [
  no(1, 'Matriz', [no(3, 'Andar 1', [no(4, 'Sala 101', [], true, 'S101')]), no(5, 'Andar 2', [], false)], true, 'MTZ'),
  no(2, 'Filial')
];

@Component({
  standalone: true,
  imports: [ReactiveFormsModule, SeletorLocalComponent],
  template: `<app-seletor-local [formControl]="ctrl" [arvore]="arvore" [excluirId]="excluir()" [somenteAtivos]="somenteAtivos()" />`
})
class HostComponent {
  ctrl = new FormControl<number | null>(null);
  arvore = ARVORE;
  excluir = signal<number | null>(null);
  somenteAtivos = signal(false);
}

describe('SeletorLocalComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;
  const select = () => (fixture.nativeElement as HTMLElement).querySelector('select')!;
  const rotulos = () => Array.from(select().options).map(o => o.text.replace(new RegExp(String.fromCharCode(160), 'g'), '_'));

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HostComponent] });
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('lista a hierarquia com recuo e código', () => {
    expect(rotulos()).toEqual([
      '(Raiz)', 'Matriz (MTZ)', '__Andar 1', '____Sala 101 (S101)', '__Andar 2', 'Filial'
    ]);
  });

  it('oculta o próprio local e toda a sua subárvore', () => {
    host.excluir.set(3);
    fixture.detectChanges();
    expect(rotulos()).toEqual(['(Raiz)', 'Matriz (MTZ)', '__Andar 2', 'Filial']);
  });

  it('com somenteAtivos esconde inativos, mas mantém o valor já selecionado', () => {
    host.somenteAtivos.set(true);
    fixture.detectChanges();
    expect(rotulos()).not.toContain('__Andar 2');

    host.ctrl.setValue(5);
    fixture.detectChanges();
    expect(rotulos()).toContain('__Andar 2');
  });

  it('emite o id escolhido e null ao voltar para a raiz', () => {
    select().value = '4';
    select().dispatchEvent(new Event('change'));
    expect(host.ctrl.value).toBe(4);

    select().value = '';
    select().dispatchEvent(new Event('change'));
    expect(host.ctrl.value).toBeNull();
  });

  it('reflete o valor do formulário na seleção', () => {
    host.ctrl.setValue(2);
    fixture.detectChanges();
    expect(select().selectedOptions[0].text).toBe('Filial');
  });

  it('respeita o estado desabilitado do formulário', () => {
    host.ctrl.disable();
    fixture.detectChanges();
    expect(select().disabled).toBeTrue();
  });
});
