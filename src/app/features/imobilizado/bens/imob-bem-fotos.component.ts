import { Component, ElementRef, OnDestroy, OnInit, inject, input, signal, viewChild } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ImobBemFotoService } from '../../../core/services/imob-bem-foto.service';
import { Anexo, FOTO_BEM_MAX_BYTES, FOTO_BEM_MAX_POR_BEM, FOTO_BEM_TIPOS } from '../../../core/models/anexo.model';
import { lerErroApi } from '../../../core/utils/erros-api';
import { formatarDataHora } from '../../../core/utils/imob-formato';
import { reduzirImagem } from '../../../core/utils/imagem';
import { ConfirmDialogComponent } from '../shared/confirm-dialog.component';

/**
 * Aba "Fotos" do bem (E27 / US-27-06): até 5 fotos de 5 MB (JPG, PNG ou WebP). A foto é reduzida no navegador antes de
 * enviar; o servidor confere o tipo real. Ver com `bens.ver`; enviar e excluir só com `podeEditar` (`bens.editar`).
 */
@Component({
  selector: 'app-imob-bem-fotos',
  standalone: true,
  imports: [ConfirmDialogComponent],
  template: `
    <div class="card border-0 shadow-sm">
      <div class="card-body">
        <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
          <h6 class="fw-semibold mb-0">
            Fotos <span class="text-muted small fw-normal" data-testid="contagem">({{ fotos().length }} de {{ maximo }})</span>
          </h6>
          @if (podeEditar()) {
            <div>
              <input #campoArquivo id="fotoArquivo" type="file" class="d-none" [accept]="tipos" multiple (change)="escolher($event)">
              <button type="button" class="btn btn-sm btn-primary" [disabled]="enviando() || fotos().length >= maximo"
                      (click)="campoArquivo.click()">
                @if (enviando()) { <span class="spinner-border spinner-border-sm me-1"></span>Enviando… } @else { <i class="bi bi-camera me-1"></i>Adicionar fotos }
              </button>
            </div>
          }
        </div>

        @if (erro()) { <div class="alert alert-danger py-2 small" role="alert">{{ erro() }}</div> }

        @if (carregando()) {
          <div class="text-center py-4 text-muted"><div class="spinner-border spinner-border-sm me-2"></div>Carregando fotos...</div>
        } @else if (fotos().length === 0) {
          <p class="text-muted mb-0">Nenhuma foto ainda.
            @if (podeEditar()) { <span>Use “Adicionar fotos” (até {{ maximo }}, de até 5 MB).</span> }
          </p>
        } @else {
          <div class="row g-3">
            @for (f of fotos(); track f.id) {
              @let url = urls()[f.id];
              <div class="col-6 col-md-4 col-lg-3">
                <div class="card h-100">
                  @if (url) {
                    <a [href]="url" target="_blank" rel="noopener noreferrer" [attr.aria-label]="'Abrir foto ' + f.nomeArquivo">
                      <img [src]="url" [alt]="f.nomeArquivo" class="card-img-top" style="aspect-ratio: 4 / 3; object-fit: cover;">
                    </a>
                  } @else {
                    <div class="d-flex align-items-center justify-content-center bg-light text-muted" style="aspect-ratio: 4 / 3;">
                      <div class="spinner-border spinner-border-sm"></div>
                    </div>
                  }
                  <div class="card-body p-2 small">
                    <div class="text-truncate" [title]="f.nomeArquivo">{{ f.nomeArquivo }}</div>
                    <div class="text-muted">{{ tamanho(f) }} · {{ data(f) }}</div>
                    @if (podeEditar()) {
                      <button type="button" class="btn btn-sm btn-outline-danger mt-2" [disabled]="excluindo() === f.id"
                              [attr.aria-label]="'Excluir foto ' + f.nomeArquivo" (click)="excluir(f)">
                        <i class="bi bi-trash me-1"></i>Excluir
                      </button>
                    }
                  </div>
                </div>
              </div>
            }
          </div>
        }
      </div>
    </div>
    <app-confirm-dialog />
  `
})
export class ImobBemFotosComponent implements OnInit, OnDestroy {
  private service = inject(ImobBemFotoService);
  private confirmDialog = viewChild.required(ConfirmDialogComponent);
  private campoArquivo = viewChild<ElementRef<HTMLInputElement>>('campoArquivo');

