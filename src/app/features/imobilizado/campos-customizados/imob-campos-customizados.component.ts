import { Component, ElementRef, OnDestroy, OnInit, inject, signal, viewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Modal } from 'bootstrap';
import { ImobCampoCustomizadoService } from '../../../core/services/imob-campo-customizado.service';
import { ImobCategoriaService } from '../../../core/services/imob-categoria.service';
import { PermissaoService } from '../../../core/services/permissao.service';
import {
  ImobCampoCustomizado, MAX_CAMPOS_CUSTOMIZADOS, MAX_NOME_CAMPO, MAX_OPCOES_CAMPO, ROTULO_TIPO_CAMPO, TIPOS_CAMPO_CUSTOMIZADO, TipoCampoCustomizado
} from '../../../core/models/imob-campo-customizado.model';
import { ImobCategoria } from '../../../core/models/imob-categoria.model';
import { aplicarErroNoForm, lerErroApi, textoDoErro } from '../../../core/utils/erros-api';
import { ConfirmDialogComponent } from '../shared/confirm-dialog.component';
import { BloqueioExclusaoComponent } from '../shared/bloqueio-exclusao.component';

interface Bloqueio {
  campo: ImobCampoCustomizado;
  mensagem: string;
}

/** Uma opção por linha; vazias somem e repetidas (sem diferenciar caixa) ficam só uma vez. */
export function opcoesDoTexto(texto: string): string[] {
  const vistas = new Set<string>();
  const opcoes: string[] = [];
  for (const linha of texto.split(/\r?\n/)) {
    const o = linha.trim();
    if (!o || vistas.has(o.toLowerCase())) continue;
    vistas.add(o.toLowerCase());
    opcoes.push(o);
  }
  return opcoes;
}

/**
 * Configuração dos campos customizados do bem (E27 / US-27-07): até 20 por empresa, tipo fixo depois de criado, lista de opções,
 * categoria opcional e obrigatório. Com valor em algum bem o campo não se exclui: oferece inativar.
 */
