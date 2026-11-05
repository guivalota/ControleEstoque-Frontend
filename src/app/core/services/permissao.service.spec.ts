import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { AuthService } from './auth.service';
import { EmpresaAtivaService } from './empresa-ativa.service';
import { PermissaoService } from './permissao.service';

/** Usa o `PermissaoService` de verdade (o `provideAuthFake` dos outros specs o substitui por um que deriva do papel). */
function criar(role: string, permissoes?: string[], perfilNome?: string) {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(), provideHttpClientTesting(),
      { provide: AuthService, useValue: { currentUser: signal({ role, nome: 'F', email: 'f@x.com' }), isSuperAdmin: () => role === 'superadmin' } }
    ]
  });
  const empresa = TestBed.inject(EmpresaAtivaService);
  if (permissoes) {
    empresa.empresas.set([{ id: 1, razaoSocial: 'X', nomeFantasia: 'X', cnpj: '', ativo: true, criadoEm: '', permissoes, perfilNome }]);
    empresa.id.set(1);
  }
  return { p: TestBed.inject(PermissaoService), empresa };
}

describe('PermissaoService (E25)', () => {
  it('pode() vale só o que o servidor informou, sem olhar o papel do token', () => {
    const { p } = criar('leitura', ['imobilizado.locais.ver', 'imobilizado.locais.criar'], 'Cadastrador');

    expect(p.pode('imobilizado.locais.criar')).toBeTrue();
    expect(p.pode('imobilizado.locais.excluir')).toBeFalse();
    expect(p.pode('estoque.produtos.ver')).toBeFalse();
    expect(p.perfilNome()).toBe('Cadastrador');
  });

  it('com uma lista basta uma permissão (OU)', () => {
    const { p } = criar('operador', ['estoque.lotes.ver']);

    expect(p.pode(['estoque.produtos.ver', 'estoque.lotes.ver'])).toBeTrue();
    expect(p.pode(['estoque.produtos.ver', 'estoque.produtos.editar'])).toBeFalse();
  });

  it('sem empresa ativa (ou sem o campo `permissoes`) nada é permitido', () => {
    const { p } = criar('admin');

    expect(p.pode('estoque.produtos.ver')).toBeFalse();
    expect(p.permissoes().size).toBe(0);
  });

  it('super administrador nunca pode nada de empresa', () => {
    const { p } = criar('superadmin', ['estoque.produtos.ver']);

    expect(p.pode('estoque.produtos.ver')).toBeFalse();
    expect(p.permissoes().size).toBe(0);
  });

  it('reage à troca de empresa e ao recarregamento das permissões', () => {
    const { p, empresa } = criar('operador', ['estoque.produtos.ver']);
    expect(p.pode('estoque.produtos.editar')).toBeFalse();

    empresa.empresas.update(l => l.map(e => ({ ...e, permissoes: ['estoque.produtos.ver', 'estoque.produtos.editar'] })));

    expect(p.pode('estoque.produtos.editar')).toBeTrue();
  });

  it('podeUsarModulo: precisa de alguma tela de consulta do módulo', () => {
    const { p } = criar('leitura', ['imobilizado.bens.ver', 'estoque.produtos.criar', 'core.clientes.ver']);

    expect(p.podeUsarModulo('imobilizado')).toBeTrue();
    expect(p.podeUsarModulo('estoque')).toBeFalse(); // só "criar", sem nenhuma tela de consulta
    expect(p.podeUsarModulo('producao')).toBeFalse();
  });

  it('somenteLeitura: só ações de consulta, e só com empresa ativa', () => {
    expect(criar('leitura', ['estoque.produtos.ver', 'core.empresa.uso']).p.somenteLeitura()).toBeTrue();
  });

  it('somenteLeitura é falso quando há alguma ação de escrita', () => {
    TestBed.resetTestingModule();
    expect(criar('operador', ['estoque.produtos.ver', 'estoque.produtos.criar']).p.somenteLeitura()).toBeFalse();
  });

  it('somenteLeitura é falso sem empresa ativa', () => {
    TestBed.resetTestingModule();
    expect(criar('leitura').p.somenteLeitura()).toBeFalse();
  });
});
