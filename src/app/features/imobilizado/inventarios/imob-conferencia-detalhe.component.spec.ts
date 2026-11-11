import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { Modal } from 'bootstrap';
import { ImobConferenciaDetalheComponent } from './imob-conferencia-detalhe.component';
import { Anexo } from '../../../core/models/anexo.model';
import { ImobConferenciaDetalhe } from '../../../core/models/imob-leitura.model';

const BASE = '/api/v1/imobilizado/inventarios/3/conferencias/17';

const foto = (id: number): Anexo => ({
  id, nomeArquivo: `ev-${id}.jpg`, contentType: 'image/jpeg', tamanho: 120_000, criadoEm: '2026-11-11T12:15:55Z'
});

const detalhe = (extra: Partial<ImobConferenciaDetalhe> = {}): ImobConferenciaDetalhe => ({
  inventarioId: 3, inventarioReavaliacao: true, inventarioNome: 'ZZC Reavaliação', inventarioStatus: 'em_andamento', dataBase: '2026-11-01',
  bemId: 17, plaqueta: 'ZZC-0001', descricao: 'Mesa',
  localEsperadoId: 7, localEsperadoNome: 'ZZC Sala 1', departamentoEsperadoId: 3, departamentoEsperadoNome: 'ZZC Tecnologia',
  encontrado: true, localLidoId: 7, localLidoNome: 'ZZC Sala 1', estadoId: 5, estadoNome: 'ZZC Bom',
  valorMercado: 750.5, departamentoId: 3, departamentoNome: 'ZZC Tecnologia', observacao: 'Tampo riscado',
  conferidoPor: 'u1', conferidoPorNome: 'Admin Testes', conferidoEm: '2026-11-11T12:15:38Z',
  incompleto: false, somenteLeitura: false,
  eventos: [
    { id: 1, campo: 'estado_id', valorAnterior: null, valorNovo: '5', valorNovoNome: 'ZZC Bom', usuarioId: 'u1', usuarioNome: 'Admin Testes', origem: 'app', criadoEm: '2026-11-11T12:15:40Z' },
    { id: 2, campo: 'foto_adicionada', valorNovo: 'ev-1.jpg', usuarioId: 'u1', usuarioNome: 'Admin Testes', origem: 'web', criadoEm: '2026-11-11T12:16:00Z' }
  ],
  ...extra
});

