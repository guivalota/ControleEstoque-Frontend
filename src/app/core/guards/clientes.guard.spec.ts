import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { provideAuthFake, RoleFake } from '../../testing/auth-fake';
import { clientesGuard } from './clientes.guard';
import { EmpresaAtivaService } from '../services/empresa-ativa.service';
import { ImobPerfil } from '../models/imob-empresa.model';

describe('clientesGuard', () => {
  function rodar(roleGlobal: RoleFake, perfil: ImobPerfil, modulos: string[] = ['imobilizado']) {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), provideAuthFake(roleGlobal)]
    });
    const empresa = TestBed.inject(EmpresaAtivaService);
    empresa.empresas.set([{ id: 1, razaoSocial: 'X', cnpj: '', ativo: true, criadoEm: '', perfil, modulos }]);
    empresa.id.set(1);
    empresa.carregado.set(true);
    const res = TestBed.runInInjectionContext(() => clientesGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot));
    return { res: res instanceof UrlTree ? TestBed.inject(Router).serializeUrl(res) : res, empresa };
  }

  it('admin, operador e leitura passam', () => {
    for (const perfil of ['admin', 'operador', 'leitura'] as ImobPerfil[]) {
      TestBed.resetTestingModule();
      expect(rodar('leitura', perfil).res).withContext(perfil).toBeTrue();
    }
  });

  it('contador volta à página inicial com aviso', () => {
    const r = rodar('leitura', 'contador');
    expect(r.res).toBe('/imobilizado');
    expect(r.empresa.aviso()).toContain('Contador');
  });
});
