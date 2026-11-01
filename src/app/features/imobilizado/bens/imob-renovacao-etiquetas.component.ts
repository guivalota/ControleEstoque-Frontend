import { Component, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ImobBemService } from '../../../core/services/imob-bem.service';
import { ImobCodigoAnteriorService } from '../../../core/services/imob-codigo-anterior.service';
import { PermissaoService } from '../../../core/services/permissao.service';
import { ResultadoDePara } from '../../../core/models/imob-renovacao.model';
import { baixarBlob } from '../../../core/utils/download';
import { lerErroApi } from '../../../core/utils/erros-api';
import {
  BemCodigos, MAX_PARES_DE_PARA, MODELO_CSV_DE_PARA, ROTULO_SITUACAO_CADASTRO, ResultadoCruzamento,
  SituacaoCadastro, cruzarComCadastro, erroInventarioEmAndamento, parsearDePara, validarDePara
} from '../../../core/utils/renovacao-etiquetas';
import { ConfirmDialogComponent } from '../shared/confirm-dialog.component';

const PAGINA_CADASTRO = 100;
const PREVIA_LINHAS = 50;

@Component({
  selector: 'app-imob-renovacao-etiquetas',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, ConfirmDialogComponent],
  templateUrl: './imob-renovacao-etiquetas.component.html'
})
export class ImobRenovacaoEtiquetasComponent implements OnInit {
  private bens = inject(ImobBemService);
  private confirmDialog = viewChild.required(ConfirmDialogComponent);
  readonly virada = inject(ImobCodigoAnteriorService);
  readonly permissao = inject(PermissaoService);

  readonly maxPares = MAX_PARES_DE_PARA;
  readonly rotuloCadastro = ROTULO_SITUACAO_CADASTRO;
  readonly previaLinhas = PREVIA_LINHAS;

  // ---- de-para ----
  texto = new FormControl('', { nonNullable: true });
  private textoAtual = signal('');
  nomeArquivo = signal('');
  pares = computed(() => parsearDePara(this.textoAtual()));
  previa = computed(() => validarDePara(this.pares()));

  cruzamento = signal<ResultadoCruzamento | null>(null);
  conferindo = signal(false);
  progressoConferencia = signal('');
  erroConferencia = signal('');

  enviando = signal(false);
  resultado = signal<ResultadoDePara | null>(null);
  erroEnvio = signal('');
  gerandoConferencia = signal(false);
  erroConferenciaPdf = signal('');
  bloqueioInventario = signal(false);

  // ---- virada ----
  alterando = signal(false);
  erroVirada = signal('');
  feedbackVirada = signal('');

  /** Pares exibidos na prévia: os com problema primeiro, limitados para não pesar a tela. */
  linhasPrevia = computed(() => {
    const erros = new Set(this.previa().erros.map(e => e.linha));
    const cruz = this.cruzamento();
    const problema = (linha: number) => erros.has(linha) || (cruz && !['ok', 'ja_aplicado'].includes(cruz.porLinha.get(linha) ?? 'ok'));
    const todos = this.pares().map(p => ({
      ...p,
      erros: this.previa().erros.filter(e => e.linha === p.linha).map(e => e.mensagem),
      cadastro: cruz?.porLinha.get(p.linha) ?? null,
      problema: !!problema(p.linha)
    }));
    return [...todos.filter(l => l.problema), ...todos.filter(l => !l.problema)].slice(0, PREVIA_LINHAS);
  });

  podeEnviar = computed(() => !this.previa().bloqueado && !this.previa().excedeLimite && !this.enviando());

  ngOnInit() {
    this.virada.carregar(true);
    this.texto.valueChanges.subscribe(v => {
      this.textoAtual.set(v);
      this.limparResultados();
    });
  }

  private limparResultados() {
    this.resultado.set(null);
    this.erroEnvio.set('');
    this.bloqueioInventario.set(false);
    this.cruzamento.set(null);
    this.erroConferencia.set('');
  }

  // ---- entrada ----

  async escolherArquivo(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const f = input.files?.[0];
    if (!f) return;
    try {
      this.nomeArquivo.set(f.name);
      this.texto.setValue(await f.text());
    } catch {
      this.erroEnvio.set('Não foi possível ler o arquivo.');
    } finally {
      input.value = '';
    }
  }

  limpar() {
    this.nomeArquivo.set('');
    this.texto.setValue('');
  }

