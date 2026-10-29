import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ImobPerfil } from '../models/imob-empresa.model';
import { provideAuthFake, RoleFake } from '../../testing/auth-fake';
import { EmpresaAtivaService } from './empresa-ativa.service';
import { PermissaoService } from './permissao.service';

function criar(role: RoleFake, perfil?: ImobPerfil) {
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), provideAuthFake(role)] });
  const empresa = TestBed.inject(EmpresaAtivaService);
  empresa.empresas.set([{ id: 1, razaoSocial: 'X', nomeFantasia: 'X', cnpj: '', ativo: true, criadoEm: '', perfil }]);
  empresa.id.set(1);
  return TestBed.inject(PermissaoService);
}

describe('PermissaoService (Imobilizado)', () => {
  it('usa o perfil da empresa devolvido pelo servidor, mesmo com role global leitura (conta cliente)', () => {
    const p = criar('leitura', 'admin');
    expect(p.perfilImob()).toBe('admin');
    expect(p.imobCanCreate()).toBeTrue();
    expect(p.imobCanDelete()).toBeTrue();
  });

  it('perfil leitura na empresa bloqueia escrita', () => {
    const p = criar('admin', 'leitura');
    expect(p.perfilImob()).toBe('leitura');
    expect(p.imobCanEdit()).toBeFalse();
  });

  it('operador não exclui', () => {
    const p = criar('admin', 'operador');
    expect(p.imobCanCreate()).toBeTrue();
    expect(p.imobCanDelete()).toBeFalse();
  });

  it('sem perfil informado vale a role global', () => {
    expect(criar('operador').perfilImob()).toBe('operador');
  });
});

describe('PermissaoService (super administrador)', () => {
  it('reconhece superadmin sem conceder escrita nem perfil de negócio', () => {
    const p = criar('superadmin');
    expect(p.isSuperAdmin()).toBeTrue();
    expect(p.canCreate()).toBeFalse();
    expect(p.canDelete()).toBeFalse();
    expect(p.canManageUsers()).toBeFalse();
    expect(p.perfilImob()).toBeUndefined();
    expect(p.imobCanEdit()).toBeFalse();
  });
});

describe('PermissaoService (Estoque pelo perfil da empresa ativa)', () => {
  it('conta cliente com role global leitura e perfil admin pode escrever, excluir e gerir usuarios', () => {
    const p = criar('leitura', 'admin');
    expect(p.canCreate()).toBeTrue();
    expect(p.canEdit()).toBeTrue();
    expect(p.canDelete()).toBeTrue();
    expect(p.canManageUsers()).toBeTrue();
  });

  it('perfil leitura na empresa bloqueia tudo, mesmo com role global admin', () => {
    const p = criar('admin', 'leitura');
    expect(p.canCreate()).toBeFalse();
    expect(p.canEdit()).toBeFalse();
    expect(p.canDelete()).toBeFalse();
    expect(p.canManageUsers()).toBeFalse();
  });

  it('perfil operador escreve mas nao exclui nem gere usuarios', () => {
    const p = criar('leitura', 'operador');
    expect(p.canCreate()).toBeTrue();
    expect(p.canDelete()).toBeFalse();
    expect(p.canManageUsers()).toBeFalse();
  });

  it('sem empresa ativa vale a role global', () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), provideAuthFake('admin')] });
    const p = TestBed.inject(PermissaoService);
    expect(p.canCreate()).toBeTrue();
    expect(p.canManageUsers()).toBeTrue();
  });
});
