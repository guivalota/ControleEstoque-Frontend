import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { EmpresaEmailService } from '../../../core/services/empresa-email.service';
import { EmailEmpresa, EmailSeguranca, SalvarEmailEmpresaRequest } from '../../../core/models/empresa-config.model';
import { aplicarErroNoForm, lerErroApi, textoDoErro } from '../../../core/utils/erros-api';
import { formatarDataHora } from '../../../core/utils/imob-formato';

@Component({
  selector: 'app-config-email',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    @if (carregando()) {
      <div class="text-center py-5 text-muted"><div class="spinner-border spinner-border-sm me-2"></div>Carregando...</div>
    } @else if (erroCarga()) {
      <div class="alert alert-danger d-flex justify-content-between align-items-center py-2" role="alert">
        <span>{{ erroCarga() }}</span>
        <button type="button" class="btn btn-sm btn-outline-danger" (click)="carregar()">Tentar novamente</button>
      </div>
    } @else if (config()) {
      <div class="mb-3" id="email-origem">
        @if (config()!.usandoEmailProprio) {
          <span class="badge text-bg-success">Usando e-mail próprio</span>
          <span class="small text-muted ms-2">Os avisos internos saem pelo servidor da empresa.</span>
        } @else {
          <span class="badge text-bg-secondary">Usando e-mail da plataforma</span>
          <span class="small text-muted ms-2">Para usar o seu, a configuração precisa estar ativa e verificada (envie um e-mail de teste). E-mails de segurança saem sempre pela plataforma.</span>
        }
        @if (config()!.configurado) {
          <div class="small text-muted mt-1">{{ config()!.verificadoEm ? 'Verificado em ' + dataHora(config()!.verificadoEm) : 'Ainda não verificado.' }}</div>
        }
      </div>

      <form [formGroup]="form" (ngSubmit)="salvar()" novalidate class="card border-0 shadow-sm mb-3">
        <div class="card-header bg-body fw-semibold">Servidor de e-mail (SMTP)</div>
        <div class="card-body row g-3">
          <div class="col-md-6">
            <label class="form-label fw-medium" for="em-host">Servidor (host)</label>
            <input id="em-host" class="form-control" formControlName="host" placeholder="smtp.empresa.com.br" [class.is-invalid]="invalido('host')" />
            @if (invalido('host')) { <div class="invalid-feedback">{{ msg('host') }}</div> }
          </div>
          <div class="col-md-3">
            <label class="form-label fw-medium" for="em-porta">Porta</label>
            <input id="em-porta" type="number" class="form-control" formControlName="porta" [class.is-invalid]="invalido('porta')" />
            @if (invalido('porta')) { <div class="invalid-feedback">{{ msg('porta') }}</div> }
            <div class="form-text">25, 465, 587 ou 2525.</div>
          </div>
          <div class="col-md-3">
            <label class="form-label fw-medium" for="em-seg">Segurança</label>
            <select id="em-seg" class="form-select" formControlName="seguranca" [class.is-invalid]="invalido('seguranca')">
              <option value="STARTTLS">STARTTLS</option>
              <option value="SSL">SSL</option>
            </select>
            @if (invalido('seguranca')) { <div class="invalid-feedback">{{ msg('seguranca') }}</div> }
          </div>
          <div class="col-md-6">
            <label class="form-label fw-medium" for="em-usuario">Usuário</label>
            <input id="em-usuario" class="form-control" autocomplete="off" formControlName="usuario" [class.is-invalid]="invalido('usuario')" />
            @if (invalido('usuario')) { <div class="invalid-feedback">{{ msg('usuario') }}</div> }
          </div>
          <div class="col-md-6">
            <label class="form-label fw-medium" for="em-senha">Senha</label>
            <input id="em-senha" type="password" class="form-control" autocomplete="new-password" formControlName="senha"
                   [placeholder]="config()!.senha?.definida ? '********' : ''" [class.is-invalid]="invalido('senha')" />
            @if (invalido('senha')) { <div class="invalid-feedback">{{ msg('senha') }}</div> }
            <div class="form-text" id="em-senha-info">
              @if (config()!.senha?.definida) {
                Senha {{ config()!.senha!.mascara }} definida em {{ dataHora(config()!.senha!.atualizadaEm) }}@if (config()!.senha!.atualizadaPorNome) { por {{ config()!.senha!.atualizadaPorNome }} }. Deixe vazio para manter.
              } @else { Nenhuma senha definida. }
            </div>
          </div>
          <div class="col-md-5">
            <label class="form-label fw-medium" for="em-rem-nome">Nome do remetente</label>
            <input id="em-rem-nome" class="form-control" formControlName="remetenteNome" [class.is-invalid]="invalido('remetenteNome')" />
            @if (invalido('remetenteNome')) { <div class="invalid-feedback">{{ msg('remetenteNome') }}</div> }
          </div>
          <div class="col-md-5">
            <label class="form-label fw-medium" for="em-rem-email">E-mail do remetente</label>
            <input id="em-rem-email" type="email" class="form-control" formControlName="remetenteEmail" [class.is-invalid]="invalido('remetenteEmail')" />
            @if (invalido('remetenteEmail')) { <div class="invalid-feedback">{{ msg('remetenteEmail') }}</div> }
          </div>
          <div class="col-md-2 d-flex align-items-end">
            <div class="form-check form-switch mb-2">
              <input id="em-ativo" class="form-check-input" type="checkbox" role="switch" formControlName="ativo" />
              <label class="form-check-label" for="em-ativo">Ativo</label>
            </div>
          </div>
          @if (erro()) { <div class="col-12"><div class="alert alert-danger py-2 mb-0" role="alert">{{ erro() }}</div></div> }
          @if (ok()) { <div class="col-12"><div class="alert alert-success py-2 mb-0" role="status">{{ ok() }}</div></div> }
          <div class="col-12">
            <button type="submit" class="btn btn-primary" [disabled]="salvando()">
              @if (salvando()) { <span class="spinner-border spinner-border-sm me-1"></span> }Salvar e-mail
            </button>
          </div>
        </div>
      </form>

      <div class="card border-0 shadow-sm">
        <div class="card-header bg-body fw-semibold">Enviar e-mail de teste</div>
        <div class="card-body">
          @if (!config()!.configurado) {
            <div class="text-muted small">Salve a configuração antes de testar.</div>
          } @else {
            <div class="row g-2 align-items-start">
              <div class="col-md-6">
                <input id="em-teste-dest" type="email" class="form-control" aria-label="Destinatário do teste" placeholder="destinatario@exemplo.com" [formControl]="destinatario" />
              </div>
              <div class="col-auto">
                <button type="button" class="btn btn-outline-primary" id="btn-testar" [disabled]="testando() || destinatario.invalid" (click)="testar()">
                  @if (testando()) { <span class="spinner-border spinner-border-sm me-1"></span> }Enviar e-mail de teste
                </button>
              </div>
            </div>
            @if (resultado(); as r) {
              <div class="alert mt-3 mb-0 py-2" [class.alert-success]="r.sucesso" [class.alert-danger]="!r.sucesso" role="status" id="em-teste-resultado">
                {{ r.sucesso ? 'E-mail de teste enviado; configuração verificada.' : 'Falha no envio: ' + r.erro }}
              </div>
            }
            @if (erroTeste()) { <div class="alert alert-danger mt-3 mb-0 py-2" role="alert">{{ erroTeste() }}</div> }
          }
        </div>
      </div>
    }
  `
})
export class EmailComponent implements OnInit {
  private fb = inject(FormBuilder);
  private service = inject(EmpresaEmailService);

  config = signal<EmailEmpresa | null>(null);
  carregando = signal(false);
  erroCarga = signal('');
  salvando = signal(false);
  erro = signal('');
  ok = signal('');
  testando = signal(false);
  resultado = signal<{ sucesso: boolean; erro: string | null } | null>(null);
  erroTeste = signal('');

  destinatario = this.fb.control('', [Validators.required, Validators.email]);

  form = this.fb.group({
    host: ['', Validators.required],
    porta: [587 as number | null, Validators.required],
    seguranca: ['STARTTLS' as EmailSeguranca, Validators.required],
    usuario: [''],
    senha: [''],
    remetenteNome: ['', Validators.required],
    remetenteEmail: ['', [Validators.required, Validators.email]],
    ativo: [true]
  });

  ngOnInit() { this.carregar(); }

  dataHora(iso: string | null | undefined) { return formatarDataHora(iso); }

  invalido(campo: string) {
    const c = this.form.get(campo);
    return !!c && c.invalid && (c.touched || c.dirty);
  }
  msg(campo: string) {
    const c = this.form.get(campo);
    if (c?.errors?.['servidor']) return c.errors['servidor'] as string;
    if (c?.errors?.['required']) return 'Campo obrigatório.';
    if (c?.errors?.['email']) return 'E-mail inválido.';
    return 'Valor inválido.';
  }

  carregar() {
    this.carregando.set(true);
    this.erroCarga.set('');
    this.service.obter().subscribe({
      next: c => { this.aplicar(c); this.carregando.set(false); },
      error: err => {
        this.erroCarga.set(textoDoErro(lerErroApi(err, 'Erro ao carregar o e-mail da empresa.'), 'Erro ao carregar o e-mail da empresa.'));
        this.carregando.set(false);
      }
    });
  }

  private aplicar(c: EmailEmpresa) {
    this.config.set(c);
    this.form.reset({
      host: c.host ?? '', porta: c.porta ?? 587, seguranca: c.seguranca ?? 'STARTTLS', usuario: c.usuario ?? '',
      senha: '', remetenteNome: c.remetenteNome ?? '', remetenteEmail: c.remetenteEmail ?? '', ativo: c.configurado ? c.ativo : true
    });
  }

  salvar() {
    this.erro.set(''); this.ok.set('');
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const v = this.form.getRawValue();
    const usuario = (v.usuario ?? '').trim();
    const req: SalvarEmailEmpresaRequest = {
      host: (v.host ?? '').trim(), porta: Number(v.porta), seguranca: v.seguranca!,
      usuario: usuario || null, senha: v.senha ? v.senha : null,
      remetenteNome: (v.remetenteNome ?? '').trim(), remetenteEmail: (v.remetenteEmail ?? '').trim(), ativo: !!v.ativo
    };
    this.salvando.set(true);
    this.service.salvar(req).subscribe({
      next: c => {
        this.aplicar(c); // limpa o campo de senha
        this.salvando.set(false);
        this.resultado.set(null);
        this.ok.set('Configuração de e-mail salva.');
      },
      error: err => {
        this.form.controls.senha.setValue('');
        const e = lerErroApi(err, 'Erro ao salvar o e-mail da empresa.');
        this.erro.set(aplicarErroNoForm(this.form, e));
        this.form.markAllAsTouched();
        this.salvando.set(false);
      }
    });
  }

  testar() {
    if (this.destinatario.invalid) return;
    this.erroTeste.set(''); this.resultado.set(null);
    this.testando.set(true);
    this.service.testar(this.destinatario.value!.trim()).subscribe({
      next: r => {
        this.testando.set(false);
        this.resultado.set({ sucesso: r.sucesso, erro: r.erro });
        if (r.sucesso) this.service.obter().subscribe({ next: c => this.config.set(c) });
      },
      error: err => {
        this.erroTeste.set(textoDoErro(lerErroApi(err, 'Erro ao enviar o e-mail de teste.'), 'Erro ao enviar o e-mail de teste.'));
        this.testando.set(false);
      }
    });
  }
}
