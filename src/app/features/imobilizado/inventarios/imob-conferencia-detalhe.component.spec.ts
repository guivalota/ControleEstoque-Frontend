import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Modal } from 'bootstrap';
import { ImobConferenciaDetalheComponent } from './imob-conferencia-detalhe.component';
import { Anexo } from '../../../core/models/anexo.model';
import { ImobConferenciaDetalhe } from '../../../core/models/imob-leitura.model';

const BASE = '/api/v1/imobilizado/inventarios/3/conferencias/17';

const foto = (id: number): Anexo => ({
  id, nomeArquivo: `ev-${id}.jpg`, contentType: 'image/jpeg', tamanho: 120_000, criadoEm: '2026-11-11T12:15:55Z'
});

const detalhe = (extra: Partial<ImobConferenciaDetalhe> = {}): ImobConferenciaDetalhe => ({
  inventarioId: 3, inventarioNome: 'ZZC Reavaliação', inventarioStatus: 'em_andamento', dataBase: '2026-11-01',
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
    TestBed.configureTestingModule({ imports: [ImobConferenciaDetalheComponent], providers: [provideHttpClient(), provideHttpClientTesting()] });
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
});
