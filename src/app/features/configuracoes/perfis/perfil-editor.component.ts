import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { PerfilAcessoService } from '../../../core/services/perfil-acesso.service';
import { PermissaoService } from '../../../core/services/permissao.service';
import { CatalogoModulo, CatalogoPermissao, CatalogoPermissoes, PerfilAcessoDetalhe, ROTULO_MODULO } from '../../../core/models/perfil-acesso.model';
import { Permissao } from '../../../core/models/permissoes';
import { alternarPermissao, colunasDoModulo, indexarCatalogo, rotuloDaAcao } from '../../../core/utils/perfil-matriz';
import { lerErroApi } from '../../../core/utils/erros-api';

/**
 * Editor de perfil: nome, descrição e a matriz módulo × recurso × ação. Só aparecem os módulos ligados na empresa; marcar uma
 * ação marca o que ela exige; ações sensíveis ficam destacadas; o que o próprio usuário não tem não pode ser concedido.
 */
@Component({
  selector: 'app-perfil-editor',
  standalone: true,
  imports: [ReactiveFormsModule],
  styles: [`
    .matriz th, .matriz td { white-space: nowrap; }
    .matriz td.cel { text-align: center; width: 5.5rem; }
    .matriz td.sensivel { background: var(--bs-warning-bg-subtle); }
    .matriz td.vazia { background: var(--bs-tertiary-bg); }
  `],
  template: `
    <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
      <h6 class="fw-bold mb-0">{{ titulo() }}</h6>
      <button type="button" class="btn btn-outline-secondary btn-sm" (click)="cancelar.emit()">
        <i class="bi bi-arrow-left me-1"></i>Voltar aos perfis
      </button>
    </div>

    @if (erro()) { <div class="alert alert-danger py-2" role="alert">{{ erro() }}</div> }

    @if (carregando()) {
      <div class="text-center py-4 text-muted"><div class="spinner-border spinner-border-sm me-2"></div>Carregando...</div>
    } @else if (catalogo()) {
      @if (administrador()) {
        <div class="alert alert-info py-2" role="status">
          <i class="bi bi-lock me-1"></i>O <strong>Administrador</strong> tem todas as permissões, inclusive as que forem criadas no futuro.
          Não pode ser alterado.
        </div>
      }
      <form [formGroup]="form" (submit)="$event.preventDefault(); salvar()" novalidate>
        <div class="row g-2 mb-3">
          <div class="col-md-4">
            <label for="pfNome" class="form-label small mb-1">Nome *</label>
            <input id="pfNome" class="form-control form-control-sm" formControlName="nome" maxlength="80"
                   [class.is-invalid]="form.controls.nome.touched && form.controls.nome.invalid">
            <div class="invalid-feedback">Informe o nome do perfil.</div>
            @if (nomeFixo()) { <div class="form-text">O nome de um perfil padrão não muda.</div> }
          </div>
          <div class="col-md-8">
            <label for="pfDesc" class="form-label small mb-1">Descrição</label>
            <input id="pfDesc" class="form-control form-control-sm" formControlName="descricao" maxlength="255">
          </div>
        </div>

        <div class="d-flex flex-wrap align-items-center gap-3 small text-muted mb-2">
          <span><strong>{{ selecionadas().size }}</strong> permissão(ões) marcada(s)</span>
          <span><span class="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle">sensível</span> ação de risco (excluir, aprovar, fechar, credenciais…)</span>
          <span><i class="bi bi-lock me-1"></i>essencial: necessária para entrar no sistema</span>
        </div>

        @for (m of catalogo()!.modulos; track m.modulo) {
          <div class="card border-0 shadow-sm mb-3">
            <div class="card-header bg-transparent fw-bold">{{ rotuloModulo(m.modulo) }}</div>
            <div class="table-responsive">
              <table class="table table-sm table-hover align-middle mb-0 matriz">
                <thead class="table-light">
                  <tr>
                    <th class="ps-3">Recurso</th>
                    <th class="text-center px-1">Tudo</th>
                    @for (a of colunas(m); track a) {
                      <th class="text-center">
                        {{ rotuloAcao(a) }}
                        @if (!somenteLeitura()) {
                          <button type="button" class="btn btn-link btn-sm p-0 ms-1" (click)="marcarColuna(m, a)"
                                  [attr.aria-label]="'Marcar ou desmarcar a coluna ' + rotuloAcao(a) + ' em ' + rotuloModulo(m.modulo)"
                                  title="Marcar/desmarcar a coluna"><i class="bi bi-check2-square"></i></button>
                        }
                      </th>
                    }
                  </tr>
                </thead>
                <tbody>
                  @for (r of m.recursos; track r.recurso) {
                    <tr>
                      <td class="ps-3">{{ r.rotulo }}</td>
                      <td class="text-center px-1">
                        <input type="checkbox" class="form-check-input" [checked]="linhaCompleta(r.permissoes)"
                               [disabled]="somenteLeitura()" (change)="marcarLinha(r.permissoes, $any($event.target).checked)"
                               [attr.aria-label]="'Marcar todas as ações de ' + r.rotulo">
                      </td>
                      @for (a of colunas(m); track a) {
                        @let p = permissaoDe(r.permissoes, a);
                        @if (p) {
                          <td class="cel" [class.sensivel]="p.sensivel">
                            <input type="checkbox" class="form-check-input" [checked]="selecionadas().has(p.codigo)"
                                   [disabled]="desabilitada(p)" [title]="p.descricao" [attr.aria-label]="p.descricao"
                                   (change)="alternar(p, $any($event.target).checked)">
                            @if (p.essencial) { <i class="bi bi-lock small text-muted ms-1" title="Essencial"></i> }
                          </td>
                        } @else {
                          <td class="cel vazia"></td>
                        }
                      }
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        }

        @if (!somenteLeitura()) {
          <div class="d-flex gap-2">
            <button type="submit" class="btn btn-primary btn-sm" [disabled]="salvando()">
              @if (salvando()) { <span class="spinner-border spinner-border-sm me-1"></span> }
              Salvar perfil
            </button>
            <button type="button" class="btn btn-outline-secondary btn-sm" (click)="cancelar.emit()">Cancelar</button>
          </div>
        }
      </form>
    }
  `
})
export class PerfilEditorComponent implements OnInit {
  private fb = inject(FormBuilder);
  private api = inject(PerfilAcessoService);
  private permissao = inject(PermissaoService);

