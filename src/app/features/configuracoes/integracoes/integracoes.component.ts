import { Component, OnInit, inject, signal, viewChild } from '@angular/core';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { EmpresaIntegracaoService } from '../../../core/services/empresa-integracao.service';
import {
  CredencialTipo, Integracao, IntegracaoAmbiente, IntegracaoTipo, SalvarIntegracaoRequest
} from '../../../core/models/empresa-config.model';
import { aplicarErroNoForm, lerErroApi, textoDoErro } from '../../../core/utils/erros-api';
import { formatarDataHora } from '../../../core/utils/imob-formato';
import { ConfirmDialogComponent } from '../../imobilizado/shared/confirm-dialog.component';

export const TIPOS_INTEGRACAO: { codigo: IntegracaoTipo; nome: string }[] = [
  { codigo: 'fiscal', nome: 'Fiscal' }, { codigo: 'bancaria', nome: 'Bancária' },
  { codigo: 'governo', nome: 'Governamental' }, { codigo: 'outra', nome: 'Outra' }
];
export const TIPOS_CREDENCIAL: { codigo: CredencialTipo; nome: string }[] = [
  { codigo: 'token', nome: 'Token' }, { codigo: 'senha', nome: 'Senha' },
  { codigo: 'certificado', nome: 'Certificado (PFX em base64)' }, { codigo: 'outra', nome: 'Outra' }
];
const STATUS: Record<string, { texto: string; classe: string }> = {
  nao_testada: { texto: 'Não testada', classe: 'text-bg-secondary' },
  ok: { texto: 'OK', classe: 'text-bg-success' },
  falha: { texto: 'Falha', classe: 'text-bg-danger' }
};

