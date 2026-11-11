import { Component, OnChanges, OnDestroy, SimpleChanges, inject, input, output, signal, viewChild } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ImobDepartamentoService } from '../../../core/services/imob-departamento.service';
import { ImobEstadoConservacaoService } from '../../../core/services/imob-estado-conservacao.service';
import { ImobDepartamento } from '../../../core/models/imob-departamento.model';
import { ImobEstadoConservacao } from '../../../core/models/imob-reavaliacao.model';
import { ImobConferenciaService } from '../../../core/services/imob-conferencia.service';
import { Anexo, FOTO_BEM_MAX_BYTES, FOTO_BEM_TIPOS } from '../../../core/models/anexo.model';
import { ImobConferenciaDetalhe } from '../../../core/models/imob-leitura.model';
import { lerErroApi } from '../../../core/utils/erros-api';
import { formatarDataHora, formatarMoeda } from '../../../core/utils/imob-formato';
import { reduzirImagem } from '../../../core/utils/imagem';
import { ROTULO_ORIGEM_CONFERENCIA, textoEvento } from '../../../core/utils/imob-conferencia-eventos';
import { ConfirmDialogComponent } from '../shared/confirm-dialog.component';

/** Fotos de evidência por conferência (iguais às do servidor, que é quem decide). */
export const FOTO_CONFERENCIA_MAX = 5;

/**
 * Conferência de um bem num ciclo de reavaliação (E28 / US-28-01 e 02): esperado (congelado ao iniciar) × encontrado, fotos
 * de evidência e o histórico de gravações. A foto pertence à conferência, não ao cadastro do bem (DSG-30 R4/R5). Com o ciclo
 * concluído tudo é somente leitura.
 */
