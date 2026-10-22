import { Component, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ImobEmpresaService } from '../../../core/services/imob-empresa.service';
import { EmpresaAtivaService } from '../../../core/services/empresa-ativa.service';
import { UserService } from '../../../core/services/user.service';
import { ImobEmpresa, ImobUsuarioEmpresa } from '../../../core/models/imob-empresa.model';
import { User } from '../../../core/models/user.model';
import { lerErroApi } from '../../../core/utils/erros-api';
import { ConfirmDialogComponent } from '../shared/confirm-dialog.component';

const MAX_SUGESTOES = 8;

@Component({
  selector: 'app-imob-empresa-usuarios',
  standalone: true,
  imports: [DatePipe, RouterLink, ConfirmDialogComponent],
  templateUrl: './imob-empresa-usuarios.component.html'
})
export class ImobEmpresaUsuariosComponent implements OnInit {
  private service = inject(ImobEmpresaService);
  private userService = inject(UserService);
  private minhasEmpresas = inject(EmpresaAtivaService);
  private route = inject(ActivatedRoute);
  private confirmDialog = viewChild.required(ConfirmDialogComponent);

  empresaId = Number(this.route.snapshot.paramMap.get('id'));
  /** Vem do estado da navegação a partir da lista; não existe GET de empresa por id na API. */
  empresa: ImobEmpresa | null =
    (inject(Router).getCurrentNavigation()?.extras.state?.['empresa'] as ImobEmpresa | undefined) ?? null;

  vinculos = signal<ImobUsuarioEmpresa[]>([]);
  loading = signal(false);
  erro = signal('');
  feedback = signal('');
  agindo = signal<string | null>(null);

  termo = signal('');
  selecionado = signal<User | null>(null);
  vinculando = signal(false);

  sugestoes = computed(() => {
    const t = this.termo().trim().toLowerCase();
    const jaVinculados = new Set(this.vinculos().filter(v => v.ativo).map(v => v.usuarioId));
    if (!t || this.selecionado()) return [];
    return this.userService.users()
      .filter(u => u.ativo && !jaVinculados.has(u.id) &&
        (u.nome.toLowerCase().includes(t) || u.email.toLowerCase().includes(t)))
      .slice(0, MAX_SUGESTOES);
  });

  ngOnInit() {
    this.userService.getAll().subscribe({ error: () => this.erro.set('Erro ao carregar a lista de usuários do sistema.') });
    this.carregar();
  }

  carregar() {
    this.loading.set(true);
    this.erro.set('');
    this.service.usuarios(this.empresaId).subscribe({
      next: lista => { this.vinculos.set(lista); this.loading.set(false); },
      error: err => {
        this.erro.set(lerErroApi(err, 'Erro ao carregar usuários da empresa.').mensagem);
        this.loading.set(false);
      }
    });
  }

  escolher(u: User) {
    this.selecionado.set(u);
    this.termo.set(`${u.nome} (${u.email})`);
  }

  limparSelecao() {
    this.selecionado.set(null);
    this.termo.set('');
  }

  aoDigitar(valor: string) {
    this.selecionado.set(null);
    this.termo.set(valor);
  }

  vincular(usuarioId: string) {
    this.vinculando.set(true);
    this.erro.set('');
    this.service.vincular(this.empresaId, usuarioId).subscribe({
      next: () => {
        this.vinculando.set(false);
        this.limparSelecao();
        this.feedback.set('Usuário vinculado.');
        this.carregar();
        this.minhasEmpresas.carregar().subscribe();
      },
      error: err => {
        this.vinculando.set(false);
        this.erro.set(lerErroApi(err, 'Erro ao vincular usuário.').mensagem);
      }
    });
  }

  async desvincular(v: ImobUsuarioEmpresa) {
    const ok = await this.confirmDialog().abrir({
      titulo: 'Desvincular usuário',
      mensagem: `Desvincular ${v.nome}? O acesso a esta empresa é perdido imediatamente.`,
      confirmar: 'Desvincular',
      perigo: true
    });
    if (!ok) return;
    this.agindo.set(v.usuarioId);
    this.service.desvincular(this.empresaId, v.usuarioId).subscribe({
      next: () => {
        this.agindo.set(null);
        this.feedback.set('Usuário desvinculado.');
        this.carregar();
        this.minhasEmpresas.carregar().subscribe();
      },
      error: err => {
        this.agindo.set(null);
        this.erro.set(lerErroApi(err, 'Erro ao desvincular usuário.').mensagem);
      }
    });
  }
}
