import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { EmpresaAtivaService } from '../../../core/services/empresa-ativa.service';
import { formatarCnpj } from '../../../core/utils/cnpj';
import { SeletorEmpresaComponent } from './seletor-empresa.component';

@Component({
  selector: 'app-imobilizado-shell',
  standalone: true,
  imports: [RouterOutlet, SeletorEmpresaComponent],
  templateUrl: './imobilizado-shell.component.html'
})
export class ImobilizadoShellComponent {
  empresa = inject(EmpresaAtivaService);
  formatarCnpj = formatarCnpj;
}
