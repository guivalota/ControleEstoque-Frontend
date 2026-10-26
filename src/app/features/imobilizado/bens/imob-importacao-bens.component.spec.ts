import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { ImobImportacaoBensComponent } from './imob-importacao-bens.component';
import { ConfirmDialogComponent } from '../shared/confirm-dialog.component';
import { RelatorioImportacao } from '../../../core/models/imob-importacao.model';
import { provideAuthFake } from '../../../testing/auth-fake';

const BASE = '/api/v1/imobilizado/bens/importacao';
const ARVORE = '/api/v1/imobilizado/locais/arvore';

const relatorio = (extra: Partial<RelatorioImportacao> = {}): RelatorioImportacao => ({
  totalLinhas: 10, linhasValidas: 10, linhasComErro: 0, linhasComDadosIncompletos: 0, totalErros: 0, errosTruncados: false,
  erros: [], categoriasNaoEncontradas: [], locaisNaoEncontrados: [], colunasIgnoradas: [], hashArquivo: 'hash-1', podeConfirmar: true,
  ...extra
});

const comErros = (extra: Partial<RelatorioImportacao> = {}) => relatorio({
  linhasValidas: 7, linhasComErro: 3, totalErros: 4, podeConfirmar: false,
  erros: [
    { linha: 2, plaqueta: 'A1', campo: 'categoria', mensagem: "Categoria 'Veículos' não encontrada (ou inativa)." },
    { linha: 3, plaqueta: 'A2', campo: 'categoria', mensagem: "Categoria 'Veículos' não encontrada (ou inativa)." },
    { linha: 5, plaqueta: 'A4', campo: 'plaqueta', mensagem: 'Plaqueta duplicada no arquivo.' },
    { linha: 6, plaqueta: null, campo: 'linha', mensagem: 'Colunas a mais.' }
  ],
  categoriasNaoEncontradas: [{ nome: 'Veículos', linhas: 2 }],
  locaisNaoEncontrados: [{ nome: 'Filial Norte', linhas: 1 }],
  ...extra
});

