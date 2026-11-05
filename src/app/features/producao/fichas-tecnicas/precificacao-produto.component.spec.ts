import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideAuthFake } from '../../../testing/auth-fake';
import { environment } from '../../../../environments/environment';
import { Precificacao } from '../../../core/models/precificacao.model';
import { PrecificacaoProdutoComponent } from './precificacao-produto.component';

const base = `${environment.apiUrl}/v1/producao/produtos`;

function dados(extra: Partial<Precificacao> = {}): Precificacao {
  return {
    produtoId: 5, variacaoId: null, margemPercentual: 40, despesasVendaPercentual: 10, temFicha: true, custoUnitario: 20,
    precoMinimoSugerido: 40, precoVenda: 30, abaixoDoMinimo: true, margemAtualPercentual: 23.33, materiaisSemCusto: [], variacoes: [], ...extra
  };
}

@Component({
  standalone: true,
  imports: [PrecificacaoProdutoComponent],
  template: '<app-precificacao-produto [produtoId]="5" [fichaId]="ficha" />'
})
class HostComponent {
  ficha = 7;
}

describe('PrecificacaoProdutoComponent', () => {
  let http: HttpTestingController;

  function criar(role: 'admin' | 'leitura' = 'admin', resposta: Precificacao = dados()) {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), provideAuthFake(role)] });
    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    http.expectOne(`${base}/5/precificacao`).flush(resposta);
    fixture.detectChanges();
    return fixture;
  }

  const texto = (f: { nativeElement: unknown }) => ((f.nativeElement as HTMLElement).textContent ?? '').replace(/\s+/g, ' ');

  function botaoSalvar(el: HTMLElement) {
    return Array.from(el.querySelectorAll('button')).find(b => b.textContent!.includes('Salvar e recalcular')) as HTMLButtonElement;
  }

  afterEach(() => http.verify());

  it('mostra custo, preço mínimo sugerido, preço de venda e o aviso quando a venda está abaixo do mínimo', () => {
    const t = texto(criar());

    expect(t).toContain('Custo por peça: R$');
    expect(t).toContain('40,00');
    expect(t).toContain('margem atual de 23.33%');
    expect(t).toContain('abaixo do mínimo sugerido');
  });

  it('sem aviso quando o preço de venda cobre o mínimo', () => {
    expect(texto(criar('admin', dados({ precoVenda: 80, abaixoDoMinimo: false, margemAtualPercentual: 65 })))).not.toContain('abaixo do mínimo sugerido');
  });

  it('sem preço de venda cadastrado diz "não informado"', () => {
    expect(texto(criar('admin', dados({ precoVenda: 0, abaixoDoMinimo: false, margemAtualPercentual: null })))).toContain('não informado');
  });

  it('salvar envia margem e despesas e mostra o novo mínimo', async () => {
    const fixture = criar();
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const margem = el.querySelector('#margem') as HTMLInputElement;
    const despesas = el.querySelector('#despesas') as HTMLInputElement;
    expect(margem.value).toBe('40');
    margem.value = '50';
    margem.dispatchEvent(new Event('input'));
    despesas.value = '5';
    despesas.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    botaoSalvar(el).click();

    const req = http.expectOne(`${base}/5/precificacao`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ margemPercentual: 50, despesasVendaPercentual: 5 });
    req.flush(dados({ margemPercentual: 50, despesasVendaPercentual: 5, precoMinimoSugerido: 44.44 }));
    fixture.detectChanges();
    expect(texto(fixture)).toContain('44,44');
  });

  it('mostra a recusa do servidor ao salvar (margem + despesas a partir de 100%)', () => {
    const fixture = criar();

    botaoSalvar(fixture.nativeElement as HTMLElement).click();
    http.expectOne(`${base}/5/precificacao`).flush({ error: 'A margem somada às despesas de venda deve ficar abaixo de 100%.' }, { status: 400, statusText: 'Bad Request' });
    fixture.detectChanges();

    expect(texto(fixture)).toContain('abaixo de 100%');
  });

  it('perfil leitura só consulta: sem botão e com os campos desabilitados', async () => {
    const fixture = criar('leitura');
    await fixture.whenStable();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.textContent).not.toContain('Salvar e recalcular');
    expect((el.querySelector('#margem') as HTMLInputElement).disabled).toBeTrue();
  });

  it('material sem custo: não mostra preço mínimo e lista os materiais', () => {
    const t = texto(criar('admin', dados({ custoUnitario: null, precoMinimoSugerido: null, abaixoDoMinimo: false, materiaisSemCusto: ['Couro'] })));

    expect(t).toContain('Sem custo conhecido para: Couro');
    expect(t).not.toContain('Preço mínimo sugerido: R$');
  });

  it('produto com grade mostra um preço mínimo por variação, com aviso só na que está abaixo', () => {
    const variacao = (extra: object) => ({ variacaoId: 1, sku: 'CART-MAR', custoUnitario: 41.27, precoMinimoSugerido: 96.0, precoVenda: 189.9, abaixoDoMinimo: false, margemAtualPercentual: 60.2, materiaisSemCusto: [], ...extra });
    const fixture = criar('admin', dados({ variacoes: [variacao({}), variacao({ variacaoId: 2, sku: 'CART-PRE', precoVenda: 80, abaixoDoMinimo: true, margemAtualPercentual: 10 })] }));
    const el = fixture.nativeElement as HTMLElement;

    const linhas = Array.from(el.querySelectorAll('tbody tr')).map(tr => (tr.textContent ?? '').replace(/s+/g, ' '));
    expect(linhas[0]).toContain('CART-MAR');
    expect(linhas[0]).not.toContain('abaixo do mínimo');
    expect(linhas[1]).toContain('CART-PRE');
    expect(linhas[1]).toContain('abaixo do mínimo');
    expect(texto(fixture)).not.toContain('Custo por peça: R$');
  });

  it('produto sem ficha avisa em vez de calcular', () => {
    expect(texto(criar('admin', dados({ temFicha: false, custoUnitario: null, precoMinimoSugerido: null, abaixoDoMinimo: false })))).toContain('ainda não tem ficha técnica');
  });

  it('recarrega quando a ficha vigente muda', () => {
    const fixture = criar();

    fixture.componentInstance.ficha = 8;
    fixture.detectChanges();

    http.expectOne(`${base}/5/precificacao`).flush(dados({ custoUnitario: 25, precoMinimoSugerido: 50 }));
    fixture.detectChanges();
    expect(texto(fixture)).toContain('50,00');
  });
});
