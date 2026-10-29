import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-imobilizado-inicio',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="card border-0 shadow-sm">
      <div class="card-body">
        <p class="text-muted mb-2"><i class="bi bi-buildings me-2"></i>Controle patrimonial da empresa: bens, inventários, ordens de serviço e depreciação.</p>
        <div class="d-flex flex-wrap gap-2">
          <a routerLink="/imobilizado/bens" class="btn btn-sm btn-outline-primary">Bens</a>
          <a routerLink="/imobilizado/inventarios" class="btn btn-sm btn-outline-primary">Inventários</a>
          <a routerLink="/imobilizado/ordens-servico" class="btn btn-sm btn-outline-primary">Ordens de serviço</a>
          <a routerLink="/imobilizado/depreciacao" class="btn btn-sm btn-outline-primary">Depreciação</a>
          <a routerLink="/imobilizado/locais" class="btn btn-sm btn-outline-secondary">Locais</a>
          <a routerLink="/imobilizado/categorias" class="btn btn-sm btn-outline-secondary">Categorias</a>
          <a routerLink="/imobilizado/departamentos" class="btn btn-sm btn-outline-secondary">Departamentos</a>
          <a routerLink="/imobilizado/responsaveis" class="btn btn-sm btn-outline-secondary">Responsáveis</a>
          <a routerLink="/imobilizado/reavaliacao/estados-conservacao" class="btn btn-sm btn-outline-secondary">Estados de conservação</a>
          <a routerLink="/imobilizado/reavaliacao/pesos" class="btn btn-sm btn-outline-secondary">Pesos da reavaliação</a>
          <a routerLink="/imobilizado/reavaliacao/escalas" class="btn btn-sm btn-outline-secondary">Escalas VP e VF</a>
        </div>
      </div>
    </div>
  `
})
export class ImobilizadoInicioComponent {}
