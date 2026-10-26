import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subscription, debounceTime, distinctUntilChanged, switchMap } from 'rxjs';
import { ImobDepreciacaoService } from '../../../core/services/imob-depreciacao.service';
import { AjudaDepreciacao } from '../../../core/models/imob-depreciacao.model';
import { lerErroApi } from '../../../core/utils/erros-api';
import { formatarData } from '../../../core/utils/imob-formato';
import { renderizarMarkdown } from '../../../core/utils/markdown-seguro';

const ATRASO_BUSCA_MS = 300;

@Component({
  selector: 'app-imob-depreciacao-ajuda',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './imob-depreciacao-ajuda.component.html'
})
export class ImobDepreciacaoAjudaComponent implements OnInit, OnDestroy {
  private service = inject(ImobDepreciacaoService);
  private route = inject(ActivatedRoute);
  private busca$?: Subscription;

  formatarData = formatarData;
  renderizar = renderizarMarkdown;

  busca = new FormControl('', { nonNullable: true });
  ajuda = signal<AjudaDepreciacao | null>(null);
  loading = signal(false);
  erro = signal('');
  /** Seção aberta por link direto (`?secao=slug`). */
  secaoDestaque = signal(this.route.snapshot.queryParamMap.get('secao'));

  secoes = computed(() => [...(this.ajuda()?.secoes ?? [])].sort((a, b) => a.ordem - b.ordem));

  ngOnInit() {
    this.loading.set(true);
    this.busca$ = this.busca.valueChanges.pipe(
      debounceTime(ATRASO_BUSCA_MS),
      distinctUntilChanged(),
      switchMap(q => {
        this.loading.set(true);
        return this.service.ajuda(q.trim() || undefined);
      })
    ).subscribe({
      next: a => this.aplicar(a),
      error: err => this.falhar(err)
    });
    this.service.ajuda().subscribe({ next: a => this.aplicar(a), error: err => this.falhar(err) });
  }

  ngOnDestroy() {
    this.busca$?.unsubscribe();
  }

  irPara(slug: string) {
    document.getElementById(`secao-${slug}`)?.scrollIntoView({ behavior: 'smooth' });
  }

  private aplicar(a: AjudaDepreciacao) {
    this.ajuda.set(a);
    this.loading.set(false);
    this.erro.set('');
  }

  private falhar(err: unknown) {
    this.loading.set(false);
    this.erro.set(lerErroApi(err, 'Erro ao carregar a ajuda.').mensagem);
  }
}
