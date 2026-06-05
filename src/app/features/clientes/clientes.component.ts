import { Component, inject, OnInit, signal, ViewChild, ElementRef, OnDestroy } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { Modal } from 'bootstrap';
import { ClienteService } from '../../core/services/cliente.service';
import { ImpressaoService } from '../../core/services/impressao.service';
import { PermissaoService } from '../../core/services/permissao.service';
import { CepService } from '../../core/services/cep.service';
import { Cliente, CreateClienteRequest, UpdateClienteRequest } from '../../core/models/cliente.model';

@Component({
  selector: 'app-clientes',
  standalone: true,
  imports: [ReactiveFormsModule, FormsModule, DatePipe],
  templateUrl: './clientes.component.html'
})
export class ClientesComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private cepService = inject(CepService);
  private clienteService = inject(ClienteService);
  private impressaoService = inject(ImpressaoService);
  permissao = inject(PermissaoService);

  @ViewChild('modalEl') modalEl!: ElementRef;
  private modal!: Modal;

  clientes = signal<Cliente[]>([]);
  total = signal(0);
  page = signal(1);
  readonly pageSize = 50;
  loading = signal(false);
  imprimindo = signal(false);

  filterBusca = '';
  filterUf = '';
  filterAtivo = '';

  editingId = signal<number | null>(null);
  saving = signal(false);
  saveError = signal('');
  buscandoCep = signal(false);
  cepMsg = signal('');

  form = this.fb.group({
    cpfCnpj: ['', [Validators.required, Validators.pattern(/^(\d{11}|\d{14})$/)]],
    nome: ['', [Validators.required, Validators.maxLength(255)]],
    email: ['' as string | null, [Validators.email, Validators.maxLength(255)]],
    telefone: ['' as string | null, Validators.maxLength(20)],
    cep: ['' as string | null],
    logradouro: ['' as string | null, Validators.maxLength(255)],
    municipio: ['' as string | null, Validators.maxLength(100)],
    uf: ['' as string | null, Validators.maxLength(2)],
    ativo: [true]
  });

  ngOnInit() { this.buscar(1); }
  ngOnDestroy() { this.modal?.dispose(); }

  buscar(page = 1) {
    this.loading.set(true);
    this.clienteService.buscar({
      busca: this.filterBusca || undefined,
      uf: this.filterUf || undefined,
      ativo: this.filterAtivo !== '' ? this.filterAtivo === 'true' : undefined,
      page,
      pageSize: this.pageSize
    }).subscribe({
      next: res => {
        this.clientes.set(res.items);
        this.total.set(res.total);
        this.page.set(page);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  limparFiltros() {
    this.filterBusca = '';
    this.filterUf = '';
    this.filterAtivo = '';
    this.buscar(1);
  }

  hasNextPage() { return this.page() * this.pageSize < this.total(); }

  imprimir() {
    this.imprimindo.set(true);
    this.impressaoService.gerarPdf('/v1/impressoes/clientes', {
      busca: this.filterBusca || undefined,
      uf: this.filterUf || undefined,
      ativo: this.filterAtivo !== '' ? this.filterAtivo : undefined
    }).subscribe({
      next: blob => { this.impressaoService.abrirPdf(blob); this.imprimindo.set(false); },
      error: () => { alert('Erro ao gerar PDF.'); this.imprimindo.set(false); }
    });
  }

  private getModal(): Modal {
    if (!this.modal) this.modal = new Modal(this.modalEl.nativeElement);
    return this.modal;
  }

  openCreate() {
    this.editingId.set(null);
    this.form.reset({ ativo: true });
    this.f('cpfCnpj').enable();
    this.saveError.set('');
    this.cepMsg.set('');
    this.getModal().show();
  }

  openEdit(c: Cliente) {
    this.editingId.set(c.id);
    this.form.patchValue(c);
    this.f('cpfCnpj').disable();
    this.saveError.set('');
    this.cepMsg.set('');
    this.getModal().show();
  }

  buscarCep() {
    const cep = this.f('cep').value?.replace(/\D/g, '') ?? '';
    if (cep.length !== 8) { this.cepMsg.set('CEP deve ter 8 dígitos.'); return; }
    this.buscandoCep.set(true);
    this.cepMsg.set('');
    this.cepService.lookup(cep).subscribe({
      next: (res) => {
        if (res.erro) {
          this.cepMsg.set('CEP não encontrado.');
        } else {
          this.form.patchValue({
            logradouro: res.logradouro ?? null,
            municipio: res.municipio ?? null,
            uf: res.uf ?? null
          });
          this.cepMsg.set('Endereço preenchido.');
        }
        this.buscandoCep.set(false);
      },
      error: () => {
        this.cepMsg.set('CEP não encontrado.');
        this.buscandoCep.set(false);
      }
    });
  }

  onCepInput() {
    const cep = this.f('cep').value?.replace(/\D/g, '') ?? '';
    if (cep.length === 8) this.buscarCep();
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
      next: () => { this.saving.set(false); this.getModal().hide(); this.buscar(this.page()); },
      error: (err) => {
        this.saveError.set(err.error?.message ?? 'Erro ao salvar cliente.');
        this.saving.set(false);
      }
    });
  }

  delete(c: Cliente) {
    if (!confirm(`Excluir o cliente "${c.nome}"?`)) return;
    this.clienteService.delete(c.id).subscribe({
      next: () => this.buscar(this.page())
    });
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
