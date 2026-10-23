import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ImobInventarioService } from '../../../core/services/imob-inventario.service';
import { PermissaoService } from '../../../core/services/permissao.service';
import {
  CLASSE_STATUS_INVENTARIO, ImobInventarioFiltro, ImobInventarioResumo, ImobInventarioStatus,
  ROTULO_STATUS_INVENTARIO, STATUS_INVENTARIO, inventarioEditavel
} from '../../../core/models/imob-inventario.model';
import { lerErroApi } from '../../../core/utils/erros-api';
import { formatarData } from '../../../core/utils/imob-formato';
import { PaginacaoComponent } from '../shared/paginacao.component';

const PAGE_SIZE = 50;

@Component({
  selector: 'app-imob-inventarios',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, PaginacaoComponent],
  templateUrl: './imob-inventarios.component.html'
})
export class ImobInventariosComponent implements OnInit {
  private fb = inject(FormBuilder);
  private service = inject(ImobInventarioService);
  permissao = inject(PermissaoService);

  readonly pageSize = PAGE_SIZE;
  readonly statusLista = STATUS_INVENTARIO;
  rotuloStatus = ROTULO_STATUS_INVENTARIO;
  classeStatus = CLASSE_STATUS_INVENTARIO;
  formatarData = formatarData;
  inventarioEditavel = inventarioEditavel;

  inventarios = signal<ImobInventarioResumo[]>([]);
  total = signal(0);
  page = signal(1);
  loading = signal(false);
  erro = signal('');

  filtros = this.fb.group({ busca: [''], status: ['' as ImobInventarioStatus | ''] });
  private filtroAtivo: ImobInventarioFiltro = {};

  ngOnInit() {
    this.carregar(1);
  }

  /** Aplica os filtros digitados e volta à primeira página. */
  filtrar() {
    const v = this.filtros.getRawValue();
    this.filtroAtivo = { busca: v.busca?.trim() || undefined, status: v.status || undefined };
    this.carregar(1);
  }

  limpar() {
    this.filtros.reset({ busca: '', status: '' });
    this.filtrar();
  }

  temFiltro(): boolean {
    return Object.values(this.filtroAtivo).some(v => v !== undefined);
  }

  carregar(page = this.page()) {
    this.loading.set(true);
    this.erro.set('');
    this.service.listar({ ...this.filtroAtivo, page, pageSize: PAGE_SIZE }).subscribe({
      next: res => {
        this.inventarios.set(res.items);
        this.total.set(res.total);
        this.page.set(page);
        this.loading.set(false);
      },
      error: err => {
        this.erro.set(lerErroApi(err, 'Erro ao carregar inventários.').mensagem);
        this.loading.set(false);
      }
    });
  }
}
