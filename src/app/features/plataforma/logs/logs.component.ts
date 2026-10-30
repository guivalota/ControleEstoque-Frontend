import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { LogsAuditoriaComponent } from './logs-auditoria.component';
import { LogsSistemaComponent } from './logs-sistema.component';
import { LogsTrilhaComponent } from './logs-trilha.component';

type Aba = 'trilha' | 'auditoria' | 'sistema';

/** Logs do painel: Trilha da plataforma, Auditoria de acesso e Logs do sistema. `?empresaId=` pré-filtra a trilha. */
@Component({
  selector: 'app-plataforma-logs',
  standalone: true,
  imports: [LogsTrilhaComponent, LogsAuditoriaComponent, LogsSistemaComponent],
  template: `
    <h5 class="fw-bold mb-3">Logs</h5>
    <ul class="nav nav-tabs mb-3" role="tablist">
      @for (a of abas; track a.id) {
        <li class="nav-item" role="presentation">
          <button type="button" class="nav-link" role="tab" [class.active]="aba() === a.id"
                  [attr.aria-selected]="aba() === a.id" (click)="aba.set(a.id)">{{ a.rotulo }}</button>
        </li>
      }
    </ul>
    @switch (aba()) {
      @case ('trilha') { <app-logs-trilha [empresaIdInicial]="empresaId" /> }
      @case ('auditoria') { <app-logs-auditoria /> }
      @case ('sistema') { <app-logs-sistema /> }
    }
  `
})
export class PlataformaLogsComponent {
  private route = inject(ActivatedRoute);

  readonly abas: { id: Aba; rotulo: string }[] = [
    { id: 'trilha', rotulo: 'Trilha da plataforma' },
    { id: 'auditoria', rotulo: 'Auditoria de acesso' },
    { id: 'sistema', rotulo: 'Logs do sistema' }
  ];
  aba = signal<Aba>('trilha');

  readonly empresaId = (() => {
    const v = Number(this.route.snapshot.queryParamMap.get('empresaId'));
    return Number.isInteger(v) && v > 0 ? v : undefined;
  })();
}