  /** Perfil a editar; nulo = novo. */
  perfilId = input<number | null>(null);
  /** Novo perfil nascendo da cópia de outro. */
  copiarDeId = input<number | null>(null);
  salvo = output<PerfilAcessoDetalhe>();
  cancelar = output<void>();

  carregando = signal(true);
  salvando = signal(false);
  erro = signal('');
  catalogo = signal<CatalogoPermissoes | null>(null);
  perfil = signal<PerfilAcessoDetalhe | null>(null);
  selecionadas = signal<ReadonlySet<string>>(new Set());
  private indice = computed(() => indexarCatalogo(this.catalogo()));

  administrador = computed(() => !!this.perfil()?.todasPermissoes);
  nomeFixo = computed(() => !!this.perfil()?.sistema);
  somenteLeitura = computed(() => this.administrador() || !this.permissao.pode('core.acesso.gerir'));
  titulo = computed(() => {
    const p = this.perfil();
    if (p) return this.somenteLeitura() ? `Perfil ${p.nome}` : `Editar perfil ${p.nome}`;
    return this.copiarDeId() ? 'Novo perfil (cópia)' : 'Novo perfil';
  });

  form = this.fb.group({
    nome: ['', [Validators.required, Validators.maxLength(80)]],
    descricao: ['']
  });

