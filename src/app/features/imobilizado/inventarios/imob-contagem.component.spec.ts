import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { ImobContagemComponent } from './imob-contagem.component';
import { ImobInventario } from '../../../core/models/imob-inventario.model';
import { provideAuthFake } from '../../../testing/auth-fake';

const API = '/api/v1/imobilizado';

const inv = (extra: Partial<ImobInventario> = {}): ImobInventario => ({
  id: 7, nome: 'Reavaliação 2026', descricao: '', status: 'em_andamento', dataInicio: '2026-10-22T14:03:11Z', dataFim: null,
  criadoPorId: 'u1', criadoPorNome: 'Maria', criadoEm: '2026-10-20T09:00:00Z', atualizadoEm: '2026-10-20T09:00:00Z',
  totalLocais: 1, totalEsperados: 10, reavaliacao: true, locais: [{ localId: 1, localNome: 'Matriz' }], equipe: [], ...extra
});

describe('ImobContagemComponent — conferência da reavaliação', () => {
  let fixture: ComponentFixture<ImobContagemComponent>;
  let comp: ImobContagemComponent;
  let ctrl: HttpTestingController;
  const el = () => fixture.nativeElement as HTMLElement;
  const texto = () => (el().textContent ?? '').replace(/\s+/g, ' ');
  const listaLeituras = (r: { url: string }) => r.url === `${API}/inventarios/7/leituras`;

  function montar(i: ImobInventario = inv()) {
    TestBed.configureTestingModule({
      imports: [ImobContagemComponent],
      providers: [
        provideRouter([]), provideHttpClient(), provideHttpClientTesting(), provideAuthFake('admin'),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: '7' }) } } }
      ]
    });
    ctrl = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ImobContagemComponent);
    comp = fixture.componentInstance;
    fixture.detectChanges();
    ctrl.expectOne(`${API}/inventarios/7`).flush(i);
    ctrl.expectOne(`${API}/locais/arvore`).flush([]);
    if (i.status === 'em_andamento') ctrl.expectOne(listaLeituras).flush({ items: [], page: 1, pageSize: 20, total: 0 });
    if (i.reavaliacao) {
      ctrl.expectOne(r => r.url === `${API}/estados-conservacao`).flush({
        items: [{ id: 2, nome: 'Bom', notaEc: 1, notaVidaRemanescente: 1, ativo: true }], page: 1, pageSize: 200, total: 1
      });
      ctrl.expectOne(r => r.url === `${API}/departamentos`).flush({
        items: [{ id: 5, codigo: 'TI', nome: 'Tecnologia', ativo: true }], page: 1, pageSize: 1000, total: 1
      });
    }
    fixture.detectChanges();
  }

  afterEach(() => ctrl.verify());

  it('inventário comum não mostra campos nem CSV de conferência e não carrega as listas', () => {
    montar(inv({ reavaliacao: false }));
    expect(texto()).not.toContain('Conferência da reavaliação');
    expect(texto()).not.toContain('Importar conferências');
  });

  it('reavaliação mostra os campos de conferência, o botão e o CSV de conferências', () => {
    montar();
    expect(texto()).toContain('Estado de conservação');
    expect(texto()).toContain('Bom');
    expect(texto()).toContain('Tecnologia');
    expect(texto()).toContain('Só conferir');
    expect(texto()).toContain('Importar conferências por CSV');
  });

  it('a leitura leva a conferência preenchida e mostra o resultado', () => {
    montar();
    comp.local.setValue(1);
    comp.plaqueta.setValue('NB-1');
    comp.estado.setValue(2);
    comp.valorMercado.setValue(150);
    comp.registrar();
    const req = ctrl.expectOne(listaLeituras);
    expect(req.request.method).toBe('POST');
    expect(req.request.body.conferencia).toEqual({ estadoId: 2, valorMercado: 150 });
    req.flush({
      id: 1, clientId: 'c', plaqueta: 'NB-1', localLidoId: 1, localLidoNome: 'Matriz', usuarioId: 'u', lidoEm: '2026-11-08T10:00:00Z',
      origem: 'web', criadoEm: '2026-11-08T10:00:00Z', anulada: false, reaproveitada: false, conferencia: 'gravada',
      info: { plaqueta: 'NB-1', noEsperado: true, leiturasAtivas: 1, situacaoPrevista: 'no_local_esperado' }
    });
    ctrl.expectOne(r => listaLeituras(r) && r.method === 'GET').flush({ items: [], page: 1, pageSize: 20, total: 0 });
    fixture.detectChanges();
    expect(texto()).toContain('Conferência gravada');
    expect(comp.estado.value).toBeNull();
  });

  it('a leitura sem campos de conferência não envia o objeto', () => {
    montar();
    comp.local.setValue(1);
    comp.plaqueta.setValue('NB-2');
    comp.registrar();
    const req = ctrl.expectOne(listaLeituras);
    expect(req.request.body.conferencia).toBeUndefined();
    req.flush({ error: 'x' }, { status: 400, statusText: 'Bad Request' });
  });

  it('valor de mercado negativo é barrado antes de enviar', () => {
    montar();
    comp.local.setValue(1);
    comp.plaqueta.setValue('NB-3');
    comp.valorMercado.setValue(-1);
    comp.registrar();
    expect(comp.erro()).toContain('negativo');
  });

  it('"Só conferir" exige algum campo e envia o lote por plaqueta sem local', () => {
    montar();
    comp.plaqueta.setValue('NB-4');
    comp.soConferir();
    expect(comp.erro()).toContain('ao menos');

    comp.departamento.setValue(5);
    comp.soConferir();
    const req = ctrl.expectOne(`${API}/inventarios/7/conferencias/lote`);
    expect(req.request.body).toEqual({ itens: [{ plaqueta: 'NB-4', departamentoId: 5 }] });
    req.flush({ gravadas: 1, ignoradas: 0, foraDoEsperado: 0, comErro: 0, itens: [{ indice: 0, plaqueta: 'NB-4', resultado: 'gravada' }] });
    fixture.detectChanges();
    expect(texto()).toContain('NB-4: Conferência gravada');
    expect(comp.plaqueta.value).toBe('');
  });

  it('"Só conferir" mantém os dados quando o bem está fora do esperado', () => {
    montar();
    comp.plaqueta.setValue('NB-5');
    comp.estado.setValue(2);
    comp.soConferir();
    ctrl.expectOne(`${API}/inventarios/7/conferencias/lote`).flush({
      gravadas: 0, ignoradas: 0, foraDoEsperado: 1, comErro: 0, itens: [{ indice: 0, plaqueta: 'NB-5', resultado: 'fora_do_esperado' }]
    });
    fixture.detectChanges();
    expect(texto()).toContain('fora do esperado');
    expect(comp.plaqueta.value).toBe('NB-5');
  });
});
