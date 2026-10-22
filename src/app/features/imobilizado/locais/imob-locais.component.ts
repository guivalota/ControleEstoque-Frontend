import { Component, ElementRef, OnDestroy, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Modal } from 'bootstrap';
import { ImobLocalService } from '../../../core/services/imob-local.service';
import { PermissaoService } from '../../../core/services/permissao.service';
import { ImobLocalArvore } from '../../../core/models/imob-local.model';
import { aplicarErroNoForm, lerErroApi } from '../../../core/utils/erros-api';
import { acharNo } from '../../../core/utils/local-arvore';
import { ConfirmDialogComponent } from '../shared/confirm-dialog.component';
import { SeletorLocalComponent } from '../shared/seletor-local.component';
import { BloqueioExclusaoComponent } from '../shared/bloqueio-exclusao.component';

interface Linha {
  no: ImobLocalArvore;
  nivel: number;
  paiId: number | null;
  temFilhos: boolean;
  expandido: boolean;
}

interface Bloqueio {
  no: ImobLocalArvore;
  mensagem: string;
}

@Component({
  selector: 'app-imob-locais',
  standalone: true,
  imports: [ReactiveFormsModule, FormsModule, ConfirmDialogComponent, SeletorLocalComponent, BloqueioExclusaoComponent],
  templateUrl: './imob-locais.component.html'
})
export class ImobLocaisComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private service = inject(ImobLocalService);
  private host = inject<ElementRef<HTMLElement>>(ElementRef);
  permissao = inject(PermissaoService);

  private modalEl = viewChild.required<ElementRef<HTMLElement>>('modalEl');
  private confirmDialog = viewChild.required(ConfirmDialogComponent);
  private modal?: Modal;

  arvore = signal<ImobLocalArvore[]>([]);
  expandidos = signal<Set<number>>(new Set());
  busca = signal('');
  mostrarInativos = signal(false);
  focoId = signal<number | null>(null);

  loading = signal(false);
  erro = signal('');
  feedback = signal('');

  editingId = signal<number | null>(null);
  saving = signal(false);
  saveError = signal('');
  agindo = signal<number | null>(null);
  bloqueio = signal<Bloqueio | null>(null);

  form = this.fb.group({
    nome: ['', [Validators.required, Validators.maxLength(255)]],
    codigo: ['', [Validators.maxLength(50)]],
    localPaiId: [null as number | null],
    ativo: [true]
  });

  /** Linhas visíveis (achatadas), já aplicados busca, inativos e expansão. */
  linhas = computed<Linha[]>(() => {
    const termo = this.busca().trim().toLowerCase();
    const comInativos = this.mostrarInativos();
    const abertos = this.expandidos();

    const proprio = (no: ImobLocalArvore) =>
      (comInativos || no.ativo) &&
      (!termo || no.nome.toLowerCase().includes(termo) || (no.codigo ?? '').toLowerCase().includes(termo));

    // um nó entra se ele ou algum descendente passa nos filtros (o pai fica como contexto)
    const incluido = new Map<number, boolean>();
    const marcar = (no: ImobLocalArvore): boolean => {
      const filhos = no.filhos.map(marcar);
      const entra = proprio(no) || filhos.some(Boolean);
      incluido.set(no.id, entra);
      return entra;
    };
    this.arvore().forEach(marcar);

    const saida: Linha[] = [];
    const visitar = (nos: ImobLocalArvore[], nivel: number, paiId: number | null) => {
      for (const no of nos) {
        if (!incluido.get(no.id)) continue;
        const filhosVisiveis = no.filhos.filter(f => incluido.get(f.id));
        const expandido = filhosVisiveis.length > 0 && (termo ? true : abertos.has(no.id));
        saida.push({ no, nivel, paiId, temFilhos: filhosVisiveis.length > 0, expandido });
        if (expandido) visitar(filhosVisiveis, nivel + 1, no.id);
      }
    };
    visitar(this.arvore(), 0, null);
    return saida;
  });

  /** Item com tabindex=0 (foco rotativo): o último focado, se ainda visível, senão o primeiro. */
  focoEfetivo = computed(() => {
    const linhas = this.linhas();
    const foco = this.focoId();
    return linhas.some(l => l.no.id === foco) ? foco : (linhas[0]?.no.id ?? null);
  });

  ngOnInit() {
    this.carregar();
  }

  ngOnDestroy() {
    this.modal?.dispose();
  }

  carregar() {
    this.loading.set(true);
    this.erro.set('');
    this.service.arvore().subscribe({
      next: arvore => { this.arvore.set(arvore); this.loading.set(false); },
      error: err => {
        this.erro.set(lerErroApi(err, 'Erro ao carregar locais.').mensagem);
        this.loading.set(false);
      }
    });
  }

  private getModal(): Modal {
    this.modal ??= new Modal(this.modalEl().nativeElement);
    return this.modal;
  }

  alternar(id: number) {
    this.expandidos.update(s => {
      const novo = new Set(s);
      if (!novo.delete(id)) novo.add(id);
      return novo;
    });
  }

  expandirTodos(abrir: boolean) {
    const ids = new Set<number>();
    const juntar = (nos: ImobLocalArvore[]) => nos.forEach(n => { if (n.filhos.length) ids.add(n.id); juntar(n.filhos); });
    if (abrir) juntar(this.arvore());
    this.expandidos.set(ids);
  }

  // ---- teclado (padrão WAI-ARIA de tree) ----

  aoTeclar(ev: KeyboardEvent, l: Linha) {
    if (ev.target !== ev.currentTarget) return;
    const itens = Array.from(this.host.nativeElement.querySelectorAll<HTMLElement>('[role="treeitem"]'));
    const i = itens.indexOf(ev.currentTarget as HTMLElement);
    const focar = (el?: HTMLElement) => { if (el) { ev.preventDefault(); el.focus(); } };

    switch (ev.key) {
      case 'ArrowDown': focar(itens[i + 1]); break;
      case 'ArrowUp': focar(itens[i - 1]); break;
      case 'Home': focar(itens[0]); break;
      case 'End': focar(itens[itens.length - 1]); break;
      case 'ArrowRight':
        ev.preventDefault();
        if (l.temFilhos && !l.expandido) this.alternar(l.no.id);
        else if (l.expandido) focar(itens[i + 1]);
        break;
      case 'ArrowLeft':
        ev.preventDefault();
        if (l.expandido && !this.busca().trim()) this.alternar(l.no.id);
        else if (l.paiId !== null) focar(this.host.nativeElement.querySelector<HTMLElement>(`[data-local-id="${l.paiId}"]`) ?? undefined);
        break;
      case 'Enter':
      case ' ':
        if (l.temFilhos && !this.busca().trim()) { ev.preventDefault(); this.alternar(l.no.id); }
        break;
    }
  }

  // ---- formulário ----

  openCreate(pai: ImobLocalArvore | null = null) {
    this.editingId.set(null);
    this.form.reset({ nome: '', codigo: '', localPaiId: pai?.id ?? null, ativo: true });
    this.saveError.set('');
    this.getModal().show();
  }

  openEdit(no: ImobLocalArvore) {
    this.editingId.set(no.id);
    this.form.reset({ nome: no.nome, codigo: no.codigo ?? '', localPaiId: no.localPaiId ?? null, ativo: no.ativo });
    this.saveError.set('');
    this.getModal().show();
  }

  save() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.saving.set(true);
    this.saveError.set('');

    const v = this.form.getRawValue();
    const corpo = { nome: v.nome!.trim(), codigo: v.codigo?.trim() || undefined, localPaiId: v.localPaiId };
    const id = this.editingId();
    const op = id !== null
      ? this.service.atualizar(id, { ...corpo, ativo: !!v.ativo })
      : this.service.criar(corpo);

    op.subscribe({
      next: () => {
        this.saving.set(false);
        this.getModal().hide();
        this.feedback.set(id !== null ? 'Local atualizado.' : 'Local criado.');
        if (corpo.localPaiId != null) this.expandidos.update(s => new Set(s).add(corpo.localPaiId!));
        this.carregar();
      },
      error: err => {
        this.saveError.set(aplicarErroNoForm(this.form, lerErroApi(err, 'Erro ao salvar local.'), {
          codigo: ['código', 'codigo'],
          nome: ['nome']
        }));
        this.saving.set(false);
      }
    });
  }

  // ---- exclusão / desativação ----

  async excluir(no: ImobLocalArvore) {
    const ok = await this.confirmDialog().abrir({
      titulo: 'Excluir local',
      mensagem: `Excluir o local "${no.nome}"? Prefira desativar se ele já foi usado.`,
      confirmar: 'Excluir',
      perigo: true
    });
    if (!ok) return;
    this.agindo.set(no.id);
    this.bloqueio.set(null);
    this.service.excluir(no.id).subscribe({
      next: () => {
        this.agindo.set(null);
        this.feedback.set('Local excluído.');
        this.carregar();
      },
      error: err => {
        this.agindo.set(null);
        const e = lerErroApi(err, 'Erro ao excluir local.');
        if (err.status === 400 && e.mensagem) this.bloqueio.set({ no, mensagem: e.mensagem });
        else this.erro.set(e.mensagem);
      }
    });
  }

  desativar() {
    const b = this.bloqueio();
    if (!b) return;
    const no = acharNo(this.arvore(), b.no.id) ?? b.no;
    this.agindo.set(no.id);
    this.service.atualizar(no.id, {
      nome: no.nome, codigo: no.codigo ?? undefined, localPaiId: no.localPaiId ?? null, ativo: false
    }).subscribe({
      next: () => {
        this.agindo.set(null);
        this.bloqueio.set(null);
        this.feedback.set(`Local "${no.nome}" desativado.`);
        this.carregar();
      },
      error: err => {
        this.agindo.set(null);
        this.erro.set(lerErroApi(err, 'Erro ao desativar local.').mensagem);
      }
    });
  }

  bloqueioTemBens(): boolean {
    return !!this.bloqueio()?.mensagem.toLowerCase().includes('bens');
  }

  erroCampo(nome: 'nome' | 'codigo'): string {
    const c = this.form.controls[nome];
    if (c.errors?.['servidor']) return c.errors['servidor'];
    if (!c.touched) return '';
    if (c.errors?.['required']) return 'Campo obrigatório.';
    if (c.errors?.['maxlength']) return `Máximo de ${nome === 'nome' ? 255 : 50} caracteres.`;
    return '';
  }
}
