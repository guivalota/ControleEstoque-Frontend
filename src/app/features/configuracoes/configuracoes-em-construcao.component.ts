import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

/** Placeholder das abas ainda não implementadas (cada story de E17 substitui a rota por sua tela). */
@Component({
  selector: 'app-configuracoes-em-construcao',
  standalone: true,
  template: `
    <div class="card border-0 shadow-sm">
      <div class="card-body text-center py-5 text-muted">
        <i class="bi bi-tools fs-1"></i>
        <p class="mt-3 mb-0 fw-medium">{{ titulo }}: em construção.</p>
      </div>
    </div>
  `
})
export class ConfiguracoesEmConstrucaoComponent {
  titulo = inject(ActivatedRoute).snapshot.data['titulo'] as string;
}
