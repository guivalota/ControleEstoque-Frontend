import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { RouterTestingHarness } from '@angular/router/testing';
import { ABAS_CONFIGURACOES } from './configuracoes.component';
import { CONFIGURACOES_ROUTES } from './configuracoes.routes';
import { provideAuthFake } from '../../testing/auth-fake';
import { EmpresaAtivaService } from '../../core/services/empresa-ativa.service';

describe('Configurações (casca com abas lazy)', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
    providers: [
      provideRouter([{ path: 'configuracoes', children: CONFIGURACOES_ROUTES }]),
      provideHttpClient(), provideHttpClientTesting(), provideAuthFake('admin')
    ]
    });
    spyOn(TestBed.inject(EmpresaAtivaService), 'garantirCarregada').and.returnValue(of(undefined));
  });

  function comPermissoes(permissoes: string[]) {
    const empresa = TestBed.inject(EmpresaAtivaService);
    empresa.empresas.set([{ id: 1, razaoSocial: 'X', cnpj: '', ativo: true, criadoEm: '', perfil: 'admin', modulos: ['estoque'], permissoes }]);
    empresa.id.set(1);
  }

  it('lista as oito abas para quem tem todas as permissões', async () => {
    comPermissoes(ABAS_CONFIGURACOES.map(a => a.permissao));
    const h = await RouterTestingHarness.create('/configuracoes/perfil');
    const links = Array.from((h.routeNativeElement as HTMLElement).querySelectorAll('nav a')).map(a => a.textContent!.trim());
    expect(links).toEqual(ABAS_CONFIGURACOES.map(a => a.titulo));
    expect(links.length).toBe(8);
  });

  it('mostra só as abas que o perfil pode ver e abre a primeira delas', async () => {
    comPermissoes(['core.acesso.ver', 'core.equipe.ver']);
    const h = await RouterTestingHarness.create('/configuracoes');
    const links = Array.from((h.routeNativeElement as HTMLElement).querySelectorAll('nav a')).map(a => a.textContent!.trim());
    expect(links).toEqual(['Equipe', 'Perfis']);
    expect(TestBed.inject(Router).url).toBe('/configuracoes/equipe');
  });

  it('/configuracoes abre a aba Perfil', async () => {
    await RouterTestingHarness.create('/configuracoes');
    expect(TestBed.inject(Router).url).toBe('/configuracoes/perfil');
  });

  for (const aba of ['integracoes', 'email', 'notificacoes']) {
    it(`aba ${aba} carrega a tela real (não o placeholder)`, async () => {
      const h = await RouterTestingHarness.create(`/configuracoes/${aba}`);
      expect((h.routeNativeElement as HTMLElement).textContent).not.toContain('em construção');
    });
  }

  it('aba perfil carrega a tela real (não o placeholder)', async () => {
    const h = await RouterTestingHarness.create('/configuracoes/perfil');
    expect((h.routeNativeElement as HTMLElement).textContent).not.toContain('em construção');
  });

  it('aba fiscal carrega a tela real (não o placeholder)', async () => {
    const h = await RouterTestingHarness.create('/configuracoes/fiscal');
    expect((h.routeNativeElement as HTMLElement).textContent).not.toContain('em construção');
  });

  it('aba historico carrega a tela real (não o placeholder)', async () => {
    const h = await RouterTestingHarness.create('/configuracoes/historico');
    expect((h.routeNativeElement as HTMLElement).textContent).not.toContain('em construção');
  });
});
