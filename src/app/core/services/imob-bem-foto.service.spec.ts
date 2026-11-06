import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ImobBemFotoService } from './imob-bem-foto.service';

const BASE = '/api/v1/imobilizado/bens/42/fotos';

describe('ImobBemFotoService', () => {
  let service: ImobBemFotoService;
  let ctrl: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(ImobBemFotoService);
    ctrl = TestBed.inject(HttpTestingController);
  });

  afterEach(() => ctrl.verify());

  it('listar: GET das fotos do bem', () => {
    let n = 0;
    service.listar(42).subscribe(l => n = l.length);
    const req = ctrl.expectOne(BASE);
    expect(req.request.method).toBe('GET');
    req.flush([{ id: 1, nomeArquivo: 'a.jpg', contentType: 'image/jpeg', tamanho: 10, criadoEm: '2026-11-06T10:00:00Z' }]);
    expect(n).toBe(1);
  });

  it('enviar: multipart com o campo "arquivo", sem Content-Type manual', () => {
    const arquivo = new File(['x'], 'frente.jpg', { type: 'image/jpeg' });
    service.enviar(42, arquivo).subscribe();
    const req = ctrl.expectOne(BASE);
    const form = req.request.body as FormData;
    expect(req.request.method).toBe('POST');
    expect(form instanceof FormData).toBeTrue();
    expect((form.get('arquivo') as File).name).toBe('frente.jpg');
    expect(req.request.headers.has('Content-Type')).toBeFalse();
    req.flush({ id: 7 });
  });

  it('excluir: DELETE da foto', () => {
    service.excluir(42, 7).subscribe();
    const req = ctrl.expectOne(`${BASE}/7`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });

  it('conteudo: baixa como blob', () => {
    let blob: Blob | null = null;
    service.conteudo(42, 7).subscribe(b => blob = b);
    const req = ctrl.expectOne(`${BASE}/7/conteudo`);
    expect(req.request.responseType).toBe('blob');
    req.flush(new Blob(['abc'], { type: 'image/jpeg' }));
    expect(blob!.size).toBe(3);
  });

  it('o 404 do conteúdo (corpo Blob) vira erro legível', async () => {
    const erro = new Promise<HttpErrorResponse>(resolve => service.conteudo(42, 7).subscribe({ error: resolve }));
    ctrl.expectOne(`${BASE}/7/conteudo`).flush(
      new Blob([JSON.stringify({ error: 'Foto não encontrada.' })], { type: 'application/json' }),
      { status: 404, statusText: 'Not Found' });
    const e = await erro;
    expect(e.status).toBe(404);
    expect(e.error.error).toBe('Foto não encontrada.');
  });
});
