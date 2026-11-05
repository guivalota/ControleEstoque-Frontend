import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { provideAuthFake } from '../../../testing/auth-fake';
import { environment } from '../../../../environments/environment';
import { FichaTecnicaEditorComponent } from './ficha-tecnica-editor.component';
import { FichaTecnica } from '../../../core/models/ficha-tecnica.model';

const base = `${environment.apiUrl}/v1`;

function ficha(id: number, versao: number, vigente: boolean, quantidade = 1.1): FichaTecnica {
  return {
    id, produtoId: 5, produtoSku: 'CAM', produtoNome: 'Camisa', versao, vigente, observacao: null, criadoPor: null,
    criadoEm: '2026-11-03T10:00:00Z', quantidadeItens: 1, maoDeObra: 3, custosIndiretos: 1, custoPadraoNaCriacao: 14,
    itens: [{ materialId: 10, materialSku: 'TEC', materialNome: 'Tecido', variacaoId: null, variacaoSku: null,
      quantidade, perdaPercentual: 5, unidadeCodigo: 'm', ordem: 0 }]
  };
}

const custoCompleto = {
  fichaId: 2, variacaoId: null, custoMateriais: 10.71, maoDeObra: 3, custosIndiretos: 1, custoTotal: 14.71, custoParcial: 14.71,
  completo: true, materiaisSemCusto: [],
  materiais: [{ materialId: 10, materialSku: 'TEC', materialNome: 'Tecido', unidadeCodigo: 'm', quantidadeComPerda: 1.26, custoUnitario: 8.5, custo: 10.71 }]
};

const custoIncompleto = {
  ...custoCompleto, completo: false, custoTotal: null, custoParcial: 4, materiaisSemCusto: ['Tecido'],
  materiais: [{ ...custoCompleto.materiais[0], custoUnitario: null, custo: null }]
};

const precificacao = {
  produtoId: 5, variacaoId: null, margemPercentual: 40, despesasVendaPercentual: 10, temFicha: true, custoUnitario: 14.71,
  precoMinimoSugerido: 29.42, precoVenda: 20, abaixoDoMinimo: true, margemAtualPercentual: 18.55, materiaisSemCusto: [], variacoes: []
};

