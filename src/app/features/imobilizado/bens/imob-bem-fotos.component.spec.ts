import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { Modal } from 'bootstrap';
import { ImobBemFotosComponent } from './imob-bem-fotos.component';
import { Anexo } from '../../../core/models/anexo.model';

const BASE = '/api/v1/imobilizado/bens/42/fotos';

const foto = (id: number, extra: Partial<Anexo> = {}): Anexo => ({
  id, nomeArquivo: `foto-${id}.jpg`, contentType: 'image/jpeg', tamanho: 120_000, criadoEm: '2026-11-06T13:00:00Z', ...extra
});

describe('ImobBemFotosComponent', () => {
  let fixture: ComponentFixture<ImobBemFotosComponent>;
  let comp: ImobBemFotosComponent;
  let ctrl: HttpTestingController;
  const el = () => fixture.nativeElement as HTMLElement;
  const texto = () => (el().textContent ?? '').replace(/\s+/g, ' ');
  const imagens = () => el().querySelectorAll('img').length;

  function montar(podeEditar = true) {
    TestBed.configureTestingModule({ imports: [ImobBemFotosComponent], providers: [provideHttpClient(), provideHttpClientTesting()] });
    ctrl = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ImobBemFotosComponent);
    fixture.componentRef.setInput('bemId', 42);
    fixture.componentRef.setInput('podeEditar', podeEditar);
    comp = fixture.componentInstance;
    fixture.detectChanges();
  }

  /** Responde a lista e o conteúdo de cada foto. */
  function carregar(fotos: Anexo[]) {
    ctrl.expectOne(BASE).flush(fotos);
    fixture.detectChanges();
    for (const f of fotos) ctrl.expectOne(`${BASE}/${f.id}/conteudo`).flush(new Blob(['img'], { type: 'image/jpeg' }));
    fixture.detectChanges();
  }

  beforeEach(() => {
    spyOn(URL, 'createObjectURL').and.callFake(() => `blob:${Math.random()}`);
    spyOn(URL, 'revokeObjectURL').and.stub();
    spyOn(Modal.prototype, 'show').and.stub();
    spyOn(Modal.prototype, 'hide').and.stub();
  });

  afterEach(() => ctrl.verify());

  it('carrega a lista e a imagem de cada foto', () => {
    montar();
    expect(texto()).toContain('Carregando fotos');
    carregar([foto(1), foto(2)]);
    expect(texto()).toContain('(2 de 5)');
    expect(imagens()).toBe(2);
    expect(texto()).toContain('foto-1.jpg');
    expect(texto()).toContain('117 KB');
  });

  it('sem fotos mostra a orientação', () => {
    montar();
    carregar([]);
    expect(texto()).toContain('Nenhuma foto ainda');
    expect(texto()).toContain('Adicionar fotos');
  });

  it('sem permissão de editar não oferece enviar nem excluir', () => {
    montar(false);
    carregar([foto(1)]);
    expect(texto()).not.toContain('Adicionar fotos');
    expect(el().querySelector('button[aria-label^="Excluir foto"]')).toBeNull();
    expect(imagens()).toBe(1);
  });

  it('erro ao listar mostra a mensagem do servidor', () => {
    montar();
    ctrl.expectOne(BASE).flush({ error: 'Bem com id 42 não encontrado.' }, { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();
    expect(texto()).toContain('Bem com id 42 não encontrado.');
  });

  it('falha ao baixar uma imagem não derruba a lista', () => {
    montar();
    ctrl.expectOne(BASE).flush([foto(1), foto(2)]);
    fixture.detectChanges();
    ctrl.expectOne(`${BASE}/1/conteudo`).flush(new Blob(['x']), { status: 500, statusText: 'Erro' });
    ctrl.expectOne(`${BASE}/2/conteudo`).flush(new Blob(['img']));
    fixture.detectChanges();
    expect(texto()).toContain('foto-1.jpg');
    expect(imagens()).toBe(1);
  });

  describe('enviar', () => {
    const escolher = (arquivos: File[]) => {
      const input = el().querySelector<HTMLInputElement>('#fotoArquivo')!;
      Object.defineProperty(input, 'files', { value: arquivos, configurable: true });
      input.dispatchEvent(new Event('change'));
    };

    const esperarEnvio = async (): Promise<TestRequest> => {
      for (let i = 0; i < 50; i++) {
        const abertas = ctrl.match(r => r.method === 'POST' && r.url === BASE);
        if (abertas.length) return abertas[0];
        await new Promise(r => setTimeout(r, 10));
      }
      throw new Error('nenhum POST');
    };

    it('envia a foto, mostra na lista e busca a imagem', async () => {
      montar();
      carregar([]);

      escolher([new File(['jpeg'], 'nova.jpg', { type: 'image/jpeg' })]);
      const req = await esperarEnvio();
      expect(((req.request.body as FormData).get('arquivo') as File).name).toBe('nova.jpg');
      req.flush(foto(9, { nomeArquivo: 'nova.jpg' }));
      await fixture.whenStable();
      fixture.detectChanges();
      ctrl.expectOne(`${BASE}/9/conteudo`).flush(new Blob(['img']));
      fixture.detectChanges();

      expect(texto()).toContain('(1 de 5)');
      expect(texto()).toContain('nova.jpg');
      expect(comp.enviando()).toBeFalse();
    });

    it('erro do servidor aparece com o nome do arquivo e a lista não muda', async () => {
      montar();
      carregar([]);

      escolher([new File(['texto'], 'laudo.jpg', { type: 'image/jpeg' })]);
      const req = await esperarEnvio();
      req.flush({ error: 'Tipo de arquivo não permitido. Envie JPG, PNG, WebP.' }, { status: 400, statusText: 'Bad Request' });
      await fixture.whenStable();
      fixture.detectChanges();

      expect(texto()).toContain('“laudo.jpg”');
      expect(texto()).toContain('Tipo de arquivo não permitido');
      expect(comp.fotos().length).toBe(0);
    });

    it('com 5 fotos o botão fica desabilitado e o excedente é ignorado com aviso', async () => {
      montar();
      carregar([foto(1), foto(2), foto(3), foto(4)]);

      escolher([new File(['a'], 'a.jpg', { type: 'image/jpeg' }), new File(['b'], 'b.jpg', { type: 'image/jpeg' })]);
      const req = await esperarEnvio();
      req.flush(foto(5, { nomeArquivo: 'a.jpg' }));
      await fixture.whenStable();
      fixture.detectChanges();
      ctrl.expectOne(`${BASE}/5/conteudo`).flush(new Blob(['img']));
      fixture.detectChanges();

      expect(comp.fotos().length).toBe(5);
      expect(texto()).toContain('Só cabem mais 1 foto(s)');
      const botao = Array.from(el().querySelectorAll('button')).find(b => b.textContent?.includes('Adicionar fotos'))!;
      expect(botao.disabled).toBeTrue();
      expect(ctrl.match(r => r.method === 'POST').length).toBe(0);
    });
  });

  describe('excluir', () => {
    it('confirma, exclui e some da lista', async () => {
      montar();
      carregar([foto(1), foto(2)]);

      const pendente = comp.excluir(comp.fotos()[0]);
      fixture.detectChanges();
      el().querySelector<HTMLButtonElement>('.modal-footer .btn-danger')!.click();
      await pendente;

      const req = ctrl.expectOne(`${BASE}/1`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
      fixture.detectChanges();

      expect(comp.fotos().map(f => f.id)).toEqual([2]);
      expect(imagens()).toBe(1);
    });

    it('cancelar não chama a API', async () => {
      montar();
      carregar([foto(1)]);

      const pendente = comp.excluir(comp.fotos()[0]);
      fixture.detectChanges();
      el().querySelector<HTMLButtonElement>('.modal-footer .btn-outline-secondary')!.click();
      // o diálogo resolve "false" ao fechar (evento do Bootstrap): simulamos
      (el().querySelector('.modal') as HTMLElement).dispatchEvent(new Event('hidden.bs.modal'));
      await pendente;

      ctrl.expectNone(`${BASE}/1`);
      expect(comp.fotos().length).toBe(1);
    });

    it('erro ao excluir mostra a mensagem e mantém a foto', async () => {
      montar();
      carregar([foto(1)]);

      const pendente = comp.excluir(comp.fotos()[0]);
      fixture.detectChanges();
      el().querySelector<HTMLButtonElement>('.modal-footer .btn-danger')!.click();
      await pendente;
      ctrl.expectOne(`${BASE}/1`).flush({ error: 'Foto não encontrada.' }, { status: 404, statusText: 'Not Found' });
      fixture.detectChanges();

      expect(texto()).toContain('Foto não encontrada.');
      expect(comp.fotos().length).toBe(1);
    });
  });
});
