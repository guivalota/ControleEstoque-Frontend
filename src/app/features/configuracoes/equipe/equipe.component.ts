import { Component } from '@angular/core';
import { EmpresaEquipeComponent } from '../../plataforma/empresas/empresa-equipe.component';

/**
 * Configurações → Equipe: o administrador da empresa cria e gere os usuários da própria empresa
 * (`v1/equipe`). Reaproveita a tela de equipe do painel da Plataforma, sem `empresaId`.
 */
@Component({
  selector: 'app-configuracoes-equipe',
  standalone: true,
  imports: [EmpresaEquipeComponent],
  template: `<app-empresa-equipe />`
})
export class EquipeComponent {}
