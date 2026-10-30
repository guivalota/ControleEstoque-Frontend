import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRouteSnapshot, CanActivateFn, Router, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { Observable } from 'rxjs';
import { provideAuthFake } from '../../testing/auth-fake';
import { cargaEmpresaGuard } from './carga-empresa.guard';
import { moduloGuard } from './modulo.guard';
import { EmpresaAtivaService } from '../services/empresa-ativa.service';
import { ImobEmpresa } from '../models/imob-empresa.model';

const URL = '/api/v1/imobilizado/minhas-empresas';
const emp = (id: number, modulos: string[]): ImobEmpresa =>
  ({ id, razaoSocial: 'X', cnpj: '', ativo: true, criadoEm: '', perfil: 'admin', modulos });

describe('guards de carga da empresa e de modulo', () => {
  let ctrl: HttpTestingController;
  let empresa: EmpresaAtivaService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), provideAuthFake('admin')]
    });
    ctrl = TestBed.inject(HttpTestingController);
    empresa = TestBed.inject(EmpresaAtivaService);
  });

  afterEach(() => {
    ctrl.verify();
  });

  function executar(guard: CanActivateFn) {
    return TestBed.runInInjectionContext(() => guard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot)) as Observable<boolean | UrlTree>;
  }

  function rodar(guard: CanActivateFn, lista: ImobEmpresa[]) {
    let res: unknown;
    executar(guard).subscribe(v => res = v);
    ctrl.expectOne(URL).flush(lista);
    return res instanceof UrlTree ? TestBed.inject(Router).serializeUrl(res) : res;
  }

  it('cargaEmpresaGuard carrega a empresa ativa antes de liberar a rota', () => {
    let res: unknown;
    executar(cargaEmpresaGuard).subscribe(v => res = v);
    expect(res).toBeUndefined();
    ctrl.expectOne(URL).flush([emp(3, ['estoque'])]);
    expect(res).toBeTrue();
    expect(empresa.id()).toBe(3);
  });

  it('cargaEmpresaGuard libera mesmo com falha de carga (o shell mostra o erro)', () => {
    let res: unknown;
    executar(cargaEmpresaGuard).subscribe(v => res = v);
    ctrl.expectOne(URL).flush({}, { status: 500, statusText: 'Err' });
    expect(res).toBeTrue();
    expect(empresa.erroCarregar()).toBeTrue();
  });

  it('cargaEmpresaGuard nao recarrega quando a sessao ja foi carregada', () => {
    executar(cargaEmpresaGuard).subscribe();
    ctrl.expectOne(URL).flush([emp(3, ['estoque'])]);
    let res: unknown;
    executar(cargaEmpresaGuard).subscribe(v => res = v);
    ctrl.expectNone(URL);
    expect(res).toBeTrue();
  });

  it('moduloGuard libera quando a empresa tem o modulo', () => {
    expect(rodar(moduloGuard('estoque'), [emp(1, ['estoque'])])).toBeTrue();
  });

  it('moduloGuard sem o modulo manda para a pagina inicial segura', () => {
    expect(rodar(moduloGuard('estoque'), [emp(1, ['imobilizado'])])).toBe('/imobilizado');
  });

  it('moduloGuard avisa o motivo ao redirecionar (inclusive no recarregamento)', () => {
    rodar(moduloGuard('estoque'), [emp(1, ['imobilizado'])]);
    expect(empresa.aviso()).toBe('Seu plano não inclui este módulo.');
  });

  it('moduloGuard do estoque barra o contador e manda para o Imobilizado', () => {
    const c = { ...emp(1, ['estoque', 'imobilizado']), perfil: 'contador' as const };
    expect(rodar(moduloGuard('estoque'), [c])).toBe('/imobilizado');
    expect(empresa.aviso()).toContain('contador');
  });

  it('moduloGuard sem nenhum modulo cai no cadastro Core', () => {
    expect(rodar(moduloGuard('imobilizado'), [emp(1, [])])).toBe('/clientes');
  });

  it('moduloGuard libera sem empresa ativa (sem acesso: o shell trata)', () => {
    expect(rodar(moduloGuard('estoque'), [])).toBeTrue();
  });
});
