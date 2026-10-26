import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ImobOrdemServicoService } from '../../../core/services/imob-ordem-servico.service';
import { PermissaoService } from '../../../core/services/permissao.service';
import {
  CLASSE_STATUS_OS, ImobOs, ROTULO_EVENTO_OS, ROTULO_MOTIVO_BAIXA, ROTULO_STATUS_OS, ROTULO_TIPO_OS, formatarNumeroOs
} from '../../../core/models/imob-ordem-servico.model';
import { ROTULO_STATUS_BEM } from '../../../core/models/imob-bem.model';
import { lerErroApi } from '../../../core/utils/erros-api';
import { formatarData, formatarDataHora, formatarMoeda } from '../../../core/utils/imob-formato';

type Acao = 'aprovar' | 'rejeitar' | 'cancelar' | 'concluir';

const TITULO_ACAO: Record<Acao, string> = {
  aprovar: 'Aprovar OS',
  rejeitar: 'Rejeitar OS',
  cancelar: 'Cancelar OS',
  concluir: 'Concluir manutenção'
};

@Component({
  selector: 'app-imob-os-detalhe',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './imob-os-detalhe.component.html'
})
export class ImobOsDetalheComponent implements OnInit {
  private service = inject(ImobOrdemServicoService);
  private route = inject(ActivatedRoute);
  private auth = inject(AuthService);
  permissao = inject(PermissaoService);

  readonly id = Number(this.route.snapshot.paramMap.get('id'));
  rotuloTipo = ROTULO_TIPO_OS;
  rotuloStatus = ROTULO_STATUS_OS;
  classeStatus = CLASSE_STATUS_OS;
  rotuloEvento = ROTULO_EVENTO_OS;
  rotuloMotivo = ROTULO_MOTIVO_BAIXA;
  tituloAcao = TITULO_ACAO;
  nomeStatusBem = (s: string) => (ROTULO_STATUS_BEM as Record<string, string>)[s] ?? s;
  formatarNumero = formatarNumeroOs;
  formatarData = formatarData;
  formatarDataHora = formatarDataHora;
  formatarMoeda = formatarMoeda;

  os = signal<ImobOs | null>(null);
  loading = signal(false);
  naoEncontrado = signal(false);
  erro = signal('');

  acao = signal<Acao | null>(null);
  comentario = new FormControl('', { nonNullable: true });
  custoReal = new FormControl<number | null>(null);
  enviando = signal(false);
  erroAcao = signal('');

  private ehSolicitante = computed(() => {
    const sub = (this.auth.currentUser() as { sub?: string } | null)?.sub;
    return !!sub && sub.toLowerCase() === this.os()?.solicitanteId?.toLowerCase();
  });

  podeAprovar = computed(() => this.permissao.imobCanDelete() && this.os()?.status === 'pendente');
  podeRejeitar = this.podeAprovar;
  podeCancelar = computed(() => {
    const os = this.os();
    if (!os) return false;
    if (os.status === 'pendente') return this.permissao.imobCanDelete() || (this.permissao.imobCanEdit() && this.ehSolicitante());
    return os.status === 'aprovada' && os.tipo === 'manutencao' && this.permissao.imobCanDelete();
  });
  podeConcluir = computed(() => {
    const os = this.os();
    return !!os && os.status === 'aprovada' && os.tipo === 'manutencao' && this.permissao.imobCanEdit();
  });

  ngOnInit() {
    this.carregar();
  }

  carregar() {
    this.loading.set(true);
    this.erro.set('');
    this.naoEncontrado.set(false);
    this.service.obter(this.id).subscribe({
      next: os => { this.os.set(os); this.loading.set(false); },
      error: err => {
        if (err.status === 404) this.naoEncontrado.set(true);
        else this.erro.set(lerErroApi(err, 'Erro ao carregar a ordem de serviço.').mensagem);
        this.loading.set(false);
      }
    });
  }

  abrirAcao(a: Acao) {
    this.acao.set(a);
    this.comentario.reset('');
    this.custoReal.reset(null);
    this.erroAcao.set('');
  }

  fecharAcao() {
    this.acao.set(null);
  }

  /** Resumo do efeito da aprovação, mostrado antes de confirmar. */
  efeitoAprovacao(os: ImobOs): string {
    const n = os.itens.length;
    switch (os.tipo) {
      case 'transferencia': return `${n} bem(ns) serão transferidos para o local/responsável de destino.`;
      case 'manutencao': return `${n} bem(ns) ficarão com status Em manutenção até a conclusão.`;
      case 'sinistro': return `${n} bem(ns) ficarão com status Extraviado.`;
      case 'venda': return `${n} bem(ns) ficarão com status Vendido.`;
      case 'baixa': return `${n} bem(ns) ficarão com status Baixado.`;
    }
  }

  confirmar() {
    const acao = this.acao();
    const os = this.os();
    if (!acao || !os) return;
    const comentario = this.comentario.value.trim();
    if (acao === 'rejeitar' && !comentario) { this.erroAcao.set('Informe o motivo da rejeição.'); return; }
    if (acao === 'concluir' && (this.custoReal.value ?? 0) < 0) { this.erroAcao.set('O custo real não pode ser negativo.'); return; }

    const req = {
      aprovar: () => this.service.aprovar(os.id, comentario),
      rejeitar: () => this.service.rejeitar(os.id, comentario),
      cancelar: () => this.service.cancelar(os.id, comentario),
      concluir: () => this.service.concluir(os.id, this.custoReal.value, comentario)
    }[acao]();

    this.enviando.set(true);
    this.erroAcao.set('');
    req.subscribe({
      next: atualizada => { this.enviando.set(false); this.acao.set(null); this.os.set(atualizada); },
      error: err => {
        this.enviando.set(false);
        this.erroAcao.set(lerErroApi(err, 'Erro ao executar a ação.').mensagem);
        // Concorrência (OS já decidida por outra pessoa): recarrega o estado real.
        if (err.status === 400) this.service.obter(os.id).subscribe({ next: o => this.os.set(o) });
      }
    });
  }
}