describe('ImobConferenciaDetalheComponent', () => {
  let fixture: ComponentFixture<ImobConferenciaDetalheComponent>;
  let comp: ImobConferenciaDetalheComponent;
  let ctrl: HttpTestingController;
  const el = () => fixture.nativeElement as HTMLElement;
  const texto = () => (el().textContent ?? '').replace(/\s+/g, ' ').replace(/ /g, ' ');

  function montar(opcoes: { podeEnviar?: boolean; podeExcluir?: boolean } = {}) {
    TestBed.configureTestingModule({ imports: [ImobConferenciaDetalheComponent], providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])] });
    ctrl = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ImobConferenciaDetalheComponent);
    fixture.componentRef.setInput('inventarioId', 3);
    fixture.componentRef.setInput('bemId', 17);
    fixture.componentRef.setInput('podeEnviar', opcoes.podeEnviar ?? true);
    fixture.componentRef.setInput('podeExcluir', opcoes.podeExcluir ?? true);
    comp = fixture.componentInstance;
    fixture.detectChanges();
  }

  /** Responde o detalhe, a lista de fotos e o conteúdo de cada uma. */
  function carregar(d: ImobConferenciaDetalhe, fotos: Anexo[] = []) {
    ctrl.expectOne(BASE).flush(d);
    fixture.detectChanges();
    ctrl.expectOne(`${BASE}/fotos`).flush(fotos);
    for (const f of fotos) ctrl.expectOne(`${BASE}/fotos/${f.id}/conteudo`).flush(new Blob(['img'], { type: 'image/jpeg' }));
    fixture.detectChanges();
  }

  beforeEach(() => {
    spyOn(URL, 'createObjectURL').and.callFake(() => `blob:${Math.random()}`);
    spyOn(URL, 'revokeObjectURL').and.stub();
    spyOn(Modal.prototype, 'show').and.stub();
    spyOn(Modal.prototype, 'hide').and.stub();
  });

  afterEach(() => ctrl.verify());

  it('mostra esperado × encontrado, as fotos e o histórico', () => {
    montar();
    expect(texto()).toContain('Carregando');
    carregar(detalhe(), [foto(1)]);

    const t = texto();
    expect(t).toContain('ZZC-0001');
    expect(t).toContain('ZZC Reavaliação');
    expect(t).toContain('ZZC Tecnologia');
    expect(t).toContain('ZZC Bom');
    expect(t).toContain('R$ 750,50');
    expect(t).toContain('Tampo riscado');
    expect(t).toContain('Completo');
    expect(t).toContain('(1 de 5)');
    expect(el().querySelectorAll('img').length).toBe(1);
    expect(t).toContain('Estado de conservação: — → ZZC Bom');
    expect(t).toContain('Foto adicionada: ev-1.jpg');
    expect(t).toContain('App');
  });

  it('ciclo concluído é somente leitura: sem enviar nem excluir', () => {
    montar();
    carregar(detalhe({ somenteLeitura: true, inventarioStatus: 'concluido' }), [foto(1)]);

    expect(el().querySelector('[data-testid="somente-leitura"]')).not.toBeNull();
    expect(texto()).not.toContain('Adicionar fotos');
    expect(el().querySelector('button[aria-label^="Excluir foto"]')).toBeNull();
  });

  it('sem permissão não oferece enviar nem excluir', () => {
    montar({ podeEnviar: false, podeExcluir: false });
    carregar(detalhe(), [foto(1)]);

    expect(texto()).not.toContain('Adicionar fotos');
    expect(el().querySelector('button[aria-label^="Excluir foto"]')).toBeNull();
  });

  it('esperado sem departamento (ciclo antigo) aparece em traço e o bem não encontrado é sinalizado', () => {
    montar();
    carregar(detalhe({ departamentoEsperadoId: null, departamentoEsperadoNome: null, encontrado: false, eventos: [] }));

    expect(texto()).toContain('Não encontrado');
    expect(texto()).toContain('Nenhuma gravação registrada');
    expect(texto()).toContain('Nenhuma foto de evidência');
  });

  it('erro ao carregar mostra a mensagem do servidor', () => {
    montar();
    ctrl.expectOne(BASE).flush({ error: 'Conferência do bem 17 não encontrada.' }, { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();

    expect(texto()).toContain('não encontrada');
  });

  it('excluir confirma, remove a foto, atualiza o histórico e avisa a lista do ciclo', async () => {
    montar();
    carregar(detalhe(), [foto(1)]);
    let avisou = 0;
    comp.alterou.subscribe(() => avisou++);
    spyOn(comp['confirmDialog'](), 'abrir').and.resolveTo(true);

    await comp.excluir(foto(1));
    const del = ctrl.expectOne(r => r.method === 'DELETE' && r.url === `${BASE}/fotos/1`);
    expect(del.request.params.get('origem')).toBe('web');
    del.flush(null, { status: 204, statusText: 'No Content' });
    ctrl.expectOne(BASE).flush(detalhe({ eventos: [] }));
    fixture.detectChanges();

    expect(comp.fotos().length).toBe(0);
    expect(avisou).toBe(1);
  });

  it('excluir cancelado não chama o servidor', async () => {
    montar();
    carregar(detalhe(), [foto(1)]);
    spyOn(comp['confirmDialog'](), 'abrir').and.resolveTo(false);

    await comp.excluir(foto(1));

    ctrl.expectNone(r => r.method === 'DELETE');
    expect(comp.fotos().length).toBe(1);
  });

  it('com 5 fotos o botão de adicionar fica desabilitado', () => {
    montar();
    carregar(detalhe(), [1, 2, 3, 4, 5].map(foto));

    const botao = Array.from(el().querySelectorAll('button')).find(b => (b.textContent ?? '').includes('Adicionar fotos')) as HTMLButtonElement;
    expect(botao.disabled).toBeTrue();
  });

  describe('edição da conferência', () => {
    const listasEstados = () => ctrl.expectOne(r => r.url === '/api/v1/imobilizado/estados-conservacao');
    const listasDeptos = () => ctrl.expectOne(r => r.url === '/api/v1/imobilizado/departamentos');
    const editar = () => el().querySelector<HTMLButtonElement>('[data-testid="editar"]');

    function abrir() {
      editar()!.click();
      fixture.detectChanges();
      listasEstados().flush({ items: [{ id: 5, nome: 'ZZC Bom', notaEc: 8, notaVidaRemanescente: 7 }, { id: 6, nome: 'ZZC Ruim', notaEc: 3, notaVidaRemanescente: 2 }], page: 1, pageSize: 200, total: 2 });
      listasDeptos().flush({ items: [{ id: 3, nome: 'ZZC Tecnologia' }], page: 1, pageSize: 1000, total: 1 });
      fixture.detectChanges();
    }

    beforeEach(() => {
      montar({ podeEnviar: false, podeExcluir: false });
      fixture.componentRef.setInput('podeEditar', true);
    });

    it('com a permissão e o ciclo em andamento mostra o botão e abre o formulário já preenchido', () => {
      carregar(detalhe());
      expect(editar()).not.toBeNull();

      abrir();

      expect(el().querySelector('[data-testid="form-edicao"]')).not.toBeNull();
      expect(comp.form.getRawValue()).toEqual({ estadoId: 5, valorMercado: 750.5, departamentoId: 3, observacao: 'Tampo riscado' });
      expect(texto()).toContain('não apaga');
    });

    it('sem permissão ou com o ciclo concluído não oferece edição', () => {
      carregar(detalhe({ somenteLeitura: true }));
      expect(editar()).toBeNull();
    });

    it('sem permissão de editar não oferece o botão', () => {
      fixture.componentRef.setInput('podeEditar', false);
      carregar(detalhe());
      expect(editar()).toBeNull();
    });

    it('salvar envia o PUT com os campos, recarrega o detalhe e avisa a lista do ciclo', () => {
      carregar(detalhe());
      abrir();
      let avisou = 0;
      comp.alterou.subscribe(() => avisou++);
      comp.form.patchValue({ estadoId: 6, valorMercado: 90, observacao: '  Pé quebrado  ' });

      comp.salvarEdicao();
      const put = ctrl.expectOne(r => r.method === 'PUT' && r.url === BASE);
      expect(put.request.body).toEqual({ estadoId: 6, valorMercado: 90, departamentoId: 3, observacao: 'Pé quebrado' });
      put.flush({ indice: 0, bemId: 17, resultado: 'gravada' });
      ctrl.expectOne(BASE).flush(detalhe({ estadoNome: 'ZZC Ruim', valorMercado: 90, observacao: 'Pé quebrado' }));
      fixture.detectChanges();

      expect(comp.editando()).toBeFalse();
      expect(avisou).toBe(1);
      expect(texto()).toContain('Pé quebrado');
      expect(texto()).toContain('ZZC Ruim');
    });

    it('observação em branco vai como nula (não apaga a gravada)', () => {
      carregar(detalhe());
      abrir();
      comp.form.patchValue({ observacao: '   ' });

      comp.salvarEdicao();
      const put = ctrl.expectOne(r => r.method === 'PUT' && r.url === BASE);
      expect(put.request.body.observacao).toBeNull();
      put.flush({ indice: 0, bemId: 17, resultado: 'gravada' });
      ctrl.expectOne(BASE).flush(detalhe());
    });

    it('valor negativo não envia', () => {
      carregar(detalhe());
      abrir();
      comp.form.patchValue({ valorMercado: -5 });

      comp.salvarEdicao();

      ctrl.expectNone(r => r.method === 'PUT');
      expect(comp.form.controls.valorMercado.invalid).toBeTrue();
    });

    it('erro do servidor (ex.: fora da equipe) aparece e mantém o formulário aberto', () => {
      carregar(detalhe());
      abrir();

      comp.salvarEdicao();
      ctrl.expectOne(r => r.method === 'PUT' && r.url === BASE).flush(
        { error: 'Somente a equipe do inventário (ou um administrador) pode registrar conferências.' }, { status: 403, statusText: 'Forbidden' });
      fixture.detectChanges();

      expect(comp.editando()).toBeTrue();
      expect(texto()).toContain('Somente a equipe do inventário');
    });

    it('resultado "ignorada" avisa que já existe gravação mais recente', () => {
      carregar(detalhe());
      abrir();

      comp.salvarEdicao();
      ctrl.expectOne(r => r.method === 'PUT' && r.url === BASE).flush({ indice: 0, bemId: 17, resultado: 'ignorada' });
      fixture.detectChanges();

      expect(comp.editando()).toBeTrue();
      expect(texto()).toContain('mais recente');
    });

    it('cancelar fecha o formulário sem chamar o servidor', () => {
      carregar(detalhe());
      abrir();

      comp.cancelarEdicao();

      expect(comp.editando()).toBeFalse();
      ctrl.expectNone(r => r.method === 'PUT');
    });
  });

  describe('inventário comum (DSG-30 R15)', () => {
    const comum = (extra: Partial<ImobConferenciaDetalhe> = {}) => detalhe({
      inventarioReavaliacao: false, inventarioNome: 'Conferencia 11/2026', estadoId: null, estadoNome: null, valorMercado: null,
      departamentoId: null, departamentoNome: null, observacao: null, incompleto: false,
      eventos: [{ id: 1, campo: 'encontrado', valorAnterior: 'false', valorNovo: 'true', usuarioId: 'u1', usuarioNome: 'Admin Testes', origem: 'app', criadoEm: '2026-11-11T12:15:40Z' }],
      ...extra
    });

    beforeEach(() => {
      montar({ podeEnviar: true, podeExcluir: true });
      fixture.componentRef.setInput('podeEditar', true);
    });

    it('mostra o item lido, o local, as fotos e o histórico — sem estado, valor nem edição de conferência', () => {
      carregar(comum(), [foto(1)]);

      const t = texto();
      expect(t).toContain('Inventário Conferencia 11/2026');
      expect(t).toContain('Encontrado');
      expect(t).toContain('ZZC Sala 1');
      expect(t).toContain('(1 de 5)');
      expect(t).toContain('Encontrado: Não → Sim');
      expect(t).not.toContain('Estado de conservação');
      expect(t).not.toContain('Valor de mercado');
      expect(t).not.toContain('Completo');
      expect(el().querySelector('[data-testid="editar"]')).toBeNull();
      expect(el().querySelector('button[aria-label^="Excluir foto"]')).not.toBeNull();
    });

    it('item com a leitura anulada aparece como não encontrado', () => {
      carregar(comum({ encontrado: false, eventos: [] }));
      expect(texto()).toContain('Não encontrado');
    });

    it('"Abrir bem" e "Editar bem" aparecem só com as permissões do bem', () => {
      fixture.componentRef.setInput('podeVerBem', true);
      fixture.componentRef.setInput('podeEditarBem', true);
      carregar(comum());

      const abrir = el().querySelector<HTMLAnchorElement>('[data-testid="abrir-bem"]')!;
      const editar = el().querySelector<HTMLAnchorElement>('[data-testid="editar-bem"]')!;
      expect(abrir.getAttribute('href')).toContain('/imobilizado/bens/17');
      expect(editar.getAttribute('href')).toContain('/imobilizado/bens/17/editar');
    });

    it('sem permissão no bem não oferece os atalhos', () => {
      carregar(comum());

      expect(el().querySelector('[data-testid="abrir-bem"]')).toBeNull();
      expect(el().querySelector('[data-testid="editar-bem"]')).toBeNull();
    });
  });
});
