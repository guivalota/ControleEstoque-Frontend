import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AprovacaoService } from '../../core/services/aprovacao.service';
import { PermissaoService } from '../../core/services/permissao.service';
import { ToastService } from '../../core/services/toast.service';
import { Aprovacao, ROTULO_STATUS_APROVACAO, StatusAprovacao, rotaDaEntidade } from '../../core/models/aprovacao.model';
import { formatarDataHora, formatarMoeda } from '../../core/utils/imob-formato';
import { lerErroApi, textoDoErro } from '../../core/utils/erros-api';

/**
 * Caixa de aprovações (US-22-07): pedidos de qualquer módulo que registre um tipo de aprovação. Quem lançou o pedido não decide o
 * próprio (o servidor recusa e o botão nem aparece). Recusar exige o motivo.
 */
@Component({
  selector: 'app-aprovacoes',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <h1 class="h4 mb-3">Aprovações</h1>
    <ul class="nav nav-tabs mb-3" role="tablist">
      @for (s of abas; track s.valor) {
        <li class="nav-item" role="presentation">
          <button type="button" class="nav-link" role="tab" [class.active]="status() === s.valor" [attr.aria-selected]="status() === s.valor" (click)="trocar(s.valor)">{{ s.rotulo }}</button>
        </li>
      }
    </ul>
    @if (erro()) { <div class="alert alert-danger" role="alert">{{ erro() }}</div> }

    <div class="table-responsive">
      <table class="table table-hover align-middle">
        <thead><tr><th>Pedido</th><th>Tipo</th><th class="text-end">Valor</th><th>Solicitante</th><th>Quando</th><th>Situação</th><th></th></tr></thead>
        <tbody>
          @for (a of itens(); track a.id) {
            <tr>
              <td>{{ a.titulo }}</td><td>{{ a.tipoNome }}</td><td class="text-end">{{ moeda(a.valor) }}</td><td>{{ a.solicitanteNome || '—' }}</td><td>{{ dataHora(a.criadoEm) }}</td>
              <td>
                <span class="badge" [class]="classe(a)">{{ rotulo(a.status) }}</span>
                @if (a.status !== 'pendente') { <div class="small text-secondary">{{ a.decisorNome }}{{ a.decisaoMotivo ? ': ' + a.decisaoMotivo : '' }}</div> }
              </td>
              <td class="text-end text-nowrap">
                @if (rota(a); as r) { <a class="btn btn-sm btn-outline-primary me-1" [routerLink]="r" [attr.aria-label]="'Abrir ' + a.titulo">Abrir</a> }
                @if (a.status === 'pendente' && permissao.pode('core.aprovacoes.decidir')) {
                  @if (a.podeDecidir) {
                    <button type="button" class="btn btn-sm btn-success me-1" [attr.aria-label]="'Aprovar ' + a.titulo" [disabled]="salvando()" (click)="aprovar(a)">Aprovar</button>
                    <button type="button" class="btn btn-sm btn-outline-danger" [attr.aria-label]="'Recusar ' + a.titulo" (click)="recusando.set(a); motivo = ''">Recusar</button>
                  } @else {
                    <span class="small text-secondary">Peça a outro administrador</span>
                  }
                }
              </td>
            </tr>
            @if (recusando()?.id === a.id) {
              <tr>
                <td colspan="7">
                  <form class="d-flex flex-wrap gap-2 align-items-end" (submit)="$event.preventDefault(); recusar(a)">
                    <div class="flex-grow-1"><label class="form-label small mb-1" for="rMotivo">Motivo da recusa</label><input id="rMotivo" class="form-control form-control-sm" name="motivo" [(ngModel)]="motivo" maxlength="500"></div>
                    <button type="submit" class="btn btn-danger btn-sm" [disabled]="salvando() || !motivo.trim()">Confirmar recusa</button>
                    <button type="button" class="btn btn-outline-primary btn-sm" (click)="recusando.set(null)">Voltar</button>
                  </form>
                </td>
              </tr>
            }
          } @empty { <tr><td colspan="7" class="text-secondary">{{ carregando() ? 'Carregando…' : 'Nenhum pedido nesta situação.' }}</td></tr> }
        </tbody>
      </table>
    </div>
  `
})
export class AprovacoesComponent implements OnInit {
  private service = inject(AprovacaoService);
  private toast = inject(ToastService);
  private rotaAtiva = inject(ActivatedRoute);
  permissao = inject(PermissaoService);

  readonly abas: { valor: StatusAprovacao | ''; rotulo: string }[] = [
    { valor: 'pendente', rotulo: 'Pendentes' }, { valor: 'aprovada', rotulo: 'Aprovadas' }, { valor: 'recusada', rotulo: 'Recusadas' }, { valor: '', rotulo: 'Todas' }
  ];

  itens = signal<Aprovacao[]>([]);
  status = signal<StatusAprovacao | ''>('pendente');
  recusando = signal<Aprovacao | null>(null);
  carregando = signal(false);
  salvando = signal(false);
  erro = signal('');
  motivo = '';

  ngOnInit() {
    const s = this.rotaAtiva.snapshot.queryParamMap.get('status');
    if (s !== null) this.status.set(s as StatusAprovacao | '');
    this.carregar();
  }

  trocar(s: StatusAprovacao | '') { this.status.set(s); this.recusando.set(null); this.carregar(); }

  private carregar() {
    this.carregando.set(true);
    this.erro.set('');
    this.service.listar(this.status()).subscribe({
      next: r => { this.itens.set(r.items); this.carregando.set(false); },
      error: e => { this.carregando.set(false); this.erro.set(textoDoErro(lerErroApi(e, 'Não foi possível carregar as aprovações.'), 'Não foi possível carregar as aprovações.')); }
    });
  }

  private decidir(a: Aprovacao, aprovar: boolean, motivo: string | null, mensagem: string) {
    this.salvando.set(true);
    this.service.decidir(a.id, { aprovar, motivo }).subscribe({
      next: () => { this.salvando.set(false); this.recusando.set(null); this.toast.sucesso(mensagem); this.carregar(); },
      error: e => { this.salvando.set(false); this.toast.erro(textoDoErro(lerErroApi(e, 'Não foi possível registrar a decisão.'), 'Não foi possível registrar a decisão.')); }
    });
  }

  aprovar(a: Aprovacao) { this.decidir(a, true, null, 'Pedido aprovado.'); }
  recusar(a: Aprovacao) { this.decidir(a, false, this.motivo.trim(), 'Pedido recusado.'); }

  moeda(v: number | null) { return formatarMoeda(v); }
  dataHora(iso: string) { return formatarDataHora(iso); }
  rotulo(s: StatusAprovacao) { return ROTULO_STATUS_APROVACAO[s]; }
  rota(a: Aprovacao) { return rotaDaEntidade(a); }
  classe(a: Aprovacao) { return { pendente: 'text-bg-warning', aprovada: 'text-bg-success', recusada: 'text-bg-danger', cancelada: 'text-bg-secondary' }[a.status]; }
}
