import { Component, ElementRef, OnInit, inject, signal, viewChild } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ImobInventarioService } from '../../../core/services/imob-inventario.service';
import { ImobLeituraService } from '../../../core/services/imob-leitura.service';
import { ImobLocalService } from '../../../core/services/imob-local.service';
import { ImobInventario } from '../../../core/models/imob-inventario.model';
import { ImobLocalArvore } from '../../../core/models/imob-local.model';
import {
  CLASSE_SITUACAO_PREVISTA, ICONE_SITUACAO_PREVISTA, ImobLeitura, ImobLeituraRegistrada,
  RelatorioImportacaoLeituras, ROTULO_SITUACAO_PREVISTA
} from '../../../core/models/imob-leitura.model';
import { baixarBlob } from '../../../core/utils/download';
import { lerErroApi } from '../../../core/utils/erros-api';
import { formatarDataHora } from '../../../core/utils/imob-formato';
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
  private route = inject(ActivatedRoute);
  private campoPlaqueta = viewChild<ElementRef<HTMLInputElement>>('campoPlaqueta');

  readonly id = Number(this.route.snapshot.paramMap.get('id'));
  readonly pageSize = PAGE_SIZE;
  rotuloSituacao = ROTULO_SITUACAO_PREVISTA;
  classeSituacao = CLASSE_SITUACAO_PREVISTA;
  iconeSituacao = ICONE_SITUACAO_PREVISTA;
  formatarDataHora = formatarDataHora;

  inventario = signal<ImobInventario | null>(null);
  naoEncontrado = signal(false);
  arvore = signal<ImobLocalArvore[]>([]);

  local = new FormControl<number | null>(null);
  plaqueta = new FormControl('', { nonNullable: true });
  observacao = new FormControl('', { nonNullable: true });

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

  // Importação CSV
  arquivo = signal<File | null>(null);
  relatorio = signal<RelatorioImportacaoLeituras | null>(null);
  importando = signal(false);
  erroImportacao = signal('');

  get emAndamento() { return this.inventario()?.status === 'em_andamento'; }

  ngOnInit() {
    this.inventarios.obter(this.id).subscribe({
      next: inv => { this.inventario.set(inv); if (inv.status === 'em_andamento') this.carregar(); },
      error: err => {
        if (err.status === 404) this.naoEncontrado.set(true);
        else this.erro.set(lerErroApi(err, 'Erro ao carregar o inventário.').mensagem);
      }
    });
    this.locais.arvore().subscribe({ next: a => this.arvore.set(a), error: () => this.arvore.set([]) });
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
    if (localId == null || !plaqueta) {
      this.erro.set(localId == null ? 'Selecione o local onde você está.' : 'Informe a plaqueta.');
      return;
    }
    const observacao = this.observacao.value.trim() || undefined;
    const chave = `${plaqueta.toLowerCase()}|${localId}|${observacao ?? ''}`;
    const clientId = this.pendente?.chave === chave ? this.pendente.clientId : crypto.randomUUID();
    this.pendente = { chave, clientId };
    this.erro.set('');
    this.registrando.set(true);
    this.service.registrar(this.id, { plaqueta, localId, clientId, observacao }).subscribe({
      next: r => {
        this.pendente = null;
        this.registrando.set(false);
        this.sessao.update(l => [r, ...l].slice(0, MAX_FEEDBACK));
        this.plaqueta.reset('');
        this.observacao.reset('');
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