@Component({
  selector: 'app-config-integracoes',
  standalone: true,
  imports: [ReactiveFormsModule, ConfirmDialogComponent],
  template: `
    @if (carregando()) {
      <div class="text-center py-5 text-muted"><div class="spinner-border spinner-border-sm me-2"></div>Carregando...</div>
    } @else if (erroCarga()) {
      <div class="alert alert-danger d-flex justify-content-between align-items-center py-2" role="alert">
        <span>{{ erroCarga() }}</span>
        <button type="button" class="btn btn-sm btn-outline-danger" (click)="carregar()">Tentar novamente</button>
      </div>
    } @else {
      @if (aviso()) { <div class="alert alert-success py-2" role="status">{{ aviso() }}</div> }
      @if (erroAcao()) { <div class="alert alert-danger py-2" role="alert">{{ erroAcao() }}</div> }

      @if (!formAberto()) {
        <div class="card border-0 shadow-sm">
          <div class="card-header bg-body d-flex justify-content-between align-items-center">
            <span class="fw-semibold">Integrações</span>
            <button type="button" class="btn btn-sm btn-primary" id="btn-nova" (click)="novo()"><i class="bi bi-plus-lg me-1"></i>Nova integração</button>
          </div>
          @if (itens().length === 0) {
            <div class="card-body text-muted">Nenhuma integração cadastrada. Esta fase só prepara o cadastro; nenhum serviço externo é chamado.</div>
          } @else {
            <div class="table-responsive">
              <table class="table align-middle mb-0">
                <thead><tr><th>Provedor</th><th>Tipo</th><th>Ambiente</th><th>Credencial</th><th>Status</th><th>Ativa</th><th class="text-end">Ações</th></tr></thead>
                <tbody>
                  @for (i of itens(); track i.id) {
                    <tr>
                      <td class="fw-medium">{{ i.provedor }}</td>
                      <td>{{ nomeTipo(i.tipo) }}</td>
                      <td>{{ i.ambiente === 'producao' ? 'Produção' : 'Homologação' }}</td>
                      <td>@if (i.credencial?.definida) { <span class="text-muted">{{ i.credencial!.mascara }}</span> } @else { <span class="text-muted">—</span> }</td>
                      <td>
                        <span class="badge" [class]="status(i).classe">{{ status(i).texto }}</span>
                        @if (i.ultimoTesteEm) {
                          <div class="small text-muted">{{ dataHora(i.ultimoTesteEm) }}@if (i.ultimoTesteResultado) { · {{ i.ultimoTesteResultado }} }</div>
                        }
                        @if (testes()[i.id]; as t) { <div class="small teste-resultado" [class.text-danger]="t.status === 'falha'" [class.text-success]="t.status === 'ok'">{{ t.resultado }}</div> }
                      </td>
                      <td>{{ i.ativo ? 'Sim' : 'Não' }}</td>
                      <td class="text-end text-nowrap">
                        <button type="button" class="btn btn-sm btn-outline-secondary me-1" data-acao="testar" [disabled]="ocupado() === i.id" (click)="testar(i)">Testar</button>
                        <button type="button" class="btn btn-sm btn-outline-secondary me-1" data-acao="editar" (click)="editar(i)">Editar</button>
                        <button type="button" class="btn btn-sm btn-outline-secondary me-1" data-acao="ativar" [disabled]="ocupado() === i.id" (click)="alternarAtivo(i)">{{ i.ativo ? 'Desativar' : 'Ativar' }}</button>
                        <button type="button" class="btn btn-sm btn-outline-danger" data-acao="excluir" [disabled]="ocupado() === i.id" (click)="excluir(i)">Excluir</button>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </div>
      } @else {
        <form [formGroup]="form" (ngSubmit)="salvar()" novalidate class="card border-0 shadow-sm">
          <div class="card-header bg-body fw-semibold">{{ editando() ? 'Editar integração' : 'Nova integração' }}</div>
          <div class="card-body row g-3">
            <div class="col-md-3">
              <label class="form-label fw-medium" for="int-tipo">Tipo</label>
              <select id="int-tipo" class="form-select" formControlName="tipo" [class.is-invalid]="invalido('tipo')">
                @for (t of tipos; track t.codigo) { <option [value]="t.codigo">{{ t.nome }}</option> }
              </select>
              @if (invalido('tipo')) { <div class="invalid-feedback">{{ msg('tipo') }}</div> }
            </div>
            <div class="col-md-5">
              <label class="form-label fw-medium" for="int-provedor">Provedor</label>
              <input id="int-provedor" class="form-control" maxlength="100" formControlName="provedor" [class.is-invalid]="invalido('provedor')" />
              @if (invalido('provedor')) { <div class="invalid-feedback">{{ msg('provedor') }}</div> }
            </div>
            <div class="col-md-2">
              <label class="form-label fw-medium" for="int-ambiente">Ambiente</label>
              <select id="int-ambiente" class="form-select" formControlName="ambiente" [class.is-invalid]="invalido('ambiente')">
                <option value="homologacao">Homologação</option>
                <option value="producao">Produção</option>
              </select>
              @if (invalido('ambiente')) { <div class="invalid-feedback">{{ msg('ambiente') }}</div> }
            </div>
            <div class="col-md-2 d-flex align-items-end">
              <div class="form-check form-switch mb-2">
                <input id="int-ativo" class="form-check-input" type="checkbox" role="switch" formControlName="ativo" />
                <label class="form-check-label" for="int-ativo">Ativa</label>
              </div>
            </div>

            <div class="col-12">
              <div class="d-flex justify-content-between align-items-center mb-1">
                <span class="fw-medium">Parâmetros (chave/valor)</span>
                <button type="button" class="btn btn-sm btn-outline-secondary" id="btn-add-param" (click)="adicionarParametro()">Adicionar parâmetro</button>
              </div>
              <div class="form-text mb-2" id="int-aviso-param">Não use segredos aqui: nomes como senha, token, apikey, chave, certificado ou secret são recusados. Segredos vão no campo de credencial abaixo.</div>
              @for (p of parametros.controls; track p; let idx = $index) {
                <div class="row g-2 mb-2" [formGroup]="$any(p)">
                  <div class="col-5"><input class="form-control form-control-sm" placeholder="chave" aria-label="Chave" maxlength="50" formControlName="chave" /></div>
                  <div class="col-6"><input class="form-control form-control-sm" placeholder="valor" aria-label="Valor" maxlength="500" formControlName="valor" /></div>
                  <div class="col-1"><button type="button" class="btn btn-sm btn-outline-danger" aria-label="Remover parâmetro" (click)="removerParametro(idx)"><i class="bi bi-x-lg"></i></button></div>
                </div>
              }
              @if (msg('parametros')) { <div class="text-danger small">{{ msg('parametros') }}</div> }
            </div>

            <div class="col-12"><hr class="my-0" /></div>
            <div class="col-12">
              <div class="fw-medium">Credencial / segredo</div>
              @if (editando()?.credencial?.definida) {
                <div class="small text-muted" id="int-cred-info">
                  Credencial {{ editando()!.credencial!.mascara }} definida em {{ dataHora(editando()!.credencial!.atualizadoEm) }}@if (editando()!.credencial!.atualizadoPorNome) { por {{ editando()!.credencial!.atualizadoPorNome }} }
                  (versão {{ editando()!.credencial!.versao }}). Deixe o campo vazio para manter.
                </div>
              } @else {
                <div class="small text-muted">Nenhuma credencial definida.</div>
              }
            </div>
            @if (!editando()?.credencial?.definida) {
              <div class="col-md-4">
                <label class="form-label" for="int-cred-tipo">Tipo da credencial</label>
                <select id="int-cred-tipo" class="form-select" formControlName="credencialTipo">
                  @for (t of tiposCredencial; track t.codigo) { <option [value]="t.codigo">{{ t.nome }}</option> }
                </select>
              </div>
            }
            <div class="col-md-8">
              <label class="form-label" for="int-segredo">{{ editando()?.credencial?.definida ? 'Substituir segredo' : 'Segredo' }}</label>
              <input id="int-segredo" type="password" class="form-control" autocomplete="new-password" formControlName="segredo"
                     [placeholder]="editando()?.credencial?.definida ? '********' : ''" [class.is-invalid]="invalido('segredo')" />
              @if (invalido('segredo')) { <div class="invalid-feedback">{{ msg('segredo') }}</div> }
              <div class="form-text">O valor nunca é exibido depois de salvo.</div>
            </div>

            @if (erroForm()) { <div class="col-12"><div class="alert alert-danger py-2 mb-0" role="alert">{{ erroForm() }}</div></div> }
            <div class="col-12 d-flex gap-2">
              <button type="submit" class="btn btn-primary" [disabled]="salvando()">
                @if (salvando()) { <span class="spinner-border spinner-border-sm me-1"></span> }Salvar
              </button>
              <button type="button" class="btn btn-outline-secondary" id="btn-cancelar" (click)="cancelar()">Cancelar</button>
            </div>
          </div>
        </form>
      }
    }
    <app-confirm-dialog />
  `
})
export class IntegracoesComponent implements OnInit {
  private fb = inject(FormBuilder);
  private service = inject(EmpresaIntegracaoService);
  private confirmDialog = viewChild.required(ConfirmDialogComponent);

