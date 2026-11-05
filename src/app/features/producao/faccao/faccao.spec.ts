import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { provideAuthFake } from '../../../testing/auth-fake';
import { environment } from '../../../../environments/environment';
import { RemessasListaComponent } from './remessas-lista.component';
import { RemessaFormComponent } from './remessa-form.component';
import { RemessaDetalheComponent } from './remessa-detalhe.component';
import { Remessa } from '../../../core/models/faccao.model';

const base = `${environment.apiUrl}/v1`;

function remessa(status: Remessa['status'] = 'aberta', extra: Partial<Remessa> = {}): Remessa {
  return {
    id: 70, numero: 3, ordemId: 9, ordemNumero: 4, produtoNome: 'Camiseta', fichaCustosIndiretos: 1.5, fornecedorId: 5, fornecedorNome: 'Costura Sul', status, valorPeca: 2.5,
    prazoRetorno: '2030-05-20', observacao: null, criadoEm: '2026-11-03T10:00:00Z', usuarioNome: 'Maria', pecasEnviadas: 40, pecasBoas: 0,
    pecasDefeituosas: 0, pecasEmPoder: 40, perdidas: 0, valorPagar: 0, atrasada: false, diasEmAberto: 2,
    itens: [{ variacaoId: 21, variacaoSku: 'CAM-P', enviadas: 30, boas: 0, defeituosas: 0, emPoder: 30 }, { variacaoId: 22, variacaoSku: 'CAM-G', enviadas: 10, boas: 0, defeituosas: 0, emPoder: 10 }],
    materiais: [{ materialId: 11, materialSku: 'BOT', materialNome: 'Botão', unidadeCodigo: 'un', enviado: 160, devolvido: 0, emPoder: 160 }],
    retornos: [], ...extra
  };
}

describe('RemessasListaComponent', () => {
  let http: HttpTestingController;

  function criar() {
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), provideAuthFake('admin')] });
    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(RemessasListaComponent);
    fixture.detectChanges();
    http.expectOne(`${base}/producao/faccao/oficinas`).flush([
      { fornecedorId: 5, fornecedorNome: 'Costura Sul', remessasAbertas: 2, remessasAtrasadas: 1, pecasEmPoder: 55, valorAPagar: 120 }
    ]);
    http.expectOne(r => r.url === `${base}/producao/faccao/remessas`).flush({ items: [remessa('aberta', { atrasada: true })], page: 1, pageSize: 20, total: 1 });
    fixture.detectChanges();
    return fixture;
  }

  afterEach(() => http.verify());

  it('mostra as oficinas com peças em poder e atraso, e as remessas com o selo de atrasada', () => {
    const texto = (criar().nativeElement as HTMLElement).textContent ?? '';

    expect(texto).toContain('55 peça(s) em poder');
    expect(texto).toContain('1 atrasada(s)');
    expect(texto).toContain('20/05/2030');
    expect(texto).toContain('atrasada');
    expect(texto).toContain('Costura Sul');
  });

  it('"só atrasadas" envia o filtro e volta à primeira página', () => {
    const fixture = criar();
    fixture.componentInstance.soAtrasadas = true;

    fixture.componentInstance.filtrar();

    const req = http.expectOne(r => r.url === `${base}/producao/faccao/remessas`);
    expect(req.request.params.get('atrasadas')).toBe('true');
    expect(req.request.params.get('page')).toBe('1');
    req.flush({ items: [], page: 1, pageSize: 20, total: 0 });
  });
});

