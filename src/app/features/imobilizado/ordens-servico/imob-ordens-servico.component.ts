import { Component, OnInit, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ImobOrdemServicoService } from '../../../core/services/imob-ordem-servico.service';
import { PermissaoService } from '../../../core/services/permissao.service';
import {
  CLASSE_STATUS_OS, ImobOsResumo, ImobOsStatus, ImobOsTipo, ROTULO_STATUS_OS, ROTULO_TIPO_OS, STATUS_OS, TIPOS_OS,
  formatarNumeroOs
} from '../../../core/models/imob-ordem-servico.model';
import { lerErroApi } from '../../../core/utils/erros-api';
import { formatarDataHora } from '../../../core/utils/imob-formato';
import { PaginacaoComponent } from '../shared/paginacao.component';

const PAGE_SIZE = 20;

@Component({
  selector: 'app-imob-ordens-servico',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, PaginacaoComponent],
  templateUrl: './imob-ordens-servico.component.html'
})
export class ImobOrdensServicoComponent implements OnInit {
  private service = inject(ImobOrdemServicoService);
  permissao = inject(PermissaoService);

  readonly pageSize = PAGE_SIZE;
  readonly tipos = TIPOS_OS;
  readonly statusLista = STATUS_OS;
  rotuloTipo = ROTULO_TIPO_OS;
  rotuloStatus = ROTULO_STATUS_OS;
  classeStatus = CLASSE_STATUS_OS;
  formatarNumero = formatarNumeroOs;
  formatarDataHora = formatarDataHora;

  busca = new FormControl('', { nonNullable: true });
  tipo = new FormControl<ImobOsTipo | ''>('', { nonNullable: true });
  status = new FormControl<ImobOsStatus | ''>('', { nonNullable: true });

  itens = signal<ImobOsResumo[]>([]);
  total = signal(0);
  page = signal(1);
  loading = signal(false);
  erro = signal('');

  ngOnInit() {
    this.carregar(1);
  }

  carregar(page = this.page()) {
    this.loading.set(true);
    this.erro.set('');
    this.service.listar({
      busca: this.busca.value.trim() || undefined,
      tipo: this.tipo.value || undefined,
      status: this.status.value || undefined,
      page, pageSize: PAGE_SIZE
    }).subscribe({
      next: r => { this.itens.set(r.items); this.total.set(r.total); this.page.set(r.page); this.loading.set(false); },
      error: err => { this.loading.set(false); this.erro.set(lerErroApi(err, 'Erro ao carregar as ordens de serviço.').mensagem); }
    });
  }
}
