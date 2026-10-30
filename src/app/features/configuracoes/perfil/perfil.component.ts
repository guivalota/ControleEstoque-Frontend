import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { EmpresaPerfilService } from '../../../core/services/empresa-perfil.service';
import { EmpresaPerfil, EmpresaPerfilOpcoes } from '../../../core/models/empresa-perfil.model';
import { aplicarErroNoForm, lerErroApi, textoDoErro } from '../../../core/utils/erros-api';
import { formatarCnpj } from '../../../core/utils/cnpj';
import { EnderecoComponent } from './endereco.component';
import { LogoComponent } from './logo.component';

const CAMPOS = ['nomeFantasia', 'telefone', 'emailContato', 'site', 'cep', 'logradouro', 'numero', 'complemento',
  'bairro', 'municipio', 'uf', 'codigoIbge'] as const;

@Component({
  selector: 'app-config-perfil',
  standalone: true,
  imports: [ReactiveFormsModule, EnderecoComponent, LogoComponent],
  template: `
    @if (carregando()) {
      <div class="text-center py-5 text-muted"><div class="spinner-border spinner-border-sm me-2"></div>Carregando...</div>
    } @else if (erroCarga()) {
      <div class="alert alert-danger d-flex justify-content-between align-items-center py-2" role="alert">
        <span>{{ erroCarga() }}</span>
        <button type="button" class="btn btn-sm btn-outline-danger" (click)="carregar()">Tentar novamente</button>
      </div>
    } @else if (perfil()) {
      @let p = perfil()!;
      <form [formGroup]="form" (ngSubmit)="salvar()" novalidate>
        <div class="card border-0 shadow-sm mb-3">
          <div class="card-header bg-body fw-semibold">Identificação</div>
          <div class="card-body row g-3">
            <div class="col-md-8">
              <label class="form-label fw-medium" for="cfg-razao">Razão social</label>
              <input id="cfg-razao" class="form-control" [value]="p.razaoSocial" readonly />
            </div>
            <div class="col-md-4">
              <label class="form-label fw-medium" for="cfg-cnpj">CNPJ</label>
              <input id="cfg-cnpj" class="form-control" [value]="formatarCnpj(p.cnpj)" readonly />
            </div>
            <div class="col-12 form-text mt-0">Razão social e CNPJ só são alterados pelo suporte da plataforma.</div>
            <div class="col-md-6">
              <label class="form-label fw-medium" for="cfg-fantasia">Nome fantasia</label>
              <input id="cfg-fantasia" class="form-control" formControlName="nomeFantasia" [class.is-invalid]="invalido('nomeFantasia')" />
              @if (invalido('nomeFantasia')) { <div class="invalid-feedback">{{ msg('nomeFantasia') }}</div> }
            </div>
            <div class="col-md-6">
              <label class="form-label fw-medium" for="cfg-site">Site</label>
              <input id="cfg-site" class="form-control" formControlName="site" placeholder="https://" [class.is-invalid]="invalido('site')" />
              @if (invalido('site')) { <div class="invalid-feedback">{{ msg('site') }}</div> }
            </div>
            <div class="col-md-6">
              <label class="form-label fw-medium" for="cfg-tel">Telefone</label>
              <input id="cfg-tel" class="form-control" formControlName="telefone" placeholder="(11) 99999-8888" [class.is-invalid]="invalido('telefone')" />
              @if (invalido('telefone')) { <div class="invalid-feedback">{{ msg('telefone') }}</div> }
            </div>
            <div class="col-md-6">
              <label class="form-label fw-medium" for="cfg-email">E-mail de contato</label>
              <input id="cfg-email" type="text" class="form-control" formControlName="emailContato" [class.is-invalid]="invalido('emailContato')" />
              @if (invalido('emailContato')) { <div class="invalid-feedback">{{ msg('emailContato') }}</div> }
            </div>
          </div>
        </div>

        <div class="card border-0 shadow-sm mb-3">
          <div class="card-header bg-body fw-semibold">Endereço</div>
          <div class="card-body"><app-config-endereco [form]="form" [ufs]="opcoes()?.ufs ?? []" /></div>
        </div>

        @if (erro()) { <div class="alert alert-danger py-2" role="alert">{{ erro() }}</div> }
        @if (ok()) { <div class="alert alert-success py-2" role="status">{{ ok() }}</div> }
        <button type="submit" class="btn btn-primary mb-4" [disabled]="salvando()">
          @if (salvando()) { <span class="spinner-border spinner-border-sm me-1"></span> }Salvar perfil
        </button>
      </form>

      <div class="card border-0 shadow-sm">
        <div class="card-header bg-body fw-semibold">Logo</div>
        <div class="card-body">
          <app-config-logo [tamanhoMaximoBytes]="opcoes()?.logoTamanhoMaximoBytes ?? 1048576"
                           [dimensaoMaximaPx]="opcoes()?.logoDimensaoMaximaPx ?? 2000" />
        </div>
      </div>
    }
  `
})
export class PerfilComponent implements OnInit {
  private fb = inject(FormBuilder);
  private service = inject(EmpresaPerfilService);

