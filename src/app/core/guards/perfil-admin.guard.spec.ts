import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { provideAuthFake, RoleFake } from '../../testing/auth-fake';
import { perfilAdminGuard } from './perfil-admin.guard';
import { EmpresaAtivaService } from '../services/empresa-ativa.service';
import { ImobPerfil } from '../models/imob-empresa.model';

describe('perfilAdminGuard', () => {
  function rodar(roleGlobal: RoleFake, perfil: ImobPerfil | null, modulos: string[] = ['estoque']) {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), provideAuthFake(roleGlobal)]
    });
    const empresa = TestBed.inject(EmpresaAtivaService);
    if (perfil) {
      empresa.empresas.set([{ id: 1, razaoSocial: 'X', cnpj: '', ativo: true, criadoEm: '', perfil, modulos }]);
      empresa.id.set(1);
      empresa.carregado.set(true);
    }
    const res = TestBed.runInInjectionContext(() => perfilAdminGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot));
    return { res: res instanceof UrlTree ? TestBed.inject(Router).serializeUrl(res) : res, empresa };
  }

  it('admin da empresa passa, mesmo com a role global leitura e sem módulos', () => {
    expect(rodar('leitura', 'admin', []).res).toBeTrue();
  });

  it('operador volta à página inicial com aviso', () => {
    const op = rodar('admin', 'operador');
    expect(op.res).toBe('/dashboard');
    expect(op.empresa.aviso()).toContain('administrador');
  });

  it('sem Estoque o redirecionamento cai em outra rota segura', () => {
    expect(rodar('leitura', 'leitura', ['imobilizado']).res).toBe('/imobilizado');
  });

  it('superadmin vai para a plataforma', () => {
    expect(rodar('superadmin', null).res).toBe('/plataforma');
  });
});
