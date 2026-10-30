import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { provideAuthFake } from '../../testing/auth-fake';
import { EmpresaAtivaService } from '../../core/services/empresa-ativa.service';
import { VersionService } from '../../core/services/version.service';
import { ShellComponent } from './shell.component';

describe('ShellComponent (estados da empresa ativa)', () => {
  function criar() {
    TestBed.configureTestingModule({
      imports: [ShellComponent],
      providers: [
        provideRouter([]), provideHttpClient(), provideHttpClientTesting(), provideAuthFake('leitura'),
        { provide: VersionService, useValue: { carregar: () => undefined, versao: () => '' } }
      ]
    });
    const empresa = TestBed.inject(EmpresaAtivaService);
    const fixture = TestBed.createComponent(ShellComponent);
    const el = () => fixture.nativeElement as HTMLElement;
    return { empresa, fixture, el };
  }

  it('sem acesso: tela de bloqueio com Sair, sem banner somente leitura, sem selo e sem modal aberto', () => {
    const { empresa, fixture, el } = criar();
    empresa.empresas.set([]);
    empresa.carregado.set(true);
    fixture.detectChanges();
    const texto = el().textContent ?? '';
    expect(texto).toContain('Você ainda não tem acesso a nenhuma empresa');
    expect(texto).toContain('bloqueada ou você não tem vínculo ativo');
    expect(texto).not.toContain('Modo somente leitura');
    expect(texto).not.toContain('Somente leitura');
    expect(el().querySelector('a[href="/clientes"]')).toBeNull();
    expect(Array.from(el().querySelectorAll('main button')).some(b => b.textContent?.includes('Sair'))).toBeTrue();
  });

  it('conta cliente com perfil admin na empresa: selo Admin e sem banner de leitura', () => {
    const { empresa, fixture, el } = criar();
    empresa.empresas.set([{ id: 1, razaoSocial: 'X', cnpj: '', ativo: true, criadoEm: '', perfil: 'admin', modulos: ['estoque'] }]);
    empresa.id.set(1);
    empresa.carregado.set(true);
    fixture.detectChanges();
    const texto = el().textContent ?? '';
    expect(el().querySelector('app-topbar .badge')?.textContent?.trim()).toBe('Admin');
    expect(texto).not.toContain('Modo somente leitura');
    expect(el().querySelector('a[href="/usuarios"]')).not.toBeNull();
  });

  it('não oferece "Trocar empresa", mesmo com 2 vínculos legados (usa a primeira)', () => {
    const { empresa, fixture, el } = criar();
    const e = (id: number) => ({ id, razaoSocial: 'X', cnpj: '', ativo: true, criadoEm: '', perfil: 'admin' as const, modulos: ['estoque'] });
    empresa.empresas.set([e(1), e(2)]);
    empresa.id.set(1);
    empresa.carregado.set(true);
    fixture.detectChanges();
    expect(el().querySelector('app-topbar button[title="Trocar empresa"]')).toBeNull();
    expect(el().textContent).not.toContain('Trocar empresa');
  });
});