  formatarCnpj = formatarCnpj;
  perfil = signal<EmpresaPerfil | null>(null);
  opcoes = signal<EmpresaPerfilOpcoes | null>(null);
  carregando = signal(false);
  salvando = signal(false);
  erroCarga = signal('');
  erro = signal('');
  ok = signal('');

  form = this.fb.group({
    nomeFantasia: [null as string | null], telefone: [null as string | null], emailContato: [null as string | null],
    site: [null as string | null], cep: [null as string | null], logradouro: [null as string | null],
    numero: [null as string | null], complemento: [null as string | null], bairro: [null as string | null],
    municipio: [null as string | null], uf: [null as string | null], codigoIbge: [null as string | null]
  });

  ngOnInit() { this.carregar(); }

  invalido(campo: string) {
    const c = this.form.get(campo);
    return !!c && c.invalid && (c.touched || c.dirty);
  }

  msg(campo: string) {
    return (this.form.get(campo)?.errors?.['servidor'] as string) ?? 'Valor inválido.';
  }

  carregar() {
    this.carregando.set(true);
    this.erroCarga.set('');
    forkJoin({ perfil: this.service.obter(), opcoes: this.service.opcoes() }).subscribe({
      next: ({ perfil, opcoes }) => {
        this.perfil.set(perfil);
        this.opcoes.set(opcoes);
        this.preencher(perfil);
        this.carregando.set(false);
      },
      error: err => {
        this.erroCarga.set(textoDoErro(lerErroApi(err, 'Erro ao carregar o perfil.'), 'Erro ao carregar o perfil.'));
        this.carregando.set(false);
      }
    });
  }

  private preencher(p: EmpresaPerfil) {
    const v: Record<string, string | null> = {};
    for (const c of CAMPOS) v[c] = p[c] ?? null;
    this.form.reset(v);
  }

  salvar() {
    const atual = this.perfil();
    if (!atual) return;
    this.erro.set(''); this.ok.set('');
    const bruto = this.form.getRawValue() as Record<string, string | null>;
    const alteracoes: Record<string, string | null> = {};
    for (const c of CAMPOS) alteracoes[c] = bruto[c]?.toString().trim() ? bruto[c]!.toString().trim() : null;
    this.salvando.set(true);
    this.service.salvar(atual, alteracoes).subscribe({
      next: p => {
        this.perfil.set(p);
        this.preencher(p);
        this.salvando.set(false);
        this.ok.set('Perfil salvo.');
      },
      error: err => {
        const e = lerErroApi(err, 'Erro ao salvar o perfil.');
        const geral = aplicarErroNoForm(this.form, e);
        this.erro.set(geral || textoDoErro(e, 'Erro ao salvar o perfil.'));
        this.form.markAllAsTouched();
        this.salvando.set(false);
      }
    });
  }
}
