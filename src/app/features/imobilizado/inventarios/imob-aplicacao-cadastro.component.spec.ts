import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { Modal } from 'bootstrap';
import { ImobAplicacaoCadastroComponent } from './imob-aplicacao-cadastro.component';
import { ImobAplicacaoLinha, ImobAplicacaoPrevia, ImobAplicacaoResposta } from '../../../core/models/imob-leitura.model';

const BASE = '/api/v1/imobilizado/inventarios/3/conferencias';

const linha = (bemId: number, extra: Partial<ImobAplicacaoLinha> = {}): ImobAplicacaoLinha => ({
  bemId, plaqueta: `ZZC-000${bemId}`, descricao: `Bem ${bemId}`, bemStatus: 'ativo',
  departamentoAtualId: null, departamentoAtualNome: null, departamentoEsperadoId: null,
  departamentoEncontradoId: 3, departamentoEncontradoNome: 'ZZC Tecnologia', departamentoAplicado: false,
  departamentoDiferente: true, departamentoCadastroAlterado: false,
  estadoAtualId: null, estadoAtualNome: null, estadoEncontradoId: 5, estadoEncontradoNome: 'ZZC Bom', estadoAplicado: false, estadoDiferente: true,
  localCadastroId: 7, localLidoId: 7, localDivergente: false, aplicavel: true, ...extra
});

const previa = (itens: ImobAplicacaoLinha[], extra: Partial<ImobAplicacaoPrevia> = {}): ImobAplicacaoPrevia => ({
  items: itens, page: 1, pageSize: 20, total: itens.length, inventarioId: 3, inventarioStatus: 'concluido', podeAplicar: true, ...extra
});

const resposta = (extra: Partial<ImobAplicacaoResposta> = {}): ImobAplicacaoResposta => ({
  aplicados: 0, revertidos: 0, semMudanca: 0, naoAplicados: 0, itens: [], ...extra
});

