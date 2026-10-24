import { Component, OnInit, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { FiltroValorContabil, FormatoArquivo, ImobDepreciacaoService } from '../../../core/services/imob-depreciacao.service';
import { ImobCategoriaService } from '../../../core/services/imob-categoria.service';
import { ImobLocalService } from '../../../core/services/imob-local.service';
import { ImobCategoria } from '../../../core/models/imob-categoria.model';
import { ImobLocalArvore } from '../../../core/models/imob-local.model';
import { ROTULO_STATUS_BEM, STATUS_BEM } from '../../../core/models/imob-bem.model';
import {
  AgruparRazao, DimensaoRelatorio, PeriodoFechado, RelatorioBaixas, RelatorioBensPorDimensao, RelatorioRazao,
  RelatorioValorContabil, formatarMes
} from '../../../core/models/imob-depreciacao.model';
import { formatarNumeroOs } from '../../../core/models/imob-ordem-servico.model';
import { baixarBlob } from '../../../core/utils/download';
import { lerErroApi } from '../../../core/utils/erros-api';
import { formatarData, formatarMoeda } from '../../../core/utils/imob-formato';
import { AutocompleteResponsavelComponent } from '../shared/autocomplete-responsavel.component';
import { PaginacaoComponent } from '../shared/paginacao.component';
import { SeletorLocalComponent } from '../shared/seletor-local.component';

type Aba = 'razao' | 'valor-contabil' | 'dimensao' | 'baixas';

const PAGE_SIZE = 50;
const ABAS: { chave: Aba; rotulo: string }[] = [
  { chave: 'razao', rotulo: 'Razão do período' },
  { chave: 'valor-contabil', rotulo: 'Valor contábil' },
  { chave: 'dimensao', rotulo: 'Bens por dimensão' },
  { chave: 'baixas', rotulo: 'Baixas e vendas' }
];

@Component({
  selector: 'app-imob-depreciacao-relatorios',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, PaginacaoComponent, SeletorLocalComponent, AutocompleteResponsavelComponent],
  templateUrl: './imob-depreciacao-relatorios.component.html'
})
export class ImobDepreciacaoRelatoriosComponent implements OnInit {
  private service = inject(ImobDepreciacaoService);
  private categoriasService = inject(ImobCategoriaService);
  private locaisService = inject(ImobLocalService);

  readonly abas = ABAS;
  readonly pageSize = PAGE_SIZE;
  readonly statusBem = STATUS_BEM;
  rotuloStatus = ROTULO_STATUS_BEM as Record<string, string>;
  formatarMoeda = formatarMoeda;
  formatarData = formatarData;
  formatarMes = formatarMes;
  formatarNumeroOs = formatarNumeroOs;

  aba = signal<Aba>('razao');
  erro = signal('');
  carregando = signal(false);
  baixando = signal<FormatoArquivo | null>(null);

  categorias = signal<ImobCategoria[]>([]);
  arvore = signal<ImobLocalArvore[]>([]);
  periodos = signal<PeriodoFechado[]>([]);

  // Razão
  razaoCompetencia = new FormControl('', { nonNullable: true });
  razaoAgrupar = new FormControl<AgruparRazao>('bem', { nonNullable: true });
  razaoRevisao = new FormControl<number | null>(null);
  razao = signal<RelatorioRazao | null>(null);
  razaoPagina = signal(1);

  // Valor contábil
  vcEm = new FormControl('', { nonNullable: true });
  vcCategoria = new FormControl<number | null>(null);
  vcLocal = new FormControl<number | null>(null);
  vcResponsavel = new FormControl<number | null>(null);
  vcStatus = new FormControl('', { nonNullable: true });
  valorContabil = signal<RelatorioValorContabil | null>(null);
  vcPagina = signal(1);

  // Por dimensão
  dimPor = new FormControl<DimensaoRelatorio>('categoria', { nonNullable: true });
  dimEm = new FormControl('', { nonNullable: true });
  dimensao = signal<RelatorioBensPorDimensao | null>(null);

  // Baixas
  baixasDe = new FormControl('', { nonNullable: true });
  baixasAte = new FormControl('', { nonNullable: true });
  baixas = signal<RelatorioBaixas | null>(null);
  baixasPagina = signal(1);

