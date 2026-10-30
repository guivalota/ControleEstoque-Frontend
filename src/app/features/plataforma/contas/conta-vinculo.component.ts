import { Component, OnInit, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PlataformaEmpresaService } from '../../../core/services/plataforma-empresa.service';
import { PlataformaVinculoService } from '../../../core/services/plataforma-vinculo.service';
import { PlataformaEmpresa } from '../../../core/models/plataforma-empresa.model';
import { ImobPerfil, PERFIS_IMOB, ROTULO_PERFIL } from '../../../core/models/imob-empresa.model';
import { User } from '../../../core/models/user.model';
import { lerErroApi, textoDoErro } from '../../../core/utils/erros-api';
import { formatarCnpj } from '../../../core/utils/cnpj';

export type AcaoVinculo = 'vincular' | 'desvincular' | 'transferir';

/**
 * Vincular, desvincular ou transferir uma conta entre empresas (D-031/D-035: um usuário, uma empresa).
 * O servidor não informa a empresa atual da conta: para desvincular/transferir o super admin escolhe a origem.
 * Transferir = desvincula da origem e vincula ao destino; erros 400 aparecem como vieram.
 */
@Component({
  selector: 'app-conta-vinculo',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="card border-0 shadow-sm mb-3" role="region" aria-label="Vínculo com empresa">
      <div class="card-body">
        <div class="d-flex justify-content-between align-items-start mb-2">
          <div>
            <h6 class="fw-bold mb-0">Vínculo de {{ conta().nome }}</h6>
            <small class="text-muted">{{ conta().email }}</small>
          </div>
          <button type="button" class="btn-close" aria-label="Fechar" (click)="fechar.emit()"></button>
        </div>

        @if (erro()) {
          <div class="alert alert-danger py-2" role="alert">{{ erro() }}</div>
        }

        <div class="row g-2 align-items-end">
          <div class="col-md-3">
            <label for="vincAcao" class="form-label small mb-1">Ação</label>
            <select id="vincAcao" class="form-select form-select-sm" [ngModel]="acao()" (ngModelChange)="acao.set($event)">
              <option value="vincular">Vincular a uma empresa</option>
              <option value="transferir">Transferir para outra empresa</option>
              <option value="desvincular">Desvincular de uma empresa</option>
            </select>
          </div>
          @if (acao() !== 'vincular') {
            <div class="col-md-3">
              <label for="vincOrigem" class="form-label small mb-1">Empresa atual da conta *</label>
              <select id="vincOrigem" class="form-select form-select-sm" [ngModel]="origem()" (ngModelChange)="origem.set($event)">
                <option [ngValue]="null">Selecione...</option>
                @for (e of empresas(); track e.id) { <option [ngValue]="e.id">{{ rotulo(e) }}</option> }
              </select>
            </div>
          }
          @if (acao() !== 'desvincular') {
            <div class="col-md-3">
              <label for="vincDestino" class="form-label small mb-1">Empresa de destino *</label>
              <select id="vincDestino" class="form-select form-select-sm" [ngModel]="destino()" (ngModelChange)="destino.set($event)">
                <option [ngValue]="null">Selecione...</option>
                @for (e of empresas(); track e.id) { <option [ngValue]="e.id">{{ rotulo(e) }}</option> }
              </select>
            </div>
            <div class="col-md-2">
              <label for="vincPerfil" class="form-label small mb-1">Perfil</label>
              <select id="vincPerfil" class="form-select form-select-sm" [ngModel]="perfil()" (ngModelChange)="perfil.set($event)">
                <option [ngValue]="null">Padrão do servidor</option>
                @for (p of perfis; track p) { <option [ngValue]="p">{{ rotuloPerfil[p] }}</option> }
              </select>
            </div>
          }
          <div class="col-md-auto">
            <button type="button" class="btn btn-primary btn-sm" [disabled]="salvando()" (click)="executar()">
              @if (salvando()) { <span class="spinner-border spinner-border-sm me-1"></span> }
              Confirmar
            </button>
          </div>
        </div>
      </div>
    </div>
  `
})
export class ContaVinculoComponent implements OnInit {
  private empresasService = inject(PlataformaEmpresaService);
  private vinculo = inject(PlataformaVinculoService);

  conta = input.required<User>();
  concluido = output<string>();
  fechar = output<void>();

  perfis = PERFIS_IMOB;
  rotuloPerfil = ROTULO_PERFIL;

  empresas = signal<PlataformaEmpresa[]>([]);
  acao = signal<AcaoVinculo>('vincular');
  origem = signal<number | null>(null);
  destino = signal<number | null>(null);
  perfil = signal<ImobPerfil | null>(null);
  salvando = signal(false);
  erro = signal('');

  ngOnInit() {
    this.empresasService.listar(1, 100).subscribe({
      next: r => this.empresas.set(r.items),
      error: err => this.erro.set(textoDoErro(lerErroApi(err, 'Erro ao carregar as empresas.'), 'Erro ao carregar as empresas.'))
    });
  }

  rotulo(e: PlataformaEmpresa) {
    return `${e.nomeFantasia || e.razaoSocial} (${formatarCnpj(e.cnpj)})${e.ativo ? '' : ' - bloqueada'}`;
  }

  executar() {
    const acao = this.acao();
    const origem = this.origem();
    const destino = this.destino();
    if ((acao !== 'vincular' && origem == null) || (acao !== 'desvincular' && destino == null)) {
      this.erro.set('Selecione a empresa.');
      return;
    }
    if (acao === 'transferir' && origem === destino) {
      this.erro.set('A empresa de destino deve ser diferente da atual.');
      return;
    }
    this.erro.set('');
    this.salvando.set(true);
    const id = this.conta().id;
    const falha = (err: unknown, complemento = '') => {
      const base = textoDoErro(lerErroApi(err, 'Não foi possível concluir a operação.'), 'Não foi possível concluir a operação.');
      this.erro.set(complemento ? `${base} ${complemento}` : base);
      this.salvando.set(false);
    };
    const vincular = () => this.vinculo.vincular(destino!, id, this.perfil()).subscribe({
      next: () => this.finalizar(acao === 'transferir' ? 'Conta transferida.' : 'Conta vinculada.'),
      error: err => falha(err, acao === 'transferir'
        ? 'A conta já foi desvinculada da empresa atual; tente vincular ao destino de novo.' : '')
    });
    if (acao === 'vincular') {
      vincular();
    } else {
      this.vinculo.desvincular(origem!, id).subscribe({
        next: () => (acao === 'desvincular' ? this.finalizar('Conta desvinculada.') : vincular()),
        error: err => falha(err)
      });
    }
  }

  private finalizar(msg: string) {
    this.salvando.set(false);
    this.concluido.emit(msg);
  }
}
