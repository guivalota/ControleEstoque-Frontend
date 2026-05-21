import { Component, inject, OnInit, signal, ViewChild, ElementRef, OnDestroy } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TitleCasePipe } from '@angular/common';
import { Modal } from 'bootstrap';
import { UserService } from '../../core/services/user.service';
import { PermissaoService } from '../../core/services/permissao.service';
import { User, CreateUserRequest, UpdateUserRequest, UserRole } from '../../core/models/user.model';

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [ReactiveFormsModule, TitleCasePipe],
  templateUrl: './users.component.html'
})
export class UsersComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  userService = inject(UserService);
  permissao = inject(PermissaoService);

  @ViewChild('modalEl') modalEl!: ElementRef;
  private modal!: Modal;

  users = this.userService.users;
  loading = this.userService.loading;

  editingId = signal<number | null>(null);
  saving = signal(false);
  saveError = signal('');

  readonly roles: UserRole[] = ['admin', 'operador', 'leitura'];

  form = this.fb.group({
    nome: ['', [Validators.required, Validators.maxLength(255)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(255)]],
    senha: ['', [Validators.minLength(8)]],
    role: ['operador' as UserRole, Validators.required],
    ativo: [true]
  });

  ngOnInit() {
    this.userService.getAll().subscribe();
  }

  ngOnDestroy() {
    this.modal?.dispose();
  }

  private getModal(): Modal {
    if (!this.modal) this.modal = new Modal(this.modalEl.nativeElement);
    return this.modal;
  }

  openCreate() {
    this.editingId.set(null);
    this.form.reset({ role: 'operador', ativo: true });
    this.f('senha').setValidators([Validators.required, Validators.minLength(8)]);
    this.f('senha').updateValueAndValidity();
    this.saveError.set('');
    this.getModal().show();
  }

  openEdit(u: User) {
    this.editingId.set(u.id);
    this.form.patchValue({ ...u, senha: '' });
    this.f('senha').setValidators([Validators.minLength(8)]);
    this.f('senha').updateValueAndValidity();
    this.saveError.set('');
    this.getModal().show();
  }

  save() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.saving.set(true);
    this.saveError.set('');

    const val = this.form.value;
    const id = this.editingId();

    let op;
    if (id) {
      const req: UpdateUserRequest = {
        nome: val.nome,
        email: val.email,
        role: val.role as UserRole,
        ativo: val.ativo
      };
      if (val.senha) req.senha = val.senha;
      op = this.userService.update(id, req);
    } else {
      op = this.userService.create(val as CreateUserRequest);
    }

    op.subscribe({
      next: () => { this.saving.set(false); this.getModal().hide(); },
      error: (err) => {
        this.saveError.set(err.error?.message ?? 'Erro ao salvar usuário.');
        this.saving.set(false);
      }
    });
  }

  delete(u: User) {
    if (!confirm(`Excluir o usuário "${u.nome}"?`)) return;
    this.userService.delete(u.id).subscribe();
  }

  roleBadge(role: UserRole): string {
    const map: Record<UserRole, string> = {
      admin: 'bg-danger',
      operador: 'bg-primary',
      leitura: 'bg-secondary'
    };
    return map[role] ?? 'bg-secondary';
  }

  f(name: string) { return this.form.get(name)!; }
}
