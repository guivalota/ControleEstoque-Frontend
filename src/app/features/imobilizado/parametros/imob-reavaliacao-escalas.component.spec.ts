import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { ImobReavaliacaoEscalasComponent } from './imob-reavaliacao-escalas.component';
import { ImobEscala } from '../../../core/models/imob-reavaliacao.model';
import { provideAuthFake } from '../../../testing/auth-fake';

const BASE = '/api/v1/imobilizado/reavaliacao/escalas';

const escala = (versao: number, tipo: 'vp' | 'vf' = 'vp', extra: Partial<ImobEscala> = {}): ImobEscala => ({
  id: versao + (tipo === 'vf' ? 100 : 0), tipo, versao, vigente: true, motivo: null, criadoPor: 'u1', criadoPorNome: 'Ana',
  criadoEm: '2026-10-27T14:03:11Z',
  faixas: [
    { ordem: 1, de: 0, ate: 5, nota: 4 },
    { ordem: 2, de: 5, ate: 6, nota: 5 },
    { ordem: 3, de: 6, ate: null, nota: 6 }
  ], ...extra
});

describe('ImobReavaliacaoEscalasComponent', () => {
  let fixture: ComponentFixture<ImobReavaliacaoEscalasComponent>;
  let comp: ImobReavaliacaoEscalasComponent;
  let ctrl: HttpTestingController;
  const el = () => fixture.nativeElement as HTMLElement;
  const texto = () => el().textContent!.replace(/\s+/g, ' ');

  const vigente = (tipo: 'vp' | 'vf') => ctrl.expectOne(r => r.url === `${BASE}/${tipo}` && r.method === 'GET');
  const historico = (tipo: 'vp' | 'vf', items: ImobEscala[]) => {
    const req = ctrl.expectOne(r => r.url === `${BASE}/${tipo}/historico`);
    expect(req.request.params.get('pageSize')).toBe('10');
    req.flush({ items, page: 1, pageSize: 10, total: items.length });
  };

  function montar(role: 'admin' | 'operador' | 'leitura' = 'admin', v = escala(2)) {
    TestBed.configureTestingModule({
      imports: [ImobReavaliacaoEscalasComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), provideAuthFake(role)]
    });
    ctrl = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ImobReavaliacaoEscalasComponent);
    comp = fixture.componentInstance;
    fixture.detectChanges();
    vigente('vp').flush(v);
    historico('vp', [v, escala(1, 'vp', { vigente: false, motivo: 'Semente' })]);
    fixture.detectChanges();
  }

  const linha = (i: number) => comp.linhas.at(i).controls;
  const digitar = (i: number, campo: 'de' | 'ate' | 'nota', valor: number | null) => {
    linha(i)[campo].setValue(valor);
    fixture.detectChanges();
  };

  afterEach(() => ctrl.verify());

  describe('leitura e editor', () => {
    beforeEach(() => montar());

    it('carrega a versão vigente no editor e mostra a escala contínua', () => {
      expect(comp.linhas.length).toBe(3);
      expect(linha(2).ate.value).toBeNull();
      expect(comp.validacao().valida).toBeTrue();
      expect(el().querySelector('#escalaContinua')).not.toBeNull();
      expect(texto()).toContain('Escala VP — versão vigente v2');
      expect(comp.alterada()).toBeFalse();
    });

    it('lacuna: destaca a linha e bloqueia salvar', () => {
      digitar(1, 'de', 6);
      expect(comp.validacao().valida).toBeFalse();
      expect(comp.validacao().porLinha[1].join(' ')).toContain('Lacuna');
      expect(el().querySelector('#escalaInvalida')).not.toBeNull();
      expect(el().querySelector('tr[data-linha="1"]')!.classList).toContain('table-danger');
      expect(el().querySelector('tr[data-erros="1"]')!.textContent).toContain('Lacuna');
      const salvar = Array.from(el().querySelectorAll('button')).find(b => b.textContent?.includes('Salvar nova versão'))!;
      expect(salvar.disabled).toBeTrue();
    });

    it('sobreposição é detectada', () => {
      digitar(1, 'de', 4);
      expect(comp.validacao().porLinha[1].join(' ')).toContain('Sobreposição');
    });

    it('primeira faixa fora de 0 e última com limite são recusadas', () => {
      digitar(0, 'de', 1);
      expect(comp.validacao().porLinha[0].join(' ')).toContain('começar em 0');
      digitar(0, 'de', 0);
      digitar(2, 'ate', 9);
      expect(comp.validacao().porLinha[2].join(' ')).toContain('última faixa deve ficar sem limite');
    });

    it('encaixar faixas corrige lacunas e sobreposições', () => {
      digitar(1, 'de', 7);
      digitar(2, 'de', 3);
      expect(comp.validacao().valida).toBeFalse();
      comp.encaixarFaixas();
      expect(linha(1).de.value).toBe(5);
      expect(linha(2).de.value).toBe(6);
      expect(comp.validacao().valida).toBeTrue();
    });

    it('adicionar faixa fecha a última e continua a partir dela; remover refaz a validação', () => {
      comp.adicionarFaixa();
      expect(comp.linhas.length).toBe(4);
      expect(linha(2).ate.value).toBe(7);
      expect(linha(3).de.value).toBe(7);
      expect(linha(3).ate.value).toBeNull();
      expect(comp.validacao().porLinha[3].join(' ')).toContain('Informe a nota');
      digitar(3, 'nota', 7);
      expect(comp.validacao().valida).toBeTrue();
      comp.removerFaixa(3);
      expect(comp.linhas.length).toBe(3);
      expect(comp.validacao().porLinha[2].join(' ')).toContain('última faixa deve ficar sem limite');
    });

    it('descartar volta para a versão vigente', () => {
      digitar(0, 'nota', 9);
      expect(comp.alterada()).toBeTrue();
      comp.descartar();
      expect(linha(0).nota.value).toBe(4);
      expect(comp.alterada()).toBeFalse();
    });
  });

  describe('nova versão', () => {
    beforeEach(() => montar());

    it('salva faixas e motivo, atualiza a vigente e recarrega o histórico', () => {
      digitar(0, 'nota', 3);
      comp.motivo.setValue(' Revisão ');
      comp.salvar();
      const post = ctrl.expectOne(r => r.method === 'POST' && r.url === `${BASE}/vp`);
      expect(post.request.body).toEqual({
        motivo: 'Revisão',
        faixas: [{ de: 0, ate: 5, nota: 3 }, { de: 5, ate: 6, nota: 5 }, { de: 6, ate: null, nota: 6 }]
      });
      post.flush(escala(3, 'vp', { faixas: [{ de: 0, ate: 5, nota: 3 }, { de: 5, ate: 6, nota: 5 }, { de: 6, ate: null, nota: 6 }] }),
        { status: 201, statusText: 'Created' });
      expect(comp.vigente()!.versao).toBe(3);
      expect(comp.feedback()).toBe('Versão 3 da Escala VP criada e vigente.');
      expect(comp.alterada()).toBeFalse();
      historico('vp', [escala(3)]);
    });

    it('sem alteração não chama a API', () => {
      comp.salvar();
      expect(comp.saveError()).toBe('Nenhuma alteração em relação à versão vigente.');
      ctrl.expectNone(r => r.method === 'POST');
    });

    it('escala inválida não é enviada', () => {
      digitar(1, 'de', 6);
      comp.salvar();
      expect(comp.saveError()).toBe('Corrija as faixas destacadas antes de salvar.');
      ctrl.expectNone(r => r.method === 'POST');
    });

    it('erro do servidor ({ error }) é exibido como veio', () => {
      digitar(0, 'nota', 3);
      comp.salvar();
      ctrl.expectOne(r => r.method === 'POST').flush(
        { error: 'A primeira faixa deve começar em 0.' }, { status: 400, statusText: 'Bad Request' });
      expect(comp.saveError()).toBe('A primeira faixa deve começar em 0.');
      expect(comp.saving()).toBeFalse();
    });

    it('usar uma versão antiga como base carrega as faixas no editor sem salvar', () => {
      comp.usarComoBase(escala(1, 'vp', { vigente: false, faixas: [{ de: 0, ate: null, nota: 1 }] }));
      expect(comp.linhas.length).toBe(1);
      expect(comp.alterada()).toBeTrue();
      expect(comp.feedback()).toContain('versão 1');
      ctrl.expectNone(r => r.method === 'POST');
    });

    it('histórico lista versões com faixas e motivo', () => {
      expect(texto()).toContain('v2');
      expect(texto()).toContain('v1');
      expect(texto()).toContain('Semente');
      expect(texto()).toContain('[0, 5) → nota 4');
      expect(texto()).toContain('[6, ∞) → nota 6');
    });
  });

  describe('testar valor', () => {
    beforeEach(() => montar());

    it('consulta GET escalas/{tipo}/nota e mostra a nota', () => {
      comp.valorTeste.setValue(3.5);
      comp.testar();
      const req = ctrl.expectOne(r => r.url === `${BASE}/vp/nota`);
      expect(req.request.params.get('valor')).toBe('3.5');
      req.flush({ tipo: 'vp', escalaId: 2, versao: 2, valor: 3.5, nota: 4 });
      fixture.detectChanges();
      const r = el().querySelector('#resultadoTeste')!.textContent!.replace(/\s+/g, ' ');
      expect(r).toContain('Valor 3,5 → nota 4');
      expect(r).toContain('versão 2 vigente');
      expect(r).not.toContain('No rascunho');
    });

    it('compara com o rascunho do editor quando há alteração válida', () => {
      digitar(0, 'nota', 3);
      comp.valorTeste.setValue(3.5);
      comp.testar();
      ctrl.expectOne(r => r.url === `${BASE}/vp/nota`).flush({ tipo: 'vp', escalaId: 2, versao: 2, valor: 3.5, nota: 4 });
      fixture.detectChanges();
      expect(texto()).toContain('No rascunho do editor: nota 3');
    });

    it('sem valor não chama a API', () => {
      comp.testar();
      expect(comp.erroTeste()).toBe('Informe um valor para testar.');
      ctrl.expectNone(r => r.url.endsWith('/nota'));
    });

    it('erro do servidor aparece', () => {
      comp.valorTeste.setValue(1);
      comp.testar();
      ctrl.expectOne(r => r.url === `${BASE}/vp/nota`).flush({ error: 'Valor inválido.' }, { status: 400, statusText: 'Bad Request' });
      expect(comp.erroTeste()).toBe('Valor inválido.');
    });
  });

  describe('tipo VF', () => {
    it('trocar de aba carrega a escala VF e o seu histórico', () => {
      montar();
      comp.trocarTipo('vf');
      const v = escala(1, 'vf', { faixas: [{ de: 0, ate: 5, nota: 4 }, { de: 5, ate: null, nota: 5 }] });
      vigente('vf').flush(v);
      historico('vf', [v]);
      fixture.detectChanges();
      expect(comp.tipo()).toBe('vf');
      expect(comp.linhas.length).toBe(2);
      expect(texto()).toContain('Escala VF — versão vigente v1');
      expect(texto()).toContain('nota de vida remanescente');
    });
  });

  describe('papéis', () => {
    it('operador e leitura veem só as faixas, o histórico e o teste (sem editor)', () => {
      montar('leitura');
      expect(texto()).toContain('Somente leitura');
      expect(el().querySelector('input[aria-label="Início da faixa 1"]')).toBeNull();
      expect(el().querySelector('#escMotivo')).toBeNull();
      expect(texto()).toContain('Faixas da versão vigente');
      expect(texto()).toContain('sem limite');
      expect(el().querySelector('#escValorTeste')).not.toBeNull();
      expect(texto()).not.toContain('Usar como base');
    });

    it('admin vê o editor', () => {
      montar('admin');
      expect(el().querySelector('input[aria-label="Início da faixa 1"]')).not.toBeNull();
      expect(texto()).toContain('Usar como base');
    });
  });
});
