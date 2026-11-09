import { Component, ElementRef, OnInit, inject, signal, viewChild } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ImobInventarioService } from '../../../core/services/imob-inventario.service';
import { ImobConferenciaService } from '../../../core/services/imob-conferencia.service';
import { ImobDepartamentoService } from '../../../core/services/imob-departamento.service';
import { ImobEstadoConservacaoService } from '../../../core/services/imob-estado-conservacao.service';
import { ImobLeituraService } from '../../../core/services/imob-leitura.service';
import { ImobLocalService } from '../../../core/services/imob-local.service';
import { ImobInventario } from '../../../core/models/imob-inventario.model';
import { ImobLocalArvore } from '../../../core/models/imob-local.model';
import { ImobDepartamento } from '../../../core/models/imob-departamento.model';
import { ImobEstadoConservacao } from '../../../core/models/imob-reavaliacao.model';
import {
  CLASSE_SITUACAO_PREVISTA, ICONE_SITUACAO_PREVISTA, ImobConferenciaDados, ImobLeitura, ImobLeituraRegistrada,
  RelatorioImportacaoConferencias, RelatorioImportacaoLeituras, ResultadoConferenciaLote,
  ROTULO_RESULTADO_CONFERENCIA, ROTULO_SITUACAO_PREVISTA
} from '../../../core/models/imob-leitura.model';
import { baixarBlob } from '../../../core/utils/download';
import { lerErroApi } from '../../../core/utils/erros-api';
import { formatarDataHora } from '../../../core/utils/imob-formato';
import { textoCoordenadas, urlMapa } from '../../../core/utils/mapa';
import { PaginacaoComponent } from '../shared/paginacao.component';
import { SeletorLocalComponent } from '../shared/seletor-local.component';

const PAGE_SIZE = 20;
const MAX_FEEDBACK = 15;

@Component({
  selector: 'app-imob-contagem',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, PaginacaoComponent, SeletorLocalComponent],
  templateUrl: './imob-contagem.component.html'
})
export class ImobContagemComponent implements OnInit {
  private inventarios = inject(ImobInventarioService);
  private service = inject(ImobLeituraService);
  private locais = inject(ImobLocalService);
  private conferencias = inject(ImobConferenciaService);
  private estadosApi = inject(ImobEstadoConservacaoService);
  private departamentosApi = inject(ImobDepartamentoService);
  private route = inject(ActivatedRoute);
  private campoPlaqueta = viewChild<ElementRef<HTMLInputElement>>('campoPlaqueta');

  readonly id = Number(this.route.snapshot.paramMap.get('id'));
  readonly pageSize = PAGE_SIZE;
  rotuloSituacao = ROTULO_SITUACAO_PREVISTA;
  rotuloConferencia = ROTULO_RESULTADO_CONFERENCIA;
  classeSituacao = CLASSE_SITUACAO_PREVISTA;
  iconeSituacao = ICONE_SITUACAO_PREVISTA;
  formatarDataHora = formatarDataHora;
  mapa = (l: ImobLeitura) => urlMapa(l.latitude, l.longitude);
  coordenadas = (l: ImobLeitura) => textoCoordenadas(l.latitude, l.longitude) ?? '';

  inventario = signal<ImobInventario | null>(null);
  naoEncontrado = signal(false);
  arvore = signal<ImobLocalArvore[]>([]);

  local = new FormControl<number | null>(null);
  plaqueta = new FormControl('', { nonNullable: true });
  observacao = new FormControl('', { nonNullable: true });

  // Conferência da reavaliação (só quando o inventário é de reavaliação)
  estados = signal<ImobEstadoConservacao[]>([]);
  departamentos = signal<ImobDepartamento[]>([]);
  estado = new FormControl<number | null>(null);
  valorMercado = new FormControl<number | null>(null, { validators: [Validators.min(0)] });
  departamento = new FormControl<number | null>(null);
  conferindo = signal(false);
  /** Resultado da última conferência sem leitura. */
  resultadoConferencia = signal<{ ok: boolean; texto: string } | null>(null);

  registrando = signal(false);
  erro = signal('');
  /** Feedback imediato das leituras desta sessão (mais recente primeiro). */
  sessao = signal<ImobLeituraRegistrada[]>([]);
  /** Reaproveitado ao repetir a mesma leitura após falha de rede (retry idempotente). */
  private pendente: { chave: string; clientId: string } | null = null;

  leituras = signal<ImobLeitura[]>([]);
  total = signal(0);
  page = signal(1);
  incluirAnuladas = signal(false);
  filtroPlaqueta = new FormControl('', { nonNullable: true });
  carregando = signal(false);
  anulando = signal<number | null>(null);

  // Importação CSV de conferências
  arquivoConf = signal<File | null>(null);
  relatorioConf = signal<RelatorioImportacaoConferencias | null>(null);
  importandoConf = signal(false);
  erroImportacaoConf = signal('');

