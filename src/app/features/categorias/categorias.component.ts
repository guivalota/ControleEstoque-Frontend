import { Component, inject, OnInit, signal, ViewChild, ElementRef, OnDestroy } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Modal } from 'bootstrap';
import { CategoriaService } from '../../core/services/categoria.service';
import { Categoria, CreateCategoriaRequest, UpdateCategoriaRequest } from '../../core/models/categoria.model';

@Component({
  selector: 'app-categorias',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './categorias.component.html'
})
export class CategoriasComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  categoriaService = inject(CategoriaService);

  @ViewChild('modalEl') modalEl!: ElementRef;
  private modal!: Modal;

  categorias = this.categoriaService.categorias;
  loading = this.categoriaService.loading;

  editingId = signal<number | null>(null);
  saving = signal(false);
  saveError = signal('');

  form = this.fb.group({
    nome: ['', [Validators.required, Validators.maxLength(255)]],
    descricao: ['' as string | null],
    ativo: [true]
  });

  ngOnInit() {
    this.categoriaService.getAll().subscribe();
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
    this.form.reset({ ativo: true, descricao: null });
    this.saveError.set('');
    this.getModal().show();
  }

  openEdit(c: Categoria) {
    this.editingId.set(c.id);
    this.form.patchValue({ ...c, descricao: c.descricao ?? null });
    this.saveError.set('');
    this.getModal().show();
  }

  save() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.saving.set(true);
    this.saveError.set('');

    const val = this.form.value;
    const id = this.editingId();

    const op = id
      ? this.categoriaService.update(id, val as UpdateCategoriaRequest)
      : this.categoriaService.create({ nome: val.nome!, descricao: val.descricao } as CreateCategoriaRequest);

    op.subscribe({
      next: () => { this.saving.set(false); this.getModal().hide(); },
      error: (err) => {
        this.saveError.set(err.error?.message ?? 'Erro ao salvar categoria.');
        this.saving.set(false);
      }
    });
  }

  delete(c: Categoria) {
    if (!confirm(`Excluir a categoria "${c.nome}"?`)) return;
    this.categoriaService.delete(c.id).subscribe();
  }

  f(name: string) { return this.form.get(name)!; }
}
