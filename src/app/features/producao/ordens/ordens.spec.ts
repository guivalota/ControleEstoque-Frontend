import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { provideAuthFake } from '../../../testing/auth-fake';
import { environment } from '../../../../environments/environment';
import { OrdensListaComponent } from './ordens-lista.component';
import { OrdemFormComponent } from './ordem-form.component';
import { OrdemDetalheComponent } from './ordem-detalhe.component';
import { OrdemProducao } from '../../../core/models/ordem-producao.model';

const base = `${environment.apiUrl}/v1`;

function ordem(status: OrdemProducao['status'], extra: Partial<OrdemProducao> = {}): OrdemProducao {
  return {
    id: 9, numero: 4, produtoId: 1, produtoSku: 'CAM', produtoNome: 'Camiseta', fichaId: 7, fichaVersao: 2, fichaMaoDeObra: 6, fichaCustosIndiretos: 2, status, prazo: '2030-05-20',
    observacao: null, criadoEm: '2026-11-03T10:00:00Z', quantidadeTotal: 14,
    itens: [{ variacaoId: 21, variacaoSku: 'CAM-P', quantidade: 10, apontado: 0, cortado: 0 }, { variacaoId: 22, variacaoSku: 'CAM-G', quantidade: 4, apontado: 0, cortado: 0 }],
    materiais: [{ materialId: 10, materialSku: 'MAL', materialNome: 'Malha', unidadeCodigo: 'm', necessidade: 17.6, reservado: 0, consumido: 0, baixaNoCorte: false, saldo: 10, disponivel: 10, falta: 7.6 }],
    historico: [{ deStatus: null, paraStatus: 'planejada', motivo: null, usuarioNome: 'Maria', criadoEm: '2026-11-03T10:00:00Z' }],
    ...extra
  };
}

describe('OrdensListaComponent', () => {
  let http: HttpTestingController;

  function criar(role: 'admin' | 'leitura' = 'admin') {
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), provideAuthFake(role)] });
    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(OrdensListaComponent);
    fixture.detectChanges();
    http.expectOne(r => r.url === `${base}/producao/ordens`).flush({ items: [ordem('liberada')], page: 1, pageSize: 20, total: 1 });
    fixture.detectChanges();
    return fixture;
  }

  afterEach(() => http.verify());

  it('lista as ordens com número, produto, peças e estado', () => {
    const texto = (criar().nativeElement as HTMLElement).textContent ?? '';

    expect(texto).toContain('CAM — Camiseta');
    expect(texto).toContain('Liberada');
    expect(texto).toContain('14');
    expect(texto).toContain('20/05/2030');
  });

  it('filtrar por estado volta à primeira página e envia o estado', () => {
    const fixture = criar();
    fixture.componentInstance.status = 'cancelada';

    fixture.componentInstance.filtrar();

    const req = http.expectOne(r => r.url === `${base}/producao/ordens`);
    expect(req.request.params.get('status')).toBe('cancelada');
    expect(req.request.params.get('page')).toBe('1');
    req.flush({ items: [], page: 1, pageSize: 20, total: 0 });
  });

  it('leitura não vê "Nova ordem"', () => {
    const el = criar('leitura').nativeElement as HTMLElement;

    expect(Array.from(el.querySelectorAll('a')).some(a => a.textContent?.includes('Nova ordem'))).toBeFalse();
  });
});

