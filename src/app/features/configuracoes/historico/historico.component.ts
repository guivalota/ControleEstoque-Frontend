import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { EmpresaPerfilService } from '../../../core/services/empresa-perfil.service';
import { AREAS_CONFIG, ConfigEvento } from '../../../core/models/empresa-perfil.model';
import { lerErroApi, textoDoErro } from '../../../core/utils/erros-api';
import { formatarDataHora } from '../../../core/utils/imob-formato';
import {
  AVISO_INTERVALO_INVERTIDO, fimDoDiaLocalISO, inicioDoDiaLocalISO, intervaloInvertido
} from '../../../core/utils/periodo';
import { PaginacaoComponent } from '../../imobilizado/shared/paginacao.component';

@Component({
  selector: 'app-config-historico',
  standalone: true,
  imports: [FormsModule, PaginacaoComponent],
  template: `
    <div class="card border-0 shadow-sm">
      <div class="card-body">
        <form class="row g-2 align-items-end mb-3" (ngSubmit)="filtrar()">
          <div class="col-md-3">
            <label class="form-label small mb-1" for="hist-area">Área</label>
            <select id="hist-area" class="form-select form-select-sm" name="area" [(ngModel)]="area">
              <option value="">Todas</option>
              @for (a of areas; track a.codigo) { <option [value]="a.codigo">{{ a.nome }}</option> }
            </select>
          </div>
          <div class="col-md-3">
            <label class="form-label small mb-1" for="hist-ini">De</label>
            <input id="hist-ini" type="date" class="form-control form-control-sm" name="inicio" [(ngModel)]="inicio" />
          </div>
          <div class="col-md-3">
            <label class="form-label small mb-1" for="hist-fim">Até</label>
            <input id="hist-fim" type="date" class="form-control form-control-sm" name="fim" [(ngModel)]="fim" />
          </div>
          <div class="col-md-3 d-flex gap-2">
            <button type="submit" class="btn btn-sm btn-primary">Filtrar</button>
            <button type="button" class="btn btn-sm btn-outline-secondary" (click)="limpar()">Limpar</button>
          </div>
        </form>

        @if (aviso()) { <div class="alert alert-warning py-2" role="alert">{{ aviso() }}</div> }
        @if (erro()) { <div class="alert alert-danger py-2" role="alert">{{ erro() }}</div> }

        @if (carregando()) {
          <div class="text-center py-4 text-muted"><div class="spinner-border spinner-border-sm me-2"></div>Carregando...</div>
        } @else if (itens().length === 0 && !erro()) {
          <p class="text-muted text-center py-4 mb-0">Nenhuma alteração registrada.</p>
        } @else if (itens().length > 0) {
          <div class="table-responsive">
            <table class="table table-sm align-middle mb-0">
              <thead><tr><th>Quando</th><th>Quem</th><th>Área</th><th>Ação</th><th>Campos</th><th>Detalhe</th></tr></thead>
              <tbody>
                @for (e of itens(); track e.id) {
                  <tr>
                    <td class="text-nowrap">{{ formatarDataHora(e.criadoEm) }}</td>
                    <td>{{ e.atorNome || '—' }}</td>
                    <td>{{ nomeArea(e.area) }}</td>
                    <td>{{ e.acao }}</td>
                    <td>{{ e.campo || '—' }}</td>
                    <td>{{ e.detalhe || '—' }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <app-paginacao [page]="page()" [pageSize]="pageSize" [total]="total()" [disabled]="carregando()" (mudar)="ir($event)" />
        }
      </div>
    </div>
  `
})
export class HistoricoComponent implements OnInit {
  private service = inject(EmpresaPerfilService);

  readonly areas = AREAS_CONFIG;
  readonly pageSize = 50;
  formatarDataHora = formatarDataHora;

  area = '';
  inicio = '';
  fim = '';

  itens = signal<ConfigEvento[]>([]);
  total = signal(0);
  page = signal(1);
  carregando = signal(false);
  erro = signal('');
  aviso = signal('');

  ngOnInit() { this.carregar(1); }

  nomeArea(codigo: string) {
    return this.areas.find(a => a.codigo === codigo)?.nome ?? codigo;
  }

  filtrar() {
    if (intervaloInvertido(this.inicio, this.fim)) { this.aviso.set(AVISO_INTERVALO_INVERTIDO); return; }
    this.aviso.set('');
    this.carregar(1);
  }

  limpar() {
    this.area = ''; this.inicio = ''; this.fim = '';
    this.aviso.set('');
    this.carregar(1);
  }

  ir(p: number) { this.carregar(p); }

  carregar(page: number) {
    this.carregando.set(true);
    this.erro.set('');
    this.service.historico({
      area: this.area || undefined,
      dataInicio: inicioDoDiaLocalISO(this.inicio),
      dataFim: fimDoDiaLocalISO(this.fim),
      page, pageSize: this.pageSize
    }).subscribe({
      next: r => { this.itens.set(r.items); this.total.set(r.total); this.page.set(r.page || page); this.carregando.set(false); },
      error: err => {
        this.erro.set(textoDoErro(lerErroApi(err, 'Erro ao carregar o histórico.'), 'Erro ao carregar o histórico.'));
        this.itens.set([]);
        this.carregando.set(false);
      }
    });
  }
}
