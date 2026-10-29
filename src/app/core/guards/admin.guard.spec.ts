import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { provideAuthFake, RoleFake } from '../../testing/auth-fake';
import { adminGuard } from './admin.guard';
import { EmpresaAtivaService } from '../services/empresa-ativa.service';
import { ImobPerfil } from '../models/imob-empresa.model';

describe('adminGuard (perfil efetivo da empresa ativa)', () => {
  function rodar(roleGlobal: RoleFake, perfil: ImobPerfil | null) {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), provideAuthFake(roleGlobal)]
    });
    const empresa = TestBed.inject(EmpresaAtivaService);
    if (perfil) {
      empresa.empresas.set([{ id: 1, razaoSocial: 'X', cnpj: '', ativo: true, criadoEm: '', perfil, modulos: ['estoque'] }]);
      empresa.id.set(1);
      empresa.carregado.set(true);
    }
    const res = TestBed.runInInjectionContext(() => adminGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot));
    return res instanceof UrlTree ? TestBed.inject(Router).serializeUrl(res) : res;
  }

  it('conta cliente (role global leitura) com perfil admin na empresa passa', () => {
    expect(rodar('leitura', 'admin')).toBeTrue();
  });

  it('perfil leitura na empresa nao passa, mesmo com role global admin', () => {
    expect(rodar('admin', 'leitura')).toBe('/dashboard');
  });

  it('perfil operador nao passa', () => {
    expect(rodar('leitura', 'operador')).toBe('/dashboard');
  });

  it('superadmin vai para a plataforma', () => {
    expect(rodar('superadmin', null)).toBe('/plataforma');
  });
});
