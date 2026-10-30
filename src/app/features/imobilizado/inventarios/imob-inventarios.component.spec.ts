import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { ImobInventariosComponent } from './imob-inventarios.component';
import { ImobInventarioResumo } from '../../../core/models/imob-inventario.model';
import { provideAuthFake } from '../../../testing/auth-fake';

const URL_INV = '/api/v1/imobilizado/inventarios';

const inv = (id: number, extra: Partial<ImobInventarioResumo> = {}): ImobInventarioResumo => ({
  id, nome: `Inventário ${id}`, status: 'rascunho', dataInicio: null, dataFim: null, criadoPorId: 'u1',
  criadoPorNome: 'Maria', criadoEm: '2026-10-20T09:00:00Z', totalLocais: 2, totalEsperados: 0, reavaliacao: false, ...extra
});

describe('ImobInventariosComponent', () => {
  let fixture: ComponentFixture<ImobInventariosComponent>;
  let comp: ImobInventariosComponent;
  let ctrl: HttpTestingController;
  const el = () => fixture.nativeElement as HTMLElement;
  const texto = () => (el().textContent ?? '').replace(/\s+/g, ' ');
  const listagem = () => ctrl.expectOne(r => r.url === URL_INV);
  const responder = (items: ImobInventarioResumo[], req: TestRequest = listagem(), total = items.length) => {
    req.flush({ items, page: 1, pageSize: 50, total });
    fixture.detectChanges();
  };

  function montar(role: 'admin' | 'operador' | 'leitura' = 'admin') {
    TestBed.configureTestingModule({
      imports: [ImobInventariosComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), provideAuthFake(role)]
    });
    ctrl = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ImobInventariosComponent);
    comp = fixture.componentInstance;
    fixture.detectChanges();
  }

  afterEach(() => ctrl.verify());

  it('mostra carregando, pede a página 1 e lista com status, início e esperados', () => {
    montar();
    expect(texto()).toContain('Carregando');
    const req = listagem();
    expect(req.request.params.get('page')).toBe('1');
    expect(req.request.params.get('pageSize')).toBe('50');
    responder([
      inv(1),
      inv(2, { status: 'em_andamento', dataInicio: '2026-10-22T14:03:11Z', totalEsperados: 155 })
    ], req);
    const linhas = el().querySelectorAll('tbody tr');
    expect(linhas[0].textContent).toContain('Rascunho');
    expect(linhas[0].textContent).toContain('—');
    expect(linhas[1].textContent).toContain('Em andamento');
    expect(linhas[1].textContent).toContain('22/10/2026');
    expect(linhas[1].textContent).toContain('155');
  });

  it('vazio sem filtro e vazio com filtro', () => {
    montar();
    responder([]);
    expect(texto()).toContain('Nenhum inventário cadastrado');

    comp.filtros.patchValue({ busca: 'xyz' });
    comp.filtrar();
    responder([]);
    expect(texto()).toContain('Nenhum inventário encontrado com os filtros atuais');
  });

  it('filtrar envia busca e status e volta à página 1', () => {
    montar();
    responder([]);
    comp.filtros.patchValue({ busca: ' anual ', status: 'em_andamento' });
    comp.filtrar();
    const req = listagem();
    expect(req.request.params.get('busca')).toBe('anual');
    expect(req.request.params.get('status')).toBe('em_andamento');
    expect(req.request.params.get('page')).toBe('1');
    responder([], req);

    comp.limpar();
    const req2 = listagem();
    expect(req2.request.params.has('busca')).toBeFalse();
    expect(req2.request.params.has('status')).toBeFalse();
    responder([], req2);
  });

  it('erro de carga oferece tentar novamente', () => {
    montar();
    listagem().flush({}, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();
    expect(texto()).toContain('Erro ao carregar inventários.');
    comp.carregar();
    responder([inv(1)]);
    expect(texto()).not.toContain('Erro ao carregar');
  });

  describe('papéis', () => {
    it('leitura vê a lista, mas sem "Novo inventário" nem editar', () => {
      montar('leitura');
      responder([inv(1)]);
      expect(texto()).not.toContain('Novo inventário');
      expect(el().querySelector('a[title="Editar"]')).toBeNull();
      expect(texto()).toContain('Inventário 1');
    });

    it('operador cria e edita rascunho/em andamento, mas não edita concluído', () => {
      montar('operador');
      responder([inv(1), inv(2, { status: 'concluido' })]);
      expect(texto()).toContain('Novo inventário');
      const editar = el().querySelectorAll('a[title="Editar"]');
      expect(editar.length).toBe(1);
    });
  });
});