@Component({
  selector: 'app-imob-conferencia-detalhe',
  standalone: true,
  imports: [ConfirmDialogComponent, ReactiveFormsModule],
  template: `
    <div class="card border-0 shadow-sm mb-3" data-testid="conferencia-detalhe">
      <div class="card-header bg-transparent d-flex justify-content-between align-items-center">
        <span class="fw-semibold">
          Conferência · {{ detalhe()?.plaqueta ?? '…' }}
          @if (detalhe()?.descricao) { <span class="text-muted fw-normal small">{{ detalhe()?.descricao }}</span> }
        </span>
        <button type="button" class="btn btn-sm btn-outline-primary" aria-label="Fechar detalhe" (click)="fechar.emit()">
          <i class="bi bi-x-lg me-1"></i>Fechar
        </button>
      </div>

      @if (erro()) { <div class="alert alert-danger py-2 mx-3 mt-3 mb-0" role="alert">{{ erro() }}</div> }

      @if (carregando()) {
        <div class="card-body text-center text-muted"><div class="spinner-border spinner-border-sm me-2"></div>Carregando…</div>
      } @else if (detalhe()) {
        @let d = detalhe()!;
        <div class="card-body">
          <p class="small text-muted mb-2">
            Ciclo <strong>{{ d.inventarioNome }}</strong>
            @if (d.somenteLeitura) { <span class="badge bg-secondary ms-1" data-testid="somente-leitura">Concluído · somente leitura</span> }
          </p>

          <div class="table-responsive mb-3">
            <table class="table table-sm align-middle mb-0">
              <thead><tr><th></th><th>Esperado (cadastro no início do ciclo)</th><th>Encontrado na conferência</th></tr></thead>
              <tbody>
                <tr><th scope="row">Local</th><td>{{ d.localEsperadoNome || '—' }}</td><td>{{ d.localLidoNome || '—' }}</td></tr>
                <tr><th scope="row">Departamento</th><td>{{ d.departamentoEsperadoNome || '—' }}</td><td>{{ d.departamentoNome || '—' }}</td></tr>
                <tr><th scope="row">Estado de conservação</th><td class="text-muted">—</td><td>{{ d.estadoNome || '—' }}</td></tr>
                <tr><th scope="row">Valor de mercado</th><td class="text-muted">—</td><td>{{ d.valorMercado !== null && d.valorMercado !== undefined ? formatarMoeda(d.valorMercado) : '—' }}</td></tr>
                <tr><th scope="row">Observação</th><td class="text-muted">—</td><td>{{ d.observacao || '—' }}</td></tr>
                <tr>
                  <th scope="row">Situação</th>
                  <td></td>
                  <td>
                    @if (!d.encontrado) { <span class="badge bg-light text-dark border">Não encontrado</span> }
                    @else if (d.incompleto) { <span class="badge bg-warning-subtle text-warning-emphasis">Incompleto</span> }
                    @else { <span class="badge bg-success-subtle text-success-emphasis">Completo</span> }
                    @if (d.conferidoEm) { <span class="text-muted small ms-2">{{ d.conferidoPorNome || '—' }} · {{ formatarDataHora(d.conferidoEm) }}</span> }
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          @if (podeEditar() && !d.somenteLeitura) {
            @if (!editando()) {
              <button type="button" class="btn btn-sm btn-outline-primary mb-3" data-testid="editar" (click)="abrirEdicao()">
                <i class="bi bi-pencil me-1"></i>Editar conferência
              </button>
            } @else {
              <form class="border rounded p-3 mb-3" data-testid="form-edicao" [formGroup]="form" (submit)="$event.preventDefault(); salvarEdicao()">
                <div class="row g-2">
                  <div class="col-md-4">
                    <label class="form-label small mb-1" for="confEstado">Estado de conservação</label>
                    <select id="confEstado" class="form-select form-select-sm" formControlName="estadoId">
                      <option [ngValue]="null">Não informado</option>
                      @for (e of estados(); track e.id) { <option [ngValue]="e.id">{{ e.nome }}</option> }
                    </select>
                  </div>
                  <div class="col-md-4">
                    <label class="form-label small mb-1" for="confValor">Valor de mercado (R$)</label>
                    <input id="confValor" type="number" step="0.01" min="0" class="form-control form-control-sm" formControlName="valorMercado">
                    @if (form.controls.valorMercado.invalid && form.controls.valorMercado.touched) { <div class="text-danger small">Informe um valor maior ou igual a zero.</div> }
                  </div>
                  <div class="col-md-4">
                    <label class="form-label small mb-1" for="confDepto">Departamento encontrado</label>
                    <select id="confDepto" class="form-select form-select-sm" formControlName="departamentoId">
                      <option [ngValue]="null">Não informado</option>
                      @for (dep of departamentos(); track dep.id) { <option [ngValue]="dep.id">{{ dep.nome }}</option> }
                    </select>
                  </div>
                  <div class="col-12">
                    <label class="form-label small mb-1" for="confObs">Observação</label>
                    <textarea id="confObs" rows="2" maxlength="500" class="form-control form-control-sm" formControlName="observacao"></textarea>
                  </div>
                </div>
                <p class="small text-muted mt-2 mb-2">
                  Vale a gravação mais recente e fica registrada no histórico (origem Web). Campo deixado em branco <strong>não apaga</strong> o que já está gravado.
                </p>
                <div class="d-flex gap-2">
                  <button type="submit" class="btn btn-sm btn-primary" data-testid="salvar-edicao" [disabled]="salvando()">
                    @if (salvando()) { <span class="spinner-border spinner-border-sm me-1"></span> }Salvar
                  </button>
                  <button type="button" class="btn btn-sm btn-outline-primary" [disabled]="salvando()" (click)="cancelarEdicao()">Cancelar</button>
                </div>
              </form>
            }
          }

          <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
            <h6 class="fw-semibold mb-0">
              Fotos de evidência <span class="text-muted small fw-normal" data-testid="contagem-fotos">({{ fotos().length }} de {{ maximo }})</span>
            </h6>
            @if (podeEnviar() && !d.somenteLeitura) {
              <div>
                <input #campoArquivo type="file" class="d-none" [accept]="tipos" multiple (change)="escolher($event)">
                <button type="button" class="btn btn-sm btn-primary" [disabled]="enviando() || fotos().length >= maximo" (click)="campoArquivo.click()">
                  @if (enviando()) { <span class="spinner-border spinner-border-sm me-1"></span>Enviando… } @else { <i class="bi bi-camera me-1"></i>Adicionar fotos }
                </button>
              </div>
            }
          </div>
          @if (fotos().length === 0) {
            <p class="text-muted small">Nenhuma foto de evidência nesta conferência.</p>
          } @else {
            <div class="row g-2 mb-3">
              @for (f of fotos(); track f.id) {
                @let url = urls()[f.id];
                <div class="col-6 col-md-3 col-lg-2">
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
                      <div class="text-muted">{{ formatarDataHora(f.criadoEm) }}</div>
                      @if (podeExcluir() && !d.somenteLeitura) {
                        <button type="button" class="btn btn-sm btn-outline-danger mt-1" [disabled]="excluindo() === f.id"
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

          <h6 class="fw-semibold mb-2">Histórico da conferência</h6>
          @if (d.eventos.length === 0) {
            <p class="text-muted small mb-0">Nenhuma gravação registrada.</p>
          } @else {
            <div class="table-responsive">
              <table class="table table-sm align-middle mb-0" data-testid="historico-conferencia">
                <thead><tr><th>Quando</th><th>Quem</th><th>Origem</th><th>O que mudou</th></tr></thead>
                <tbody>
                  @for (e of d.eventos; track e.id) {
                    <tr>
                      <td>{{ formatarDataHora(e.criadoEm) }}</td>
                      <td>{{ e.usuarioNome || '—' }}</td>
                      <td><span class="badge bg-light text-dark border">{{ rotuloOrigem[e.origem] || e.origem }}</span></td>
                      <td>{{ textoEvento(e) }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </div>
      }
    </div>
    <app-confirm-dialog />
  `
})
export class ImobConferenciaDetalheComponent implements OnChanges, OnDestroy {
  private service = inject(ImobConferenciaService);
  private estadosApi = inject(ImobEstadoConservacaoService);
  private departamentosApi = inject(ImobDepartamentoService);
  private confirmDialog = viewChild.required(ConfirmDialogComponent);

