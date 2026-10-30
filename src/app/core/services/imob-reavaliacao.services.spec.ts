import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ImobCategoriaService } from './imob-categoria.service';
import { ImobDepartamentoService } from './imob-departamento.service';
import { ImobEstadoConservacaoService } from './imob-estado-conservacao.service';
import { ImobReavaliacaoParametrosService } from './imob-reavaliacao-parametros.service';
import { ImobReavaliacaoEscalaService } from './imob-reavaliacao-escala.service';
import { ImobBemService } from './imob-bem.service';

const API = '/api/v1/imobilizado';

describe('serviços do E19 (categorias padrão, departamentos, reavaliação, filtros de bens)', () => {
  let ctrl: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    ctrl = TestBed.inject(HttpTestingController);
  });

  afterEach(() => ctrl.verify());

  it('categorias: POST categorias/padrao', () => {
    TestBed.inject(ImobCategoriaService).carregarPadrao().subscribe(r => expect(r.criadas).toBe(3));
    const req = ctrl.expectOne(`${API}/categorias/padrao`);
    expect(req.request.method).toBe('POST');
    req.flush({ criadas: 3, jaExistentes: 0, categorias: [] });
  });

  it('departamentos: CRUD em v1/imobilizado/departamentos', () => {
    const s = TestBed.inject(ImobDepartamentoService);
    s.listar({ busca: 'ti', ativo: true, page: 2, pageSize: 20 }).subscribe();
    const lista = ctrl.expectOne(r => r.url === `${API}/departamentos`);
    expect(lista.request.params.get('busca')).toBe('ti');
    expect(lista.request.params.get('ativo')).toBe('true');
    lista.flush({ items: [], page: 2, pageSize: 20, total: 0 });

    s.criar({ codigo: 'TI', nome: 'Tec' }).subscribe();
    expect(ctrl.expectOne(`${API}/departamentos`).request.method).toBe('POST');
    s.atualizar(4, { codigo: 'TI', nome: 'Tec', ativo: false }).subscribe();
    expect(ctrl.expectOne(`${API}/departamentos/4`).request.method).toBe('PUT');
    s.excluir(4).subscribe();
    expect(ctrl.expectOne(`${API}/departamentos/4`).request.method).toBe('DELETE');
  });

  it('estados de conservação: padrão e histórico', () => {
    const s = TestBed.inject(ImobEstadoConservacaoService);
    s.carregarPadrao().subscribe();
    expect(ctrl.expectOne(`${API}/estados-conservacao/padrao`).request.method).toBe('POST');
    s.historico(3, 2, 20).subscribe();
    const h = ctrl.expectOne(r => r.url === `${API}/estados-conservacao/3/historico`);
    expect(h.request.params.get('page')).toBe('2');
    expect(h.request.params.get('pageSize')).toBe('20');
  });

  it('pesos: vigente, histórico e nova versão', () => {
    const s = TestBed.inject(ImobReavaliacaoParametrosService);
    s.vigente().subscribe();
    expect(ctrl.expectOne(`${API}/reavaliacao/parametros`).request.method).toBe('GET');
    s.historico(1, 10).subscribe();
    ctrl.expectOne(r => r.url === `${API}/reavaliacao/parametros/historico`);
    s.criarVersao({ pesoEc: 5, pesoVf: 6, pesoVp: -3, divisor: 100 }).subscribe();
    expect(ctrl.expectOne(`${API}/reavaliacao/parametros`).request.method).toBe('POST');
  });

  it('escalas: vigente por tipo, nota, histórico e nova versão', () => {
    const s = TestBed.inject(ImobReavaliacaoEscalaService);
    s.vigentes().subscribe();
    ctrl.expectOne(`${API}/reavaliacao/escalas`);
    s.nota('vf', 3.5).subscribe();
    const n = ctrl.expectOne(r => r.url === `${API}/reavaliacao/escalas/vf/nota`);
    expect(n.request.params.get('valor')).toBe('3.5');
    s.historico('vp', 1, 10).subscribe();
    ctrl.expectOne(r => r.url === `${API}/reavaliacao/escalas/vp/historico`);
    s.criarVersao('vp', { faixas: [{ de: 0, ate: null, nota: 1 }] }).subscribe();
    expect(ctrl.expectOne(`${API}/reavaliacao/escalas/vp`).request.method).toBe('POST');
  });

  it('bens: envia departamentoId, compraDe/compraAte e ordenação só quando definidos', () => {
    const s = TestBed.inject(ImobBemService);
    s.listar({ departamentoId: 2, compraDe: '2024-01-01', compraAte: '2024-12-31', ordenarPor: 'valorAquisicao', direcao: 'desc' }).subscribe();
    const req = ctrl.expectOne(r => r.url === `${API}/bens`);
    expect(req.request.params.get('departamentoId')).toBe('2');
    expect(req.request.params.get('compraDe')).toBe('2024-01-01');
    expect(req.request.params.get('compraAte')).toBe('2024-12-31');
    expect(req.request.params.get('ordenarPor')).toBe('valorAquisicao');
    expect(req.request.params.get('direcao')).toBe('desc');
    s.listar({}).subscribe();
    expect(ctrl.expectOne(r => r.url === `${API}/bens`).request.params.keys()).toEqual([]);
  });
});
