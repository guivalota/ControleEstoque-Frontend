import { Injectable, signal, computed, effect } from '@angular/core';

type Theme = 'light' | 'dark';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly KEY = 'ce_theme';

  /** Escuro é o padrão; só vale o claro quando o usuário o escolheu (guardado em localStorage). */
  private _theme = signal<Theme>(ThemeService.lerSalvo());

  theme = this._theme.asReadonly();
  isDark = computed(() => this._theme() === 'dark');

  constructor() {
    this.applyTheme(this._theme());
    effect(() => this.applyTheme(this._theme()));
  }

  private static lerSalvo(): Theme {
    try {
      return localStorage.getItem('ce_theme') === 'light' ? 'light' : 'dark';
    } catch {
      return 'dark';
    }
  }

  toggle() {
    const html = document.documentElement;
    html.classList.add('theme-transitioning');
    this._theme.update(t => (t === 'light' ? 'dark' : 'light'));
    window.setTimeout(() => html.classList.remove('theme-transitioning'), 350);
  }

  private applyTheme(theme: Theme) {
    document.documentElement.setAttribute('data-bs-theme', theme);
    try { localStorage.setItem(this.KEY, theme); } catch { /* storage indisponível */ }
  }
}
