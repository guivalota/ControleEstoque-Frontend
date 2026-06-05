import { Component, inject, OnInit, signal, ViewChild, ElementRef, OnDestroy } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { Modal } from 'bootstrap';
import { FornecedorService } from '../../core/services/fornecedor.service';
import { ImpressaoService } from '../../core/services/impressao.service';
import { PermissaoService } from '../../core/services/permissao.service';
import { CepService } from '../../core/services/cep.service';
import { Fornecedor, CreateFornecedorRequest, UpdateFornecedorRequest } from '../../core/models/fornecedor.model';

@Component({
  selector: 'app-fornecedores',
  standalone: true,
  imports: [ReactiveFormsModule, FormsModule, DatePipe],
  templateUrl: './fornecedores.component.html'
})
export class FornecedoresComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private cepService = inject(CepService);
  private fornecedorService = inject(FornecedorService);
  private impressaoService = inject(ImpressaoService);
  permissao = inject(PermissaoService);

  @ViewChild('modalEl') modalEl!: ElementRef;
  private modal!: Modal;

  fornecedores = signal<Fornecedor[]>([]);
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
  consultandoCnpj = signal(false);
  cnpjMsg = signal('');
  buscandoCep = signal(false);
  cepMsg = signal('');

  form = this.fb.group({
    cnpj: ['', [Validators.required, Validators.pattern(/^\d{14}$/)]],
    razaoSocial: ['', [Validators.required, Validators.maxLength(255)]],
    nomeFantasia: ['' as string | null],
    email: ['' as string | null, Validators.email],
    telefone: ['' as string | null, Validators.maxLength(20)],
    cep: ['' as string | null],
    logradouro: ['' as string | null],
    municipio: ['' as string | null, Validators.maxLength(100)],
    uf: ['' as string | null, Validators.maxLength(2)],
    ativo: [true]
  });

  ngOnInit() { this.buscar(1); }
  ngOnDestroy() { this.modal?.dispose(); }

  buscar(page = 1) {
    this.loading.set(true);
    this.fornecedorService.buscar({
      busca: this.filterBusca || undefined,
      uf: this.filterUf || undefined,
      ativo: this.filterAtivo !== '' ? this.filterAtivo === 'true' : undefined,
      page,
      pageSize: this.pageSize
    }).subscribe({
      next: res => {
        this.fornecedores.set(res.items);
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
    this.impressaoService.gerarPdf('/v1/impressoes/fornecedores', {
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
    this.f('cnpj').enable();
    this.saveError.set('');
    this.cnpjMsg.set('');
    this.cepMsg.set('');
    this.getModal().show();
  }

  openEdit(f: Fornecedor) {
    this.editingId.set(f.id);
    this.form.patchValue(f);
    this.f('cnpj').disable();
    this.saveError.set('');
    this.cnpjMsg.set('');
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

  consultarCnpj() {
    const cnpj = this.f('cnpj').value?.replace(/\D/g, '') ?? '';
    if (cnpj.length !== 14) { this.cnpjMsg.set('CNPJ deve ter 14 dígitos.'); return; }
    this.consultandoCnpj.set(true);
    this.cnpjMsg.set('');
    this.fornecedorService.consultarCnpj(cnpj).subscribe({
      next: (f) => {
        this.form.patchValue(f);
        this.cnpjMsg.set('Fornecedor encontrado e dados preenchidos.');
        this.consultandoCnpj.set(false);
      },
      error: () => {
        this.cnpjMsg.set('CNPJ não encontrado no cadastro.');
        this.consultandoCnpj.set(false);
      }
    });
  }

  save() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.saving.set(true);
    this.saveError.set('');

    const val = this.form.getRawValue();
    const id = this.editingId();

    const op = id
      ? this.fornecedorService.update(id, val as UpdateFornecedorRequest)
      : this.fornecedorService.create(val as CreateFornecedorRequest);

    op.subscribe({
      next: () => { this.saving.set(false); this.getModal().hide(); this.buscar(this.page()); },
      error: (err) => {
        this.saveError.set(err.error?.message ?? 'Erro ao salvar fornecedor.');
        this.saving.set(false);
      }
    });
  }

  delete(f: Fornecedor) {
    if (!confirm(`Excluir o fornecedor "${f.razaoSocial}"?`)) return;
    this.fornecedorService.delete(f.id).subscribe({
      next: () => this.buscar(this.page())
    });
  }

  f(name: string) { return this.form.get(name)!; }
}
