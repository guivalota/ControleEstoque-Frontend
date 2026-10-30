import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ThemeService } from '../../../core/services/theme.service';
import { lerErroApi } from '../../../core/utils/erros-api';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  theme = inject(ThemeService);

  form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    senha: ['', [Validators.required, Validators.minLength(8)]]
  });

  loading = signal(false);
  /** Começa com o aviso deixado pelo refresh recusado (empresa bloqueada), se houver. */
  error = signal(this.consumirAviso());
  /** Aviso de sucesso vindo de outra tela (ex.: senha definida em /definir-senha). */
  sucesso = signal(this.route.snapshot.queryParamMap.get('senhaDefinida') === '1' ? 'Senha definida. Entre novamente com a nova senha.' : '');

  submit() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.loading.set(true);
    this.error.set('');
    this.sucesso.set('');

    this.auth.login(this.form.value as any).subscribe({
      next: () => this.router.navigate([this.auth.destinoInicial()]),
      error: (err) => {
        // 429 (rate limit) pode vir sem corpo: mensagem local; com { error } vale a do servidor
        const fallback = err?.status === 429 ? 'Muitas tentativas de login. Aguarde um instante e tente novamente.' : 'Email ou senha incorretos.';
        this.error.set(lerErroApi(err, fallback).mensagem || fallback);
        this.loading.set(false);
      }
    });
  }

  private consumirAviso(): string {
    const aviso = this.auth.avisoLogin();
    this.auth.avisoLogin.set('');
    return aviso;
  }

  field(name: string) {
    return this.form.get(name)!;
  }
}
