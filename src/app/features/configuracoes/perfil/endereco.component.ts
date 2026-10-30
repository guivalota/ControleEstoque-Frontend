import { Component, inject, input, signal } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { CepService } from '../../../core/services/cep.service';

/** Seção de endereço do perfil: campos no FormGroup do pai; busca de CEP reaproveita o `CepService` de clientes/fornecedores. */
@Component({
  selector: 'app-config-endereco',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <div [formGroup]="form()" class="row g-3">
      <div class="col-md-3">
        <label class="form-label fw-medium" for="cfg-cep">CEP</label>
        <div class="input-group">
          <input id="cfg-cep" type="text" class="form-control" formControlName="cep" placeholder="00000-000"
                 maxlength="9" inputmode="numeric" (input)="onCepInput()" [class.is-invalid]="invalido('cep')" />
          <button type="button" class="btn btn-outline-secondary" (click)="buscarCep()" [disabled]="buscando()"
                  title="Buscar CEP" aria-label="Buscar CEP">
            @if (buscando()) { <span class="spinner-border spinner-border-sm"></span> } @else { <i class="bi bi-search"></i> }
          </button>
          @if (invalido('cep')) { <div class="invalid-feedback">{{ msg('cep') }}</div> }
        </div>
        @if (cepMsg()) {
          <div class="form-text" [class.text-success]="cepOk()" [class.text-danger]="!cepOk()">{{ cepMsg() }}</div>
        }
      </div>
      <div class="col-md-6">
        <label class="form-label fw-medium" for="cfg-logradouro">Logradouro</label>
        <input id="cfg-logradouro" type="text" class="form-control" formControlName="logradouro" [class.is-invalid]="invalido('logradouro')" />
        @if (invalido('logradouro')) { <div class="invalid-feedback">{{ msg('logradouro') }}</div> }
      </div>
      <div class="col-md-3">
        <label class="form-label fw-medium" for="cfg-numero">Número</label>
        <input id="cfg-numero" type="text" class="form-control" formControlName="numero" [class.is-invalid]="invalido('numero')" />
        @if (invalido('numero')) { <div class="invalid-feedback">{{ msg('numero') }}</div> }
      </div>
      <div class="col-md-4">
        <label class="form-label fw-medium" for="cfg-complemento">Complemento</label>
        <input id="cfg-complemento" type="text" class="form-control" formControlName="complemento" />
      </div>
      <div class="col-md-4">
        <label class="form-label fw-medium" for="cfg-bairro">Bairro</label>
        <input id="cfg-bairro" type="text" class="form-control" formControlName="bairro" [class.is-invalid]="invalido('bairro')" />
        @if (invalido('bairro')) { <div class="invalid-feedback">{{ msg('bairro') }}</div> }
      </div>
      <div class="col-md-4">
        <label class="form-label fw-medium" for="cfg-municipio">Município</label>
        <input id="cfg-municipio" type="text" class="form-control" formControlName="municipio" [class.is-invalid]="invalido('municipio')" />
        @if (invalido('municipio')) { <div class="invalid-feedback">{{ msg('municipio') }}</div> }
      </div>
      <div class="col-md-3">
        <label class="form-label fw-medium" for="cfg-uf">UF</label>
        <select id="cfg-uf" class="form-select" formControlName="uf" [class.is-invalid]="invalido('uf')">
          <option [ngValue]="null">—</option>
          @for (u of ufs(); track u) { <option [value]="u">{{ u }}</option> }
        </select>
        @if (invalido('uf')) { <div class="invalid-feedback">{{ msg('uf') }}</div> }
      </div>
      <div class="col-md-3">
        <label class="form-label fw-medium" for="cfg-ibge">Código IBGE</label>
        <input id="cfg-ibge" type="text" class="form-control" formControlName="codigoIbge" maxlength="7"
               inputmode="numeric" [class.is-invalid]="invalido('codigoIbge')" />
        @if (invalido('codigoIbge')) { <div class="invalid-feedback">{{ msg('codigoIbge') }}</div> }
      </div>
    </div>
  `
})
export class EnderecoComponent {
  private cepService = inject(CepService);
  form = input.required<FormGroup>();
  ufs = input<string[]>([]);

  buscando = signal(false);
  cepMsg = signal('');
  cepOk = signal(false);

  invalido(campo: string) {
    const c = this.form().get(campo);
    return !!c && c.invalid && (c.touched || c.dirty);
  }

  msg(campo: string): string {
    const e = this.form().get(campo)?.errors;
    return (e?.['servidor'] as string) ?? 'Valor inválido.';
  }

  onCepInput() {
    const cep = (this.form().get('cep')?.value ?? '').replace(/\D/g, '');
    if (cep.length === 8) this.buscarCep();
  }

  buscarCep() {
    const cep = (this.form().get('cep')?.value ?? '').replace(/\D/g, '');
    this.cepOk.set(false);
    if (cep.length !== 8) { this.cepMsg.set('CEP deve ter 8 dígitos.'); return; }
    this.buscando.set(true);
    this.cepMsg.set('');
    this.cepService.lookup(cep).subscribe({
      next: res => {
        this.buscando.set(false);
        if (res.erro) { this.cepMsg.set('CEP não encontrado.'); return; }
        const patch: Record<string, string | null> = {
          logradouro: res.logradouro ?? null,
          bairro: res.bairro ?? null,
          municipio: res.municipio ?? null,
          uf: res.uf?.toUpperCase() ?? null
        };
        const ibge = res.codigoIbge ?? res.ibge;
        if (ibge) patch['codigoIbge'] = ibge;
        this.form().patchValue(patch);
        this.cepOk.set(true);
        this.cepMsg.set('Endereço preenchido.');
      },
      error: () => { this.buscando.set(false); this.cepMsg.set('CEP não encontrado.'); }
    });
  }
}
