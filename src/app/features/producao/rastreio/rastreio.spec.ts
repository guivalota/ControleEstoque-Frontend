import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { RastreioLoteComponent } from './rastreio-lote.component';
import { RastreioLote } from '../../../core/models/rastreio-lote.model';

const base = `${environment.apiUrl}/v1/producao`;

const lote = { id: 5, numeroLote: 'ROLO-A', produtoId: 10, produtoSku: 'MAL', produtoNome: 'Malha', unidadeCodigo: 'm', dataValidade: '2031-01-01', quantidadeAtual: 20 };
const gerado = { ordemId: 9, loteId: 8, numeroLote: 'OP-4', produtoId: 1, produtoSku: 'CAM', produtoNome: 'Camisa', quantidade: 40 };
const consumido = { ordemId: 9, loteId: 5, numeroLote: 'ROLO-A', materialId: 10, materialSku: 'MAL', materialNome: 'Malha', unidadeCodigo: 'm', quantidade: 40 };

describe('RastreioLoteComponent', () => {
  let http: HttpTestingController;

  function criar(id: string, resposta: RastreioLote | { status: number; error: object }) {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id })) } }
      ]
    });
    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(RastreioLoteComponent);
    fixture.detectChanges();
    const req = http.expectOne(`${base}/rastreio/lotes/${id}`);
    if ('status' in resposta) req.flush(resposta.error, { status: resposta.status, statusText: 'x' });
    else req.flush(resposta);
    fixture.detectChanges();
    return fixture;
  }

  afterEach(() => http.verify());

  it('para a frente: mostra as ordens que usaram o rolo e os lotes de acabado gerados', () => {
    const texto = (criar('5', { lote, usadoEm: [{ ordemId: 9, numero: 4, status: 'concluida', produtoNome: 'Camisa', quantidade: 40, lotesGerados: [gerado], lotesConsumidos: [] }], geradoPor: [] })
      .nativeElement as HTMLElement).textContent ?? '';

    expect(texto).toContain('Rastreio do lote ROLO-A');
    expect(texto).toContain('Usado nas ordens');
    expect(texto).toContain('Ordem 4');
    expect(texto).toContain('OP-4');
    expect(texto).not.toContain('Gerado pela ordem');
  });

  it('para trás: mostra a ordem que gerou o lote e os rolos de material usados', () => {
    const texto = (criar('8', { lote: { ...lote, id: 8, numeroLote: 'OP-4' }, usadoEm: [], geradoPor: [{ ordemId: 9, numero: 4, status: 'concluida', produtoNome: 'Camisa', quantidade: 40, lotesGerados: [], lotesConsumidos: [consumido] }] })
      .nativeElement as HTMLElement).textContent ?? '';

    expect(texto).toContain('Gerado pela ordem');
    expect(texto).toContain('Material usado');
    expect(texto).toContain('ROLO-A');
  });

  it('lote sem ligação com ordens avisa que ainda não foi usado', () => {
    const texto = (criar('5', { lote, usadoEm: [], geradoPor: [] }).nativeElement as HTMLElement).textContent ?? '';

    expect(texto).toContain('ainda não foi usado nem gerado');
  });

  it('lote inexistente mostra a mensagem do servidor', () => {
    const fixture = criar('99', { status: 404, error: { error: 'Lote com id 99 não encontrado.' } });

    expect(fixture.componentInstance.erro()).toContain('não encontrado');
  });
});
