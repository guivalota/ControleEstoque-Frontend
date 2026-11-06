import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideAuthFake } from '../../../testing/auth-fake';
import { ImobRelatoriosComponent } from './imob-relatorios.component';

function montar(role: 'admin' | 'operador' | 'leitura') {
  TestBed.configureTestingModule({
    providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), ...provideAuthFake(role)]
  });
  const fixture = TestBed.createComponent(ImobRelatoriosComponent);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('ImobRelatoriosComponent', () => {
  it('lista os relatórios existentes e o grupo "A decidir" para o admin', () => {
    const el = montar('admin');
    const links = Array.from(el.querySelectorAll('a.list-group-item')).map(a => a.textContent ?? '');
    expect(links.some(t => t.includes('Depreciação'))).toBeTrue();
    expect(links.some(t => t.includes('Inventários'))).toBeTrue();
    const aDecidir = el.querySelector('[data-testid="a-decidir"]')!;
    expect(aDecidir.querySelectorAll('li').length).toBe(4);
    expect(aDecidir.textContent).toContain('Aguardando definição');
    expect(aDecidir.querySelector('a, button')).toBeNull();
  });

  it('não mostra link de relatório que o perfil não pode ver', () => {
    const el = montar('leitura');
    const links = Array.from(el.querySelectorAll('a.list-group-item')).map(a => a.textContent ?? '');
    expect(links.some(t => t.includes('exportação'))).toBeFalse();
  });
});
