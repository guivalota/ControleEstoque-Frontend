import { Injectable, signal, computed, effect } from '@angular/core';

type Theme = 'light' | 'dark';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly KEY = 'ce_theme';

  private _theme = signal<Theme>(
    (localStorage.getItem(this.KEY) as Theme) ?? 'light'
  );

  theme = this._theme.asReadonly();
  isDark = computed(() => this._theme() === 'dark');

  constructor() {
    this.applyTheme(this._theme());
    effect(() => this.applyTheme(this._theme()));
  }

  toggle() {
    const html = document.documentElement;
    html.classList.add('theme-transitioning');
    this._theme.update(t => (t === 'light' ? 'dark' : 'light'));
    window.setTimeout(() => html.classList.remove('theme-transitioning'), 350);
  }

  private applyTheme(theme: Theme) {
    document.documentElement.setAttribute('data-bs-theme', theme);
    localStorage.setItem(this.KEY, theme);
  }
}