describe('RemessaFormComponent', () => {
  let http: HttpTestingController;
  let router: Router;

  function criar(ordemId = '9') {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]), provideHttpClient(), provideHttpClientTesting(), provideAuthFake('admin'),
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(ordemId ? { ordemId } : {}) } } }
      ]
    });
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
    const fixture = TestBed.createComponent(RemessaFormComponent);
    fixture.detectChanges();
    http.expectOne(r => r.url === `${base}/fornecedores`).flush({ items: [{ id: 5, razaoSocial: 'Costura Sul', cnpj: '1' }], page: 1, pageSize: 1000, total: 1 });
    return fixture;
  }

  afterEach(() => http.verify());

  const ordem = {
    id: 9, numero: 4, produtoSku: 'CAM', produtoNome: 'Camiseta', status: 'em_producao',
    itens: [{ variacaoId: 21, variacaoSku: 'CAM-P', quantidade: 30, apontado: 0, cortado: 28 }, { variacaoId: 22, variacaoSku: 'CAM-G', quantidade: 10, apontado: 0, cortado: 10 }],
    materiais: [{ materialId: 11, materialNome: 'Botão', unidadeCodigo: 'un', necessidade: 160, reservado: 160, consumido: 0, baixaNoCorte: false, saldo: 500, disponivel: 500, falta: 0 }]
  };

  it('envia peças por tamanho e aviamentos, e abre a remessa criada', () => {
    const fixture = criar();
    http.expectOne(`${base}/producao/ordens/9`).flush(ordem);
    const c = fixture.componentInstance;

    c.fornecedorId = 5;
    c.valorPeca = 2.5;
    c.prazo = '2030-05-20';
    c.pecas[0].quantidade = 28;
    c.pecas[1].quantidade = 10;
    c.aviamentos[0].quantidade = 160;
    expect(c.podeEnviar()).toBeTrue();
    c.enviar();

    const req = http.expectOne(`${base}/producao/faccao/remessas`);
    expect(req.request.body).toEqual({
      ordemId: 9, fornecedorId: 5, valorPeca: 2.5, prazoRetorno: '2030-05-20', observacao: null,
      itens: [{ variacaoId: 21, quantidade: 28 }, { variacaoId: 22, quantidade: 10 }], materiais: [{ materialId: 11, quantidade: 160 }]
    });
    req.flush(remessa());
    expect(router.navigate).toHaveBeenCalledWith(['/producao/faccao', 70]);
  });

  it('só habilita enviar com oficina, preço e ao menos uma peça', () => {
    const fixture = criar();
    http.expectOne(`${base}/producao/ordens/9`).flush(ordem);
    const c = fixture.componentInstance;

    expect(c.podeEnviar()).toBeFalse();
    c.fornecedorId = 5; c.valorPeca = 0; c.pecas[0].quantidade = 1;
    expect(c.podeEnviar()).toBeTrue();
  });

  it('mostra a recusa do servidor (ex.: mais peças que o cortado)', () => {
    const fixture = criar();
    http.expectOne(`${base}/producao/ordens/9`).flush(ordem);
    const c = fixture.componentInstance;
    c.fornecedorId = 5; c.valorPeca = 1; c.pecas[0].quantidade = 29;

    c.enviar();
    http.expectOne(`${base}/producao/faccao/remessas`).flush({ error: 'CAM-P: só há 28 peça(s) disponíveis para enviar.' }, { status: 400, statusText: 'Bad Request' });

    expect(c.erro()).toContain('só há 28');
    expect(c.salvando()).toBeFalse();
  });

  it('sem ordemId na URL avisa para abrir pela ordem', () => {
    const fixture = criar('');

    expect(fixture.componentInstance.erro()).toContain('a partir de uma ordem');
  });
});

