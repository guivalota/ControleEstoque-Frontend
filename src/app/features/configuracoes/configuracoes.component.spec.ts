import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { ABAS_CONFIGURACOES } from './configuracoes.component';
import { CONFIGURACOES_ROUTES } from './configuracoes.routes';

describe('Configurações (casca com abas lazy)', () => {
  beforeEach(() => TestBed.configureTestingModule({
    providers: [
      provideRouter([{ path: 'configuracoes', children: CONFIGURACOES_ROUTES }]),
      provideHttpClient(), provideHttpClientTesting()
    ]
  }));

  it('lista as seis abas', async () => {
    const h = await RouterTestingHarness.create('/configuracoes/perfil');
    const links = Array.from((h.routeNativeElement as HTMLElement).querySelectorAll('nav a')).map(a => a.textContent!.trim());
    expect(links).toEqual(ABAS_CONFIGURACOES.map(a => a.titulo));
    expect(links.length).toBe(6);
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