  tipos = TIPOS_INTEGRACAO;
  tiposCredencial = TIPOS_CREDENCIAL;

  itens = signal<Integracao[]>([]);
  carregando = signal(false);
  erroCarga = signal('');
  erroAcao = signal('');
  aviso = signal('');
  ocupado = signal<string | null>(null);
  testes = signal<Record<string, { status: 'ok' | 'falha'; resultado: string }>>({});

  formAberto = signal(false);
  editando = signal<Integracao | null>(null);
  salvando = signal(false);
  erroForm = signal('');

  form = this.fb.group({
    tipo: ['fiscal' as IntegracaoTipo, Validators.required],
    provedor: ['', [Validators.required, Validators.maxLength(100)]],
    ambiente: ['homologacao' as IntegracaoAmbiente, Validators.required],
    ativo: [true],
    credencialTipo: ['token' as CredencialTipo],
    segredo: [''],
    parametros: this.fb.array([] as any[])
  });

  get parametros() { return this.form.controls.parametros as FormArray; }

  ngOnInit() { this.carregar(); }

  nomeTipo(t: string) { return TIPOS_INTEGRACAO.find(x => x.codigo === t)?.nome ?? t; }
  status(i: Integracao) { return STATUS[i.status] ?? STATUS['nao_testada']; }
  dataHora(iso: string | null | undefined) { return formatarDataHora(iso); }

  invalido(campo: string) {
    const c = this.form.get(campo);
    return !!c && c.invalid && (c.touched || c.dirty);
  }
  msg(campo: string) {
    const c = this.form.get(campo);
    return (c?.errors?.['servidor'] as string) ?? (c?.errors?.['required'] ? 'Campo obrigatório.' : '');
  }

  private novoParametro(chave = '', valor = '') {
    return this.fb.group({ chave: [chave], valor: [valor] });
  }
  adicionarParametro() { this.parametros.push(this.novoParametro()); }
  removerParametro(i: number) { this.parametros.removeAt(i); }

  carregar() {
    this.carregando.set(true);
    this.erroCarga.set('');
    this.service.listar().subscribe({
      next: lista => { this.itens.set(lista); this.carregando.set(false); },
      error: err => {
        this.erroCarga.set(textoDoErro(lerErroApi(err, 'Erro ao carregar as integrações.'), 'Erro ao carregar as integrações.'));
        this.carregando.set(false);
      }
    });
  }

  private recarregarSilencioso() {
    this.service.listar().subscribe({ next: l => this.itens.set(l) });
  }

  novo() { this.preparar(null); }
  editar(i: Integracao) { this.preparar(i); }