  inventarioId = input.required<number>();
  bemId = input.required<number>();
  /** `inventarios-leituras.criar` */
  podeEnviar = input(false);
  /** `inventarios-leituras.excluir` */
  podeExcluir = input(false);
  /** `inventarios-leituras.criar`: corrigir estado, valor, departamento e observação (só com o ciclo em andamento). */
  podeEditar = input(false);

  fechar = output<void>();
  /** Fotos enviadas ou excluídas: a lista do ciclo atualiza a contagem. */
  alterou = output<void>();

  readonly maximo = FOTO_CONFERENCIA_MAX;
  readonly tipos = FOTO_BEM_TIPOS;
  readonly rotuloOrigem = ROTULO_ORIGEM_CONFERENCIA;
  readonly formatarDataHora = formatarDataHora;
  readonly formatarMoeda = formatarMoeda;
  readonly textoEvento = textoEvento;

  detalhe = signal<ImobConferenciaDetalhe | null>(null);
  fotos = signal<Anexo[]>([]);
  /** `blob:` de cada foto, por id (o conteúdo precisa de `X-Empresa-Id`, então vem por HttpClient). */
  urls = signal<Record<number, string>>({});
  carregando = signal(true);
  enviando = signal(false);
  excluindo = signal<number | null>(null);
  erro = signal('');