  /** PDF de conferência com todos os bens (lista para imprimir antes de trocar as etiquetas). */
  gerarConferencia() {
    this.gerandoConferencia.set(true);
    this.erroConferenciaPdf.set('');
    this.bens.conferenciaPdf().subscribe({
      next: arquivo => {
        baixarBlob(arquivo.blob, arquivo.nome);
        this.gerandoConferencia.set(false);
      },
      error: err => {
        this.erroConferenciaPdf.set(lerErroApi(err, 'Erro ao gerar a conferência.').mensagem);
        this.gerandoConferencia.set(false);
      }
    });
  }

  baixarModelo() {
    baixarBlob(new Blob(['﻿' + MODELO_CSV_DE_PARA], { type: 'text/csv;charset=utf-8' }), 'modelo-de-para-etiquetas.csv');
  }

  // ---- cruzamento com o cadastro ----

  /** Pagina a lista de bens (a API não tem dry-run) e cruza os códigos no navegador. */
  conferirCadastro() {
    const pares = this.pares();
    if (!pares.length) return;
    this.conferindo.set(true);
    this.erroConferencia.set('');
    this.cruzamento.set(null);
    const acumulado: BemCodigos[] = [];

    const pagina = (page: number) => {
      this.progressoConferencia.set(acumulado.length ? `${acumulado.length} bens lidos...` : 'Lendo o cadastro...');
      this.bens.listar({ page, pageSize: PAGINA_CADASTRO }).subscribe({
        next: res => {
          for (const b of res.items) acumulado.push({ plaqueta: b.plaqueta, plaquetaAnterior: b.plaquetaAnterior });
          if (acumulado.length < res.total && res.items.length > 0) { pagina(page + 1); return; }
          this.cruzamento.set(cruzarComCadastro(pares, acumulado));
          this.conferindo.set(false);
        },
        error: err => {
          this.erroConferencia.set(lerErroApi(err, 'Erro ao ler o cadastro de bens.').mensagem);
          this.conferindo.set(false);
        }
      });
    };
    pagina(1);
  }

  contagemCadastro(s: SituacaoCadastro): number {
    return this.cruzamento()?.contagem[s] ?? 0;
  }

  // ---- envio ----

  async enviar() {
    if (!this.podeEnviar()) return;
    const total = this.pares().length;
    const ok = await this.confirmDialog().abrir({
      titulo: 'Aplicar renovação de etiquetas',
      mensagem: `Aplicar ${total} ${total === 1 ? 'par' : 'pares'} de códigos? A operação é atômica: se algum par for recusado, nada é gravado.`,
      confirmar: 'Aplicar'
    });
    if (!ok) return;

    this.enviando.set(true);
    this.erroEnvio.set('');
    this.resultado.set(null);
    this.bloqueioInventario.set(false);
    this.bens.aplicarDePara(this.pares().map(p => ({ antiga: p.antiga, nova: p.nova }))).subscribe({
      next: r => {
        this.resultado.set(r);
        this.enviando.set(false);
        this.cruzamento.set(null);
        this.virada.carregar(true);
      },
      error: err => {
        const msg = lerErroApi(err, 'Erro ao aplicar o de-para.').mensagem;
        this.erroEnvio.set(msg);
        this.bloqueioInventario.set(err.status === 400 && erroInventarioEmAndamento(msg));
        this.enviando.set(false);
      }
    });
  }

  // ---- virada ----

  async alternarVirada() {
    const estado = this.virada.estado();
    if (!estado || this.alterando()) return;
    const ocultar = !estado.oculto;
    if (ocultar) {
      const ok = await this.confirmDialog().abrir({
        titulo: 'Ocultar códigos antigos',
        mensagem: 'Depois disso, as etiquetas antigas deixam de ser reconhecidas no levantamento. Dá para desfazer.',
        confirmar: 'Ocultar códigos antigos',
        perigo: true
      });
      if (!ok) return;
    }
    this.alterando.set(true);
    this.erroVirada.set('');
    this.feedbackVirada.set('');
    this.virada.alterar(ocultar).subscribe({
      next: () => {
        this.alterando.set(false);
        this.feedbackVirada.set(ocultar ? 'Códigos antigos ocultados.' : 'Códigos antigos voltaram a ser exibidos.');
      },
      error: err => {
        this.alterando.set(false);
        this.erroVirada.set(lerErroApi(err, 'Erro ao alterar a exibição dos códigos antigos.').mensagem);
      }
    });
  }
}