  // Importação CSV
  arquivo = signal<File | null>(null);
  relatorio = signal<RelatorioImportacaoLeituras | null>(null);
  importando = signal(false);
  erroImportacao = signal('');

  get emAndamento() { return this.inventario()?.status === 'em_andamento'; }
  get reavaliacao() { return this.inventario()?.reavaliacao === true; }

  ngOnInit() {
    this.inventarios.obter(this.id).subscribe({
      next: inv => {
        this.inventario.set(inv);
        if (inv.status === 'em_andamento') this.carregar();
        if (inv.reavaliacao) this.carregarListasConferencia();
      },
      error: err => {
        if (err.status === 404) this.naoEncontrado.set(true);
        else this.erro.set(lerErroApi(err, 'Erro ao carregar o inventário.').mensagem);
      }
    });
    this.locais.arvore().subscribe({ next: a => this.arvore.set(a), error: () => this.arvore.set([]) });
  }

  private carregarListasConferencia() {
    this.estadosApi.listar({ ativo: true, pageSize: 200 }).subscribe({ next: r => this.estados.set(r.items), error: () => this.estados.set([]) });
    this.departamentosApi.listar({ ativo: true, pageSize: 1000 }).subscribe({ next: r => this.departamentos.set(r.items), error: () => this.departamentos.set([]) });
  }

  /** Dados de conferência preenchidos, ou `undefined` se nenhum campo foi informado (ou fora da reavaliação). */
  private dadosConferencia(): ImobConferenciaDados | undefined {
    if (!this.reavaliacao) return undefined;
    const d: ImobConferenciaDados = {};
    if (this.estado.value != null) d.estadoId = this.estado.value;
    if (this.valorMercado.value != null) d.valorMercado = this.valorMercado.value;
    if (this.departamento.value != null) d.departamentoId = this.departamento.value;
    return Object.keys(d).length ? d : undefined;
  }

  private limparConferencia() {
    this.estado.reset(null);
    this.valorMercado.reset(null);
    this.departamento.reset(null);
  }

  carregar(page = this.page()) {
    this.carregando.set(true);
    this.service.listar(this.id, {
      plaqueta: this.filtroPlaqueta.value.trim() || undefined,
      incluirAnuladas: this.incluirAnuladas() || undefined,
      page, pageSize: PAGE_SIZE
    }).subscribe({
      next: r => { this.leituras.set(r.items); this.total.set(r.total); this.page.set(r.page); this.carregando.set(false); },
      error: err => { this.carregando.set(false); this.erro.set(lerErroApi(err, 'Erro ao carregar as leituras.').mensagem); }
    });
  }

  alternarAnuladas() {
    this.incluirAnuladas.update(v => !v);
    this.carregar(1);
  }

  registrar() {
    const plaqueta = this.plaqueta.value.trim();
    const localId = this.local.value;
    this.resultadoConferencia.set(null);
    if (localId == null || !plaqueta) {
      this.erro.set(localId == null ? 'Selecione o local onde você está.' : 'Informe a plaqueta.');
      return;
    }
    if (this.valorMercado.invalid) { this.erro.set('O valor de mercado não pode ser negativo.'); return; }
    const observacao = this.observacao.value.trim() || undefined;
    const conferencia = this.dadosConferencia();
    const chave = `${plaqueta.toLowerCase()}|${localId}|${observacao ?? ''}|${JSON.stringify(conferencia ?? {})}`;
    const clientId = this.pendente?.chave === chave ? this.pendente.clientId : crypto.randomUUID();
    this.pendente = { chave, clientId };
    this.erro.set('');
    this.registrando.set(true);
    this.resultadoConferencia.set(null);
    this.service.registrar(this.id, { plaqueta, localId, clientId, observacao, conferencia }).subscribe({
      next: r => {
        this.pendente = null;
        this.registrando.set(false);
        this.lidoPorId.set(r.id, plaqueta);
        this.sessao.update(l => [r, ...l].slice(0, MAX_FEEDBACK));
        this.plaqueta.reset('');
        this.observacao.reset('');
        this.limparConferencia();
        this.carregar(1);
        this.campoPlaqueta()?.nativeElement.focus();
      },
      error: err => {
        // Falha de rede/servidor mantém o clientId para o retry; erro de regra o descarta.
        if (err.status && err.status < 500) this.pendente = null;
        this.registrando.set(false);
        this.erro.set(lerErroApi(err, 'Erro ao registrar a leitura.').mensagem);
      }
    });
  }

