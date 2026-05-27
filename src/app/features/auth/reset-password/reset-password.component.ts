import { Component, inject, signal, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ThemeService } from '../../../core/services/theme.service';

function passwordStrength(control: AbstractControl): ValidationErrors | null {
  const pattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;
  return pattern.test(control.value ?? '') ? null : { passwordStrength: true };
}

function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  const nova = group.get('novaSenha')?.value;
  const confirmar = group.get('confirmarSenha')?.value;
  return nova === confirmar ? null : { passwordsMismatch: true };
}

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './reset-password.component.html',
  styleUrl: './reset-password.component.scss'
})
export class ResetPasswordComponent implements OnInit {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  theme = inject(ThemeService);

  token = signal('');
  loading = signal(false);
  error = signal('');
  success = signal(false);
  showPassword = signal(false);

  form = this.fb.group({
    novaSenha: ['', [Validators.required, passwordStrength]],
    confirmarSenha: ['', Validators.required]
  }, { validators: passwordsMatch });

  ngOnInit() {
    const token = this.route.snapshot.queryParamMap.get('token') ?? '';
    if (!token) {
      this.error.set('Link inválido ou expirado. Solicite uma nova redefinição de senha.');
    }
    this.token.set(token);
  }

  submit() {
    if (this.form.invalid || !this.token()) { this.form.markAllAsTouched(); return; }
    this.loading.set(true);
    this.error.set('');

    this.auth.resetPassword({ token: this.token(), novaSenha: this.form.value.novaSenha! }).subscribe({
      next: () => {
        this.success.set(true);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err.error?.message ?? 'Não foi possível redefinir a senha. O link pode ter expirado.');
        this.loading.set(false);
      }
    });
  }

  field(name: string) {
    return this.form.get(name)!;
  }
}
