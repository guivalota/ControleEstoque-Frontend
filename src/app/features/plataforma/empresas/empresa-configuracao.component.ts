import { Component, OnInit, inject, input, signal } from '@angular/core';
import { PlataformaEmpresaService } from '../../../core/services/plataforma-empresa.service';
import { ConfiguracaoResumo } from '../../../core/models/empresa-perfil.model';
import { formatarCnpj } from '../../../core/utils/cnpj';
import { lerErroApi, textoDoErro } from '../../../core/utils/erros-api';
import { formatarDataHora } from '../../../core/utils/imob-formato';

const ROTULO_PENDENCIA: Record<string, string> = { contato: 'Contato', endereco: 'Endereço', fiscal: 'Fiscal' };

/** Aba "Configuração" do detalhe da empresa (super admin): só identificação e estado, nunca segredos. */
@Component({
  selector: 'app-empresa-configuracao',
  standalone: true,
  template: `
    @if (carregando()) {
      <div class="text-center py-4 text-muted"><div class="spinner-border spinner-border-sm me-2"></div>Carregando...</div>
    } @else if (erro()) {
      <div class="alert alert-danger d-flex justify-content-between align-items-center py-2" role="alert">
        <span>{{ erro() }}</span>
        <button type="button" class="btn btn-sm btn-outline-danger" (click)="carregar()">Tentar novamente</button>
      </div>
    } @else if (resumo()) {
      @let r = resumo()!;
      <dl class="row mb-0">
        <dt class="col-sm-3">Razão social</dt><dd class="col-sm-9">{{ r.razaoSocial }}</dd>
        <dt class="col-sm-3">CNPJ</dt><dd class="col-sm-9">{{ formatarCnpj(r.cnpj) }}</dd>
        <dt class="col-sm-3">Nome fantasia</dt><dd class="col-sm-9">{{ r.nomeFantasia || '—' }}</dd>
        <dt class="col-sm-3">Estado</dt>
        <dd class="col-sm-9">
          @if (r.estado === 'completo') {
            <span class="badge bg-success-subtle text-success">Completo</span>
          } @else {
            <span class="badge bg-warning-subtle text-warning-emphasis">Incompleto</span>
          }
        </dd>
        <dt class="col-sm-3">Pendências</dt>
        <dd class="col-sm-9">
          @if (r.pendencias.length === 0) { Nenhuma } @else {
            @for (p of r.pendencias; track p) { <span class="badge bg-secondary-subtle text-secondary-emphasis me-1">{{ rotulo(p) }}</span> }
          }
        </dd>
        <dt class="col-sm-3">Logo</dt><dd class="col-sm-9">{{ r.temLogo ? 'Sim' : 'Não' }}</dd>
        <dt class="col-sm-3">E-mail verificado</dt><dd class="col-sm-9">{{ r.emailVerificado ? 'Sim' : 'Não' }}</dd>
        <dt class="col-sm-3">Integrações</dt><dd class="col-sm-9">{{ r.integracoes }}</dd>
        <dt class="col-sm-3">Perfil atualizado em</dt><dd class="col-sm-9">{{ formatarDataHora(r.perfilAtualizadoEm) }}</dd>
      </dl>
    }
  `
})
export class EmpresaConfiguracaoComponent implements OnInit {
  private service = inject(PlataformaEmpresaService);
  empresaId = input.required<number>();

  formatarCnpj = formatarCnpj;
  formatarDataHora = formatarDataHora;
  resumo = signal<ConfiguracaoResumo | null>(null);
  carregando = signal(false);
  erro = signal('');

  rotulo = (p: string) => ROTULO_PENDENCIA[p] ?? p;

  ngOnInit() { this.carregar(); }

  carregar() {
    this.carregando.set(true);
    this.erro.set('');
    this.service.configuracaoResumo(this.empresaId()).subscribe({
      next: r => { this.resumo.set(r); this.carregando.set(false); },
      error: err => {
        this.erro.set(textoDoErro(lerErroApi(err, 'Erro ao carregar a configuração.'), 'Erro ao carregar a configuração.'));
        this.carregando.set(false);
      }
    });
  }
}
