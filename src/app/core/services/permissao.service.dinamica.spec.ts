import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideAuthFake, RoleFake } from '../../testing/auth-fake';
import { ImobPerfil } from '../models/imob-empresa.model';
import { EmpresaAtivaService } from './empresa-ativa.service';
import { PermissaoService } from './permissao.service';

function criar(role: RoleFake, perfil?: ImobPerfil, permissoes?: string[], perfilNome?: string) {
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), provideAuthFake(role)] });
  const empresa = TestBed.inject(EmpresaAtivaService);
  empresa.empresas.set([{ id: 1, razaoSocial: 'X', nomeFantasia: 'X', cnpj: '', ativo: true, criadoEm: '', perfil, permissoes, perfilNome }]);
  empresa.id.set(1);
  return { p: TestBed.inject(PermissaoService), empresa };
}

describe('PermissaoService — permissões dinâmicas (E25)', () => {
  it('pode() vale só o que o servidor informou, sem olhar o perfil em texto', () => {
    const { p } = criar('leitura', 'admin', ['imobilizado.locais.ver', 'imobilizado.locais.criar'], 'Cadastrador');

    expect(p.pode('imobilizado.locais.criar')).toBeTrue();
    expect(p.pode('imobilizado.locais.excluir')).toBeFalse();
    expect(p.pode('estoque.produtos.ver')).toBeFalse();
    expect(p.perfilNome()).toBe('Cadastrador');
  });

  it('com uma lista basta uma permissão (OU)', () => {
    const { p } = criar('operador', 'operador', ['estoque.lotes.ver']);

    expect(p.pode(['estoque.produtos.ver', 'estoque.lotes.ver'])).toBeTrue();
    expect(p.pode(['estoque.produtos.ver', 'estoque.produtos.editar'])).toBeFalse();
  });

  it('super administrador nunca pode nada de empresa', () => {
    const { p } = criar('superadmin', undefined, ['estoque.produtos.ver']);

    expect(p.pode('estoque.produtos.ver')).toBeFalse();
    expect(p.permissoes()!.size).toBe(0);
  });

  it('reage à troca de empresa e ao recarregamento das permissões', () => {
    const { p, empresa } = criar('operador', 'operador', ['estoque.produtos.ver']);
    expect(p.pode('estoque.produtos.editar')).toBeFalse();

    empresa.empresas.update(l => l.map(e => ({ ...e, permissoes: ['estoque.produtos.ver', 'estoque.produtos.editar'] })));

    expect(p.pode('estoque.produtos.editar')).toBeTrue();
  });

  it('os aliases derivam das permissões: perfil personalizado com "criar" mas sem "excluir"', () => {
    const { p } = criar('leitura', 'leitura', ['imobilizado.bens.ver', 'imobilizado.bens.criar']);

    expect(p.canCreate()).toBeTrue();
    expect(p.canEdit()).toBeTrue();
    expect(p.canDelete()).toBeFalse();
    expect(p.imobCanCreate()).toBeTrue();
    expect(p.imobCanDelete()).toBeFalse();
    expect(p.canManageUsers()).toBeFalse();
    expect(p.podeUsarEstoque()).toBeFalse();
  });

  it('gestão da equipe e do Estoque seguem as permissões', () => {
    const { p } = criar('leitura', 'leitura', ['core.equipe.ver', 'estoque.produtos.ver', 'core.clientes.ver']);

    expect(p.canManageUsers()).toBeTrue();
    expect(p.podeUsarEstoque()).toBeTrue();
    expect(p.podeUsarClientes()).toBeTrue();
  });
});

describe('PermissaoService — modo legado (servidor sem `permissoes`)', () => {
  it('admin pode tudo', () => {
    const { p } = criar('admin', 'admin');

    expect(p.permissoes()).toBeNull();
    expect(p.pode('core.acesso.gerir')).toBeTrue();
    expect(p.pode('imobilizado.bens.excluir')).toBeTrue();
  });

  it('leitura só consulta e nunca administra', () => {
    const { p } = criar('admin', 'leitura');

    expect(p.pode('estoque.produtos.ver')).toBeTrue();
    expect(p.pode('estoque.produtos.editar')).toBeFalse();
    expect(p.pode('core.equipe.ver')).toBeFalse();
    expect(p.pode('core.acesso.ver')).toBeFalse();
    expect(p.canManageUsers()).toBeFalse();
  });

  it('operador cria e edita, não exclui nem administra a equipe', () => {
    const { p } = criar('admin', 'operador');

    expect(p.pode('estoque.produtos.criar')).toBeTrue();
    expect(p.pode('estoque.produtos.excluir')).toBeFalse();
    expect(p.pode('imobilizado.ordens-servico.aprovar')).toBeFalse();
    expect(p.pode('core.equipe.criar')).toBeFalse();
    expect(p.canCreate()).toBeTrue();
    expect(p.canDelete()).toBeFalse();
  });

  it('contador consulta o Imobilizado e cuida do contábil, sem Estoque nem Produção', () => {
    const { p } = criar('admin', 'contador');

    expect(p.pode('imobilizado.bens.ver')).toBeTrue();
    expect(p.pode('imobilizado.depreciacao-periodos.fechar')).toBeTrue();
    expect(p.pode('imobilizado.bens.criar')).toBeFalse();
    expect(p.pode('estoque.produtos.ver')).toBeFalse();
    expect(p.pode('producao.ordens.ver')).toBeFalse();
    expect(p.podeUsarEstoque()).toBeFalse();
  });
});
