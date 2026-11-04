import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideAuthFake } from '../../../testing/auth-fake';
import { environment } from '../../../../environments/environment';
import { CorteOrdemComponent } from './corte-ordem.component';
import { OrdemProducao } from '../../../core/models/ordem-producao.model';
import { Corte } from '../../../core/models/corte-producao.model';

const base = `${environment.apiUrl}/v1/producao/ordens/9/cortes`;

function ordem(status: OrdemProducao['status']): OrdemProducao {
  return {
    id: 9, numero: 4, produtoId: 1, produtoSku: 'CAM', produtoNome: 'Camiseta', fichaId: 7, fichaVersao: 1, fichaMaoDeObra: 0, fichaCustosIndiretos: 0, status, prazo: null, observacao: null,
    criadoEm: '2026-11-03T10:00:00Z', quantidadeTotal: 40,
    itens: [{ variacaoId: 21, variacaoSku: 'CAM-P', quantidade: 30, apontado: 0, cortado: 0 }, { variacaoId: 22, variacaoSku: 'CAM-G', quantidade: 10, apontado: 0, cortado: 0 }],
    materiais: [{ materialId: 10, materialSku: 'MAL', materialNome: 'Malha', unidadeCodigo: 'm', necessidade: 56, reservado: 56, consumido: 0, baixaNoCorte: false, saldo: 100, disponivel: 100, falta: 0 }],
    historico: []
  };
}

function corte(): Corte {
  return {
    id: 55, materialId: 10, materialSku: 'MAL', materialNome: 'Malha', unidadeCodigo: 'm', usado: 55, retalho: 2, consumido: 53, camadas: 10,
    observacao: null, usuarioNome: 'Cortador', criadoEm: '2026-11-03T10:00:00Z',
    itens: [{ variacaoId: 21, variacaoSku: 'CAM-P', porCamada: 3, esperadas: 30, cortadas: 28, perdidas: 2 }, { variacaoId: 22, variacaoSku: 'CAM-G', porCamada: 1, esperadas: 10, cortadas: 10, perdidas: 0 }],
    pecasCortadas: 38, pecasPerdidas: 2, consumoTeorico: 43, consumoPrevisto: 47.3, perdaPrevistaPercentual: 10, perdaRealPercentual: 23.26,
    aproveitamentoPercentual: 81.13, sobra: -5.7
  };
}

describe('CorteOrdemComponent', () => {
  let http: HttpTestingController;

  function criar(status: OrdemProducao['status'] = 'liberada', cortes: Corte[] = [], role: 'admin' | 'leitura' = 'admin') {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), provideAuthFake(role)] });
    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(CorteOrdemComponent);
    fixture.componentRef.setInput('ordem', ordem(status));
    fixture.detectChanges();
    http.expectOne(base).flush(cortes);
    fixture.detectChanges();
    return fixture;
  }

  afterEach(() => http.verify());

  it('lista os cortes com aproveitamento, perda real × prevista, sobra e perda de contagem', () => {
    const texto = (criar('em_producao', [corte()]).nativeElement as HTMLElement).textContent ?? '';

    expect(texto).toContain('consumido 53');
    expect(texto).toMatch(/CAM-P: 28 de 30/);
    expect(texto).toContain('Aproveitamento 81,13%');
    expect(texto).toContain('perda real 23,26% × prevista 10%');
    expect(texto).toContain('gastou a mais: 5,7 m');
    expect(texto).toContain('2 peça(s) perdida(s) na contagem');
  });

  it('registrar envia o tecido, o retalho, as camadas e só os tamanhos preenchidos', () => {
    const fixture = criar();
    const c = fixture.componentInstance;
    let avisou = false;
    c.registrado.subscribe(() => (avisou = true));

    c.usado = 55;
    c.retalho = 2;
    c.camadas = 10;
    c.linhas[0].porCamada = 3;
    c.linhas[0].cortadas = 28;
    c.registrar();

    const req = http.expectOne(base);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      materialId: 10, usado: 55, retalho: 2, camadas: 10, observacao: null, itens: [{ variacaoId: 21, porCamada: 3, cortadas: 28 }]
    });
    req.flush(corte());
    expect(avisou).toBeTrue();
    expect(c.usado).toBeNull();
    expect(c.salvando()).toBeFalse();
  });

  it('mostra as esperadas (camadas × por camada) e a perda enquanto digita', () => {
    const fixture = criar();
    const c = fixture.componentInstance;
    c.camadas = 10;
    c.linhas[0].porCamada = 3;
    c.linhas[0].cortadas = 28;

    expect(c.esperadas(c.linhas[0])).toBe(30);
    expect(c.perdidas(c.linhas[0])).toBe(2);
    expect(c.perdidas(c.linhas[1])).toBe(0);
  });

  it('só habilita registrar com tecido usado, camadas e ao menos um tamanho cortado', () => {
    const c = criar().componentInstance;

    expect(c.podeSalvar()).toBeFalse();
    c.usado = 10; c.camadas = 2; c.linhas[0].cortadas = 5;
    expect(c.podeSalvar()).toBeTrue();
  });

  it('saldo insuficiente aparece como erro', () => {
    const c = criar().componentInstance;
    c.usado = 500; c.camadas = 1; c.linhas[0].cortadas = 5;

    c.registrar();
    http.expectOne(base).flush({ error: 'Saldo insuficiente — o corte não foi registrado. Malha: precisa de 500 m, disponível 100 m.' }, { status: 400, statusText: 'Bad Request' });

    expect(c.erro()).toContain('não foi registrado');
    expect(c.salvando()).toBeFalse();
  });

  it('não oferece o formulário em ordem planejada ou concluída, nem para o perfil leitura', () => {
    expect((criar('concluida').nativeElement as HTMLElement).querySelector('#corte-usado')).toBeNull();
    TestBed.resetTestingModule();
    expect((criar('liberada', [], 'leitura').nativeElement as HTMLElement).querySelector('#corte-usado')).toBeNull();
    TestBed.resetTestingModule();
    expect((criar('liberada').nativeElement as HTMLElement).querySelector('#corte-usado')).not.toBeNull();
  });
});