@Component({
  selector: 'app-imob-campos-customizados',
  standalone: true,
  imports: [ReactiveFormsModule, ConfirmDialogComponent, BloqueioExclusaoComponent],
  templateUrl: './imob-campos-customizados.component.html'
})
export class ImobCamposCustomizadosComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private service = inject(ImobCampoCustomizadoService);
  private categoriaService = inject(ImobCategoriaService);
  permissao = inject(PermissaoService);

  private modalEl = viewChild.required<ElementRef<HTMLElement>>('modalEl');
  private confirmDialog = viewChild.required(ConfirmDialogComponent);
  private modal?: Modal;

  readonly tipos = TIPOS_CAMPO_CUSTOMIZADO;
  readonly rotuloTipo = ROTULO_TIPO_CAMPO;
  readonly maximo = MAX_CAMPOS_CUSTOMIZADOS;
  readonly maxNome = MAX_NOME_CAMPO;
  readonly maxOpcoes = MAX_OPCOES_CAMPO;

  campos = signal<ImobCampoCustomizado[]>([]);
  categorias = signal<ImobCategoria[]>([]);
  loading = signal(false);
  erro = signal('');
  feedback = signal('');

  editingId = signal<number | null>(null);
  saving = signal(false);
  saveError = signal('');
  agindo = signal<number | null>(null);
  bloqueio = signal<Bloqueio | null>(null);

  form = this.fb.group({
    nome: ['', [Validators.required, Validators.maxLength(MAX_NOME_CAMPO)]],
    tipo: ['texto' as TipoCampoCustomizado, [Validators.required]],
    obrigatorio: [false],
    opcoesTexto: [''],
    categoriaId: [null as number | null],
    ordem: [0, [Validators.min(0), Validators.max(1000)]],
    ativo: [true]
  });

  ngOnInit() {
    this.carregar();
    this.categoriaService.listar({ pageSize: 100 }).subscribe({ next: r => this.categorias.set(r.items), error: () => undefined });
  }

  ngOnDestroy() {
    this.modal?.dispose();
  }

  carregar() {
    this.loading.set(true);
    this.erro.set('');
    this.service.listar(true).subscribe({
      next: lista => { this.campos.set(lista); this.loading.set(false); },
      error: err => {
        this.erro.set(textoDoErro(lerErroApi(err, 'Erro ao carregar os campos.'), 'Erro ao carregar os campos.'));
        this.loading.set(false);
      }
    });
  }

  private getModal(): Modal {
    this.modal ??= new Modal(this.modalEl().nativeElement);
    return this.modal;
  }

  atingiuLimite(): boolean { return this.campos().length >= MAX_CAMPOS_CUSTOMIZADOS; }

  ehLista(): boolean { return this.form.controls.tipo.value === 'lista'; }

  openCreate() {
    this.editingId.set(null);
    this.form.reset({ nome: '', tipo: 'texto', obrigatorio: false, opcoesTexto: '', categoriaId: null, ordem: this.campos().length, ativo: true });
    this.form.controls.tipo.enable();
    this.saveError.set('');
    this.getModal().show();
  }

  openEdit(c: ImobCampoCustomizado) {
    this.editingId.set(c.id);
    this.form.reset({
      nome: c.nome, tipo: c.tipo, obrigatorio: c.obrigatorio, opcoesTexto: c.opcoes.join('\n'),
      categoriaId: c.categoriaId, ordem: c.ordem, ativo: c.ativo
    });
    this.form.controls.tipo.disable(); // o tipo não muda depois de criado
    this.saveError.set('');
    this.getModal().show();
  }

  /** Erro das opções da lista, ou vazio. */
  erroOpcoes(): string {
    if (!this.ehLista()) return '';
    const n = opcoesDoTexto(this.form.controls.opcoesTexto.value ?? '').length;
    if (n === 0) return 'Informe ao menos uma opção.';
    if (n > MAX_OPCOES_CAMPO) return `No máximo ${MAX_OPCOES_CAMPO} opções.`;
    return '';
  }

  save() {
    if (this.form.invalid || this.erroOpcoes()) { this.form.markAllAsTouched(); if (this.erroOpcoes()) this.saveError.set(this.erroOpcoes()); return; }
    this.saving.set(true);
    this.saveError.set('');

    const v = this.form.getRawValue();
    const corpo = {
      nome: v.nome!.trim(),
      obrigatorio: !!v.obrigatorio,
      opcoes: v.tipo === 'lista' ? opcoesDoTexto(v.opcoesTexto ?? '') : undefined,
      categoriaId: v.categoriaId,
      ordem: Number(v.ordem) || 0
    };
    const id = this.editingId();
    const op = id !== null
      ? this.service.atualizar(id, { ...corpo, ativo: !!v.ativo })
      : this.service.criar({ ...corpo, tipo: v.tipo! });

    op.subscribe({
      next: () => {
        this.saving.set(false);
        this.getModal().hide();
        this.feedback.set(id !== null ? 'Campo atualizado.' : 'Campo criado.');
        this.carregar();
      },
      error: err => {
        this.saveError.set(aplicarErroNoForm(this.form, lerErroApi(err, 'Erro ao salvar o campo.'), {
          nome: ['nome', 'reservado', 'equivalente']
        }));
        this.saving.set(false);
      }
    });
  }

  async excluir(c: ImobCampoCustomizado) {
    const ok = await this.confirmDialog().abrir({
      titulo: 'Excluir campo',
      mensagem: `Excluir o campo "${c.nome}"? Se algum bem já tem valor nele, o campo só pode ser inativado.`,
      confirmar: 'Excluir',
      perigo: true
    });
    if (!ok) return;
    this.agindo.set(c.id);
    this.bloqueio.set(null);
    this.service.excluir(c.id).subscribe({
      next: () => { this.agindo.set(null); this.feedback.set('Campo excluído.'); this.carregar(); },
      error: err => {
        this.agindo.set(null);
        const e = lerErroApi(err, 'Erro ao excluir o campo.');
        if (err.status === 400 && e.mensagem) this.bloqueio.set({ campo: c, mensagem: e.mensagem });
        else this.erro.set(textoDoErro(e, 'Erro ao excluir o campo.'));
      }
    });
  }

  desativar() {
    const c = this.bloqueio()?.campo;
    if (!c) return;
    this.agindo.set(c.id);
    this.service.atualizar(c.id, {
      nome: c.nome, obrigatorio: c.obrigatorio, opcoes: c.tipo === 'lista' ? c.opcoes : undefined,
      categoriaId: c.categoriaId, ativo: false, ordem: c.ordem
    }).subscribe({
      next: () => {
        this.agindo.set(null);
        this.bloqueio.set(null);
        this.feedback.set(`Campo "${c.nome}" inativado. Os valores continuam nos bens.`);
        this.carregar();
      },
      error: err => {
        this.agindo.set(null);
        this.erro.set(textoDoErro(lerErroApi(err, 'Erro ao inativar o campo.'), 'Erro ao inativar o campo.'));
      }
    });
  }

  erroCampo(nome: 'nome' | 'ordem'): string {
    const c = this.form.controls[nome];
    if (c.errors?.['servidor']) return c.errors['servidor'];
    if (!c.touched) return '';
    if (c.errors?.['required']) return 'Campo obrigatório.';
    if (c.errors?.['maxlength']) return `Máximo de ${MAX_NOME_CAMPO} caracteres.`;
    if (c.errors?.['min'] || c.errors?.['max']) return 'Informe de 0 a 1000.';
    return '';
  }
}
