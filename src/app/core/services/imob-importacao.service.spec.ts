import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ImobImportacaoService } from './imob-importacao.service';
import { lerErroApi } from '../utils/erros-api';

const BASE = '/api/v1/imobilizado/bens/importacao';

describe('ImobImportacaoService', () => {
  let service: ImobImportacaoService;
  let ctrl: HttpTestingController;
  const arquivo = new File(['plaqueta;descricao;categoria\n1;Mesa;Moveis'], 'bens.csv', { type: 'text/csv' });

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(ImobImportacaoService);
    ctrl = TestBed.inject(HttpTestingController);
  });

  afterEach(() => ctrl.verify());

  it('modelo: baixa como blob e usa o nome do servidor ou o padrão', () => {
    let nome = '';
    service.modelo().subscribe(a => nome = a.nome);
    const req = ctrl.expectOne(`${BASE}/modelo`);
    expect(req.request.responseType).toBe('blob');
    req.flush(new Blob(['x']));
    expect(nome).toBe('modelo-importacao-bens.csv');
  });

  it('validar: envia multipart com arquivo e local padrão, sem Content-Type manual', () => {
    service.validar(arquivo, 5).subscribe();
    const req = ctrl.expectOne(`${BASE}/validar`);
    const form = req.request.body as FormData;
    expect(form instanceof FormData).toBeTrue();
    expect((form.get('arquivo') as File).name).toBe('bens.csv');
    expect(form.get('localPadraoId')).toBe('5');
    expect(req.request.headers.has('Content-Type')).toBeFalse();
    req.flush({});
  });

  it('validar sem local padrão não envia o campo', () => {
    service.validar(arquivo).subscribe();
    const req = ctrl.expectOne(`${BASE}/validar`);
    expect((req.request.body as FormData).has('localPadraoId')).toBeFalse();
    req.flush({});
  });

  it('confirmar: reenvia o arquivo com o hash e só marca "apenas válidas" quando pedido', () => {
    service.confirmar(arquivo, 'abc123', 5).subscribe();
    let req = ctrl.expectOne(`${BASE}/confirmar`);
    let form = req.request.body as FormData;
    expect(form.get('hashArquivo')).toBe('abc123');
    expect(form.get('localPadraoId')).toBe('5');
    expect(form.has('importarApenasValidas')).toBeFalse();
    req.flush({});

    service.confirmar(arquivo, 'abc123', null, true).subscribe();
    req = ctrl.expectOne(`${BASE}/confirmar`);
    form = req.request.body as FormData;
    expect(form.get('importarApenasValidas')).toBe('true');
    expect(form.has('localPadraoId')).toBeFalse();
    req.flush({});
  });

  it('o 400 do modelo (corpo Blob) vira erro legível', async () => {
    const erro = new Promise<HttpErrorResponse>(resolve => service.modelo().subscribe({ error: resolve }));
    ctrl.expectOne(`${BASE}/modelo`).flush(
      new Blob([JSON.stringify({ error: 'Falhou.' })], { type: 'application/json' }), { status: 400, statusText: 'Bad Request' });
    expect(lerErroApi(await erro, 'x').mensagem).toBe('Falhou.');
  });
});
