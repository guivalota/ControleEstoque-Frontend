import { Component, computed, effect, ElementRef, inject, signal, viewChild } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { marked } from 'marked';
import { EmpresaAtivaService } from '../../core/services/empresa-ativa.service';
import { PermissaoService } from '../../core/services/permissao.service';

export interface ManualModulo {
  chave: string;
  titulo: string;
  icone: string;
  arquivo: string;
  /** Aparece só para quem usa o módulo (módulo liberado na empresa e perfil que o usa). */
  visivel: boolean;
}

export interface ManualSecao {
  titulo: string;
}

/** Manual do usuário em abas: uma por módulo, cada uma um arquivo Markdown em `public/docs`. */
@Component({
  selector: 'app-manual',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './manual.component.html'
})
export class ManualComponent {
  private http = inject(HttpClient);
  private empresa = inject(EmpresaAtivaService);
  private permissao = inject(PermissaoService);
  private rota = inject(ActivatedRoute);

  private moduloDaRota = toSignal(this.rota.paramMap.pipe(map(p => p.get('modulo'))), { initialValue: null });

  /** O manual do Estoque é o geral do sistema e fica sempre; os demais só para quem usa o módulo. */
  modulos = computed<ManualModulo[]>(() => {
    const todos: ManualModulo[] = [
      { chave: 'estoque', titulo: 'Estoque', icone: 'bi-box-seam', arquivo: 'docs/manual-usuario.md', visivel: true },
      {
        chave: 'producao', titulo: 'Produção', icone: 'bi-scissors', arquivo: 'docs/manual-producao.md',
        visivel: this.empresa.temModulo('producao') && this.permissao.podeUsarEstoque()
      }
    ];
    return todos.filter(m => m.visivel);
  });

  /** Aba pedida na URL; se não existir ou não estiver liberada, cai no Estoque. */
  ativo = computed(() => this.modulos().find(m => m.chave === this.moduloDaRota()) ?? this.modulos()[0]);

  conteudo = signal('');
  secoes = signal<ManualSecao[]>([]);
  loading = signal(true);
  erro = signal(false);

  private cache = new Map<string, { html: string; secoes: ManualSecao[] }>();
  private requisicao = 0;

  constructor() {
    effect(() => this.carregar(this.ativo().arquivo));
  }

  private texto = viewChild<ElementRef<HTMLElement>>('texto');

  /** O sanitizador do [innerHTML] remove atributos id, então o título é achado pela posição entre os h2. */
  irPara(indice: number) {
    this.texto()?.nativeElement.querySelectorAll('h2')[indice]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  private carregar(arquivo: string) {
    const guardado = this.cache.get(arquivo);
    if (guardado) {
      this.conteudo.set(guardado.html);
      this.secoes.set(guardado.secoes);
      this.erro.set(false);
      this.loading.set(false);
      return;
    }
    const minha = ++this.requisicao;
    this.loading.set(true);
    this.erro.set(false);
    this.http.get(arquivo, { responseType: 'text' }).subscribe({
      next: md => {
        if (minha !== this.requisicao) return; // o usuário já trocou de aba
        const secoes: ManualSecao[] = [];
        // String simples: o binding [innerHTML] sanitiza, então não há bypassSecurityTrustHtml sobre HTML do marked.
        const html = (marked.parse(md) as string)
          .replace(/<table>/g, '<div class="table-responsive my-3"><table class="table table-bordered table-sm">')
          .replace(/<\/table>/g, '</table></div>')
          .replace(/<h2>(.*?)<\/h2>/g, (h2: string, titulo: string) => {
            secoes.push({ titulo: titulo.replace(/<[^>]+>/g, '') });
            return h2;
          });
        this.cache.set(arquivo, { html, secoes });
        this.conteudo.set(html);
        this.secoes.set(secoes);
        this.loading.set(false);
      },
      error: () => {
        if (minha !== this.requisicao) return;
        this.erro.set(true);
        this.loading.set(false);
      }
    });
  }
}