  ngOnInit() {
    this.service.periodos({ page: 1, pageSize: 100 }).subscribe({
      next: l => {
        this.periodos.set(l.periodos.items);
        if (l.periodos.items[0]) this.razaoCompetencia.setValue(l.periodos.items[0].mes);
      },
      error: () => this.periodos.set([])
    });
    this.categoriasService.listar({ pageSize: 100 }).subscribe({ next: r => this.categorias.set(r.items), error: () => this.categorias.set([]) });
    this.locaisService.arvore().subscribe({ next: a => this.arvore.set(a), error: () => this.arvore.set([]) });
  }

  selecionarAba(a: Aba) {
    this.aba.set(a);
    this.erro.set('');
  }

  private falhar(err: unknown, fallback: string) {
    this.carregando.set(false);
    this.erro.set(lerErroApi(err, fallback).mensagem);
  }

  // --- Razão ---
  gerarRazao(page = 1) {
    if (!this.razaoCompetencia.value) { this.erro.set('Escolha um período fechado.'); return; }
    this.carregando.set(true);
    this.erro.set('');
    this.service.razao({
      competencia: this.razaoCompetencia.value, agrupar: this.razaoAgrupar.value,
      revisao: this.razaoRevisao.value ?? undefined, page, pageSize: PAGE_SIZE
    }).subscribe({
      next: r => { this.razao.set(r); this.razaoPagina.set(page); this.carregando.set(false); },
      error: err => this.falhar(err, 'Erro ao gerar o razão.')
    });
  }

  // --- Valor contábil ---
  private filtroVc(): FiltroValorContabil {
    return {
      em: this.vcEm.value || undefined, categoriaId: this.vcCategoria.value ?? undefined, localId: this.vcLocal.value ?? undefined,
      responsavelId: this.vcResponsavel.value ?? undefined, status: this.vcStatus.value || undefined
    };
  }

  gerarValorContabil(page = 1) {
    this.carregando.set(true);
    this.erro.set('');
    this.service.valorContabil({ ...this.filtroVc(), page, pageSize: PAGE_SIZE }).subscribe({
      next: r => { this.valorContabil.set(r); this.vcPagina.set(page); this.carregando.set(false); },
      error: err => this.falhar(err, 'Erro ao gerar o relatório de valor contábil.')
    });
  }

  // --- Por dimensão ---
  gerarDimensao() {
    this.carregando.set(true);
    this.erro.set('');
    this.service.bensPorDimensao(this.dimPor.value, this.dimEm.value || undefined).subscribe({
      next: r => { this.dimensao.set(r); this.carregando.set(false); },
      error: err => this.falhar(err, 'Erro ao gerar o relatório.')
    });
  }

  // --- Baixas ---
  gerarBaixas(page = 1) {
    this.carregando.set(true);
    this.erro.set('');
    this.service.baixas({ de: this.baixasDe.value || undefined, ate: this.baixasAte.value || undefined, page, pageSize: PAGE_SIZE }).subscribe({
      next: r => { this.baixas.set(r); this.baixasPagina.set(page); this.carregando.set(false); },
      error: err => this.falhar(err, 'Erro ao gerar o relatório de baixas.')
    });
  }

  // --- Download ---
  baixar(formato: FormatoArquivo) {
    let req;
    switch (this.aba()) {
      case 'razao':
        if (!this.razaoCompetencia.value) { this.erro.set('Escolha um período fechado.'); return; }
        req = this.service.baixarRazao({
          competencia: this.razaoCompetencia.value, agrupar: this.razaoAgrupar.value, revisao: this.razaoRevisao.value ?? undefined
        }, formato);
        break;
      case 'valor-contabil':
        req = this.service.baixarValorContabil(this.filtroVc(), formato);
        break;
      case 'dimensao':
        req = this.service.baixarBensPorDimensao(this.dimPor.value, this.dimEm.value || undefined, formato);
        break;
      default:
        req = this.service.baixarBaixas({ de: this.baixasDe.value || undefined, ate: this.baixasAte.value || undefined }, formato);
    }
    this.baixando.set(formato);
    this.erro.set('');
    req.subscribe({
      next: a => { this.baixando.set(null); baixarBlob(a.blob, a.nome); },
      error: err => { this.baixando.set(null); this.erro.set(lerErroApi(err, 'Erro ao gerar o arquivo.').mensagem); }
    });
  }

  nomeStatus(s: string): string {
    return this.rotuloStatus[s] ?? s;
  }

  classeGanho(v: number | null | undefined): string {
    return (v ?? 0) > 0 ? 'text-success' : (v ?? 0) < 0 ? 'text-danger' : '';
  }
}
