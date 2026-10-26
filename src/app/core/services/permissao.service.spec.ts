import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ImobPerfil } from '../models/imob-empresa.model';
import { provideAuthFake } from '../../testing/auth-fake';
import { EmpresaAtivaService } from './empresa-ativa.service';
import { PermissaoService } from './permissao.service';

function criar(role: 'admin' | 'operador' | 'leitura', perfil?: ImobPerfil) {
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
