import { Component, OnDestroy, effect, inject, signal, viewChild, ElementRef } from '@angular/core';
import { Router } from '@angular/router';
import { Modal } from 'bootstrap';
import { EmpresaAtivaService } from '../../../core/services/empresa-ativa.service';
import { formatarCnpj } from '../../../core/utils/cnpj';

@Component({
  selector: 'app-seletor-empresa',
  standalone: true,
  templateUrl: './seletor-empresa.component.html'
})
export class SeletorEmpresaComponent implements OnDestroy {
  empresa = inject(EmpresaAtivaService);
  private router = inject(Router);

  modalEl = viewChild<ElementRef<HTMLElement>>('modalEl');
  private modal?: Modal;

  escolhido = signal<number | null>(null);
  formatarCnpj = formatarCnpj;

  constructor() {
    effect(() => {
      const el = this.modalEl()?.nativeElement;
      if (!el) return;
      this.modal ??= new Modal(el, { backdrop: 'static', keyboard: false });
      if (this.empresa.seletorAberto()) {
        this.escolhido.set(this.empresa.id());
        this.modal.show();
      } else {
        this.modal.hide();
      }
    });
  }

  ngOnDestroy() {
    this.modal?.hide();
    this.modal?.dispose();
  }

  confirmar() {
    const id = this.escolhido();
    if (id === null) return;
    const trocou = this.empresa.id() !== id;
    this.empresa.selecionar(id);
    if (trocou) this.router.navigate(['/imobilizado']);
  }
}
