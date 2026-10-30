import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { UsersComponent } from './users.component';
import { provideAuthFake } from '../../testing/auth-fake';

const URL = '/api/v1/empresa-ativa/usuarios';
const pagina = (total = 2, page = 1) => ({
  items: [
    { id: 'u-1', nome: 'Ana Admin', email: 'ana@x.com', perfil: 'leitura', perfilEfetivo: 'admin', ativo: true },
    { id: 'u-2', nome: 'Beto Inativo', email: 'beto@x.com', perfil: 'operador', perfilEfetivo: 'operador', ativo: false }
  ],
  page, pageSize: 50, total
});

describe('UsersComponent (usuários da empresa ativa)', () => {
  let fixture: ComponentFixture<UsersComponent>;
  let comp: UsersComponent;
  let ctrl: HttpTestingController;
  const texto = () => ((fixture.nativeElement as HTMLElement).textContent ?? '').replace(/\s+/g, ' ');

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [UsersComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideAuthFake('admin')]
    });
    ctrl = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(UsersComponent);
    comp = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    ctrl.expectNone(r => r.url.endsWith('/v1/users'));
    ctrl.verify();
  });

  it('lista em somente leitura via empresa-ativa/usuarios (sem v1/users e sem botões de CRUD)', () => {
    const req = ctrl.expectOne(r => r.url === URL);
    expect(req.request.params.get('page')).toBe('1');
    expect(req.request.params.get('pageSize')).toBe('50');
    expect(req.request.params.has('busca')).toBeFalse();
    expect(req.request.params.has('ativo')).toBeFalse();
    req.flush(pagina());
    fixture.detectChanges();

    expect(texto()).toContain('Ana Admin');
    expect(texto()).toContain('Admin');
    expect(texto()).toContain('Inativo');
    expect(texto()).toContain('Gerenciar equipe: em breve');
    expect(texto()).not.toContain('Novo Usuário');
    expect(fixture.nativeElement.querySelector('button[title="Editar"], button[title="Excluir"]')).toBeNull();
  });

  it('busca e status vão ao servidor', () => {
    ctrl.expectOne(r => r.url === URL).flush(pagina());
    comp.busca = ' ana ';
    comp.filtroAtivo = 'true';
    comp.carregar(1);
    const req = ctrl.expectOne(r => r.url === URL);
    expect(req.request.params.get('busca')).toBe('ana');
    expect(req.request.params.get('ativo')).toBe('true');
    req.flush(pagina());
  });

  it('paginação server-side: próxima página pede page=2', () => {
    ctrl.expectOne(r => r.url === URL).flush(pagina(120));
    expect(comp.hasNextPage()).toBeTrue();
    comp.carregar(comp.page() + 1);
    const req = ctrl.expectOne(r => r.url === URL);
    expect(req.request.params.get('page')).toBe('2');
    req.flush(pagina(120, 2));
    expect(comp.page()).toBe(2);
  });

  it('erro de carga mostra mensagem', () => {
    ctrl.expectOne(r => r.url === URL).flush({}, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();
    expect(texto()).toContain('Erro ao carregar os usuários da empresa.');
  });
});
