import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { EmpresaAtivaService } from '../../../core/services/empresa-ativa.service';
import { formatarCnpj } from '../../../core/utils/cnpj';

@Component({
  selector: 'app-imobilizado-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './imobilizado-shell.component.html'
})
export class ImobilizadoShellComponent {
  empresa = inject(EmpresaAtivaService);

  formatarCnpj = formatarCnpj;
}
