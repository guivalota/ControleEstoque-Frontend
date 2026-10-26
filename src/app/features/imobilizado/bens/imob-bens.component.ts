import { Component, OnInit, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { merge } from 'rxjs';
import { ActivatedRoute, ParamMap, Router, RouterLink } from '@angular/router';
import { ImobBemService } from '../../../core/services/imob-bem.service';
import { ImobCategoriaService } from '../../../core/services/imob-categoria.service';
import { ImobLocalService } from '../../../core/services/imob-local.service';
import { PermissaoService } from '../../../core/services/permissao.service';
import {
  CLASSE_STATUS_BEM, ImobBem, ImobBemFiltro, ImobBemStatus, ROTULO_STATUS_BEM, STATUS_BEM, bemEditavel
} from '../../../core/models/imob-bem.model';
import { ImobCategoria } from '../../../core/models/imob-categoria.model';
import { ImobLocalArvore } from '../../../core/models/imob-local.model';
import { lerErroApi } from '../../../core/utils/erros-api';
import { baixarBlob } from '../../../core/utils/download';
import { formatarMoeda } from '../../../core/utils/imob-formato';
import { ConfirmDialogComponent } from '../shared/confirm-dialog.component';
import { PaginacaoComponent } from '../shared/paginacao.component';
import { ImobEtiquetasDialogComponent } from '../shared/imob-etiquetas-dialog.component';
import { SeletorLocalComponent } from '../shared/seletor-local.component';
import { AutocompleteResponsavelComponent } from '../shared/autocomplete-responsavel.component';

const PAGE_SIZE = 50;

/** Lê um id positivo da query string; ignora valores inválidos. */
function idDaQuery(params: ParamMap, chave: string): number | null {
  const n = Number(params.get(chave));
  return Number.isInteger(n) && n > 0 ? n : null;
}

@Component({
  selector: 'app-imob-bens',
  standalone: true,
  imports: [
    ReactiveFormsModule, RouterLink, ConfirmDialogComponent, PaginacaoComponent, ImobEtiquetasDialogComponent,
    SeletorLocalComponent, AutocompleteResponsavelComponent
  ],
  templateUrl: './imob-bens.component.html'
})
export class ImobBensComponent implements OnInit {
  private fb = inject(FormBuilder);
  private service = inject(ImobBemService);
  private categoriaService = inject(ImobCategoriaService);
  private localService = inject(ImobLocalService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  permissao = inject(PermissaoService);

  private confirmDialog = viewChild.required(ConfirmDialogComponent);
  private etiquetasDialog = viewChild.required(ImobEtiquetasDialogComponent);

  readonly pageSize = PAGE_SIZE;
  readonly statusLista = STATUS_BEM;
  rotuloStatus = ROTULO_STATUS_BEM;
  classeStatus = CLASSE_STATUS_BEM;
  formatarMoeda = formatarMoeda;
  bemEditavel = bemEditavel;

  bens = signal<ImobBem[]>([]);
  total = signal(0);
  page = signal(1);
  loading = signal(false);
  erro = signal('');
  feedback = signal('');
  agindo = signal<number | null>(null);

  categorias = signal<ImobCategoria[]>([]);
  arvore = signal<ImobLocalArvore[]>([]);

  /** Bens marcados para etiqueta; vale entre páginas e zera quando o filtro muda. */
  selecionados = signal<ReadonlySet<number>>(new Set());

  exportando = signal(false);
  erroExportacao = signal('');

  plaquetaBusca = this.fb.control('');
  buscandoPlaqueta = signal(false);
  erroPlaqueta = signal('');

  filtros = this.fb.group({
    busca: [''],
    localId: [null as number | null],
    incluirSublocais: [true],
    categoriaId: [null as number | null],
    responsavelId: [null as number | null],
    status: ['' as ImobBemStatus | ''],
    pendentes: [false]
  });

  /** Filtro efetivamente aplicado (vem da URL). */
  private filtroAtivo: ImobBemFiltro = {};

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe(params => this.aplicarDaUrl(params));

    // selects e seletores aplicam na hora; a busca por texto só ao enviar o formulário
    const c = this.filtros.controls;
    merge(c.localId.valueChanges, c.incluirSublocais.valueChanges, c.categoriaId.valueChanges,
      c.responsavelId.valueChanges, c.status.valueChanges, c.pendentes.valueChanges)
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.aplicar(1));
  }

  ngOnInit() {
    this.categoriaService.listar({ pageSize: 100 }).subscribe({
      next: res => this.categorias.set(res.items),
      error: () => undefined
    });
    this.localService.arvore().subscribe({
      next: a => this.arvore.set(a),
      error: () => undefined
    });
  }

  // ---- filtros <-> URL ----

  private aplicarDaUrl(params: ParamMap) {
    const status = params.get('status') as ImobBemStatus | null;
    const localId = idDaQuery(params, 'localId');
    const filtro: ImobBemFiltro = {
      busca: params.get('busca')?.trim() || undefined,
      localId: localId ?? undefined,
      incluirSublocais: localId !== null && params.get('incluirSublocais') === 'false' ? false : undefined,
      categoriaId: idDaQuery(params, 'categoriaId') ?? undefined,
      responsavelId: idDaQuery(params, 'responsavelId') ?? undefined,
      status: status && STATUS_BEM.includes(status) ? status : undefined,
      dadosCompletos: params.get('dadosCompletos') === 'false' ? false : undefined
    };
    if (JSON.stringify(filtro) !== JSON.stringify(this.filtroAtivo)) this.selecionados.set(new Set());
    this.filtroAtivo = filtro;
    this.filtros.reset({
      busca: filtro.busca ?? '',
      localId: filtro.localId ?? null,
      incluirSublocais: filtro.incluirSublocais !== false,
      categoriaId: filtro.categoriaId ?? null,
      responsavelId: filtro.responsavelId ?? null,
      status: filtro.status ?? '',
      pendentes: filtro.dadosCompletos === false
    }, { emitEvent: false });
    this.carregar(Math.max(1, idDaQuery(params, 'page') ?? 1));
  }

  private queryParamsDoFormulario(page: number): Record<string, string | number | null> {
    const v = this.filtros.getRawValue();
    return {
      busca: v.busca?.trim() || null,
      localId: v.localId,
      incluirSublocais: v.localId !== null && !v.incluirSublocais ? 'false' : null,
      categoriaId: v.categoriaId,
      responsavelId: v.responsavelId,
      status: v.status || null,
      dadosCompletos: v.pendentes ? 'false' : null,
      page: page > 1 ? page : null
    };
  }

  /** Aplica os filtros do formulário: a URL é a fonte da verdade e dispara a (re)carga. */
  aplicar(page = 1) {
    const novos = this.queryParamsDoFormulario(page);
    const atuais = this.route.snapshot.queryParamMap;
    const iguais = Object.entries(novos).every(([k, v]) => (v === null ? null : String(v)) === atuais.get(k));
    if (iguais) { this.carregar(page); return; }
    this.router.navigate([], { relativeTo: this.route, queryParams: novos });
  }

  /** Troca de página mantendo o filtro aplicado (e não o que está digitado e ainda não foi enviado). */
  mudarPagina(page: number) {
    this.router.navigate([], {
      relativeTo: this.route, queryParamsHandling: 'merge', queryParams: { page: page > 1 ? page : null }
    });
  }

  limparFiltros() {
    this.filtros.reset({ busca: '', localId: null, incluirSublocais: true, categoriaId: null, responsavelId: null, status: '', pendentes: false },
      { emitEvent: false });
    this.aplicar(1);
  }

  temFiltro(): boolean {
    return Object.values(this.filtroAtivo).some(v => v !== undefined);
  }

  // ---- dados ----

  carregar(page = this.page()) {
    this.loading.set(true);
    this.erro.set('');
    this.service.listar({ ...this.filtroAtivo, page, pageSize: PAGE_SIZE }).subscribe({
      next: res => {
        this.bens.set(res.items);
        this.total.set(res.total);
        this.page.set(page);
        this.loading.set(false);
      },
      error: err => {
        this.erro.set(lerErroApi(err, 'Erro ao carregar bens.').mensagem);
        this.loading.set(false);
      }
    });
  }

  // ---- etiquetas ----

  alternar(id: number, marcado: boolean) {
    const novo = new Set(this.selecionados());
    if (marcado) novo.add(id); else novo.delete(id);
    this.selecionados.set(novo);
  }

  paginaToda(): boolean {
    return this.bens().length > 0 && this.bens().every(b => this.selecionados().has(b.id));
  }

  alternarPagina(marcado: boolean) {
    const novo = new Set(this.selecionados());
    for (const b of this.bens()) { if (marcado) novo.add(b.id); else novo.delete(b.id); }
    this.selecionados.set(novo);
  }

  imprimirSelecionados() {
    this.etiquetasDialog().abrir({ ids: [...this.selecionados()] });
  }

  imprimirFiltro() {
    this.etiquetasDialog().abrir({ filtro: this.filtroAtivo, total: this.total() });
  }

  buscarPlaqueta() {
    const plaqueta = (this.plaquetaBusca.value ?? '').trim();
    if (!plaqueta) return;
    this.buscandoPlaqueta.set(true);
    this.erroPlaqueta.set('');
    this.service.porPlaqueta(plaqueta).subscribe({
      next: bem => {
        this.buscandoPlaqueta.set(false);
        this.router.navigate(['/imobilizado/bens', bem.id]);
      },
      error: err => {
        this.buscandoPlaqueta.set(false);
        this.erroPlaqueta.set(err.status === 404
          ? `Plaqueta "${plaqueta}" não encontrada.`
          : lerErroApi(err, 'Erro ao buscar a plaqueta.').mensagem);
      }
    });
  }

  exportar() {
    this.exportando.set(true);
    this.erroExportacao.set('');
    this.service.exportar(this.filtroAtivo).subscribe({
      next: arquivo => {
        baixarBlob(arquivo.blob, arquivo.nome);
        this.exportando.set(false);
      },
      error: err => {
        const e = lerErroApi(err, 'Erro ao exportar bens.');
        this.erroExportacao.set(err.status === 400 && e.mensagem
          ? `${e.mensagem} Tente filtrar por local ou categoria.`
          : e.mensagem);
        this.exportando.set(false);
      }
    });
  }

  async excluir(bem: ImobBem) {
    const ok = await this.confirmDialog().abrir({
      titulo: 'Excluir bem',
      mensagem: `Excluir o bem ${bem.plaqueta} — ${bem.descricao}? A exclusão fica registrada no histórico.`,
      confirmar: 'Excluir',
      perigo: true
    });
    if (!ok) return;
    this.agindo.set(bem.id);
    this.service.excluir(bem.id).subscribe({
      next: () => {
        this.agindo.set(null);
        this.feedback.set(`Bem ${bem.plaqueta} excluído.`);
        this.carregar(this.bens().length === 1 && this.page() > 1 ? this.page() - 1 : this.page());
      },
      error: err => {
        this.agindo.set(null);
        this.erro.set(lerErroApi(err, 'Erro ao excluir bem.').mensagem);
      }
    });
  }
}