  /** Registra só a conferência (estado/valor/departamento), sem criar leitura: não exige local. */
  soConferir() {
    const plaqueta = this.plaqueta.value.trim();
    const dados = this.dadosConferencia();
    if (!plaqueta) { this.erro.set('Informe a plaqueta.'); return; }
    if (!dados) { this.erro.set('Informe ao menos o estado, o valor de mercado ou o departamento.'); return; }
    if (this.valorMercado.invalid) { this.erro.set('O valor de mercado não pode ser negativo.'); return; }
    this.erro.set('');
    this.resultadoConferencia.set(null);
    this.conferindo.set(true);
    this.conferencias.enviarLote(this.id, [{ plaqueta, ...dados }]).subscribe({
      next: r => {
        this.conferindo.set(false);
        this.resultadoConferencia.set(this.resumoConferencia(plaqueta, r));
        if (r.gravadas > 0) { this.plaqueta.reset(''); this.limparConferencia(); this.campoPlaqueta()?.nativeElement.focus(); }
      },
      error: err => { this.conferindo.set(false); this.erro.set(lerErroApi(err, 'Erro ao registrar a conferência.').mensagem); }
    });
  }

  private resumoConferencia(plaqueta: string, r: ResultadoConferenciaLote) {
    const item = r.itens[0];
    if (!item) return { ok: false, texto: 'Resposta sem resultado.' };
    const base = `${plaqueta}: ${this.rotuloConferencia[item.resultado] ?? item.resultado}`;
    return { ok: item.resultado === 'gravada', texto: item.erro ? `${base} — ${item.erro}` : base };
  }

  /** Texto do resultado da conferência enviada junto da leitura (vazio quando não houve conferência). */
  textoConferencia(r: ImobLeituraRegistrada): string {
    if (!r.conferencia) return '';
    return r.conferenciaErro ? `${this.rotuloConferencia[r.conferencia]} — ${r.conferenciaErro}` : this.rotuloConferencia[r.conferencia];
  }

  baixarModeloConf() {
    this.conferencias.modelo(this.id).subscribe({
      next: a => baixarBlob(a.blob, a.nome),
      error: err => this.erroImportacaoConf.set(lerErroApi(err, 'Erro ao baixar o modelo.').mensagem)
    });
  }

  escolherArquivoConf(ev: Event) {
    this.arquivoConf.set((ev.target as HTMLInputElement).files?.[0] ?? null);
    this.relatorioConf.set(null);
    this.erroImportacaoConf.set('');
  }

  validarConf() { this.enviarConf(true); }
  importarConf() { this.enviarConf(false); }

  private enviarConf(apenasValidar: boolean) {
    const f = this.arquivoConf();
    if (!f) return;
    this.importandoConf.set(true);
    this.erroImportacaoConf.set('');
    this.conferencias.importar(this.id, f, apenasValidar).subscribe({
      next: r => { this.relatorioConf.set(r); this.importandoConf.set(false); },
      error: err => { this.importandoConf.set(false); this.erroImportacaoConf.set(lerErroApi(err, 'Erro ao importar o arquivo.').mensagem); }
    });
  }

  /** Código digitado/lido na leitura (em minúsculas, para comparar com o devolvido). */
  private lidoPorId = new Map<number, string>();

  /** Texto "1001 → A-0001" quando o servidor resolveu a etiqueta antiga para o código atual. */
  etiquetaAntigaReconhecida(r: ImobLeituraRegistrada): string | null {
    const lido = this.lidoPorId.get(r.id);
    if (!lido || lido.toLowerCase() === r.plaqueta.toLowerCase()) return null;
    return `${lido} → ${r.plaqueta}`;
  }

  anular(l: { id: number }) {
    this.anulando.set(l.id);
    this.erro.set('');
    this.service.anular(this.id, l.id).subscribe({
      next: () => {
        this.anulando.set(null);
        this.sessao.update(s => s.map(x => x.id === l.id ? { ...x, anulada: true } : x));
        this.carregar();
      },
      error: err => { this.anulando.set(null); this.erro.set(lerErroApi(err, 'Erro ao anular a leitura.').mensagem); }
    });
  }

  // --- Importação CSV ---

  baixarModelo() {
    this.service.modelo(this.id).subscribe({
      next: a => baixarBlob(a.blob, a.nome),
      error: err => this.erroImportacao.set(lerErroApi(err, 'Erro ao baixar o modelo.').mensagem)
    });
  }

  escolherArquivo(ev: Event) {
    const f = (ev.target as HTMLInputElement).files?.[0] ?? null;
    this.arquivo.set(f);
    this.relatorio.set(null);
    this.erroImportacao.set('');
  }

  validar() { this.enviar(true); }
  importar() { this.enviar(false); }

  private enviar(apenasValidar: boolean) {
    const f = this.arquivo();
    if (!f) return;
    this.importando.set(true);
    this.erroImportacao.set('');
    this.service.importar(this.id, f, apenasValidar, this.local.value).subscribe({
      next: r => {
        this.relatorio.set(r);
        this.importando.set(false);
        if (!apenasValidar) this.carregar(1);
      },
      error: err => { this.importando.set(false); this.erroImportacao.set(lerErroApi(err, 'Erro ao importar o arquivo.').mensagem); }
    });
  }
}