  private preparar(i: Integracao | null) {
    this.aviso.set(''); this.erroAcao.set(''); this.erroForm.set('');
    this.editando.set(i);
    this.parametros.clear();
    for (const [k, v] of Object.entries(i?.parametros ?? {})) this.parametros.push(this.novoParametro(k, v));
    this.form.reset({
      tipo: i?.tipo ?? 'fiscal', provedor: i?.provedor ?? '', ambiente: i?.ambiente ?? 'homologacao',
      ativo: i?.ativo ?? true, credencialTipo: i?.credencial?.tipo ?? 'token', segredo: ''
    });
    this.formAberto.set(true);
  }

  cancelar() {
    this.limparSegredo();
    this.formAberto.set(false);
    this.editando.set(null);
  }

  private limparSegredo() {
    this.form.controls.segredo.setValue('');
  }

  salvar() {
    this.erroForm.set('');
    if (this.form.controls.provedor.invalid) { this.form.markAllAsTouched(); return; }
    const v = this.form.getRawValue();
    const pares = (v.parametros as { chave: string; valor: string }[])
      .map(p => ({ chave: (p.chave ?? '').trim(), valor: p.valor ?? '' }))
      .filter(p => p.chave);
    const req: SalvarIntegracaoRequest = {
      tipo: v.tipo!, provedor: (v.provedor ?? '').trim(), ambiente: v.ambiente!,
      parametros: pares.length ? Object.fromEntries(pares.map(p => [p.chave, p.valor])) : null,
      credencialTipo: this.editando()?.credencial?.definida ? null : v.credencialTipo!,
      segredo: v.segredo ? v.segredo : null,
      ativo: !!v.ativo
    };
    const atual = this.editando();
    this.salvando.set(true);
    (atual ? this.service.atualizar(atual.id, req) : this.service.criar(req)).subscribe({
      next: () => {
        this.limparSegredo();
        this.salvando.set(false);
        this.formAberto.set(false);
        this.editando.set(null);
        this.aviso.set(atual ? 'Integração atualizada.' : 'Integração criada.');
        this.recarregarSilencioso();
      },
      error: err => {
        this.limparSegredo();
        const e = lerErroApi(err, 'Erro ao salvar a integração.');
        const geral = aplicarErroNoForm(this.form, e);
        this.erroForm.set(geral);
        this.form.markAllAsTouched();
        this.salvando.set(false);
      }
    });
  }

  testar(i: Integracao) {
    this.aviso.set(''); this.erroAcao.set('');
    this.ocupado.set(i.id);
    this.service.testar(i.id).subscribe({
      next: r => {
        this.testes.update(t => ({ ...t, [i.id]: { status: r.status, resultado: r.resultado } }));
        this.ocupado.set(null);
        this.recarregarSilencioso();
      },
      error: err => {
        this.erroAcao.set(textoDoErro(lerErroApi(err, 'Erro ao testar a integração.'), 'Erro ao testar a integração.'));
        this.ocupado.set(null);
      }
    });
  }

  alternarAtivo(i: Integracao) {
    this.aviso.set(''); this.erroAcao.set('');
    // PUT é documento completo; sem segredo (mantém o do cofre).
    const req: SalvarIntegracaoRequest = {
      tipo: i.tipo, provedor: i.provedor, ambiente: i.ambiente,
      parametros: i.parametros && Object.keys(i.parametros).length ? i.parametros : null,
      credencialTipo: null, segredo: null, ativo: !i.ativo
    };
    this.ocupado.set(i.id);
    this.service.atualizar(i.id, req).subscribe({
      next: salva => {
        this.itens.update(l => l.map(x => x.id === i.id ? salva : x));
        this.ocupado.set(null);
      },
      error: err => {
        this.erroAcao.set(textoDoErro(lerErroApi(err, 'Erro ao alterar a integração.'), 'Erro ao alterar a integração.'));
        this.ocupado.set(null);
      }
    });
  }

  async excluir(i: Integracao) {
    const ok = await this.confirmDialog().abrir({
      titulo: 'Excluir integração',
      mensagem: `Excluir a integração "${i.provedor}"? A credencial associada será revogada e o segredo apagado.`,
      confirmar: 'Excluir', perigo: true
    });
    if (!ok) return;
    this.aviso.set(''); this.erroAcao.set('');
    this.ocupado.set(i.id);
    this.service.excluir(i.id).subscribe({
      next: () => {
        this.itens.update(l => l.filter(x => x.id !== i.id));
        this.ocupado.set(null);
        this.aviso.set('Integração excluída; a credencial foi revogada.');
      },
      error: err => {
        this.erroAcao.set(textoDoErro(lerErroApi(err, 'Erro ao excluir a integração.'), 'Erro ao excluir a integração.'));
        this.ocupado.set(null);
      }
    });
  }
}