describe('RemessaDetalheComponent', () => {
  let http: HttpTestingController;

  function criar(r: Remessa, role: 'admin' | 'leitura' = 'admin') {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]), provideHttpClient(), provideHttpClientTesting(), provideAuthFake(role),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: new Map([['id', '70']]) } } }
      ]
    });
    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(RemessaDetalheComponent);
    fixture.detectChanges();
    http.expectOne(`${base}/producao/faccao/remessas/70`).flush(r);
    fixture.detectChanges();
    return fixture;
  }

  afterEach(() => http.verify());

  it('mostra o que está em poder do terceirizado, o valor a pagar e os aviamentos', () => {
    const texto = (criar(remessa('parcial', { pecasBoas: 18, pecasEmPoder: 21, valorPagar: 45 })).nativeElement as HTMLElement).textContent ?? '';

    expect(texto).toContain('Remessa 3');
    expect(texto).toContain('Retorno parcial');
    expect(texto).toContain('Em poder do terceirizado');
    expect(texto).toMatch(/R\$\s*45,00/);
    expect(texto).toContain('Botão: enviado 160');
  });

  it('registrar retorno envia boas, defeituosas e a sobra de aviamento, e atualiza a tela', () => {
    const fixture = criar(remessa());
    const c = fixture.componentInstance;

    c.linhas[0].boas = 25;
    c.linhas[0].defeituosas = 3;
    c.devolucoes[0].devolvido = 20;
    c.observacao = ' primeiro lote ';
    expect(c.podeReceber()).toBeTrue();
    c.receber();

    const req = http.expectOne(`${base}/producao/faccao/remessas/70/retornos`);
    expect(req.request.body).toEqual({
      encerrar: false, observacao: 'primeiro lote', custosIndiretosPorPeca: 1.5,
      itens: [{ variacaoId: 21, boas: 25, defeituosas: 3 }], materiais: [{ materialId: 11, devolvido: 20 }]
    });
    req.flush({ remessaConcluida: false, ordemConcluida: false, valorPagar: 62.5, perdidas: 0, remessa: remessa('parcial', { pecasBoas: 25, valorPagar: 62.5 }) });
    expect(c.remessa()!.status).toBe('parcial');
    expect(c.linhas[0].boas).toBeNull();
  });

  it('encerrar sem informar peças é permitido (a diferença vira perda)', () => {
    const c = criar(remessa()).componentInstance;

    expect(c.podeReceber()).toBeFalse();
    c.encerrar = true;
    expect(c.podeReceber()).toBeTrue();
    c.receber();

    const req = http.expectOne(`${base}/producao/faccao/remessas/70/retornos`);
    expect(req.request.body.encerrar).toBeTrue();
    expect(req.request.body.itens).toEqual([]);
    req.flush({ remessaConcluida: true, ordemConcluida: false, valorPagar: 0, perdidas: 40, remessa: remessa('concluida', { perdidas: 40, pecasEmPoder: 0 }) });
    expect(c.remessa()!.perdidas).toBe(40);
  });

  it('custos indiretos vêm da ficha e o operador pode zerar antes de registrar o retorno', async () => {
    const fixture = criar(remessa());
    await fixture.whenStable();
    const c = fixture.componentInstance;
    const campo = (fixture.nativeElement as HTMLElement).querySelector('#ind-retorno') as HTMLInputElement;
    expect(campo.value).toBe('1.5');

    campo.value = '0';
    campo.dispatchEvent(new Event('input'));
    c.linhas[0].boas = 10;
    c.receber();

    const req = http.expectOne(`${base}/producao/faccao/remessas/70/retornos`);
    expect(req.request.body.custosIndiretosPorPeca).toBe(0);
    req.flush({ remessaConcluida: false, ordemConcluida: false, valorPagar: 25, perdidas: 0, remessa: remessa('parcial', { pecasBoas: 10 }) });
  });

  it('mostra a recusa do servidor ao receber mais do que está com o terceirizado', () => {
    const c = criar(remessa()).componentInstance;
    c.linhas[0].boas = 99;

    c.receber();
    http.expectOne(`${base}/producao/faccao/remessas/70/retornos`).flush({ error: 'CAM-P: só restam 30 peça(s) em poder do terceirizado.' }, { status: 400, statusText: 'Bad Request' });

    expect(c.erro()).toContain('só restam 30');
    expect(c.agindo()).toBeFalse();
  });

  it('remessa concluída e perfil leitura não oferecem o formulário de retorno', () => {
    expect((criar(remessa('concluida', { pecasEmPoder: 0 })).nativeElement as HTMLElement).textContent).not.toContain('Registrar retorno');
    TestBed.resetTestingModule();
    expect((criar(remessa(), 'leitura').nativeElement as HTMLElement).textContent).not.toContain('Registrar retorno');
  });

  it('o romaneio é baixado como PDF', () => {
    const fixture = criar(remessa());

    fixture.componentInstance.baixarRomaneio();

    const req = http.expectOne(`${base}/producao/faccao/remessas/70/romaneio`);
    expect(req.request.responseType).toBe('blob');
    req.flush(new Blob(['%PDF-'], { type: 'application/pdf' }));
  });
});
