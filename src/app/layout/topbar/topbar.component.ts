import { Component, inject, signal, ViewChild, ElementRef, OnDestroy } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators, AbstractControl } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { ThemeService } from '../../core/services/theme.service';
import { UserService } from '../../core/services/user.service';
import { Modal } from 'bootstrap';

function senhasIguais(group: AbstractControl) {
  const senha = group.get('senha')?.value;
  const confirmar = group.get('confirmarSenha')?.value;
  return senha && senha !== confirmar ? { senhasDiferentes: true } : null;
}

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './topbar.component.html',
  styleUrl: './topbar.component.scss'
})
export class TopbarComponent implements OnDestroy {
  auth = inject(AuthService);
  theme = inject(ThemeService);
  private userService = inject(UserService);
  private fb = inject(FormBuilder);

  @ViewChild('perfilModalEl') perfilModalEl!: ElementRef;
  private perfilModal!: Modal;

  saving = signal(false);
  saveError = signal('');
  saveSuccess = signal(false);

  form = this.fb.group({
    nome: ['', [Validators.required, Validators.maxLength(255)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(255)]],
    senha: ['', [Validators.pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/)]],
    confirmarSenha: ['']
  }, { validators: senhasIguais });

  private getModal(): Modal {
    if (!this.perfilModal) this.perfilModal = new Modal(this.perfilModalEl.nativeElement);
    return this.perfilModal;
  }

  openPerfil() {
    const user = this.auth.currentUser();
    this.form.reset({
      nome: user?.nome ?? '',
      email: user?.email ?? '',
      senha: '',
      confirmarSenha: ''
    });
    this.saveError.set('');
    this.saveSuccess.set(false);
    this.getModal().show();
  }

  savePerfil() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.saving.set(true);
    this.saveError.set('');
    this.saveSuccess.set(false);

    const { nome, email, senha } = this.form.value;
    const req: Record<string, string> = { nome: nome!, email: email! };
    if (senha) req['senha'] = senha;

    this.userService.updateMe(req).subscribe({
      next: () => {
        this.auth.patchCurrentUser({ nome: nome!, email: email! });
        this.saving.set(false);
        this.saveSuccess.set(true);
        setTimeout(() => this.getModal().hide(), 1200);
      },
      error: (err) => {
        this.saveError.set(err.error?.message ?? 'Erro ao salvar perfil.');
        this.saving.set(false);
      }
    });
  }

  f(name: string) { return this.form.get(name)!; }

  ngOnDestroy() { this.perfilModal?.dispose(); }

  roleBadgeClass(role: string | undefined): string {
    const map: Record<string, string> = {
      admin: 'bg-danger',
      operador: 'bg-primary',
      leitura: 'bg-secondary'
    };
    return map[role ?? ''] ?? 'bg-secondary';
  }

  roleLabel(role: string | undefined): string {
    const map: Record<string, string> = {
      admin: 'Admin',
      operador: 'Operador',
      leitura: 'Somente leitura'
    };
    return map[role ?? ''] ?? (role ?? '');
  }
}
