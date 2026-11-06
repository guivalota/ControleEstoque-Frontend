import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { Modal } from 'bootstrap';
import { ImobCamposCustomizadosComponent, opcoesDoTexto } from './imob-campos-customizados.component';
import { ImobCampoCustomizado } from '../../../core/models/imob-campo-customizado.model';
import { provideAuthFake } from '../../../testing/auth-fake';

const BASE = '/api/v1/imobilizado/campos-customizados';
const CATEGORIAS = '/api/v1/imobilizado/categorias';

const campo = (id: number, nome: string, extra: Partial<ImobCampoCustomizado> = {}): ImobCampoCustomizado => ({
  id, nome, tipo: 'texto', obrigatorio: false, opcoes: [], categoriaId: null, categoriaNome: null, ativo: true, ordem: id, bensComValor: 0, ...extra
});

describe('opcoesDoTexto', () => {
  it('uma opção por linha, sem vazias e sem repetidas (ignora caixa)', () => {
    expect(opcoesDoTexto(' Novo \r\n\nUsado\nnovo\n  \nQuebrado ')).toEqual(['Novo', 'Usado', 'Quebrado']);
    expect(opcoesDoTexto('')).toEqual([]);
  });
});

describe('ImobCamposCustomizadosComponent', () => {
  let fixture: ComponentFixture<ImobCamposCustomizadosComponent>;
  let comp: ImobCamposCustomizadosComponent;
  let ctrl: HttpTestingController;
  const el = () => fixture.nativeElement as HTMLElement;
  const texto = () => (el().textContent ?? '').replace(/\s+/g, ' ');
  const botao = (rotulo: string) => Array.from(el().querySelectorAll('button')).find(b => b.textContent?.includes(rotulo));

  function montar(role: 'admin' | 'operador' | 'leitura' = 'admin', itens: ImobCampoCustomizado[] = [
    campo(1, 'Cor'),
    campo(2, 'Estado', { tipo: 'lista', opcoes: ['Novo', 'Usado'], obrigatorio: true, categoriaId: 3, categoriaNome: 'Informática', bensComValor: 4 }),
    campo(3, 'Antigo', { ativo: false })
  ]) {
    if (!jasmine.isSpy(Modal.prototype.show)) spyOn(Modal.prototype, 'show');
    if (!jasmine.isSpy(Modal.prototype.hide)) spyOn(Modal.prototype, 'hide');
    TestBed.configureTestingModule({
      imports: [ImobCamposCustomizadosComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), provideAuthFake(role)]
    });
    ctrl = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ImobCamposCustomizadosComponent);
    comp = fixture.componentInstance;
    fixture.detectChanges();
    const req = ctrl.expectOne(r => r.url === BASE && r.method === 'GET');
    expect(req.request.params.get('incluirInativos')).toBe('true');
    req.flush(itens);
    ctrl.expectOne(r => r.url === CATEGORIAS).flush({ items: [{ id: 3, nome: 'Informática', ativo: true }], page: 1, pageSize: 100, total: 1 });
    fixture.detectChanges();
  }

  afterEach(() => ctrl.verify());

  describe('lista', () => {
    it('mostra tipo, categoria, obrigatório, bens com valor e situação', () => {
      montar();
      const linhas = el().querySelectorAll('tbody tr');
      expect(linhas.length).toBe(3);
      expect(linhas[0].textContent).toContain('Cor');
      expect(linhas[0].textContent).toContain('Texto');
      expect(linhas[0].textContent).toContain('Todas as categorias');
      expect(linhas[1].textContent).toContain('Lista de opções');
      expect(linhas[1].textContent).toContain('Novo, Usado');
      expect(linhas[1].textContent).toContain('Informática');
      expect(linhas[1].textContent).toContain('Sim');
      expect(linhas[2].textContent).toContain('Inativo');
      expect(texto()).toContain('3 de 20');
    });

    it('admin vê as ações; operador e leitura só consultam', () => {
      montar('admin');
      expect(botao('Novo campo')).toBeDefined();
      expect(el().querySelector('button[aria-label="Editar Cor"]')).not.toBeNull();
      TestBed.resetTestingModule();
      montar('operador');
      expect(botao('Novo campo')).toBeUndefined();
      expect(el().querySelector('button[aria-label^="Editar"]')).toBeNull();
      expect(el().querySelector('button[aria-label^="Excluir"]')).toBeNull();
    });

    it('com 20 campos o botão de novo fica desabilitado', () => {
      montar('admin', Array.from({ length: 20 }, (_, i) => campo(i + 1, `Campo ${i + 1}`)));
      expect(botao('Novo campo')!.disabled).toBeTrue();
    });

    it('erro ao carregar mostra a mensagem e permite tentar de novo', () => {
      spyOn(Modal.prototype, 'show');
      TestBed.configureTestingModule({
        imports: [ImobCamposCustomizadosComponent],
        providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), provideAuthFake('admin')]
      });
      ctrl = TestBed.inject(HttpTestingController);
      fixture = TestBed.createComponent(ImobCamposCustomizadosComponent);
      fixture.detectChanges();
      ctrl.expectOne(r => r.url === BASE).flush({ error: 'Sem acesso.' }, { status: 403, statusText: 'Forbidden' });
      ctrl.expectOne(r => r.url === CATEGORIAS).flush({ items: [], page: 1, pageSize: 100, total: 0 });
      fixture.detectChanges();
      expect(texto()).toContain('Tentar novamente');
    });
  });

  describe('criar', () => {
    beforeEach(() => montar());

    it('texto: envia nome, tipo, obrigatório, categoria e ordem', () => {
      comp.openCreate();
      comp.form.patchValue({ nome: '  Responsável técnico ', tipo: 'texto', obrigatorio: true, categoriaId: 3, ordem: 5 });

      comp.save();

      const post = ctrl.expectOne(r => r.method === 'POST' && r.url === BASE);
      expect(post.request.body).toEqual({
        nome: 'Responsável técnico', obrigatorio: true, opcoes: undefined, categoriaId: 3, ordem: 5, tipo: 'texto'
      });
      post.flush(campo(9, 'Responsável técnico'), { status: 201, statusText: 'Created' });
      ctrl.expectOne(r => r.url === BASE && r.method === 'GET').flush([]);
      fixture.detectChanges();
      expect(texto()).toContain('Campo criado.');
    });

    it('lista: as opções saem uma por linha, limpas', () => {
      comp.openCreate();
      comp.form.patchValue({ nome: 'Condição', tipo: 'lista', opcoesTexto: ' Novo \n\nUsado\nnovo' });

      comp.save();

      const post = ctrl.expectOne(r => r.method === 'POST' && r.url === BASE);
      expect(post.request.body.opcoes).toEqual(['Novo', 'Usado']);
      expect(post.request.body.tipo).toBe('lista');
      post.flush(campo(10, 'Condição'), { status: 201, statusText: 'Created' });
      ctrl.expectOne(r => r.url === BASE && r.method === 'GET').flush([]);
    });

    it('lista sem opções e nome vazio não enviam', () => {
      comp.openCreate();
      comp.form.patchValue({ nome: 'Condição', tipo: 'lista', opcoesTexto: ' \n ' });
      comp.save();
      ctrl.expectNone(r => r.method === 'POST');
      expect(comp.erroOpcoes()).toBe('Informe ao menos uma opção.');

      comp.form.patchValue({ nome: '', tipo: 'texto' });
      comp.save();
      ctrl.expectNone(r => r.method === 'POST');
      expect(comp.erroCampo('nome')).toBe('Campo obrigatório.');
    });

    it('erro do servidor (nome reservado) aparece no campo nome', () => {
      comp.openCreate();
      comp.form.patchValue({ nome: 'Local', tipo: 'texto' });

      comp.save();

      ctrl.expectOne(r => r.method === 'POST').flush(
        { error: "O nome 'Local' é reservado (é uma coluna do cadastro de bens). Escolha outro." }, { status: 400, statusText: 'Bad Request' });
      fixture.detectChanges();
      expect(comp.erroCampo('nome')).toContain('reservado');
      expect(comp.saving()).toBeFalse();
    });
  });

  describe('editar', () => {
    beforeEach(() => montar());

    it('o tipo não pode mudar e o PUT leva ativo, sem tipo', () => {
      comp.openEdit(comp.campos()[1]);
      expect(comp.form.controls.tipo.disabled).toBeTrue();
      expect(comp.form.controls.opcoesTexto.value).toBe('Novo\nUsado');
      comp.form.patchValue({ nome: 'Condição', opcoesTexto: 'Novo\nUsado\nQuebrado', ativo: false });

      comp.save();

      const put = ctrl.expectOne(r => r.method === 'PUT' && r.url === `${BASE}/2`);
      expect(put.request.body).toEqual({
        nome: 'Condição', obrigatorio: true, opcoes: ['Novo', 'Usado', 'Quebrado'], categoriaId: 3, ordem: 2, ativo: false
      });
      put.flush(campo(2, 'Condição'));
      ctrl.expectOne(r => r.url === BASE && r.method === 'GET').flush([]);
    });
  });

  describe('excluir', () => {
    beforeEach(() => montar());

    async function confirmarExclusao(c: ImobCampoCustomizado) {
      const pendente = comp.excluir(c);
      fixture.detectChanges();
      el().querySelector<HTMLButtonElement>('.modal-footer .btn-danger')!.click();
      await pendente;
    }

    it('campo sem valor é excluído e a lista recarrega', async () => {
      await confirmarExclusao(comp.campos()[0]);
      ctrl.expectOne(r => r.method === 'DELETE' && r.url === `${BASE}/1`).flush(null, { status: 204, statusText: 'No Content' });
      ctrl.expectOne(r => r.url === BASE && r.method === 'GET').flush([]);
      fixture.detectChanges();
      expect(texto()).toContain('Campo excluído.');
    });

    it('campo com valor: o 400 vira aviso com "Desativar" e link para os bens, sem alterar o campo', async () => {
      await confirmarExclusao(comp.campos()[1]);
      ctrl.expectOne(r => r.method === 'DELETE' && r.url === `${BASE}/2`).flush(
        { error: 'Este campo já tem valores gravados em 4 bem(ns). Inative-o em vez de excluir.' }, { status: 400, statusText: 'Bad Request' });
      fixture.detectChanges();

      expect(texto()).toContain('Inative-o em vez de excluir');
      const ver = Array.from(el().querySelectorAll('a')).find(a => a.textContent?.includes('Ver bens'));
      expect(ver?.getAttribute('href')).toContain('campoId=2');

      botao('Desativar')!.click();
      const put = ctrl.expectOne(r => r.method === 'PUT' && r.url === `${BASE}/2`);
      expect(put.request.body).toEqual({
        nome: 'Estado', obrigatorio: true, opcoes: ['Novo', 'Usado'], categoriaId: 3, ativo: false, ordem: 2
      });
      put.flush(campo(2, 'Estado', { ativo: false }));
      ctrl.expectOne(r => r.url === BASE && r.method === 'GET').flush([]);
      fixture.detectChanges();
      expect(texto()).toContain('inativado');
    });
  });
});
