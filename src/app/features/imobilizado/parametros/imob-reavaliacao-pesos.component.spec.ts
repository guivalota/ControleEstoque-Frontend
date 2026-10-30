import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { ImobReavaliacaoPesosComponent } from './imob-reavaliacao-pesos.component';
import { ImobParametrosVersao } from '../../../core/models/imob-reavaliacao.model';
import { provideAuthFake } from '../../../testing/auth-fake';

const BASE = '/api/v1/imobilizado/reavaliacao/parametros';

const versao = (n: number, extra: Partial<ImobParametrosVersao> = {}): ImobParametrosVersao => ({
  id: n, versao: n, pesoEc: 4, pesoVf: 6, pesoVp: -3, divisor: 100, vigente: true, motivo: null,
  criadoPor: 'u1', criadoPorNome: 'Ana', criadoEm: '2026-10-27T14:03:11Z', alteracoes: [], ...extra
});

describe('ImobReavaliacaoPesosComponent', () => {
  let fixture: ComponentFixture<ImobReavaliacaoPesosComponent>;
  let comp: ImobReavaliacaoPesosComponent;
  let ctrl: HttpTestingController;
  const el = () => fixture.nativeElement as HTMLElement;

  const historico = (items: ImobParametrosVersao[]) =>
    {
      const req = ctrl.expectOne(r => r.url === `${BASE}/historico`);
      expect(req.request.params.get('pageSize')).toBe('10');
      req.flush({ items, page: 1, pageSize: 10, total: items.length });
    }

  function montar(role: 'admin' | 'operador' | 'leitura' = 'admin', vigente = versao(1), hist: ImobParametrosVersao[] = [versao(1)]) {
    TestBed.configureTestingModule({
      imports: [ImobReavaliacaoPesosComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), provideAuthFake(role)]
    });
    ctrl = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ImobReavaliacaoPesosComponent);
    comp = fixture.componentInstance;
    fixture.detectChanges();
    ctrl.expectOne(r => r.url === BASE && r.method === 'GET').flush(vigente);
    historico(hist);
    fixture.detectChanges();
  }

  afterEach(() => ctrl.verify());

  it('mostra a versão vigente com os quatro valores formatados', () => {
    montar('admin', versao(1, { pesoVp: -3, divisor: 100 }));
    expect(el().querySelector('#vigPesoEc')!.textContent).toContain('4');
    expect(el().querySelector('#vigPesoVf')!.textContent).toContain('6');
    expect(el().querySelector('#vigPesoVp')!.textContent).toContain('-3');
    expect(el().querySelector('#vigDivisor')!.textContent).toContain('100');
    expect(el().textContent).toContain('v1');
  });

  it('pré-preenche o formulário com a versão vigente', () => {
    montar();
    expect(comp.form.getRawValue()).toEqual({ pesoEc: 4, pesoVf: 6, pesoVp: -3, divisor: 100, motivo: '' });
  });

  it('histórico mostra o diff das alterações e "Versão inicial" na primeira', () => {
    const v2 = versao(2, {
      pesoEc: 5, divisor: 120, motivo: 'Ajuste anual',
      alteracoes: [{ campo: 'peso_ec', anterior: 4, novo: 5 }, { campo: 'divisor', anterior: 100, novo: 120 }]
    });
    montar('admin', v2, [v2, versao(1, { vigente: false })]);
    const texto = el().textContent!.replace(/\s+/g, ' ');
    expect(texto).toContain('Peso EC: 4 → 5');
    expect(texto).toContain('Divisor: 100 → 120');
    expect(texto).toContain('Ajuste anual');
    expect(texto).toContain('Versão inicial');
    expect(texto).toContain('vigente');
  });

  describe('nova versão', () => {
    beforeEach(() => montar());

    it('valida obrigatórios, limites (-1000..1000) e divisor > 0', () => {
      comp.form.patchValue({ pesoEc: null, pesoVf: 1001, pesoVp: -1001, divisor: 0 });
      comp.save();
      expect(comp.erroCampo('pesoEc')).toBe('Campo obrigatório.');
      expect(comp.erroCampo('pesoVf')).toBe('Informe um valor de -1000 a 1000.');
      expect(comp.erroCampo('pesoVp')).toBe('Informe um valor de -1000 a 1000.');
      expect(comp.erroCampo('divisor')).toBe('O divisor deve ser maior que zero.');
      comp.form.patchValue({ motivo: 'x'.repeat(501) });
      expect(comp.erroCampo('motivo')).toBe('Máximo de 500 caracteres.');
      ctrl.expectNone(r => r.method === 'POST');
    });

    it('sem mudança não chama a API e mostra a mensagem do servidor', () => {
      comp.save();
      expect(comp.saveError()).toBe('Nenhuma alteração em relação à versão vigente.');
      ctrl.expectNone(r => r.method === 'POST');
    });

    it('cria a versão com motivo aparado, atualiza a vigente e recarrega o histórico', () => {
      comp.form.patchValue({ pesoEc: 5, motivo: ' Revisão contábil ' });
      comp.save();
      const post = ctrl.expectOne(r => r.method === 'POST' && r.url === BASE);
      expect(post.request.body).toEqual({ pesoEc: 5, pesoVf: 6, pesoVp: -3, divisor: 100, motivo: 'Revisão contábil' });
      post.flush(versao(2, { pesoEc: 5 }), { status: 201, statusText: 'Created' });
      expect(comp.vigente()!.versao).toBe(2);
      expect(comp.feedback()).toBe('Versão 2 criada e vigente.');
      expect(comp.form.value.pesoEc).toBe(5);
      expect(comp.form.value.motivo).toBe('');
      historico([versao(2, { pesoEc: 5 }), versao(1, { vigente: false })]);
    });

    it('sem motivo não envia o campo', () => {
      comp.form.patchValue({ divisor: 200 });
      comp.save();
      const post = ctrl.expectOne(r => r.method === 'POST');
      expect(post.request.body.motivo).toBeUndefined();
      post.flush(versao(2, { divisor: 200 }), { status: 201, statusText: 'Created' });
      historico([]);
    });

    it('erro de regra do servidor ({ error }) é exibido como veio', () => {
      comp.form.patchValue({ pesoEc: 5 });
      comp.save();
      ctrl.expectOne(r => r.method === 'POST').flush(
        { error: 'Nenhuma alteração em relação à versão vigente.' }, { status: 400, statusText: 'Bad Request' });
      expect(comp.saveError()).toBe('Nenhuma alteração em relação à versão vigente.');
      expect(comp.saving()).toBeFalse();
    });

    it('erro por campo do ASP.NET vai para o campo', () => {
      comp.form.patchValue({ divisor: 5 });
      comp.save();
      ctrl.expectOne(r => r.method === 'POST').flush(
        { errors: { Divisor: ['O divisor deve ser maior que zero.'] } }, { status: 400, statusText: 'Bad Request' });
      expect(comp.form.controls.divisor.errors?.['servidor']).toBe('O divisor deve ser maior que zero.');
    });
  });

  describe('papéis', () => {
    it('admin vê o formulário de nova versão', () => {
      montar('admin');
      expect(el().textContent).toContain('Nova versão');
      expect(el().querySelector('#pesoEc')).not.toBeNull();
    });

    it('operador e leitura só leem: sem formulário, com selo somente leitura e histórico', () => {
      montar('leitura');
      expect(el().textContent).toContain('Somente leitura');
      expect(el().querySelector('#pesoEc')).toBeNull();
      expect(el().textContent).toContain('Histórico de versões');
    });
  });

  it('falha ao carregar mostra o erro com nova tentativa', () => {
    TestBed.configureTestingModule({
      imports: [ImobReavaliacaoPesosComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), provideAuthFake('admin')]
    });
    ctrl = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ImobReavaliacaoPesosComponent);
    fixture.detectChanges();
    ctrl.expectOne(r => r.url === BASE && r.method === 'GET').flush({ error: 'Falhou.' }, { status: 400, statusText: 'Bad Request' });
    historico([]);
    fixture.detectChanges();
    expect(el().textContent).toContain('Falhou.');
    expect(el().textContent).toContain('Tentar novamente');
  });
});
