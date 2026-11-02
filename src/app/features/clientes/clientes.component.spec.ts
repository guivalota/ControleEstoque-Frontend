import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { Modal } from 'bootstrap';
import { ClientesComponent } from './clientes.component';
import { provideAuthFake } from '../../testing/auth-fake';

describe('ClientesComponent (lista)', () => {
  let fixture: ComponentFixture<ClientesComponent>;
  let ctrl: HttpTestingController;
  const el = () => fixture.nativeElement as HTMLElement;

  function montar() {
    spyOn(Modal.prototype, 'show');
    spyOn(Modal.prototype, 'hide');
    TestBed.configureTestingModule({
      imports: [ClientesComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), provideAuthFake('admin')]
    });
    ctrl = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ClientesComponent);
    fixture.detectChanges();
  }

  afterEach(() => ctrl.verify());

  it('lista vazia mostra "Nenhum cliente" sem erro', () => {
    montar();
    ctrl.expectOne(r => r.url === '/api/v1/clientes').flush({ items: [], total: 0, page: 1, pageSize: 20 });
    fixture.detectChanges();

    expect(el().textContent).toContain('Nenhum cliente');
    expect(el().querySelector('[role=alert]')).toBeNull();
  });

  it('403 de perfil aparece como erro, não como lista vazia enganosa', () => {
    montar();
    ctrl.expectOne(r => r.url === '/api/v1/clientes').flush({ error: 'Seu perfil nesta empresa (contador) não permite esta ação.' }, { status: 403, statusText: 'Forbidden' });
    fixture.detectChanges();

    expect(el().querySelector('[role=alert]')?.textContent).toContain('não permite esta ação');
  });

  it('o erro some quando a busca seguinte dá certo', () => {
    montar();
    ctrl.expectOne(r => r.url === '/api/v1/clientes').flush({ error: 'falhou' }, { status: 500, statusText: 'Error' });
    fixture.componentInstance.buscar(1);
    ctrl.expectOne(r => r.url === '/api/v1/clientes').flush({ items: [], total: 0, page: 1, pageSize: 20 });
    fixture.detectChanges();

    expect(el().querySelector('[role=alert]')).toBeNull();
  });
});