  ngOnInit() {
    const id = this.perfilId() ?? this.copiarDeId();
    this.api.catalogo().subscribe({
      next: c => {
        this.catalogo.set(c);
        if (id === null) { this.carregando.set(false); this.aplicarEssenciais(); return; }
        this.api.obter(id).subscribe({
          next: p => this.abrirPerfil(p),
          error: err => this.falhar(err, 'Erro ao carregar o perfil.')
        });
      },
      error: err => this.falhar(err, 'Erro ao carregar o catálogo de permissões.')
    });
  }

  private abrirPerfil(p: PerfilAcessoDetalhe) {
    const copia = this.perfilId() === null;
    this.perfil.set(copia ? null : p);
    this.form.patchValue({ nome: copia ? `${p.nome} (cópia)` : p.nome, descricao: p.descricao ?? '' });
    this.selecionadas.set(new Set(p.todasPermissoes ? this.indice().keys() : p.permissoes));
    if (this.nomeFixo() || this.somenteLeitura()) this.form.controls.nome.disable();
    if (this.somenteLeitura()) this.form.controls.descricao.disable();
    this.aplicarEssenciais();
    this.carregando.set(false);
  }

  private aplicarEssenciais() {
    const s = new Set(this.selecionadas());
    for (const [cod, p] of this.indice()) if (p.essencial) s.add(cod);
    this.selecionadas.set(s);
  }

  private falhar(err: unknown, padrao: string) {
    this.erro.set(lerErroApi(err, padrao).mensagem);
    this.carregando.set(false);
  }

  rotuloModulo = (m: string) => ROTULO_MODULO[m] ?? m;
  rotuloAcao = rotuloDaAcao;
  colunas = (m: CatalogoModulo) => colunasDoModulo(m.recursos);
  permissaoDe = (lista: CatalogoPermissao[], acao: string) => lista.find(p => p.acao === acao);

  /** Essencial fica sempre marcada; e só se concede o que o próprio usuário tem (o servidor também confere). */
  desabilitada(p: CatalogoPermissao): boolean {
    return this.somenteLeitura() || p.essencial || !this.permissao.pode(p.codigo as Permissao);
  }

  alternar(p: CatalogoPermissao, marcar: boolean) {
    this.selecionadas.set(alternarPermissao(this.selecionadas(), this.indice(), p.codigo, marcar));
  }

  linhaCompleta(lista: CatalogoPermissao[]) {
    const editaveis = lista.filter(p => !this.desabilitada(p));
    return editaveis.length > 0 && editaveis.every(p => this.selecionadas().has(p.codigo));
  }

  marcarLinha(lista: CatalogoPermissao[], marcar: boolean) {
    this.aplicarEmLote(lista.filter(p => !this.desabilitada(p)), marcar);
  }

  marcarColuna(m: CatalogoModulo, acao: string) {
    const alvo = m.recursos.map(r => this.permissaoDe(r.permissoes, acao)).filter((p): p is CatalogoPermissao => !!p && !this.desabilitada(p));
    if (alvo.length === 0) return;
    this.aplicarEmLote(alvo, !alvo.every(p => this.selecionadas().has(p.codigo)));
  }

  private aplicarEmLote(alvo: CatalogoPermissao[], marcar: boolean) {
    let s: ReadonlySet<string> = this.selecionadas();
    for (const p of alvo) s = alternarPermissao(s, this.indice(), p.codigo, marcar);
    this.selecionadas.set(s);
  }

  salvar() {
    if (this.somenteLeitura()) return;
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const v = this.form.getRawValue();
    const req = { nome: (v.nome ?? '').trim(), descricao: (v.descricao ?? '').trim() || null, permissoes: [...this.selecionadas()].sort() };
    this.salvando.set(true);
    this.erro.set('');
    const id = this.perfil()?.id;
    (id === undefined ? this.api.criar(req) : this.api.atualizar(id, req)).subscribe({
      next: p => { this.salvando.set(false); this.salvo.emit(p); },
      error: err => { this.salvando.set(false); this.erro.set(lerErroApi(err, 'Erro ao salvar o perfil.').mensagem); }
    });
  }
}
