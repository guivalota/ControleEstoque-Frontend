import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { EmpresaPerfilService } from '../../../core/services/empresa-perfil.service';
import { EmpresaPerfil, EmpresaPerfilOpcoes } from '../../../core/models/empresa-perfil.model';
import { aplicarErroNoForm, lerErroApi, textoDoErro } from '../../../core/utils/erros-api';

@Component({
  selector: 'app-config-fiscal',
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
    } @else if (perfil()) {
      <form [formGroup]="form" (ngSubmit)="salvar()" novalidate class="card border-0 shadow-sm">
        <div class="card-header bg-body fw-semibold">Dados fiscais e tributários</div>
        <div class="card-body row g-3">
          <div class="col-md-4">
            <label class="form-label fw-medium" for="cfg-ie">Inscrição estadual</label>
            <input id="cfg-ie" class="form-control" formControlName="inscricaoEstadual" placeholder="Número ou ISENTO" [class.is-invalid]="invalido('inscricaoEstadual')" />
            @if (invalido('inscricaoEstadual')) { <div class="invalid-feedback">{{ msg('inscricaoEstadual') }}</div> }
          </div>
          <div class="col-md-4">
            <label class="form-label fw-medium" for="cfg-im">Inscrição municipal</label>
            <input id="cfg-im" class="form-control" formControlName="inscricaoMunicipal" [class.is-invalid]="invalido('inscricaoMunicipal')" />
            @if (invalido('inscricaoMunicipal')) { <div class="invalid-feedback">{{ msg('inscricaoMunicipal') }}</div> }
          </div>
          <div class="col-md-4">
            <label class="form-label fw-medium" for="cfg-cnae">CNAE principal</label>
            <input id="cfg-cnae" class="form-control" formControlName="cnae" placeholder="4751-2/01" [class.is-invalid]="invalido('cnae')" />
            @if (invalido('cnae')) { <div class="invalid-feedback">{{ msg('cnae') }}</div> }
          </div>
          <div class="col-md-4">
            <label class="form-label fw-medium" for="cfg-regime">Regime tributário</label>
            <select id="cfg-regime" class="form-select" formControlName="regimeTributario" [class.is-invalid]="invalido('regimeTributario')">
              <option [ngValue]="null">—</option>
              @for (r of opcoes()?.regimesTributarios ?? []; track r.codigo) { <option [value]="r.codigo">{{ r.nome }}</option> }
            </select>
            @if (invalido('regimeTributario')) { <div class="invalid-feedback">{{ msg('regimeTributario') }}</div> }
          </div>
          <div class="col-md-4">
            <label class="form-label fw-medium" for="cfg-serie">Série da NF-e</label>
            <input id="cfg-serie" type="number" min="1" max="999" class="form-control" formControlName="serieNfe" [class.is-invalid]="invalido('serieNfe')" />
            @if (invalido('serieNfe')) { <div class="invalid-feedback">{{ msg('serieNfe') }}</div> }
          </div>
          <div class="col-md-4">
            <label class="form-label fw-medium" for="cfg-ambiente">Ambiente da NF-e</label>
            <select id="cfg-ambiente" class="form-select" formControlName="ambienteNfe" [class.is-invalid]="invalido('ambienteNfe')">
              <option [ngValue]="null">—</option>
              @for (a of opcoes()?.ambientesNfe ?? []; track a.codigo) { <option [value]="a.codigo">{{ a.nome }}</option> }
            </select>
            @if (invalido('ambienteNfe')) { <div class="invalid-feedback">{{ msg('ambienteNfe') }}</div> }
          </div>
          <div class="col-12 form-text mt-0">Preparação: nada fiscal é emitido por aqui. Campos opcionais aceitam vazio.</div>
          @if (erro()) { <div class="col-12"><div class="alert alert-danger py-2 mb-0" role="alert">{{ erro() }}</div></div> }
          @if (ok()) { <div class="col-12"><div class="alert alert-success py-2 mb-0" role="status">{{ ok() }}</div></div> }
          <div class="col-12">
            <button type="submit" class="btn btn-primary" [disabled]="salvando()">
              @if (salvando()) { <span class="spinner-border spinner-border-sm me-1"></span> }Salvar dados fiscais
            </button>
          </div>
        </div>
      </form>
    }
  `
})
export class FiscalComponent implements OnInit {
  private fb = inject(FormBuilder);
  private service = inject(EmpresaPerfilService);

  perfil = signal<EmpresaPerfil | null>(null);
  opcoes = signal<EmpresaPerfilOpcoes | null>(null);
  carregando = signal(false);
  salvando = signal(false);
  erroCarga = signal('');
  erro = signal('');
  ok = signal('');

  form = this.fb.group({
    inscricaoEstadual: [null as string | null],
    inscricaoMunicipal: [null as string | null],
    cnae: [null as string | null],
    regimeTributario: [null as string | null],
    serieNfe: [null as number | null],
    ambienteNfe: [null as string | null]
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
        this.erroCarga.set(textoDoErro(lerErroApi(err, 'Erro ao carregar os dados fiscais.'), 'Erro ao carregar os dados fiscais.'));
        this.carregando.set(false);
      }
    });
  }

  private preencher(p: EmpresaPerfil) {
    this.form.reset({
      inscricaoEstadual: p.inscricaoEstadual ?? null, inscricaoMunicipal: p.inscricaoMunicipal ?? null,
      cnae: p.cnae ?? null, regimeTributario: p.regimeTributario ?? null,
      serieNfe: p.serieNfe ?? null, ambienteNfe: p.ambienteNfe ?? null
    });
  }

  private texto(v: string | null | undefined): string | null {
    const t = v?.toString().trim();
    return t ? t : null;
  }

  salvar() {
    const atual = this.perfil();
    if (!atual) return;
    this.erro.set(''); this.ok.set('');
    const v = this.form.getRawValue();
    const serie = v.serieNfe === null || (v.serieNfe as unknown) === '' ? null : Number(v.serieNfe);
    this.salvando.set(true);
    this.service.salvar(atual, {
      inscricaoEstadual: this.texto(v.inscricaoEstadual), inscricaoMunicipal: this.texto(v.inscricaoMunicipal),
      cnae: this.texto(v.cnae), regimeTributario: (v.regimeTributario || null) as EmpresaPerfil['regimeTributario'],
      serieNfe: serie, ambienteNfe: (v.ambienteNfe || null) as EmpresaPerfil['ambienteNfe']
    }).subscribe({
      next: p => {
        this.perfil.set(p);
        this.preencher(p);
        this.salvando.set(false);
        this.ok.set('Dados fiscais salvos.');
      },
      error: err => {
        const e = lerErroApi(err, 'Erro ao salvar os dados fiscais.');
        const geral = aplicarErroNoForm(this.form, e);
        this.erro.set(geral || textoDoErro(e, 'Erro ao salvar os dados fiscais.'));
        this.form.markAllAsTouched();
        this.salvando.set(false);
      }
    });
  }
}
