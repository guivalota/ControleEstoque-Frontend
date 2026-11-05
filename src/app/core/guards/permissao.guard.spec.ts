import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRouteSnapshot, Router, UrlTree, provideRouter } from '@angular/router';
import { Observable, isObservable, firstValueFrom, of } from 'rxjs';
import { provideAuthFake, RoleFake } from '../../testing/auth-fake';
import { EmpresaAtivaService } from '../services/empresa-ativa.service';
import { permissaoGuard } from './permissao.guard';

function rota(permissao?: string | string[]) {
  return { data: permissao ? { permissao } : {} } as unknown as ActivatedRouteSnapshot;
}

describe('permissaoGuard', () => {
  function montar(role: RoleFake, permissoes: string[] | undefined) {
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), provideAuthFake(role)] });
    const empresa = TestBed.inject(EmpresaAtivaService);
    empresa.empresas.set([{ id: 1, razaoSocial: 'X', nomeFantasia: 'X', cnpj: '', ativo: true, criadoEm: '', perfil: 'operador', modulos: ['estoque', 'imobilizado'], permissoes }]);
    empresa.id.set(1);
    empresa.carregado.set(true);
    spyOn(empresa, 'garantirCarregada').and.returnValue(of(undefined));
    return empresa;
  }

  async function executar(permissao?: string | string[]) {
    const r = TestBed.runInInjectionContext(() => permissaoGuard(rota(permissao), {} as never)) as boolean | UrlTree | Observable<boolean | UrlTree>;
    return isObservable(r) ? firstValueFrom(r) : r;
  }

  it('libera quem tem a permissão', async () => {
    montar('operador', ['estoque.produtos.ver']);

    expect(await executar('estoque.produtos.ver')).toBeTrue();
  });

  it('com uma lista basta uma', async () => {
    montar('operador', ['estoque.lotes.ver']);

    expect(await executar(['estoque.produtos.ver', 'estoque.lotes.ver'])).toBeTrue();
  });

  it('nega, avisa e leva à página inicial segura', async () => {
    const empresa = montar('operador', ['estoque.produtos.ver']);

    const r = await executar('core.acesso.ver');

    expect(r instanceof UrlTree).toBeTrue();
    expect(empresa.aviso()).toContain('não permite');
    expect(TestBed.inject(Router).serializeUrl(r as UrlTree)).toBe(TestBed.inject(Router).serializeUrl(TestBed.inject(Router).createUrlTree([empresa.rotaInicial()])));
  });

  it('rota sem data.permissao não é restringida', async () => {
    montar('operador', []);

    expect(await executar()).toBeTrue();
  });

  it('super administrador vai para a Plataforma', async () => {
    montar('superadmin', []);

    const r = await executar('estoque.produtos.ver');

    expect(TestBed.inject(Router).serializeUrl(r as UrlTree)).toBe('/plataforma');
  });

  it('sem empresa ativa libera (o shell trata o estado)', async () => {
    const empresa = montar('operador', []);
    empresa.id.set(null);

    expect(await executar('estoque.produtos.ver')).toBeTrue();
  });
});
