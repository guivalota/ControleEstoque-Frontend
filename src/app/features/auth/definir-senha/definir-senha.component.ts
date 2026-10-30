import { Component, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ThemeService } from '../../../core/services/theme.service';
import { UserService } from '../../../core/services/user.service';
import { lerErroApi } from '../../../core/utils/erros-api';

function passwordStrength(control: AbstractControl): ValidationErrors | null {
  const pattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;
  return pattern.test(control.value ?? '') ? null : { passwordStrength: true };
}

function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  return group.get('novaSenha')?.value === group.get('confirmarSenha')?.value ? null : { passwordsMismatch: true };
}

/** Primeiro acesso com senha provisória: define a senha definitiva (PUT v1/users/me) e segue o fluxo normal. */
@Component({
  selector: 'app-definir-senha',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './definir-senha.component.html',
  styleUrl: './definir-senha.component.scss'
})
export class DefinirSenhaComponent {
  private fb = inject(FormBuilder);
  private userService = inject(UserService);
  private router = inject(Router);
  auth = inject(AuthService);
  theme = inject(ThemeService);

  loading = signal(false);
  error = signal('');
  showPassword = signal(false);

  form = this.fb.group({
    novaSenha: ['', [Validators.required, passwordStrength]],
    confirmarSenha: ['', Validators.required]
  }, { validators: passwordsMatch });

  submit() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const user = this.auth.currentUser();
    if (!user) { this.auth.logout(); return; }

    this.loading.set(true);
    this.error.set('');

    // O back exige nome e email em PUT v1/users/me; a senha vai junto.
    this.userService.updateMe({ nome: user.nome, email: user.email, senha: this.form.value.novaSenha! }).subscribe({
      next: () => {
        // O back revoga todos os refresh tokens ao trocar a senha e não devolve tokens novos:
        // não há refresh possível. Encerra a sessão local e pede novo login com a senha nova.
        this.auth.encerrarSessaoLocal();
        this.router.navigate(['/login'], { queryParams: { senhaDefinida: '1' } });
      },
      error: (err) => {
        if (err?.status === 401) {
          // Sessão expirada: volta ao login.
          this.auth.encerrarSessaoLocal();
          this.router.navigate(['/login']);
          return;
        }
        const e = lerErroApi(err, 'Não foi possível definir a senha.');
        this.error.set(e.mensagem || Object.values(e.campos).join(' ') || 'Não foi possível definir a senha.');
        this.loading.set(false);
      }
    });
  }

  field(name: string) {
    return this.form.get(name)!;
  }
}
