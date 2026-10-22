import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { Modal } from 'bootstrap';
import { ImobResponsaveisComponent } from './imob-responsaveis.component';
import { ConfirmDialogComponent } from '../shared/confirm-dialog.component';
import { ImobResponsavel } from '../../../core/models/imob-responsavel.model';
import { provideAuthFake } from '../../../testing/auth-fake';

const BASE = '/api/v1/imobilizado/responsaveis';

const resp = (id: number, nome: string, extra: Partial<ImobResponsavel> = {}): ImobResponsavel => ({
  id, nome, matricula: `M${id}00`, email: `${nome.toLowerCase()}@empresa.com`, setor: 'TI', ativo: true,
  criadoEm: '2026-10-22T14:03:11Z', ...extra
});

describe('ImobResponsaveisComponent', () => {
  let fixture: ComponentFixture<ImobResponsaveisComponent>;
  let comp: ImobResponsaveisComponent;
  let ctrl: HttpTestingController;
  const el = () => fixture.nativeElement as HTMLElement;

  const listagem = () => ctrl.expectOne(r => r.url === BASE && r.method === 'GET');
  const responder = (items: ImobResponsavel[], req: TestRequest = listagem()) =>
    req.flush({ items, page: 1, pageSize: 50, total: items.length });

  function montar(role: 'admin' | 'operador' | 'leitura' = 'admin',
    itens: ImobResponsavel[] = [resp(1, 'Ana'), resp(2, 'Beto', { setor: 'RH' }), resp(3, 'Ana', { matricula: 'M999', setor: null })]) {
    spyOn(Modal.prototype, 'show');
    spyOn(Modal.prototype, 'hide');
    TestBed.configureTestingModule({
      imports: [ImobResponsaveisComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), provideAuthFake(role)]
    });
    ctrl = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ImobResponsaveisComponent);
    comp = fixture.componentInstance;
    fixture.detectChanges();
    responder(itens);
    fixture.detectChanges();
  }

  afterEach(() => ctrl.verify());

  describe('lista e filtros', () => {
    beforeEach(() => montar());

    it('mostra os campos e "—" para opcionais ausentes; homônimos se distinguem pela matrícula', () => {
      expect(el().textContent).toContain('ana@empresa.com');
      expect(el().textContent).toContain('M999');
      expect(el().textContent).toContain('—');
    });

    it('monta o filtro de setor a partir dos setores vistos, sem repetir e sem perder ao filtrar', () => {
      expect(comp.setores()).toEqual(['RH', 'TI']);
      comp.setorFiltro = 'RH';
      comp.carregar(1);
      const req = listagem();
      expect(req.request.params.get('setor')).toBe('RH');
      responder([resp(2, 'Beto', { setor: 'rh' }), resp(4, 'Caio', { setor: 'Financeiro' })], req);
      expect(comp.setores()).toEqual(['Financeiro', 'RH', 'TI']);
    });

    it('envia busca e ativo, e limpar remove os filtros', () => {
      comp.busca = ' m100 ';
      comp.ativoFiltro = 'false';
      comp.carregar(1);
      const req = listagem();
      expect(req.request.params.get('busca')).toBe('m100');
      expect(req.request.params.get('ativo')).toBe('false');
      responder([], req);
      fixture.detectChanges();
      expect(el().textContent).toContain('Nenhum responsável encontrado');

      comp.limparFiltros();
      const req2 = listagem();
      expect(req2.request.params.keys().filter(k => ['busca', 'setor', 'ativo'].includes(k))).toEqual([]);
      responder([], req2);
    });

    it('mostra erro de carregamento', () => {
      comp.carregar();
      listagem().flush({}, { status: 500, statusText: 'Server Error' });
      fixture.detectChanges();
      expect(el().textContent).toContain('Erro ao carregar responsáveis');
    });
  });

  describe('formulário', () => {
    beforeEach(() => montar());

    it('valida e-mail e exige o nome', () => {
      comp.openCreate();
      comp.form.patchValue({ nome: '', email: 'sem-arroba' });
      comp.save();
      ctrl.expectNone(r => r.method === 'POST');
      expect(comp.erroCampo('nome')).toBe('Campo obrigatório.');
      expect(comp.erroCampo('email')).toBe('E-mail inválido.');
    });

    it('cria omitindo opcionais vazios e recarrega', () => {
      comp.openCreate();
      comp.form.patchValue({ nome: ' Carla ', matricula: ' ', email: '', setor: ' Compras ' });
      comp.save();
      const post = ctrl.expectOne(r => r.method === 'POST' && r.url === BASE);
      expect(post.request.body).toEqual({ nome: 'Carla', matricula: undefined, email: undefined, setor: 'Compras' });
      post.flush(resp(9, 'Carla'), { status: 201, statusText: 'Created' });
      expect(comp.feedback()).toBe('Responsável criado.');
      responder([]);
    });

    it('editar envia corpo completo com ativo', () => {
      comp.openEdit(resp(2, 'Beto', { setor: 'RH' }));
      comp.form.patchValue({ ativo: false });
      comp.save();
      const put = ctrl.expectOne(r => r.method === 'PUT' && r.url === `${BASE}/2`);
      expect(put.request.body).toEqual({
        nome: 'Beto', matricula: 'M200', email: 'beto@empresa.com', setor: 'RH', ativo: false
      });
      put.flush(resp(2, 'Beto'));
      responder([]);
    });

    it('matrícula repetida vai para o campo matrícula', () => {
      comp.openCreate();
      comp.form.patchValue({ nome: 'Carla', matricula: 'M100' });
      comp.save();
      ctrl.expectOne(r => r.method === 'POST').flush(
        { error: 'A matrícula "M100" já está em uso.' }, { status: 400, statusText: 'Bad Request' });
      expect(comp.erroCampo('matricula')).toContain('já está em uso');
      expect(comp.saveError()).toBe('');
    });

    it('erros de validação do ASP.NET são mapeados para os campos', () => {
      comp.openCreate();
      comp.form.patchValue({ nome: 'Carla', email: 'carla@x.com' });
      comp.save();
      ctrl.expectOne(r => r.method === 'POST').flush(
        { errors: { Email: ['E-mail em formato inválido.'] } }, { status: 400, statusText: 'Bad Request' });
      expect(comp.erroCampo('email')).toBe('E-mail em formato inválido.');
    });
  });

  describe('exclusão', () => {
    beforeEach(() => montar());

    it('cancelar a confirmação não exclui', async () => {
      spyOn(ConfirmDialogComponent.prototype, 'abrir').and.resolveTo(false);
      await comp.excluir(comp.responsaveis()[0]);
      ctrl.expectNone(r => r.method === 'DELETE');
      expect(comp.agindo()).toBeNull();
    });

    it('"possui bens": oferece Desativar e link para os bens do responsável', async () => {
      const abrir = spyOn(ConfirmDialogComponent.prototype, 'abrir').and.resolveTo(true);
      await comp.excluir(comp.responsaveis()[2]);
      expect(abrir.calls.mostRecent().args[0].mensagem).toContain('Ana (M999)');
      ctrl.expectOne(r => r.method === 'DELETE' && r.url === `${BASE}/3`).flush(
        { error: 'Não é possível excluir um responsável que possui bens.' }, { status: 400, statusText: 'Bad Request' });
      fixture.detectChanges();
      expect(el().textContent).toContain('possui bens');
      expect(el().querySelector<HTMLAnchorElement>('a[href*="/imobilizado/bens"]')!.getAttribute('href')).toContain('responsavelId=3');

      comp.desativar();
      const put = ctrl.expectOne(r => r.method === 'PUT' && r.url === `${BASE}/3`);
      expect(put.request.body).toEqual({
        nome: 'Ana', matricula: 'M999', email: 'ana@empresa.com', setor: undefined, ativo: false
      });
      put.flush(resp(3, 'Ana'));
      expect(comp.feedback()).toContain('Ana (M999) desativado');
      responder([]);
    });
  });

  describe('papéis', () => {
    const botoes = () => Array.from(el().querySelectorAll('button')).map(b =>
      (b.getAttribute('aria-label') ?? '') + ' ' + (b.textContent ?? '')).join('|');

    it('leitura não vê botões de escrita', () => {
      montar('leitura');
      expect(botoes()).not.toContain('Novo responsável');
      expect(botoes()).not.toContain('Editar');
      expect(botoes()).not.toContain('Excluir');
    });

    it('operador cria e edita, mas não exclui', () => {
      montar('operador');
      expect(botoes()).toContain('Novo responsável');
      expect(botoes()).toContain('Editar Beto (M200)');
      expect(botoes()).not.toContain('Excluir');
    });

    it('admin exclui', () => {
      montar('admin');
      expect(botoes()).toContain('Excluir Beto (M200)');
    });
  });
});
