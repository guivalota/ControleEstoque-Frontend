import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideAuthFake } from '../../testing/auth-fake';
import { EmpresaAtivaService } from '../../core/services/empresa-ativa.service';
import { PodeDesabilitarDirective, PodeDirective } from './pode.directive';

@Component({
  standalone: true,
  imports: [PodeDirective, PodeDesabilitarDirective],
  template: `
    <button id="criar" *appPode="'estoque.produtos.criar'">Criar</button>
    <button id="excluir" *appPode="['estoque.produtos.excluir', 'estoque.lotes.excluir']">Excluir</button>
    <button id="editar" [appPodeDesabilitar]="'estoque.produtos.editar'">Editar</button>
  `
})
class HostComponent {}

describe('PodeDirective / PodeDesabilitarDirective', () => {
  function montar(permissoes: string[]) {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), provideAuthFake('operador')] });
    const empresa = TestBed.inject(EmpresaAtivaService);
    empresa.empresas.set([{ id: 1, razaoSocial: 'X', nomeFantasia: 'X', cnpj: '', ativo: true, criadoEm: '', perfil: 'operador', permissoes }]);
    empresa.id.set(1);
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    return { fixture, empresa, el: fixture.nativeElement as HTMLElement };
  }

  it('mostra só o que o usuário pode e desabilita o resto', () => {
    const { el } = montar(['estoque.produtos.criar']);

    expect(el.querySelector('#criar')).not.toBeNull();
    expect(el.querySelector('#excluir')).toBeNull();
    const editar = el.querySelector('#editar') as HTMLButtonElement;
    expect(editar.disabled).toBeTrue();
    expect(editar.getAttribute('aria-disabled')).toBe('true');
  });

  it('com uma lista basta uma permissão; habilita quando o usuário pode', () => {
    const { el } = montar(['estoque.lotes.excluir', 'estoque.produtos.editar']);

    expect(el.querySelector('#excluir')).not.toBeNull();
    expect((el.querySelector('#editar') as HTMLButtonElement).disabled).toBeFalse();
  });

  it('reage quando as permissões mudam (troca de perfil/recarga)', () => {
    const { fixture, empresa, el } = montar([]);
    expect(el.querySelector('#criar')).toBeNull();

    empresa.empresas.update(l => l.map(e => ({ ...e, permissoes: ['estoque.produtos.criar'] })));
    fixture.detectChanges();

    expect(el.querySelector('#criar')).not.toBeNull();
  });
});
