import { Directive, TemplateRef, ViewContainerRef, computed, effect, inject, input } from '@angular/core';
import { Permissao } from '../../core/models/permissoes';
import { PermissaoService } from '../../core/services/permissao.service';

/**
 * Mostra o elemento só se o usuário tem a permissão (ou alguma, se vier uma lista). Reage a mudança de empresa/perfil.
 * <pre>
 * &lt;button *appPode="'estoque.produtos.criar'"&gt;Novo&lt;/button&gt;
 * </pre>
 * O servidor é quem decide de verdade; isto só evita mostrar o que ia ser negado (E25, DSG-27).
 */
@Directive({ selector: '[appPode]', standalone: true })
export class PodeDirective {
  private permissao = inject(PermissaoService);
  private modelo = inject(TemplateRef<unknown>);
  private recipiente = inject(ViewContainerRef);
  private visivel = false;

  appPode = input.required<Permissao | readonly Permissao[]>();

  constructor() {
    effect(() => {
      const pode = this.permissao.pode(this.appPode());
      if (pode && !this.visivel) {
        this.recipiente.createEmbeddedView(this.modelo);
        this.visivel = true;
      } else if (!pode && this.visivel) {
        this.recipiente.clear();
        this.visivel = false;
      }
    });
  }
}

/**
 * Desabilita o elemento (botão, link) quando o usuário não tem a permissão, em vez de escondê-lo — útil quando a ação deve
 * continuar visível, mas indisponível.
 */
@Directive({
  selector: '[appPodeDesabilitar]',
  standalone: true,
  host: {
    '[attr.disabled]': 'bloqueado() ? "" : null',
    '[attr.aria-disabled]': 'bloqueado() ? "true" : null',
    '[class.disabled]': 'bloqueado()'
  }
})
export class PodeDesabilitarDirective {
  private permissao = inject(PermissaoService);

  appPodeDesabilitar = input.required<Permissao | readonly Permissao[]>();

  bloqueado = computed(() => !this.permissao.pode(this.appPodeDesabilitar()));
}