describe('OrdemFormComponent', () => {
  let http: HttpTestingController;
  let router: Router;

  function criar() {
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), provideAuthFake('admin')] });
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
    const fixture = TestBed.createComponent(OrdemFormComponent);
    fixture.detectChanges();
    return fixture;
  }

  afterEach(() => http.verify());

  it('produto com grade: mostra uma quantidade por tamanho ativo e envia só os preenchidos', () => {
    const fixture = criar();
    const c = fixture.componentInstance;

    c.escolher({ id: 1, sku: 'CAM', nome: 'Camiseta', usaGrade: true, tipoItem: 'acabado' } as never);
    http.expectOne(`${base}/produtos/1/grade`).flush({
      produtoId: 1, usaGrade: true,
      variacoes: [{ produtoId: 21, sku: 'CAM-P', ativo: true }, { produtoId: 22, sku: 'CAM-M', ativo: true }, { produtoId: 23, sku: 'CAM-G', ativo: false }]
    });
    fixture.detectChanges();
    expect(c.linhas().map(l => l.rotulo)).toEqual(['CAM-P', 'CAM-M']);

    c.linhas.update(ls => [{ ...ls[0], quantidade: 10 }, ls[1]]);
    c.prazo = '2030-05-20';
    c.salvar();

    const req = http.expectOne(`${base}/producao/ordens`);
    expect(req.request.body).toEqual({ produtoId: 1, prazo: '2030-05-20', observacao: null, itens: [{ variacaoId: 21, quantidade: 10 }] });
    req.flush(ordem('planejada'));
    expect(router.navigate).toHaveBeenCalledWith(['/producao/ordens', 9]);
  });

  it('digitando a quantidade no campo, o botão Criar ordem é habilitado; sem quantidade, a tela explica o motivo', () => {
    const fixture = criar();
    const c = fixture.componentInstance;
    const el = fixture.nativeElement as HTMLElement;

    c.escolher({ id: 1, sku: 'CAM', nome: 'Camiseta', usaGrade: true, tipoItem: 'acabado' } as never);
    http.expectOne(`${base}/produtos/1/grade`).flush({
      produtoId: 1, usaGrade: true,
      variacoes: [{ produtoId: 21, sku: 'CAM-P', ativo: true }, { produtoId: 22, sku: 'CAM-M', ativo: true }]
    });
    fixture.detectChanges();

    const botao = () => Array.from(el.querySelectorAll('button')).find(b => b.textContent!.includes('Criar ordem'))! as HTMLButtonElement;
    expect(botao().disabled).toBeTrue();
    expect(el.textContent).toContain('Informe a quantidade de pelo menos um tamanho');

    const campo = el.querySelector('input[aria-label="Quantidade CAM-P"]') as HTMLInputElement;
    campo.value = '12';
    campo.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(botao().disabled).toBeFalse();
    expect(el.textContent).not.toContain('Informe a quantidade de pelo menos um tamanho');
    expect(el.textContent).toContain('12');

    campo.value = '';
    campo.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(botao().disabled).toBeTrue();
  });

  it('busca sem produto acabado/semiacabado explica por que nada apareceu', () => {
    const fixture = criar();
    const c = fixture.componentInstance;
    jasmine.clock().install();
    c.buscaProduto = 'malha';
    c.buscar();
    jasmine.clock().tick(400);
    jasmine.clock().uninstall();
    http.expectOne(r => r.url.includes('/produtos')).flush({ items: [{ id: 5, sku: 'TEC', nome: 'Malha', tipoItem: 'materia_prima' }], total: 1, page: 1, pageSize: 30 });
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Nenhum produto acabado ou semiacabado encontrado');
  });

  it('produto sem grade: uma quantidade só, sem variação', () => {
    const fixture = criar();
    const c = fixture.componentInstance;

    c.escolher({ id: 2, sku: 'BOL', nome: 'Bolsa', usaGrade: false, tipoItem: 'acabado', unidadeCodigo: 'pc' } as never);
    c.linhas.update(ls => [{ ...ls[0], quantidade: 5 }]);
    c.salvar();

    const req = http.expectOne(`${base}/producao/ordens`);
    expect(req.request.body.itens).toEqual([{ variacaoId: null, quantidade: 5 }]);
    req.flush(ordem('planejada'));
  });

  it('mostra a mensagem do servidor quando a ordem é recusada (ex.: sem ficha)', () => {
    const fixture = criar();
    const c = fixture.componentInstance;
    c.escolher({ id: 2, sku: 'BOL', nome: 'Bolsa', usaGrade: false, tipoItem: 'acabado' } as never);
    c.linhas.update(ls => [{ ...ls[0], quantidade: 5 }]);

    c.salvar();
    http.expectOne(`${base}/producao/ordens`).flush({ error: "'Bolsa' não tem ficha técnica vigente." }, { status: 400, statusText: 'Bad Request' });

    expect(c.erro()).toContain('ficha técnica');
    expect(c.salvando()).toBeFalse();
  });
});