describe('ImobAplicacaoCadastroComponent', () => {
  let fixture: ComponentFixture<ImobAplicacaoCadastroComponent>;
  let comp: ImobAplicacaoCadastroComponent;
  let ctrl: HttpTestingController;
  const el = () => fixture.nativeElement as HTMLElement;
  const texto = () => (el().textContent ?? '').replace(/\s+/g, ' ').replace(/ /g, ' ');
  const botao = (id: string) => el().querySelector<HTMLButtonElement>(`[data-testid="${id}"]`)!;
  const caixa = (rotulo: string) => el().querySelector<HTMLInputElement>(`input[aria-label="${rotulo}"]`)!;

  function montar() {
    TestBed.configureTestingModule({
      imports: [ImobAplicacaoCadastroComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])]
    });
    ctrl = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ImobAplicacaoCadastroComponent);
    fixture.componentRef.setInput('inventarioId', 3);
    comp = fixture.componentInstance;
    fixture.detectChanges();
  }

  const carregarPrevia = (p: ImobAplicacaoPrevia) => {
    ctrl.expectOne(r => r.url === `${BASE}/aplicacao`).flush(p);
    fixture.detectChanges();
  };

  const clicar = (input: HTMLInputElement) => { input.click(); fixture.detectChanges(); };

  beforeEach(() => {
    spyOn(Modal.prototype, 'show').and.stub();
    spyOn(Modal.prototype, 'hide').and.stub();
  });

  afterEach(() => ctrl.verify());

  it('mostra cadastro atual → encontrado e começa com a situação "só o que difere"', () => {
    montar();
    const req = ctrl.expectOne(r => r.url === `${BASE}/aplicacao`);
    expect(req.request.params.get('situacao')).toBe('diferencas');
    req.flush(previa([linha(1)]));
    fixture.detectChanges();

    const t = texto();
    expect(t).toContain('ZZC-0001');
    expect(t).toContain('— → ZZC Tecnologia');
    expect(t).toContain('— → ZZC Bom');
    expect(t).toContain('não altera o cadastro sozinha');
  });

  it('inventário não concluído: avisa e não deixa aplicar', () => {
    montar();
    carregarPrevia(previa([linha(1)], { podeAplicar: false, inventarioStatus: 'em_andamento' }));

    expect(el().querySelector('[data-testid="aviso-nao-concluido"]')).not.toBeNull();
    clicar(caixa('Departamento de ZZC-0001'));
    expect(botao('aplicar').disabled).toBeTrue();
  });

  it('local lido em outro lugar só é sinalizado (não há como aplicar o local)', () => {
    montar();
    carregarPrevia(previa([linha(1, { localDivergente: true, localLidoId: 9, localLidoNome: 'Sala 2', localCadastroNome: 'Sala 1' })]));

    expect(el().querySelector('[data-testid="local-divergente"]')).not.toBeNull();
    expect(texto()).toContain('Lido em outro local');
    expect(texto()).toContain('conciliação');
  });

  it('bem baixado/vendido não pode ser marcado', () => {
    montar();
    carregarPrevia(previa([linha(1, { aplicavel: false, bemStatus: 'baixado' })]));

    expect(caixa('Departamento de ZZC-0001').disabled).toBeTrue();
    expect(texto()).toContain('Bem baixado/vendido');
  });

  it('marca departamento e estado, confirma e aplica; mostra o resumo e recarrega a prévia', async () => {
    montar();
    carregarPrevia(previa([linha(1), linha(2)]));
    spyOn(comp['confirmDialog'](), 'abrir').and.resolveTo(true);
    clicar(caixa('Departamento de ZZC-0001'));
    clicar(caixa('Estado de ZZC-0001'));
    clicar(caixa('Departamento de ZZC-0002'));
    expect(texto()).toContain('3 campo(s) marcado(s)');

    const promessa = comp.executar('aplicar');
    await Promise.resolve();
    await Promise.resolve();
    const post = ctrl.expectOne(`${BASE}/aplicar`);
    expect(post.request.method).toBe('POST');
    expect(post.request.body.confirmarCadastroAlterado).toBeFalse();
    expect(post.request.body.itens).toEqual([
      { bemId: 1, campos: ['departamento_id', 'estado_conservacao_id'] },
      { bemId: 2, campos: ['departamento_id'] }
    ]);
    post.flush(resposta({ aplicados: 3, itens: [] }));
    await promessa;
    ctrl.expectOne(r => r.url === `${BASE}/aplicacao`).flush(previa([]));
    fixture.detectChanges();

    expect(texto()).toContain('3 aplicado(s)');
    expect(comp.totalMarcadas()).toBe(0);
  });

  it('cadastro alterado pede uma segunda confirmação e reenvia só esses itens com confirmarCadastroAlterado', async () => {
    montar();
    carregarPrevia(previa([linha(1, { departamentoCadastroAlterado: true, departamentoAtualId: 8, departamentoAtualNome: 'RH' })]));
    const abrir = spyOn(comp['confirmDialog'](), 'abrir').and.resolveTo(true);
    clicar(caixa('Departamento de ZZC-0001'));

    const promessa = comp.executar('aplicar');
    await Promise.resolve();
    await Promise.resolve();
    ctrl.expectOne(`${BASE}/aplicar`).flush(resposta({
      naoAplicados: 1, itens: [{ bemId: 1, campo: 'departamento_id', resultado: 'cadastro_alterado', mensagem: 'O cadastro mudou depois da conferência.' }]
    }));
    await new Promise(r => setTimeout(r));
    const segundo = ctrl.expectOne(`${BASE}/aplicar`);
    expect(segundo.request.body.confirmarCadastroAlterado).toBeTrue();
    expect(segundo.request.body.itens).toEqual([{ bemId: 1, campos: ['departamento_id'] }]);
    segundo.flush(resposta({ aplicados: 1 }));
    await promessa;
    ctrl.expectOne(r => r.url === `${BASE}/aplicacao`).flush(previa([]));
    fixture.detectChanges();

    expect(abrir).toHaveBeenCalledTimes(2);
    expect(texto()).toContain('1 aplicado(s)');
  });

  it('desfazer só vale para o que já foi aplicado e usa a rota de reverter', async () => {
    montar();
    carregarPrevia(previa([linha(1, { departamentoAplicado: true, departamentoDiferente: false })], { }));
    spyOn(comp['confirmDialog'](), 'abrir').and.resolveTo(true);
    clicar(caixa('Departamento de ZZC-0001'));
    expect(botao('aplicar').disabled).toBeTrue();
    expect(botao('desfazer').disabled).toBeFalse();

    const promessa = comp.executar('reverter');
    await Promise.resolve();
    await Promise.resolve();
    const post = ctrl.expectOne(`${BASE}/aplicar/reverter`);
    expect(post.request.body.itens).toEqual([{ bemId: 1, campos: ['departamento_id'] }]);
    post.flush(resposta({ revertidos: 1 }));
    await promessa;
    ctrl.expectOne(r => r.url === `${BASE}/aplicacao`).flush(previa([]));
    fixture.detectChanges();

    expect(texto()).toContain('1 desfeito(s)');
  });

  it('confirmação cancelada não chama o servidor', async () => {
    montar();
    carregarPrevia(previa([linha(1)]));
    spyOn(comp['confirmDialog'](), 'abrir').and.resolveTo(false);
    clicar(caixa('Departamento de ZZC-0001'));

    await comp.executar('aplicar');

    ctrl.expectNone(`${BASE}/aplicar`);
  });

  it('erro da prévia aparece na tela', () => {
    montar();
    ctrl.expectOne(r => r.url === `${BASE}/aplicacao`).flush({ error: 'Este inventário não é de reavaliação.' }, { status: 400, statusText: 'Bad Request' });
    fixture.detectChanges();

    expect(texto()).toContain('não é de reavaliação');
  });
});
