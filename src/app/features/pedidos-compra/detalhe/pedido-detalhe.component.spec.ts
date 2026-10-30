import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { PedidoDetalheComponent } from './pedido-detalhe.component';
import { provideAuthFake } from '../../../testing/auth-fake';

describe('PedidoDetalheComponent', () => {
  let fixture: ComponentFixture<PedidoDetalheComponent>;
  let ctrl: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [PedidoDetalheComponent],
      providers: [
        provideRouter([]), provideHttpClient(), provideHttpClientTesting(), provideAuthFake('admin'),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: '5' }) } } }
      ]
    });
    ctrl = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(PedidoDetalheComponent);
    fixture.detectChanges();
  });

  afterEach(() => {
    ctrl.expectNone(r => r.url.endsWith('/v1/users'));
    ctrl.verify();
  });

  it('carrega os usuários ativos da empresa ativa para "Destinado a"', () => {
    const req = ctrl.expectOne(r => r.url === '/api/v1/empresa-ativa/usuarios');
    expect(req.request.params.get('ativo')).toBe('true');
    expect(req.request.params.get('pageSize')).toBe('100');
    req.flush({
      items: [{ id: 'u-1', nome: 'Ana', email: 'a@x.com', perfil: 'leitura', perfilEfetivo: 'admin', ativo: true }],
      page: 1, pageSize: 100, total: 1
    });
    ctrl.expectOne(r => r.url.endsWith('/v1/produtos')).flush({ items: [], page: 1, pageSize: 1000, total: 0 });
    ctrl.expectOne('/api/v1/pedidos-compra/5').flush({
      id: 5, descricao: 'Pedido', status: 'aberto', criadoPor: 'u-1', criadoPorNome: 'Ana', criadoEm: '2026-10-20T09:00:00Z', itens: []
    });
    fixture.detectChanges();
    expect(fixture.componentInstance.usuarios().map(u => u.nome)).toEqual(['Ana']);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Ana');
  });
});
