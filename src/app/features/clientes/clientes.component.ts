import { Component, inject, OnInit, signal, ViewChild, ElementRef, OnDestroy } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { Modal } from 'bootstrap';
import { ClienteService } from '../../core/services/cliente.service';
import { PermissaoService } from '../../core/services/permissao.service';
import { Cliente, CreateClienteRequest, UpdateClienteRequest } from '../../core/models/cliente.model';

@Component({
  selector: 'app-clientes',
  standalone: true,
  imports: [ReactiveFormsModule, DatePipe],
  templateUrl: './clientes.component.html'
})
export class ClientesComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  clienteService = inject(ClienteService);
  permissao = inject(PermissaoService);

  @ViewChild('modalEl') modalEl!: ElementRef;
  private modal!: Modal;

  clientes = this.clienteService.clientes;
  loading = this.clienteService.loading;

  editingId = signal<number | null>(null);
  saving = signal(false);
  saveError = signal('');

  form = this.fb.group({
    cpfCnpj: ['', [Validators.required, Validators.pattern(/^(\d{11}|\d{14})$/)]],
    nome: ['', [Validators.required, Validators.maxLength(255)]],
    email: ['' as string | null, [Validators.email, Validators.maxLength(255)]],
    telefone: ['' as string | null, Validators.maxLength(20)],
    logradouro: ['' as string | null, Validators.maxLength(255)],
    municipio: ['' as string | null, Validators.maxLength(100)],
    uf: ['' as string | null, Validators.maxLength(2)],
    ativo: [true]
  });

  ngOnInit() { this.clienteService.getAll().subscribe(); }
  ngOnDestroy() { this.modal?.dispose(); }

  private getModal(): Modal {
    if (!this.modal) this.modal = new Modal(this.modalEl.nativeElement);
    return this.modal;
  }

  openCreate() {
    this.editingId.set(null);
    this.form.reset({ ativo: true });
    this.f('cpfCnpj').enable();
    this.saveError.set('');
    this.getModal().show();
  }

  openEdit(c: Cliente) {
    this.editingId.set(c.id);
    this.form.patchValue(c);
    this.f('cpfCnpj').disable();
    this.saveError.set('');
    this.getModal().show();
  }

  save() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.saving.set(true);
    this.saveError.set('');

    const val = this.form.getRawValue();
    const id = this.editingId();

    const op = id
      ? this.clienteService.update(id, val as UpdateClienteRequest)
      : this.clienteService.create(val as CreateClienteRequest);

    op.subscribe({
      next: () => { this.saving.set(false); this.getModal().hide(); },
      error: (err) => {
        this.saveError.set(err.error?.message ?? 'Erro ao salvar cliente.');
        this.saving.set(false);
      }
    });
  }

  delete(c: Cliente) {
    if (!confirm(`Excluir o cliente "${c.nome}"?`)) return;
    this.clienteService.delete(c.id).subscribe();
  }

  formatCpfCnpj(valor: string): string {
    if (valor.length === 11) {
      return valor.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    }
    if (valor.length === 14) {
      return valor.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    }
    return valor;
  }

  f(name: string) { return this.form.get(name)!; }
}
