import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { provideAuthFake } from '../../../testing/auth-fake';
import { environment } from '../../../../environments/environment';
import { NecessidadeMateriaisComponent } from './necessidade-materiais.component';
import { NecessidadeMaterial } from '../../../core/models/necessidade-materiais.model';

const base = `${environment.apiUrl}/v1`;

function linha(id: number, extra: Partial<NecessidadeMaterial> = {}): NecessidadeMaterial {
  return {
    materialId: id, materialSku: `M${id}`, materialNome: id === 1 ? 'Malha' : 'Linha', unidadeCodigo: 'm', necessario: 11, estoque: 4, reservado: 0,
    emPedido: 0, aComprar: 7, ordens: 2, prazoDaOrdem: '2030-05-20', fornecedorId: null, fornecedorNome: null, prazoEntregaDias: null,
    comprarAte: null, atrasada: false, ...extra
  };
}

describe('NecessidadeMateriaisComponent', () => {
  let http: HttpTestingController;

  function criar(linhas: NecessidadeMaterial[], role: 'admin' | 'leitura' = 'admin') {
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), provideAuthFake(role)] });
    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(NecessidadeMateriaisComponent);
    fixture.detectChanges();
    http.expectOne(`${base}/producao/necessidade-materiais`).flush(linhas);
    http.expectOne(r => r.url === `${base}/fornecedores`).flush({ items: [{ id: 5, razaoSocial: 'Tecelagem Sul', cnpj: '1' }], page: 1, pageSize: 1000, total: 1 });
    fixture.detectChanges();
    return fixture;
  }

  afterEach(() => http.verify());

  it('mostra necessário, estoque, em pedido e a comprar com a data limite e o atraso', () => {
    const texto = (criar([linha(1, { fornecedorId: 5, fornecedorNome: 'Tecelagem Sul', prazoEntregaDias: 10, comprarAte: '2030-05-10', atrasada: true })]).nativeElement as HTMLElement).textContent ?? '';

    expect(texto).toContain('Malha');
    expect(texto).toContain('Tecelagem Sul');
    expect(texto).toContain('10 dia(s)');
    expect(texto).toContain('10/05/2030');
    expect(texto).toContain('atrasado');
  });

  it('sem nada a comprar o botão de gerar pedidos fica desabilitado', () => {
    const fixture = criar([linha(1, { aComprar: 0 })]);
    const botao = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button')).find(b => b.textContent?.includes('Gerar pedidos')) as HTMLButtonElement;

    expect(botao.disabled).toBeTrue();
  });

  it('gerar pedidos mostra o que foi criado e quem ficou sem fornecedor, e recarrega', () => {
    const fixture = criar([linha(1, { fornecedorId: 5, fornecedorNome: 'Tecelagem Sul' }), linha(2)]);

    fixture.componentInstance.gerar();
    const req = http.expectOne(`${base}/producao/necessidade-materiais/gerar-pedidos`);
    expect(req.request.body).toEqual({ materialIds: [] });
    req.flush({ pedidos: [{ pedidoId: 12, fornecedorNome: 'Tecelagem Sul', itens: 1 }], semFornecedor: ['Linha'] });
    http.expectOne(`${base}/producao/necessidade-materiais`).flush([]);
    fixture.detectChanges();

    const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(texto).toContain('Pedido #12 criado para Tecelagem Sul');
    expect(texto).toContain('Sem fornecedor preferencial');
    expect(texto).toContain('Linha');
  });

  it('definir fornecedor envia o fornecedor e o prazo de entrega', () => {
    const fixture = criar([linha(1)]);
    const c = fixture.componentInstance;

    c.editar(c.linhas()[0]);
    c.fornecedorEscolhido = 5;
    c.prazoEscolhido = 12;
    c.salvarFornecedor(c.linhas()[0]);

    const req = http.expectOne(`${base}/producao/materiais/1/fornecedor`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ fornecedorId: 5, prazoEntregaDias: 12 });
    req.flush(null);
    http.expectOne(`${base}/producao/necessidade-materiais`).flush([linha(1, { fornecedorId: 5, fornecedorNome: 'Tecelagem Sul', prazoEntregaDias: 12 })]);
    expect(c.editando()).toBeNull();
  });

  it('mensagem do servidor aparece quando não há nada a comprar', () => {
    const fixture = criar([linha(1)]);

    fixture.componentInstance.gerar();
    http.expectOne(`${base}/producao/necessidade-materiais/gerar-pedidos`).flush({ error: 'Nada a comprar: o estoque cobre as ordens.' }, { status: 400, statusText: 'Bad Request' });

    expect(fixture.componentInstance.erro()).toContain('Nada a comprar');
    expect(fixture.componentInstance.gerando()).toBeFalse();
  });

  it('perfil leitura só consulta: sem gerar pedidos nem trocar fornecedor', () => {
    const el = criar([linha(1)], 'leitura').nativeElement as HTMLElement;

    expect(Array.from(el.querySelectorAll('button')).some(b => b.textContent?.includes('Gerar pedidos'))).toBeFalse();
    expect(Array.from(el.querySelectorAll('button')).some(b => b.textContent?.includes('Definir'))).toBeFalse();
  });
});