describe('OrdemDetalheComponent', () => {
  let http: HttpTestingController;

  function criar(o: OrdemProducao, role: 'admin' | 'leitura' = 'admin') {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]), provideHttpClient(), provideHttpClientTesting(), provideAuthFake(role),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: new Map([['id', '9']]) } } }
      ]
    });
    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(OrdemDetalheComponent);
    fixture.detectChanges();
    http.expectOne(`${base}/producao/ordens/9`).flush(o);
    http.expectOne(`${base}/producao/ordens/9/apontamentos`).flush([]);
    fixture.detectChanges();
    if (['liberada', 'em_producao', 'concluida'].includes(o.status)) {
      http.expectOne(`${base}/producao/ordens/9/cortes`).flush([]);
      http.expectOne(`${base}/producao/ordens/9/lotes`).flush({ ordemId: 9, consumidos: [], gerados: [] });
    }
    return fixture;
  }

  afterEach(() => http.verify());

  it('mostra quantidade por tamanho, necessidade, falta e histórico', () => {
    const texto = (criar(ordem('planejada')).nativeElement as HTMLElement).textContent ?? '';

    expect(texto).toContain('Ordem 4');
    expect(texto).toContain('CAM-P');
    expect(texto).toContain('Malha');
    expect(texto).toContain('17,6');
    expect(texto).toContain('7,6');
    expect(texto).toContain('Maria');
  });

  it('liberar com falta mostra o aviso e só libera depois da confirmação explícita', () => {
    const fixture = criar(ordem('planejada'));
    const c = fixture.componentInstance;

    c.liberar(false);
    const sem = http.expectOne(`${base}/producao/ordens/9/liberar`);
    expect(sem.request.body).toEqual({ confirmarFalta: false });
    sem.flush({ liberada: false, ordem: ordem('planejada'), faltas: [{ materialId: 10, materialNome: 'Malha', unidadeCodigo: 'm', necessidade: 17.6, reservavel: 10, falta: 7.6 }] });
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Falta material para liberar');
    expect(c.ordem()!.status).toBe('planejada');

    c.liberar(true);
    const com = http.expectOne(`${base}/producao/ordens/9/liberar`);
    expect(com.request.body).toEqual({ confirmarFalta: true });
    com.flush({ liberada: true, faltas: [], ordem: ordem('liberada') });
    expect(c.ordem()!.status).toBe('liberada');
    expect(c.faltas()).toEqual([]);
  });

  it('cancelar exige o motivo e o envia', () => {
    const fixture = criar(ordem('liberada'));
    const c = fixture.componentInstance;

    c.motivo = ' cliente desistiu ';
    c.cancelar();

    const req = http.expectOne(`${base}/producao/ordens/9/cancelar`);
    expect(req.request.body).toEqual({ motivo: 'cliente desistiu' });
    req.flush(ordem('cancelada'));
    expect(c.ordem()!.status).toBe('cancelada');
  });

  it('perfil leitura só consulta: sem botões de ação', () => {
    const el = criar(ordem('planejada'), 'leitura').nativeElement as HTMLElement;

    expect(Array.from(el.querySelectorAll('button')).some(b => b.textContent?.includes('Liberar'))).toBeFalse();
    expect(Array.from(el.querySelectorAll('button')).some(b => b.textContent?.includes('Cancelar'))).toBeFalse();
  });

  it('em produção: apontar envia só os tamanhos preenchidos e atualiza a ordem', () => {
    const fixture = criar(ordem('em_producao'));
    const c = fixture.componentInstance;
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Apontar produção');

    c.linhasApontar[0].quantidade = 6;
    c.apontar(false);

    const req = http.expectOne(`${base}/producao/ordens/9/apontamentos`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      confirmarSobreproducao: false, observacao: null, maoDeObraPorPeca: 6, custosIndiretosPorPeca: 2,
      itens: [{ variacaoId: 21, quantidade: 6, consumos: [] }]
    });
    req.flush({ registrado: true, ordemConcluida: false, sobreproducao: [], ordem: ordem('em_producao', { itens: [{ variacaoId: 21, variacaoSku: 'CAM-P', quantidade: 10, apontado: 6, cortado: 0 }] }) });
    http.expectOne(`${base}/producao/ordens/9/apontamentos`).flush([
      { id: 1, variacaoId: 21, variacaoSku: 'CAM-P', quantidade: 6, sobreproducao: false, custoUnitario: 13.5, maoDeObraUnitaria: 6, custosIndiretosUnitarios: 2, observacao: null, usuarioNome: 'João', criadoEm: '2026-11-03T10:00:00Z', consumos: [] }
    ]);
    fixture.detectChanges();
    http.expectOne(`${base}/producao/ordens/9/cortes`).flush([]);
    http.expectOne(`${base}/producao/ordens/9/lotes`).flush({ ordemId: 9, consumidos: [], gerados: [] });

    expect(c.linhasApontar[0].apontado).toBe(6);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('João');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('inclui mão de obra');
  });

  it('mão de obra e custos indiretos vêm da ficha, e o operador pode alterar ou zerar antes de apontar', async () => {
    const fixture = criar(ordem('em_producao'));
    await fixture.whenStable();
    const c = fixture.componentInstance;
    const el = fixture.nativeElement as HTMLElement;
    const mdo = el.querySelector('#mdo-apontar') as HTMLInputElement;
    const ind = el.querySelector('#ind-apontar') as HTMLInputElement;
    expect(mdo.value).toBe('6');
    expect(ind.value).toBe('2');

    mdo.value = '0';
    mdo.dispatchEvent(new Event('input'));
    ind.value = '3.5';
    ind.dispatchEvent(new Event('input'));
    c.linhasApontar[0].quantidade = 4;
    c.apontar(false);

    const req = http.expectOne(`${base}/producao/ordens/9/apontamentos`);
    expect(req.request.body.maoDeObraPorPeca).toBe(0);
    expect(req.request.body.custosIndiretosPorPeca).toBe(3.5);
    req.flush({ registrado: false, ordemConcluida: false, sobreproducao: [], ordem: ordem('em_producao') });
  });

  it('apontar além do planejado mostra o aviso e só grava com a confirmação', () => {
    const fixture = criar(ordem('em_producao'));
    const c = fixture.componentInstance;
    c.linhasApontar[0].quantidade = 12;

    c.apontar(false);
    http.expectOne(`${base}/producao/ordens/9/apontamentos`).flush({
      registrado: false, ordemConcluida: false, ordem: ordem('em_producao'),
      sobreproducao: [{ variacaoId: 21, variacaoSku: 'CAM-P', planejado: 10, apontado: 0, excesso: 2 }]
    });
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Passa do planejado');
    expect(c.ordem()!.status).toBe('em_producao');

    c.apontar(true);
    const req = http.expectOne(`${base}/producao/ordens/9/apontamentos`);
    expect(req.request.body.confirmarSobreproducao).toBeTrue();
    req.flush({ registrado: true, ordemConcluida: true, sobreproducao: [], ordem: ordem('concluida') });
    http.expectOne(`${base}/producao/ordens/9/apontamentos`).flush([]);
    expect(c.ordem()!.status).toBe('concluida');
    expect(c.sobreproducao()).toEqual([]);
  });

  it('ajustar consumo carrega o previsto da ficha e envia o real com o motivo', () => {
    const fixture = criar(ordem('em_producao'));
    const c = fixture.componentInstance;
    c.linhasApontar[0].quantidade = 5;

    c.alternarAjuste(c.linhasApontar[0]);
    http.expectOne(r => r.url === `${base}/producao/fichas-tecnicas/7/consumo` && r.params.get('variacaoId') === '21').flush([
      { materialId: 10, materialSku: 'MAL', materialNome: 'Malha', unidadeCodigo: 'm', quantidade: 1, perdaPercentual: 10, quantidadeComPerda: 1.1, propriaDaVariacao: false }
    ]);
    const ajuste = c.linhasApontar[0].consumos[0];
    expect(c.previsto(c.linhasApontar[0], ajuste)).toBe(5.5);
    ajuste.real = 6.5;
    ajuste.motivo = ' rolo com defeito ';

    c.apontar(false);

    const req = http.expectOne(`${base}/producao/ordens/9/apontamentos`);
    expect(req.request.body.itens[0].consumos).toEqual([{ materialId: 10, quantidade: 6.5, motivo: 'rolo com defeito' }]);
    req.flush({ registrado: true, ordemConcluida: false, sobreproducao: [], ordem: ordem('em_producao') });
    http.expectOne(`${base}/producao/ordens/9/apontamentos`).flush([]);
  });

  it('saldo insuficiente aparece como erro e nada muda na tela', () => {
    const fixture = criar(ordem('em_producao'));
    const c = fixture.componentInstance;
    c.linhasApontar[0].quantidade = 5;

    c.apontar(false);
    http.expectOne(`${base}/producao/ordens/9/apontamentos`).flush(
      { error: 'Saldo insuficiente — nada foi apontado. Malha: precisa de 5,5 m, disponível 3 m.' }, { status: 400, statusText: 'Bad Request' });

    expect(c.erro()).toContain('nada foi apontado');
    expect(c.agindo()).toBeFalse();
  });

  it('só quem escreve vê o bloco de apontamento', () => {
    const el = criar(ordem('em_producao'), 'leitura').nativeElement as HTMLElement;

    expect(el.textContent).not.toContain('Apontar produção');
  });

  it('com peças apontadas: imprimir etiquetas pede o PDF da ordem com o modelo escolhido', () => {
    const fixture = criar(ordem('em_producao', { itens: [{ variacaoId: 21, variacaoSku: 'CAM-P', quantidade: 10, apontado: 6, cortado: 0 }] }));
    const c = fixture.componentInstance;
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Imprimir etiquetas');

    c.modeloEtiqueta = 'a4-21';
    c.imprimirEtiquetas();

    const req = http.expectOne(r => r.url === `${base}/producao/ordens/9/etiquetas`);
    expect(req.request.params.get('modelo')).toBe('a4-21');
    expect(req.request.responseType).toBe('blob');
    req.flush(new Blob(['%PDF-'], { type: 'application/pdf' }));
  });

  it('sem nenhuma peça apontada não oferece etiquetas', () => {
    const el = criar(ordem('em_producao')).nativeElement as HTMLElement;

    expect(el.textContent).not.toContain('Imprimir etiquetas');
  });

  it('erro ao gerar etiquetas aparece na tela (o erro do arquivo chega como blob)', async () => {
    const fixture = criar(ordem('concluida', { itens: [{ variacaoId: 21, variacaoSku: 'CAM-P', quantidade: 10, apontado: 10, cortado: 0 }] }));
    const c = fixture.componentInstance;

    c.imprimirEtiquetas();
    http.expectOne(r => r.url === `${base}/producao/ordens/9/etiquetas`).flush(new Blob([JSON.stringify({ error: 'Nenhuma peça foi apontada nesta ordem.' })], { type: 'application/json' }), { status: 400, statusText: 'Bad Request' });

    await fixture.whenStable();
    await new Promise(r => setTimeout(r, 50));
    expect(c.erro()).toContain('Nenhuma peça');
  });

  it('ordem encerrada não oferece ações', () => {
    const el = criar(ordem('concluida')).nativeElement as HTMLElement;

    expect(el.querySelectorAll('button').length).toBe(0);
  });
});