describe('ImobImportacaoBensComponent', () => {
  let fixture: ComponentFixture<ImobImportacaoBensComponent>;
  let comp: ImobImportacaoBensComponent;
  let ctrl: HttpTestingController;
  const el = () => fixture.nativeElement as HTMLElement;
  const texto = () => (el().textContent ?? '').replace(/\s+/g, ' ');
  const arquivo = new File(['plaqueta;descricao;categoria'], 'bens.csv', { type: 'text/csv' });

  function montar(role: 'admin' | 'operador' | 'leitura' = 'operador') {
    TestBed.configureTestingModule({
      imports: [ImobImportacaoBensComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), provideAuthFake(role)]
    });
    ctrl = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ImobImportacaoBensComponent);
    comp = fixture.componentInstance;
    fixture.detectChanges();
    ctrl.expectOne(ARVORE).flush([{ id: 1, nome: 'Matriz', codigo: 'MTZ', ativo: true, filhos: [] }]);
    fixture.detectChanges();
  }

  const escolher = (f: File | null) => {
    const input = el().querySelector<HTMLInputElement>('#impArquivo')!;
    Object.defineProperty(input, 'files', { value: f ? [f] : [], configurable: true });
    input.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  };
  const validar = (rel: RelatorioImportacao, f: File = arquivo): TestRequest => {
    escolher(f);
    comp.validar();
    const req = ctrl.expectOne(`${BASE}/validar`);
    req.flush(rel);
    fixture.detectChanges();
    return req;
  };

  afterEach(() => ctrl.verify());

  it('sem arquivo, "Validar" fica desabilitado', () => {
    montar();
    const botao = Array.from(el().querySelectorAll('button')).find(b => b.textContent?.includes('Validar arquivo'))!;
    expect(botao.disabled).toBeTrue();
  });

  it('recusa arquivo que não é .csv sem chamar a API', () => {
    montar();
    escolher(new File(['x'], 'planilha.xlsx'));
    expect(comp.arquivo()).toBeNull();
    expect(texto()).toContain('Envie um arquivo .csv');
  });

  it('baixa o modelo via blob', () => {
    montar();
    const nomes: string[] = [];
    spyOn(URL, 'createObjectURL').and.returnValue('blob:x');
    spyOn(HTMLAnchorElement.prototype, 'click').and.callFake(function (this: HTMLAnchorElement) { nomes.push(this.download); });
    comp.baixarModelo();
    ctrl.expectOne(`${BASE}/modelo`).flush(new Blob(['x']));
    expect(nomes).toEqual(['modelo-importacao-bens.csv']);
  });

  describe('validação', () => {
    it('envia o arquivo e o local padrão e mostra os totais', () => {
      montar();
      comp.localPadrao.setValue(1);
      const req = validar(relatorio({ linhasComDadosIncompletos: 4 }));
      expect((req.request.body as FormData).get('localPadraoId')).toBe('1');
      expect(texto()).toContain('10 linhas');
      expect(texto()).toContain('4 bem(ns) ficarão com “dados incompletos”');
      expect(texto()).toContain('Importar 10 bem(ns)');
    });

    it('com erros: lista por linha, desabilita "Importar" e oferece só as válidas', () => {
      montar();
      validar(comErros());
      expect(texto()).toContain('Plaqueta duplicada no arquivo.');
      expect(texto()).toContain('Veículos (2 linhas)');
      expect(texto()).toContain('Filial Norte (1 linha)');
      const botoes = Array.from(el().querySelectorAll('button'));
      expect(botoes.find(b => b.textContent?.includes('Importar 7 bem'))!.disabled).toBeTrue();
      expect(botoes.find(b => b.textContent?.includes('Importar só as 7 válidas'))).toBeTruthy();
      expect(el().querySelector('a[href="/imobilizado/categorias"]')).toBeTruthy();
      expect(el().querySelector('a[href="/imobilizado/locais"]')).toBeTruthy();
    });

    it('filtra os erros por campo', () => {
      montar();
      validar(comErros());
      expect(comp.campos()).toEqual(['categoria', 'linha', 'plaqueta']);
      comp.filtrarCampo('plaqueta');
      fixture.detectChanges();
      expect(el().querySelectorAll('tbody tr').length).toBe(1);
    });

    it('avisa quando os erros foram truncados', () => {
      montar();
      validar(comErros({ errosTruncados: true, totalErros: 900 }));
      expect(texto()).toContain('Mostrando os primeiros 4 de 900 erros.');
    });

    it('baixa o relatório de erros gerado no navegador', () => {
      montar();
      validar(comErros());
      const nomes: string[] = [];
      spyOn(URL, 'createObjectURL').and.returnValue('blob:x');
      spyOn(HTMLAnchorElement.prototype, 'click').and.callFake(function (this: HTMLAnchorElement) { nomes.push(this.download); });
      comp.baixarRelatorioErros();
      expect(nomes).toEqual(['erros-importacao-bens.csv']);
    });

    it('400 do arquivo inteiro mostra a mensagem do servidor', () => {
      montar();
      escolher(arquivo);
      comp.validar();
      ctrl.expectOne(`${BASE}/validar`).flush({ error: 'Aspas não fechadas na linha 7.' }, { status: 400, statusText: 'Bad Request' });
      fixture.detectChanges();
      expect(texto()).toContain('Aspas não fechadas na linha 7.');
      expect(comp.relatorio()).toBeNull();
    });

    it('trocar o arquivo ou o local padrão invalida o relatório', () => {
      montar();
      validar(relatorio());
      expect(comp.relatorio()).not.toBeNull();
      comp.localPadrao.setValue(1);
      expect(comp.relatorio()).toBeNull();

      validar(relatorio());
      escolher(new File(['outro'], 'outro.csv'));
      expect(comp.relatorio()).toBeNull();
    });
  });

  describe('confirmação', () => {
    it('reenvia o mesmo arquivo com o hash e mostra o resultado com atalho para pendentes', () => {
      montar();
      validar(relatorio({ linhasComDadosIncompletos: 3, hashArquivo: 'h-9' }));
      void comp.importar(false);
      const req = ctrl.expectOne(`${BASE}/confirmar`);
      const form = req.request.body as FormData;
      expect(form.get('hashArquivo')).toBe('h-9');
      expect((form.get('arquivo') as File).name).toBe('bens.csv');
      expect(form.has('importarApenasValidas')).toBeFalse();
      expect(comp.importando()).toBeTrue();
      req.flush({ importados: 10, ignoradas: 0, relatorio: relatorio({ linhasComDadosIncompletos: 3 }) });
      fixture.detectChanges();
      expect(texto()).toContain('10 bem(ns) importado(s).');
      expect(el().querySelector('a[href="/imobilizado/bens?dadosCompletos=false"]')).toBeTruthy();
    });

    it('"só as válidas" pede confirmação e marca importarApenasValidas', async () => {
      montar();
      validar(comErros({ hashArquivo: 'h-2' }));
      const abrir = spyOn(ConfirmDialogComponent.prototype, 'abrir').and.resolveTo(false);
      await comp.importar(true);
      ctrl.expectNone(`${BASE}/confirmar`);

      abrir.and.resolveTo(true);
      await comp.importar(true);
      const req = ctrl.expectOne(`${BASE}/confirmar`);
      expect((req.request.body as FormData).get('importarApenasValidas')).toBe('true');
      req.flush({ importados: 7, ignoradas: 3, relatorio: comErros() });
      fixture.detectChanges();
      expect(texto()).toContain('7 bem(ns) importado(s).');
      expect(texto()).toContain('3 linha(s) ignorada(s).');
    });

    it('hash divergente mostra a mensagem e exige validar de novo', () => {
      montar();
      validar(relatorio());
      void comp.importar(false);
      ctrl.expectOne(`${BASE}/confirmar`).flush(
        { error: 'O arquivo enviado difere do arquivo validado. Valide novamente.' }, { status: 400, statusText: 'Bad Request' });
      fixture.detectChanges();
      expect(texto()).toContain('O arquivo enviado difere do arquivo validado.');
      expect(comp.relatorio()).toBeNull();
      expect(comp.importando()).toBeFalse();
    });

    it('outro 400 mantém o relatório para tentar novamente', () => {
      montar();
      validar(relatorio());
      void comp.importar(false);
      ctrl.expectOne(`${BASE}/confirmar`).flush({ error: 'Nenhuma linha válida para importar.' }, { status: 400, statusText: 'Bad Request' });
      expect(comp.relatorio()).not.toBeNull();
    });
  });
});
