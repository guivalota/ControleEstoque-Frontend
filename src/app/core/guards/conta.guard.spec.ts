import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, CanActivateFn, Router, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { provideAuthFake, RoleFake } from '../../testing/auth-fake';
import { contaEmpresaGuard, superAdminGuard } from './conta.guard';

function rodar(guard: CanActivateFn, role: RoleFake) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), provideAuthFake(role)] });
  const res = TestBed.runInInjectionContext(() => guard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot));
  return res instanceof UrlTree ? TestBed.inject(Router).serializeUrl(res) : res;
}

describe('guards de tipo de conta', () => {
  it('contaEmpresaGuard libera conta de empresa', () => {
    expect(rodar(contaEmpresaGuard, 'operador')).toBeTrue();
  });
  it('contaEmpresaGuard manda superadmin para /plataforma', () => {
    expect(rodar(contaEmpresaGuard, 'superadmin')).toBe('/plataforma');
  });
  it('superAdminGuard libera superadmin', () => {
    expect(rodar(superAdminGuard, 'superadmin')).toBeTrue();
  });
  it('superAdminGuard manda conta de empresa para /dashboard', () => {
    expect(rodar(superAdminGuard, 'admin')).toBe('/dashboard');
  });
});