describe('FichaTecnicaEditorComponent', () => {
  let http: HttpTestingController;

  function criar(role: 'admin' | 'leitura' = 'admin', custo: object = custoCompleto) {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]), provideHttpClient(), provideHttpClientTesting(), provideAuthFake(role),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: new Map([['produtoId', '5']]) } } }
      ]
    });
    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(FichaTecnicaEditorComponent);
    fixture.detectChanges();
    http.expectOne(`${base}/produtos/5`).flush({ id: 5, sku: 'CAM', nome: 'Camisa', usaGrade: false, tipoItem: 'acabado' });
    http.expectOne(`${base}/producao/produtos/5/fichas-tecnicas`).flush([ficha(2, 2, true, 1.2), ficha(1, 1, false)]);
    http.expectOne(`${base}/producao/fichas-tecnicas/2`).flush(ficha(2, 2, true, 1.2));
    http.expectOne(r => r.url === `${base}/producao/fichas-tecnicas/2/consumo`).flush([
      { materialId: 10, materialSku: 'TEC', materialNome: 'Tecido', unidadeCodigo: 'm', quantidade: 1.2, perdaPercentual: 5,
        quantidadeComPerda: 1.26, propriaDaVariacao: false }]);
    http.expectOne(r => r.url === `${base}/producao/fichas-tecnicas/2/custo`).flush(custo);
    fixture.detectChanges();
    http.expectOne(`${base}/producao/produtos/5/precificacao`).flush(precificacao);
    fixture.detectChanges();
    return fixture;
  }

  afterEach(() => http.verify());

  it('carrega a versão vigente, o consumo com perda e o histórico', () => {
    const fixture = criar();
    const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(texto).toContain('versão vigente v2');
    expect(texto).toContain('Tecido');
    expect(texto).toContain('1,26 m');
    expect(texto).toContain('v1');
    expect(fixture.componentInstance.linhas().length).toBe(1);
  });

  it('salvar envia a ficha toda e recarrega como nova versão', () => {
    const fixture = criar();
    fixture.componentInstance.linhas.update(ls => [{ ...ls[0], quantidade: 1.5 }]);
    fixture.componentInstance.observacao = ' ajuste ';

    fixture.componentInstance.salvar();

    const req = http.expectOne(`${base}/producao/fichas-tecnicas`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      produtoId: 5, observacao: 'ajuste', maoDeObra: 3, custosIndiretos: 1,
      itens: [{ materialId: 10, variacaoId: null, quantidade: 1.5, perdaPercentual: 5 }]
    });
    req.flush(ficha(3, 3, true, 1.5));
    http.expectOne(`${base}/producao/produtos/5/fichas-tecnicas`).flush([ficha(3, 3, true, 1.5)]);
    http.expectOne(`${base}/producao/fichas-tecnicas/3`).flush(ficha(3, 3, true, 1.5));
    http.expectOne(r => r.url === `${base}/producao/fichas-tecnicas/3/consumo`).flush([]);
    http.expectOne(r => r.url === `${base}/producao/fichas-tecnicas/3/custo`).flush(custoCompleto);
    expect(fixture.componentInstance.salvando()).toBeFalse();
  });

  it('mostra o preço mínimo sugerido na ficha e recalcula quando sai uma nova versão', () => {
    const fixture = criar();
    const texto = () => (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(texto()).toContain('Preço mínimo sugerido');
    expect(texto()).toContain('29,42');

    fixture.componentInstance.salvar();
    http.expectOne(`${base}/producao/fichas-tecnicas`).flush(ficha(3, 3, true, 1.5));
    http.expectOne(`${base}/producao/produtos/5/fichas-tecnicas`).flush([ficha(3, 3, true, 1.5)]);
    http.expectOne(`${base}/producao/fichas-tecnicas/3`).flush(ficha(3, 3, true, 1.5));
    http.expectOne(r => r.url === `${base}/producao/fichas-tecnicas/3/consumo`).flush([]);
    http.expectOne(r => r.url === `${base}/producao/fichas-tecnicas/3/custo`).flush(custoCompleto);
    fixture.detectChanges();

    http.expectOne(`${base}/producao/produtos/5/precificacao`).flush({ ...precificacao, custoUnitario: 20, precoMinimoSugerido: 40 });
    fixture.detectChanges();
    expect(texto()).toContain('40,00');
  });

  it('mostra a mensagem do servidor quando a ficha é recusada (ex.: ciclo)', () => {
    const fixture = criar();

    fixture.componentInstance.salvar();
    http.expectOne(`${base}/producao/fichas-tecnicas`).flush(
      { error: 'Ciclo na ficha técnica: Camisa → Peça → Camisa.' }, { status: 400, statusText: 'Bad Request' });
    fixture.detectChanges();

    expect(fixture.componentInstance.erro()).toContain('Ciclo na ficha técnica');
    expect(fixture.componentInstance.salvando()).toBeFalse();
  });

  it('perfil leitura só consulta: sem busca de material, sem salvar', () => {
    const fixture = criar('leitura');
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('input[aria-label="Adicionar material"]')).toBeNull();
    expect(Array.from(el.querySelectorAll('button')).some(b => b.textContent?.includes('nova versão'))).toBeFalse();
  });

  it('mostra o custo padrão por peça com mão de obra e o custo gravado na versão', () => {
    const texto = (criar().nativeElement as HTMLElement).textContent ?? '';

    expect(texto).toContain('Custo padrão por peça');
    expect(texto).toMatch(/Custo padrão:\s*R\$\s*14,71/);
    expect(texto).toMatch(/Quando esta versão foi criada:\s*R\$\s*14,00/);
  });

  it('avisa os materiais sem custo e não mostra o total como se fosse completo', () => {
    const texto = (criar('admin', custoIncompleto).nativeElement as HTMLElement).textContent ?? '';

    expect(texto).toContain('Sem custo conhecido para: Tecido');
    expect(texto).toContain('sem custo');
    expect(texto).toContain('Custo parcial (incompleto)');
    expect(texto).not.toMatch(/Custo padrão:\s*R\$/);
  });

  it('remover tira a linha da ficha', () => {
    const fixture = criar();

    fixture.componentInstance.remover(0);

    expect(fixture.componentInstance.linhas().length).toBe(0);
  });
});
