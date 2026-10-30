import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { Modal } from 'bootstrap';
import { ImobEstadosConservacaoComponent } from './imob-estados-conservacao.component';
import { ConfirmDialogComponent } from '../shared/confirm-dialog.component';
import { ImobEstadoConservacao } from '../../../core/models/imob-reavaliacao.model';
import { provideAuthFake } from '../../../testing/auth-fake';

const BASE = '/api/v1/imobilizado/estados-conservacao';

const estado = (id: number, nome: string, ec: number, vr: number, ativo = true): ImobEstadoConservacao => ({
  id, nome, notaEc: ec, notaVidaRemanescente: vr, ativo, criadoEm: '2026-10-27T14:03:11Z', atualizadoEm: '2026-10-27T14:03:11Z'
});

describe('ImobEstadosConservacaoComponent', () => {
  let fixture: ComponentFixture<ImobEstadosConservacaoComponent>;
  let comp: ImobEstadosConservacaoComponent;
  let ctrl: HttpTestingController;
  const el = () => fixture.nativeElement as HTMLElement;
  const botao = (texto: string) => Array.from(el().querySelectorAll('button')).some(b => b.textContent?.includes(texto));

  const listagem = () => ctrl.expectOne(r => r.url === BASE && r.method === 'GET');
  const responder = (items: ImobEstadoConservacao[], req: TestRequest = listagem()) =>
    req.flush({ items, page: 1, pageSize: 50, total: items.length });

  function montar(role: 'admin' | 'operador' | 'leitura' = 'admin', itens = [estado(1, 'Excelente', 10, 10), estado(2, 'Ruim', 2, 2, false)]) {
    spyOn(Modal.prototype, 'show');
    spyOn(Modal.prototype, 'hide');
    TestBed.configureTestingModule({
      imports: [ImobEstadosConservacaoComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), provideAuthFake(role)]
    });
    ctrl = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ImobEstadosConservacaoComponent);
    comp = fixture.componentInstance;
    fixture.detectChanges();
    responder(itens);
    fixture.detectChanges();
  }

  afterEach(() => ctrl.verify());

  it('lista nome, notas e situação', () => {
    montar();
    const linhas = el().querySelectorAll('tbody tr');
    expect(linhas[0].textContent).toContain('Excelente');
    expect(linhas[0].textContent).toContain('10');
    expect(linhas[1].textContent).toContain('Inativo');
  });

  it('filtros enviam busca e ativo', () => {
    montar();
    comp.busca = ' bom ';
    comp.ativoFiltro = 'true';
    comp.carregar(1);
    const req = listagem();
    expect(req.request.params.get('busca')).toBe('bom');
    expect(req.request.params.get('ativo')).toBe('true');
    responder([], req);
  });

  describe('formulário', () => {
    beforeEach(() => montar());

    it('exige nome e as duas notas; notas de 0 a 10', () => {
      comp.openCreate();
      comp.save();
      expect(comp.erroCampo('nome')).toBe('Campo obrigatório.');
      expect(comp.erroCampo('notaEc')).toBe('Campo obrigatório.');
      expect(comp.erroCampo('notaVidaRemanescente')).toBe('Campo obrigatório.');
      for (const v of [-1, 10.5, 11]) {
        comp.form.patchValue({ nome: 'X', notaEc: v, notaVidaRemanescente: v });
        expect(comp.erroCampo('notaEc')).toBe('Informe uma nota de 0 a 10.');
      }
      for (const v of [0, 10, 7.5]) {
        comp.form.patchValue({ nome: 'X', notaEc: v, notaVidaRemanescente: v });
        expect(comp.form.valid).toBeTrue();
      }
      ctrl.expectNone(r => r.method === 'POST');
    });

    it('cria com o nome aparado e recarrega', () => {
      comp.openCreate();
      comp.form.patchValue({ nome: ' Bom ', notaEc: 8, notaVidaRemanescente: 7 });
      comp.save();
      const post = ctrl.expectOne(r => r.method === 'POST' && r.url === BASE);
      expect(post.request.body).toEqual({ nome: 'Bom', notaEc: 8, notaVidaRemanescente: 7 });
      post.flush(estado(9, 'Bom', 8, 7), { status: 201, statusText: 'Created' });
      expect(comp.feedback()).toBe('Estado criado.');
      responder([]);
    });

    it('editar envia o corpo completo com ativo', () => {
      comp.openEdit(estado(2, 'Ruim', 2, 2, false));
      comp.form.patchValue({ ativo: true, notaEc: 3 });
      comp.save();
      const put = ctrl.expectOne(r => r.method === 'PUT' && r.url === `${BASE}/2`);
      expect(put.request.body).toEqual({ nome: 'Ruim', notaEc: 3, notaVidaRemanescente: 2, ativo: true });
      put.flush(estado(2, 'Ruim', 3, 2));
      responder([]);
    });

    it('nome duplicado ({ error }) vai para o campo nome', () => {
      comp.openCreate();
      comp.form.patchValue({ nome: 'Bom', notaEc: 8, notaVidaRemanescente: 8 });
      comp.save();
      ctrl.expectOne(r => r.method === 'POST').flush(
        { error: 'Já existe um estado de conservação com o nome "Bom".' }, { status: 400, statusText: 'Bad Request' });
      expect(comp.erroCampo('nome')).toContain('Já existe');
      expect(comp.saveError()).toBe('');
    });

    it('erros por campo do ASP.NET aparecem nos campos', () => {
      comp.openCreate();
      comp.form.patchValue({ nome: 'Bom', notaEc: 8, notaVidaRemanescente: 8 });
      comp.save();
      ctrl.expectOne(r => r.method === 'POST').flush(
        { errors: { NotaVidaRemanescente: ['A nota deve estar entre 0 e 10.'] } }, { status: 400, statusText: 'Bad Request' });
      expect(comp.erroCampo('notaVidaRemanescente')).toBe('A nota deve estar entre 0 e 10.');
    });
  });

  describe('estados padrão', () => {
    it('confirma, chama POST padrao e informa quantos foram criados', async () => {
      montar();
      spyOn(ConfirmDialogComponent.prototype, 'abrir').and.resolveTo(true);
      await comp.carregarPadrao();
      ctrl.expectOne(r => r.method === 'POST' && r.url === `${BASE}/padrao`).flush({ criados: 3, estados: [] });
      expect(comp.feedback()).toBe('Estados padrão: 3 criados.');
      responder([]);
    });

    it('repetir mostra que todos já existem', async () => {
      montar();
      spyOn(ConfirmDialogComponent.prototype, 'abrir').and.resolveTo(true);
      await comp.carregarPadrao();
      ctrl.expectOne(r => r.method === 'POST').flush({ criados: 0, estados: [] });
      expect(comp.feedback()).toContain('todos já existem');
      responder([]);
    });

    it('erro do servidor aparece e o botão volta', async () => {
      montar();
      spyOn(ConfirmDialogComponent.prototype, 'abrir').and.resolveTo(true);
      await comp.carregarPadrao();
      ctrl.expectOne(r => r.method === 'POST').flush({ error: 'Sem permissão.' }, { status: 403, statusText: 'Forbidden' });
      expect(comp.erro()).toBe('Sem permissão.');
      expect(comp.carregandoPadrao()).toBeFalse();
    });
  });

  describe('exclusão', () => {
    beforeEach(() => montar());

    it('exclui após confirmar', async () => {
      spyOn(ConfirmDialogComponent.prototype, 'abrir').and.resolveTo(true);
      await comp.excluir(comp.estados()[0]);
      ctrl.expectOne(r => r.method === 'DELETE' && r.url === `${BASE}/1`).flush(null, { status: 204, statusText: 'No Content' });
      expect(comp.feedback()).toBe('Estado excluído.');
      responder([]);
    });

    it('estado em uso: mostra a mensagem e oferece inativar', async () => {
      spyOn(ConfirmDialogComponent.prototype, 'abrir').and.resolveTo(true);
      await comp.excluir(comp.estados()[0]);
      ctrl.expectOne(r => r.method === 'DELETE').flush(
        { error: 'Estado em uso não pode ser excluído; inative-o.' }, { status: 400, statusText: 'Bad Request' });
      fixture.detectChanges();
      expect(el().textContent).toContain('em uso não pode ser excluído');
      comp.desativar();
      const put = ctrl.expectOne(r => r.method === 'PUT' && r.url === `${BASE}/1`);
      expect(put.request.body).toEqual({ nome: 'Excelente', notaEc: 10, notaVidaRemanescente: 10, ativo: false });
      put.flush(estado(1, 'Excelente', 10, 10, false));
      responder([]);
    });
  });

  describe('histórico', () => {
    it('abre o histórico do estado paginado e formata campos e situação', () => {
      montar();
      comp.abrirHistorico(comp.estados()[0]);
      const req = ctrl.expectOne(r => r.url === `${BASE}/1/historico`);
      expect(req.request.params.get('page')).toBe('1');
      expect(req.request.params.get('pageSize')).toBe('20');
      req.flush({
        items: [
          { id: 3, campo: 'ativo', valorAnterior: 'true', valorNovo: 'false', usuarioNome: 'Ana', criadoEm: '2026-10-27T15:00:00Z' },
          { id: 2, campo: 'nota_ec', valorAnterior: '9', valorNovo: '10', usuarioNome: 'Ana', criadoEm: '2026-10-27T14:30:00Z' },
          { id: 1, campo: 'criacao', valorAnterior: null, valorNovo: 'Excelente', usuarioNome: 'Ana', criadoEm: '2026-10-27T14:03:11Z' }
        ], page: 1, pageSize: 20, total: 3
      });
      fixture.detectChanges();
      const texto = el().querySelector('#estHistTitulo')!.closest('.modal-content')!.textContent!;
      expect(texto).toContain('Excelente');
      expect(texto).toContain('Situação');
      expect(texto).toContain('Ativo');
      expect(texto).toContain('Inativo');
      expect(texto).toContain('Nota EC');
      expect(texto).toContain('Criação');
    });

    it('erro ao carregar o histórico mostra a mensagem', () => {
      montar();
      comp.abrirHistorico(comp.estados()[0]);
      ctrl.expectOne(r => r.url === `${BASE}/1/historico`).flush({ error: 'Não encontrado.' }, { status: 404, statusText: 'Not Found' });
      expect(comp.histErro()).toBe('Não encontrado.');
    });
  });

  describe('papéis', () => {
    it('admin vê criar, padrão, editar e excluir', () => {
      montar('admin');
      expect(botao('Novo estado')).toBeTrue();
      expect(botao('Carregar estados padrão')).toBeTrue();
      expect(el().querySelector('[aria-label^="Editar"]')).not.toBeNull();
      expect(el().querySelector('[aria-label^="Excluir"]')).not.toBeNull();
    });

    for (const role of ['operador', 'leitura'] as const) {
      it('perfil ' + role + ' só consulta (e vê o histórico)', () => {
        montar(role);
        expect(el().textContent).toContain('Somente leitura');
        expect(botao('Novo estado')).toBeFalse();
        expect(botao('Carregar estados padrão')).toBeFalse();
        expect(el().querySelector('[aria-label^="Editar"]')).toBeNull();
        expect(el().querySelector('[aria-label^="Histórico"]')).not.toBeNull();
      });
    }
  });
});
