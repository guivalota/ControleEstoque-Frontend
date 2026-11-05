import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Modal } from 'bootstrap';
import { EquipeComponent } from './equipe.component';

describe('Configurações → Equipe', () => {
  it('abre a equipe da empresa ativa (v1/equipe) para o administrador da empresa', () => {
    spyOn(Modal.prototype, 'show');
    spyOn(Modal.prototype, 'hide');
    TestBed.configureTestingModule({ imports: [EquipeComponent], providers: [provideHttpClient(), provideHttpClientTesting()] });
    const ctrl = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(EquipeComponent);
    fixture.detectChanges();

    ctrl.expectOne('/api/v1/equipe').flush([
      { usuarioId: 'u1', nome: 'Ana', email: 'ana@x.com', perfil: 'operador', ativo: true, criadoEm: '2026-11-05T10:00:00Z' }
    ]);
    ctrl.expectOne(r => r.url === '/api/v1/equipe/eventos').flush({ items: [], page: 1, pageSize: 20, total: 0 });
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Ana');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Novo membro');
    ctrl.verify();
  });
});
