import { Component, ElementRef, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ImobImportacaoService } from '../../../core/services/imob-importacao.service';
import { ImobLocalService } from '../../../core/services/imob-local.service';
import { ImobLocalArvore } from '../../../core/models/imob-local.model';
import { RelatorioImportacao, ResultadoImportacao } from '../../../core/models/imob-importacao.model';
import { baixarBlob } from '../../../core/utils/download';
import { lerErroApi } from '../../../core/utils/erros-api';
import { relatorioErrosCsv } from '../../../core/utils/relatorio-erros';
import { ConfirmDialogComponent } from '../shared/confirm-dialog.component';
import { PaginacaoComponent } from '../shared/paginacao.component';
import { SeletorLocalComponent } from '../shared/seletor-local.component';

const ERROS_POR_PAGINA = 20;

@Component({
  selector: 'app-imob-importacao-bens',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, ConfirmDialogComponent, PaginacaoComponent, SeletorLocalComponent],
  templateUrl: './imob-importacao-bens.component.html'
})
export class ImobImportacaoBensComponent implements OnInit {
  private service = inject(ImobImportacaoService);
  private localService = inject(ImobLocalService);
  private confirmDialog = viewChild.required(ConfirmDialogComponent);
  private campoArquivo = viewChild<ElementRef<HTMLInputElement>>('campoArquivo');

  readonly errosPorPagina = ERROS_POR_PAGINA;

  localPadrao = new FormControl<number | null>(null);
  arvore = signal<ImobLocalArvore[]>([]);

  /** Mantido em memória: a confirmação reenvia este mesmo arquivo. */
  arquivo = signal<File | null>(null);
  erroArquivo = signal('');
  baixandoModelo = signal(false);
  validando = signal(false);
  importando = signal(false);
  erro = signal('');

  relatorio = signal<RelatorioImportacao | null>(null);
  resultado = signal<ResultadoImportacao | null>(null);

  filtroCampo = signal('');
  pagina = signal(1);

  campos = computed(() => [...new Set((this.relatorio()?.erros ?? []).map(e => e.campo))].sort());
  errosFiltrados = computed(() => {
    const campo = this.filtroCampo();
    const erros = this.relatorio()?.erros ?? [];
    return campo ? erros.filter(e => e.campo === campo) : erros;
  });
  errosPagina = computed(() => {
    const ini = (this.pagina() - 1) * ERROS_POR_PAGINA;
    return this.errosFiltrados().slice(ini, ini + ERROS_POR_PAGINA);
  });
  ocupado = computed(() => this.validando() || this.importando());

  ngOnInit() {
    this.localService.arvore().subscribe({ next: a => this.arvore.set(a), error: () => undefined });
    // trocar o local padrão invalida o relatório
    this.localPadrao.valueChanges.subscribe(() => this.invalidar());
  }

  baixarModelo() {
    this.baixandoModelo.set(true);
    this.erro.set('');
    this.service.modelo().subscribe({
      next: ({ blob, nome }) => { baixarBlob(blob, nome); this.baixandoModelo.set(false); },
      error: err => { this.erro.set(lerErroApi(err, 'Não foi possível baixar o modelo.').mensagem); this.baixandoModelo.set(false); }
    });
  }

  escolherArquivo(event: Event) {
    const arquivo = (event.target as HTMLInputElement).files?.[0] ?? null;
    this.invalidar();
    this.erroArquivo.set('');
    if (arquivo && !/\.csv$/i.test(arquivo.name)) {
      this.arquivo.set(null);
      this.erroArquivo.set('Envie um arquivo .csv. Em planilhas, use Arquivo → Salvar como → CSV.');
      return;
    }
    this.arquivo.set(arquivo);
  }

  validar() {
    const arquivo = this.arquivo();
    if (!arquivo || this.ocupado()) return;
    this.validando.set(true);
    this.erro.set('');
    this.resultado.set(null);
    this.service.validar(arquivo, this.localPadrao.value).subscribe({
      next: rel => {
        this.relatorio.set(rel);
        this.filtroCampo.set('');
        this.pagina.set(1);
        this.validando.set(false);
      },
      error: err => {
        this.relatorio.set(null);
        this.erro.set(lerErroApi(err, 'Erro ao validar o arquivo.').mensagem);
        this.validando.set(false);
      }
    });
  }

  async importar(apenasValidas = false) {
    const rel = this.relatorio();
    const arquivo = this.arquivo();
    if (!rel || !arquivo || this.ocupado()) return;
    if (apenasValidas) {
      const ok = await this.confirmDialog().abrir({
        titulo: 'Importar só as linhas válidas',
        mensagem: `${rel.linhasComErro} linha(s) com erro serão ignoradas e ${rel.linhasValidas} bem(ns) serão importados. ` +
          'As linhas ignoradas só entram com um novo arquivo. Continuar?',
        confirmar: 'Importar válidas'
      });
      if (!ok) return;
    }
    this.importando.set(true);
    this.erro.set('');
    this.service.confirmar(arquivo, rel.hashArquivo, this.localPadrao.value, apenasValidas).subscribe({
      next: res => { this.resultado.set(res); this.relatorio.set(null); this.importando.set(false); },
      error: err => {
        const msg = lerErroApi(err, 'Erro ao importar o arquivo.').mensagem;
        this.erro.set(msg);
        // arquivo divergente ou plaqueta criada por outra pessoa: o relatório deixou de valer
        if (/difere|valide o arquivo novamente/i.test(msg)) this.relatorio.set(null);
        this.importando.set(false);
      }
    });
  }

  baixarRelatorioErros() {
    const erros = this.relatorio()?.erros ?? [];
    if (erros.length) baixarBlob(relatorioErrosCsv(erros), 'erros-importacao-bens.csv');
  }

  filtrarCampo(campo: string) {
    this.filtroCampo.set(campo);
    this.pagina.set(1);
  }

  novaImportacao() {
    this.invalidar();
    this.resultado.set(null);
    this.erroArquivo.set('');
    this.arquivo.set(null);
    const campo = this.campoArquivo()?.nativeElement;
    if (campo) campo.value = '';
  }

  /** Mudou o arquivo ou o local padrão: o relatório e o hash não valem mais. */
  private invalidar() {
    this.relatorio.set(null);
    this.erro.set('');
  }
}