  bemId = input.required<number>();
  podeEditar = input(false);

  readonly maximo = FOTO_BEM_MAX_POR_BEM;
  readonly tipos = FOTO_BEM_TIPOS;

  fotos = signal<Anexo[]>([]);
  /** `blob:` de cada foto, por id (o conteúdo precisa de `X-Empresa-Id`, então vem por HttpClient). */
  urls = signal<Record<number, string>>({});
  carregando = signal(true);
  enviando = signal(false);
  excluindo = signal<number | null>(null);
  erro = signal('');

  ngOnInit() {
    this.service.listar(this.bemId()).subscribe({
      next: lista => { this.fotos.set(lista); this.carregando.set(false); lista.forEach(f => this.carregarImagem(f)); },
      error: err => { this.erro.set(lerErroApi(err, 'Não foi possível carregar as fotos.').mensagem); this.carregando.set(false); }
    });
  }

  ngOnDestroy() {
    Object.values(this.urls()).forEach(u => URL.revokeObjectURL(u));
  }

  private carregarImagem(f: Anexo) {
    this.service.conteudo(this.bemId(), f.id).subscribe({
      next: blob => this.urls.update(u => ({ ...u, [f.id]: URL.createObjectURL(blob) })),
      error: () => undefined // a miniatura fica com o indicador; o resto da lista segue
    });
  }

  tamanho(f: Anexo): string {
    return f.tamanho >= 1024 * 1024 ? `${(f.tamanho / (1024 * 1024)).toFixed(1).replace('.', ',')} MB` : `${Math.max(1, Math.round(f.tamanho / 1024))} KB`;
  }

  data(f: Anexo): string { return formatarDataHora(f.criadoEm); }

  async escolher(evento: Event) {
    const entrada = evento.target as HTMLInputElement;
    const escolhidos = Array.from(entrada.files ?? []);
    entrada.value = ''; // permite escolher o mesmo arquivo de novo
    if (escolhidos.length === 0 || this.enviando()) return;

    this.erro.set('');
    const vagas = this.maximo - this.fotos().length;
    const aEnviar = escolhidos.slice(0, Math.max(0, vagas));
    const avisos: string[] = [];
    if (escolhidos.length > aEnviar.length) avisos.push(`Só cabem mais ${Math.max(0, vagas)} foto(s) neste bem; as demais foram ignoradas.`);

    this.enviando.set(true);
    for (const original of aEnviar) {
      try {
        const arquivo = await reduzirImagem(original);
        if (arquivo.size > FOTO_BEM_MAX_BYTES) { avisos.push(`“${original.name}” passa de 5 MB mesmo reduzida.`); continue; }
        const foto = await firstValueFrom(this.service.enviar(this.bemId(), arquivo));
        this.fotos.update(l => [...l, foto]);
        this.carregarImagem(foto);
      } catch (err) {
        avisos.push(`“${original.name}”: ${lerErroApi(err, 'não foi possível enviar.').mensagem}`);
      }
    }
    this.enviando.set(false);
    if (avisos.length) this.erro.set(avisos.join(' '));
  }

  async excluir(f: Anexo) {
    const ok = await this.confirmDialog().abrir({
      titulo: 'Excluir foto',
      mensagem: `Excluir a foto “${f.nomeArquivo}”? A exclusão fica registrada no histórico do bem.`,
      confirmar: 'Excluir',
      perigo: true
    });
    if (!ok) return;
    this.excluindo.set(f.id);
    this.erro.set('');
    this.service.excluir(this.bemId(), f.id).subscribe({
      next: () => {
        const url = this.urls()[f.id];
        if (url) URL.revokeObjectURL(url);
        this.urls.update(u => Object.fromEntries(Object.entries(u).filter(([id]) => Number(id) !== f.id)));
        this.fotos.update(l => l.filter(x => x.id !== f.id));
        this.excluindo.set(null);
      },
      error: err => { this.excluindo.set(null); this.erro.set(lerErroApi(err, 'Não foi possível excluir a foto.').mensagem); }
    });
  }
}
