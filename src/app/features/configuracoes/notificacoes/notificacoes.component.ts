import { Component, OnInit, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import { EmpresaNotificacaoService } from '../../../core/services/empresa-notificacao.service';
import { UsuarioEmpresaService } from '../../../core/services/usuario-empresa.service';
import {
  DestinatarioNotificacao, DestinatarioRequest, EventoNotificacao
} from '../../../core/models/empresa-config.model';
import { UsuarioEmpresa } from '../../../core/models/usuario-empresa.model';
import { lerErroApi, textoDoErro } from '../../../core/utils/erros-api';

interface EventoVm {
  codigo: string;
  nome: string;
  descricao: string;
  modulo: string;
  destinatarios: DestinatarioNotificacao[];
  salvando: boolean;
  erro: string;
  ok: string;
  erroEmail: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

@Component({
  selector: 'app-config-notificacoes',
  standalone: true,
  template: `
    @if (carregando()) {
      <div class="text-center py-5 text-muted"><div class="spinner-border spinner-border-sm me-2"></div>Carregando...</div>
    } @else if (erroCarga()) {
      <div class="alert alert-danger d-flex justify-content-between align-items-center py-2" role="alert">
        <span>{{ erroCarga() }}</span>
        <button type="button" class="btn btn-sm btn-outline-danger" (click)="carregar()">Tentar novamente</button>
      </div>
    } @else {
      @if (eventos().length === 0) { <div class="text-muted">Nenhum evento de notificação disponível.</div> }
      @for (ev of eventos(); track ev.codigo) {
        <div class="card border-0 shadow-sm mb-3" [attr.data-evento]="ev.codigo">
          <div class="card-header bg-body">
            <div class="fw-semibold">{{ ev.nome }}</div>
            <div class="small text-muted">{{ ev.descricao }}</div>
          </div>
          <div class="card-body">
            @if (ev.destinatarios.length === 0) {
              <div class="alert alert-info py-2 usando-padrao" role="status">Usando padrão: administradores ativos da empresa recebem este aviso. Adicione destinatários para substituir o padrão.</div>
            } @else {
              <ul class="list-group mb-3">
                @for (d of ev.destinatarios; track chave(d)) {
                  <li class="list-group-item d-flex flex-wrap justify-content-between align-items-center gap-2">
                    <div>
                      <span class="fw-medium">{{ d.tipo === 'usuario' ? (d.nome || d.email) : d.email }}</span>
                      @if (d.tipo === 'usuario') { <span class="text-muted small ms-2">{{ d.email }}</span> }
                      <span class="badge text-bg-light border ms-2">{{ d.tipo === 'usuario' ? 'Usuário' : 'E-mail avulso' }}</span>
                      @if (!d.elegivel) {
                        <div class="small text-warning-emphasis inelegivel"><i class="bi bi-exclamation-triangle me-1"></i>Usuário desativado ou desvinculado: a configuração é mantida, mas ele não recebe o aviso.</div>
                      }
                    </div>
                    <div class="d-flex align-items-center gap-3">
                      <div class="form-check form-switch mb-0">
                        <input class="form-check-input" type="checkbox" role="switch" [checked]="d.ativo" [attr.aria-label]="'Ativo: ' + d.email" (change)="alternar(ev.codigo, d)" />
                      </div>
                      <button type="button" class="btn btn-sm btn-outline-danger" data-acao="remover" (click)="remover(ev.codigo, d)">Remover</button>
                    </div>
                  </li>
                }
              </ul>
            }

            <div class="row g-2 align-items-start">
              <div class="col-md-5">
                <select class="form-select form-select-sm sel-usuario" [attr.aria-label]="'Adicionar usuário a ' + ev.nome" #sel>
                  <option value="">Adicionar usuário da empresa...</option>
                  @for (u of usuariosDisponiveis(ev); track u.id) { <option [value]="u.id">{{ u.nome }} ({{ u.email }})</option> }
                </select>
              </div>
              <div class="col-md-1"><button type="button" class="btn btn-sm btn-outline-secondary w-100" data-acao="add-usuario" (click)="adicionarUsuarioDe(ev.codigo, sel)">Adicionar</button></div>
              <div class="col-md-4">
                <input type="email" class="form-control form-control-sm inp-email" placeholder="e-mail avulso" [attr.aria-label]="'E-mail avulso para ' + ev.nome" #inp
                       [class.is-invalid]="!!ev.erroEmail" (keydown.enter)="adicionarEmailDe(ev.codigo, inp); $event.preventDefault()" />
                @if (ev.erroEmail) { <div class="invalid-feedback">{{ ev.erroEmail }}</div> }
              </div>
              <div class="col-md-1"><button type="button" class="btn btn-sm btn-outline-secondary w-100" data-acao="add-email" (click)="adicionarEmailDe(ev.codigo, inp)">Adicionar</button></div>
            </div>

            @if (ev.erro) { <div class="alert alert-danger py-2 mt-3 mb-0" role="alert">{{ ev.erro }}</div> }
            @if (ev.ok) { <div class="alert alert-success py-2 mt-3 mb-0" role="status">{{ ev.ok }}</div> }
            <div class="mt-3">
              <button type="button" class="btn btn-primary" data-acao="salvar" [disabled]="ev.salvando" (click)="salvar(ev.codigo)">
                @if (ev.salvando) { <span class="spinner-border spinner-border-sm me-1"></span> }Salvar destinatários
              </button>
            </div>
          </div>
        </div>
      }
    }
  `
})
export class NotificacoesComponent implements OnInit {
  private service = inject(EmpresaNotificacaoService);
  private usuariosService = inject(UsuarioEmpresaService);

  eventos = signal<EventoVm[]>([]);
  usuarios = signal<UsuarioEmpresa[]>([]);
  carregando = signal(false);
  erroCarga = signal('');


  ngOnInit() { this.carregar(); }

  chave(d: DestinatarioNotificacao) { return d.tipo === 'usuario' ? 'u:' + d.usuarioId : 'e:' + d.email; }

  carregar() {
    this.carregando.set(true);
    this.erroCarga.set('');
    forkJoin({ resp: this.service.obter(), usuarios: this.usuariosService.listarTodos({ ativo: true }) }).subscribe({
      next: ({ resp, usuarios }) => {
        this.usuarios.set(usuarios);
        this.eventos.set(resp.eventos.map(e => this.vm(e)));
        this.carregando.set(false);
      },
      error: err => {
        this.erroCarga.set(textoDoErro(lerErroApi(err, 'Erro ao carregar as notificações.'), 'Erro ao carregar as notificações.'));
        this.carregando.set(false);
      }
    });
  }

  private vm(e: EventoNotificacao): EventoVm {
    return {
      codigo: e.codigo, nome: e.nome, descricao: e.descricao, modulo: e.modulo,
      destinatarios: e.destinatarios.map(d => ({ ...d })), salvando: false, erro: '', ok: '', erroEmail: ''
    };
  }

  private alterar(codigo: string, fn: (ev: EventoVm) => Partial<EventoVm>) {
    this.eventos.update(l => l.map(ev => ev.codigo === codigo ? { ...ev, ok: '', erro: '', ...fn(ev) } : ev));
  }

  usuariosDisponiveis(ev: EventoVm) {
    const usados = new Set(ev.destinatarios.filter(d => d.tipo === 'usuario').map(d => d.usuarioId));
    return this.usuarios().filter(u => !usados.has(u.id));
  }

  adicionarUsuarioDe(codigo: string, sel: HTMLSelectElement) {
    this.adicionarUsuario(codigo, sel.value);
    sel.value = '';
  }

  adicionarEmailDe(codigo: string, inp: HTMLInputElement) {
    this.adicionarEmail(codigo, inp.value);
    if (EMAIL_RE.test(inp.value.trim()) && !this.eventos().find(e => e.codigo === codigo)?.erroEmail) inp.value = '';
  }

  adicionarUsuario(codigo: string, usuarioId: string) {
    const u = this.usuarios().find(x => x.id === usuarioId);
    if (!u) return;
    this.alterar(codigo, ev => ({
      erroEmail: '',
      destinatarios: [...ev.destinatarios, { tipo: 'usuario', usuarioId: u.id, nome: u.nome, email: u.email, ativo: true, elegivel: true }]
    }));
  }

  adicionarEmail(codigo: string, valor: string) {
    const email = (valor ?? '').trim().toLowerCase();
    if (!email) return;
    if (!EMAIL_RE.test(email)) { this.alterar(codigo, () => ({ erroEmail: 'E-mail inválido.' })); return; }
    this.alterar(codigo, ev => {
      if (ev.destinatarios.some(d => d.tipo === 'email' && d.email === email)) return { erroEmail: 'E-mail já adicionado.' };
      return { erroEmail: '', destinatarios: [...ev.destinatarios, { tipo: 'email', usuarioId: null, nome: null, email, ativo: true, elegivel: true }] };
    });
  }

  alternar(codigo: string, d: DestinatarioNotificacao) {
    const k = this.chave(d);
    this.alterar(codigo, ev => ({ destinatarios: ev.destinatarios.map(x => this.chave(x) === k ? { ...x, ativo: !x.ativo } : x) }));
  }

  remover(codigo: string, d: DestinatarioNotificacao) {
    const k = this.chave(d);
    this.alterar(codigo, ev => ({ destinatarios: ev.destinatarios.filter(x => this.chave(x) !== k) }));
  }

  salvar(codigo: string) {
    const ev = this.eventos().find(e => e.codigo === codigo);
    if (!ev) return;
    const destinatarios: DestinatarioRequest[] = ev.destinatarios.map(d =>
      d.tipo === 'usuario' ? { usuarioId: d.usuarioId!, ativo: d.ativo } : { email: d.email, ativo: d.ativo });
    this.alterar(codigo, () => ({ salvando: true }));
    this.service.salvar({ eventos: [{ evento: codigo, destinatarios }] }).subscribe({
      next: resp => {
        const novo = resp.eventos.find(e => e.codigo === codigo);
        this.eventos.update(l => l.map(x => {
          if (x.codigo !== codigo) return x;
          return novo ? { ...this.vm(novo), ok: 'Destinatários salvos.' } : { ...x, salvando: false, ok: 'Destinatários salvos.' };
        }));
      },
      error: err => {
        this.alterar(codigo, () => ({
          salvando: false,
          erro: textoDoErro(lerErroApi(err, 'Erro ao salvar os destinatários.'), 'Erro ao salvar os destinatários.')
        }));
      }
    });
  }
}
