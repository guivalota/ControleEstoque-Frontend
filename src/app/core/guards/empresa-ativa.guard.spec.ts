import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { Observable } from 'rxjs';
import { empresaAtivaGuard, imobilizadoGuard } from './empresa-ativa.guard';
import { EmpresaAtivaService } from '../services/empresa-ativa.service';

describe('guards da área Imobilizado', () => {
  let empresa: EmpresaAtivaService;

  beforeEach(() => {
    localStorage.removeItem('imob.empresaId');
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()]
    });
    empresa = TestBed.inject(EmpresaAtivaService);
  });

  const rota = (data: Record<string, unknown> = {}) => ({ data } as unknown as ActivatedRouteSnapshot);
  const estado = {} as RouterStateSnapshot;

  describe('empresaAtivaGuard', () => {
    it('libera quando há empresa ativa', () => {
      empresa.id.set(1);
      expect(TestBed.runInInjectionContext(() => empresaAtivaGuard(rota(), estado))).toBeTrue();
    });

    it('sem empresa ativa redireciona para o início da área', () => {
      const res = TestBed.runInInjectionContext(() => empresaAtivaGuard(rota(), estado));
      expect(res instanceof UrlTree).toBeTrue();
      expect(TestBed.inject(Router).serializeUrl(res as UrlTree)).toBe('/imobilizado');
    });

    it('libera rotas marcadas com dispensaEmpresa mesmo sem empresa', () => {
      expect(TestBed.runInInjectionContext(() => empresaAtivaGuard(rota({ dispensaEmpresa: true }), estado))).toBeTrue();
    });
  });

  describe('imobilizadoGuard', () => {
    it('carrega as empresas do usuário ao entrar na área e libera a rota', () => {
      const ctrl = TestBed.inject(HttpTestingController);
      let liberado: unknown;
      (TestBed.runInInjectionContext(() => imobilizadoGuard(rota(), estado)) as Observable<boolean>)
        .subscribe(v => liberado = v);
      ctrl.expectOne('/api/v1/imobilizado/minhas-empresas').flush([]);
      expect(liberado).toBeTrue();
      expect(empresa.semAcesso()).toBeTrue();
      ctrl.verify();
    });
  });
});
