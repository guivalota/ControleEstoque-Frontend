import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { PedidosCompraComponent } from './pedidos-compra.component';
import { provideAuthFake } from '../../testing/auth-fake';

const USUARIOS = '/api/v1/empresa-ativa/usuarios';
const pagina = (items: unknown[]) => ({ items, page: 1, pageSize: 100, total: items.length });
const ana = { id: 'u-1', nome: 'Ana', email: 'a@x.com', perfil: 'leitura', perfilEfetivo: 'admin', ativo: true };
const beto = { id: 'u-2', nome: 'Beto Antigo', email: 'b@x.com', perfil: 'leitura', perfilEfetivo: 'leitura', ativo: false };

describe('PedidosCompraComponent', () => {
  let fixture: ComponentFixture<PedidosCompraComponent>;
  let ctrl: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [PedidosCompraComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), provideAuthFake('admin')]
    });
    ctrl = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(PedidosCompraComponent);
    fixture.detectChanges();
  });

  afterEach(() => {
    ctrl.expectNone(r => r.url.endsWith('/v1/users'));
    ctrl.verify();
  });

  it('"Destinado a" do formulário usa só ativos; filtros históricos carregam todos (100 por página)', () => {
    const reqs = ctrl.match(r => r.url === USUARIOS);
    expect(reqs.length).toBe(2);
    const ativos = reqs.find(r => r.request.params.get('ativo') === 'true')!;
    const todos = reqs.find(r => !r.request.params.has('ativo'))!;
    expect(ativos.request.params.get('pageSize')).toBe('100');
    expect(todos.request.params.get('pageSize')).toBe('100');
    ativos.flush(pagina([ana]));
    todos.flush(pagina([ana, beto]));
    ctrl.expectOne(r => r.url.endsWith('/v1/produtos')).flush(pagina([]));
    ctrl.expectOne(r => r.url.endsWith('/v1/pedidos-compra')).flush({ items: [], page: 1, pageSize: 50, total: 0 });
    fixture.detectChanges();

    const comp = fixture.componentInstance;
    expect(comp.usuarios().map(u => u.nome)).toEqual(['Ana']);
    expect(comp.usuariosFiltro().map(u => u.nome)).toEqual(['Ana', 'Beto Antigo']);
    const opcoes = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('select option')).map(o => o.textContent?.trim());
    expect(opcoes.filter(o => o === 'Beto Antigo').length).toBe(2); // filtros "criado por" e "destinado a"
    expect(opcoes.filter(o => o === 'Ana').length).toBe(3);        // + "Destinado a" do modal
  });
});