  // Edição da conferência (corrigir o que veio do app, por exemplo)
  editando = signal(false);
  salvando = signal(false);
  estados = signal<ImobEstadoConservacao[]>([]);
  departamentos = signal<ImobDepartamento[]>([]);
  form = new FormGroup({
    estadoId: new FormControl<number | null>(null),
    valorMercado: new FormControl<number | null>(null, { validators: [Validators.min(0)] }),
    departamentoId: new FormControl<number | null>(null),
    observacao: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(500)] })
  });

  ngOnChanges(mudancas: SimpleChanges) {
    if (mudancas['bemId'] || mudancas['inventarioId']) this.carregar();
  }

  ngOnDestroy() {
    this.liberarUrls();
  }

  private liberarUrls() {
    Object.values(this.urls()).forEach(u => URL.revokeObjectURL(u));
    this.urls.set({});
  }

  /** Abre o formulário já com o que está gravado; as listas (estados e departamentos ativos) vêm na primeira vez. */
  abrirEdicao() {
    const d = this.detalhe();
    if (!d) return;
    this.form.reset({
      estadoId: d.estadoId ?? null, valorMercado: d.valorMercado ?? null,
      departamentoId: d.departamentoId ?? null, observacao: d.observacao ?? ''
    });
    this.erro.set('');
    this.editando.set(true);
    if (this.estados().length === 0) {
      this.estadosApi.listar({ ativo: true, pageSize: 200 }).subscribe({ next: r => this.estados.set(r.items), error: () => undefined });
    }
    if (this.departamentos().length === 0) {
      this.departamentosApi.listar({ ativo: true, pageSize: 1000 }).subscribe({ next: r => this.departamentos.set(r.items), error: () => undefined });
    }
  }

  cancelarEdicao() {
    this.editando.set(false);
  }

  salvarEdicao() {
    if (this.form.invalid || this.salvando()) { this.form.markAllAsTouched(); return; }
    const v = this.form.getRawValue();
    this.salvando.set(true);
    this.erro.set('');
    this.service.conferir(this.inventarioId(), this.bemId(), {
      estadoId: v.estadoId, valorMercado: v.valorMercado, departamentoId: v.departamentoId, observacao: v.observacao.trim() || null
    }).subscribe({
      next: r => {
        this.salvando.set(false);
        if (r.resultado !== 'gravada') { this.erro.set(r.erro || 'A conferência não foi gravada (já existe uma mais recente).'); return; }
        this.editando.set(false);
        this.recarregarDetalhe();
        this.alterou.emit();
      },
      error: err => { this.salvando.set(false); this.erro.set(lerErroApi(err, 'Não foi possível gravar a conferência.').mensagem); }
    });
  }

  private carregar() {
    this.carregando.set(true);
    this.erro.set('');
    this.editando.set(false);
    this.detalhe.set(null);
    this.fotos.set([]);
    this.liberarUrls();
    const inv = this.inventarioId(), bem = this.bemId();
    this.service.obter(inv, bem).subscribe({
      next: d => { this.detalhe.set(d); this.carregando.set(false); this.carregarFotos(); },
      error: err => { this.carregando.set(false); this.erro.set(lerErroApi(err, 'Não foi possível carregar a conferência.').mensagem); }
    });
  }

  /** Recarrega só o histórico (depois de enviar ou excluir foto, que também entram nele). */
  private recarregarDetalhe() {
    this.service.obter(this.inventarioId(), this.bemId()).subscribe({ next: d => this.detalhe.set(d), error: () => undefined });
  }

  private carregarFotos() {
    this.service.fotos(this.inventarioId(), this.bemId()).subscribe({
      next: lista => { this.fotos.set(lista); lista.forEach(f => this.carregarImagem(f)); },
      error: err => this.erro.set(lerErroApi(err, 'Não foi possível carregar as fotos.').mensagem)
    });
  }

  private carregarImagem(f: Anexo) {
    this.service.conteudoFoto(this.inventarioId(), this.bemId(), f.id).subscribe({
      next: blob => this.urls.update(u => ({ ...u, [f.id]: URL.createObjectURL(blob) })),
      error: () => undefined // a miniatura fica com o indicador; o resto segue
    });
  }

  async escolher(evento: Event) {
    const entrada = evento.target as HTMLInputElement;
    const escolhidos = Array.from(entrada.files ?? []);
    entrada.value = ''; // permite escolher o mesmo arquivo de novo
    if (escolhidos.length === 0 || this.enviando()) return;

    this.erro.set('');
    const vagas = this.maximo - this.fotos().length;
    const aEnviar = escolhidos.slice(0, Math.max(0, vagas));
    const avisos: string[] = [];
    if (escolhidos.length > aEnviar.length) avisos.push(`Só cabem mais ${Math.max(0, vagas)} foto(s) nesta conferência; as demais foram ignoradas.`);

    this.enviando.set(true);
    let enviou = false;
    for (const original of aEnviar) {
      try {
        const arquivo = await reduzirImagem(original);
        if (arquivo.size > FOTO_BEM_MAX_BYTES) { avisos.push(`“${original.name}” passa de 5 MB mesmo reduzida.`); continue; }
        const foto = await firstValueFrom(this.service.enviarFoto(this.inventarioId(), this.bemId(), arquivo));
        this.fotos.update(l => [...l, foto]);
        this.carregarImagem(foto);
        enviou = true;
      } catch (err) {
        avisos.push(`“${original.name}”: ${lerErroApi(err, 'não foi possível enviar.').mensagem}`);
      }
    }
    this.enviando.set(false);
    if (avisos.length) this.erro.set(avisos.join(' '));
    if (enviou) { this.recarregarDetalhe(); this.alterou.emit(); }
  }

  async excluir(f: Anexo) {
    const ok = await this.confirmDialog().abrir({
      titulo: 'Excluir foto',
      mensagem: `Excluir a foto “${f.nomeArquivo}” desta conferência? A exclusão fica registrada no histórico da conferência.`,
      confirmar: 'Excluir',
      perigo: true
    });
    if (!ok) return;
    this.excluindo.set(f.id);
    this.erro.set('');
    this.service.excluirFoto(this.inventarioId(), this.bemId(), f.id).subscribe({
      next: () => {
        const url = this.urls()[f.id];
        if (url) URL.revokeObjectURL(url);
        this.urls.update(u => Object.fromEntries(Object.entries(u).filter(([id]) => Number(id) !== f.id)));
        this.fotos.update(l => l.filter(x => x.id !== f.id));
        this.excluindo.set(null);
        this.recarregarDetalhe();
        this.alterou.emit();
      },
      error: err => { this.excluindo.set(null); this.erro.set(lerErroApi(err, 'Não foi possível excluir a foto.').mensagem); }
    });
  }
}
