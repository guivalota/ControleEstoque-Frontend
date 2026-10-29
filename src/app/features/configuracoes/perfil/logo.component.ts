import { Component, ElementRef, inject, input, OnDestroy, OnInit, output, signal, viewChild } from '@angular/core';
import { EmpresaPerfilService } from '../../../core/services/empresa-perfil.service';
import { lerErroApi, textoDoErro } from '../../../core/utils/erros-api';

@Component({
  selector: 'app-config-logo',
  standalone: true,
  template: `
    <div class="d-flex flex-wrap align-items-center gap-3">
      <div class="border rounded d-flex align-items-center justify-content-center bg-body-tertiary" style="width: 160px; height: 100px;">
        @if (previa()) {
          <img [src]="previa()" alt="Pré-visualização do logo" style="max-width: 100%; max-height: 100%;" />
        } @else if (service.logoUrl()) {
          <img [src]="service.logoUrl()" alt="Logo da empresa" style="max-width: 100%; max-height: 100%;" />
        } @else {
          <span class="text-muted small">Sem logo</span>
        }
      </div>
      <div>
        <input #arquivoEl type="file" class="form-control form-control-sm mb-2" accept="image/png,image/jpeg"
               aria-label="Arquivo do logo" (change)="escolher($event)" />
        <div class="small text-muted mb-2">PNG ou JPG, até {{ limiteMb() }} MB e {{ dimensaoMaximaPx() }}×{{ dimensaoMaximaPx() }} px.</div>
        <div class="d-flex gap-2">
          <button type="button" class="btn btn-sm btn-primary" [disabled]="!arquivo() || enviando()" (click)="enviar()">
            @if (enviando()) { <span class="spinner-border spinner-border-sm me-1"></span> }Enviar logo
          </button>
          <button type="button" class="btn btn-sm btn-outline-danger" [disabled]="!service.logoUrl() || enviando()" (click)="remover()">
            Remover logo
          </button>
        </div>
      </div>
    </div>
    @if (erro()) { <div class="alert alert-danger py-2 mt-2 mb-0" role="alert">{{ erro() }}</div> }
    @if (ok()) { <div class="alert alert-success py-2 mt-2 mb-0" role="status">{{ ok() }}</div> }
  `
})
export class LogoComponent implements OnInit, OnDestroy {
  service = inject(EmpresaPerfilService);
  tamanhoMaximoBytes = input<number>(1048576);
  dimensaoMaximaPx = input<number>(2000);
  alterado = output<void>();

  arquivoEl = viewChild<ElementRef<HTMLInputElement>>('arquivoEl');
  arquivo = signal<File | null>(null);
  previa = signal<string | null>(null);
  enviando = signal(false);
  erro = signal('');
  ok = signal('');

  limiteMb = () => Math.round((this.tamanhoMaximoBytes() / 1048576) * 10) / 10;

  ngOnInit() {
    this.service.carregarLogo().subscribe();
  }

  ngOnDestroy() {
    this.limparPrevia();
  }

  private limparPrevia() {
    const p = this.previa();
    if (p) URL.revokeObjectURL(p);
    this.previa.set(null);
  }

  escolher(ev: Event) {
    this.erro.set(''); this.ok.set('');
    this.limparPrevia();
    const f = (ev.target as HTMLInputElement).files?.[0] ?? null;
    this.arquivo.set(f);
    if (f) this.previa.set(URL.createObjectURL(f));
  }

  enviar() {
    const f = this.arquivo();
    if (!f) return;
    this.enviando.set(true); this.erro.set(''); this.ok.set('');
    // Tipo, tamanho e dimensão são validados pelo servidor; a mensagem dele é exibida como veio.
    this.service.enviarLogo(f).subscribe({
      next: () => {
        this.service.definirLogo(f);
        this.limparPrevia();
        this.arquivo.set(null);
        const el = this.arquivoEl()?.nativeElement;
        if (el) el.value = '';
        this.enviando.set(false);
        this.ok.set('Logo atualizado.');
        this.alterado.emit();
      },
      error: err => { this.erro.set(textoDoErro(lerErroApi(err, 'Erro ao enviar o logo.'), 'Erro ao enviar o logo.')); this.enviando.set(false); }
    });
  }

  remover() {
    this.enviando.set(true); this.erro.set(''); this.ok.set('');
    this.service.removerLogo().subscribe({
      next: () => {
        this.service.definirLogo(null);
        this.limparPrevia();
        this.arquivo.set(null);
        this.enviando.set(false);
        this.ok.set('Logo removido.');
        this.alterado.emit();
      },
      error: err => { this.erro.set(textoDoErro(lerErroApi(err, 'Erro ao remover o logo.'), 'Erro ao remover o logo.')); this.enviando.set(false); }
    });
  }
}
