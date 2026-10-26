import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { Modal } from 'bootstrap';
import { ImobLocaisComponent } from './imob-locais.component';
import { ConfirmDialogComponent } from '../shared/confirm-dialog.component';
import { ImobLocalArvore } from '../../../core/models/imob-local.model';
import { provideAuthFake } from '../../../testing/auth-fake';

const BASE = '/api/v1/imobilizado/locais';

const no = (id: number, nome: string, filhos: ImobLocalArvore[] = [], ativo = true, codigo: string | null = null,
  localPaiId: number | null = null): ImobLocalArvore => ({ id, nome, codigo, localPaiId, ativo, filhos });

const ARVORE = (): ImobLocalArvore[] => [
  no(1, 'Matriz', [
    no(3, 'Andar 1', [no(4, 'Sala 101', [], true, 'S101', 3)], true, null, 1),
    no(5, 'Andar 2', [], false, null, 1)
  ], true, 'MTZ'),
  no(2, 'Filial Norte', [], true, 'FN')
];

describe('ImobLocaisComponent', () => {
  let fixture: ComponentFixture<ImobLocaisComponent>;
  let comp: ImobLocaisComponent;
  let ctrl: HttpTestingController;
  const el = () => fixture.nativeElement as HTMLElement;
  const nomes = () => comp.linhas().map(l => l.no.nome);

  function montar(role: 'admin' | 'operador' | 'leitura' = 'admin', arvore = ARVORE()) {
    spyOn(Modal.prototype, 'show');
    spyOn(Modal.prototype, 'hide');
    TestBed.configureTestingModule({
      imports: [ImobLocaisComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), provideAuthFake(role)]
    });
    ctrl = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ImobLocaisComponent);
    comp = fixture.componentInstance;
    fixture.detectChanges();
    ctrl.expectOne(`${BASE}/arvore`).flush(arvore);
    fixture.detectChanges();
  }

  afterEach(() => ctrl.verify());

  describe('árvore', () => {
    beforeEach(() => montar());

    it('começa recolhida e sem inativos', () => {
      expect(nomes()).toEqual(['Matriz', 'Filial Norte']);
    });

    it('expande e recolhe, mantendo inativos ocultos por padrão', () => {
      comp.alternar(1);
      expect(nomes()).toEqual(['Matriz', 'Andar 1', 'Filial Norte']);
      comp.alternar(3);
      expect(nomes()).toEqual(['Matriz', 'Andar 1', 'Sala 101', 'Filial Norte']);
      comp.alternar(1);
      expect(nomes()).toEqual(['Matriz', 'Filial Norte']);
    });

    it('mostrar inativos inclui os locais inativos, em cinza e com selo', () => {
      comp.expandirTodos(true);
      comp.mostrarInativos.set(true);
      fixture.detectChanges();
      expect(nomes()).toContain('Andar 2');
      expect(el().textContent).toContain('Inativo');
    });

    it('busca filtra por nome ou código, expandindo os ancestrais como contexto', () => {
      comp.busca.set('s101');
      expect(nomes()).toEqual(['Matriz', 'Andar 1', 'Sala 101']);
      comp.busca.set('norte');
      expect(nomes()).toEqual(['Filial Norte']);
      comp.busca.set('zzz');
      fixture.detectChanges();
      expect(el().textContent).toContain('Nenhum local encontrado');
    });

    it('expandir tudo e recolher tudo', () => {
      comp.expandirTodos(true);
      expect(nomes()).toEqual(['Matriz', 'Andar 1', 'Sala 101', 'Filial Norte']);
      comp.expandirTodos(false);
      expect(nomes()).toEqual(['Matriz', 'Filial Norte']);
    });

    it('expõe a semântica de árvore para leitores de tela', () => {
      comp.expandirTodos(true);
      fixture.detectChanges();
      const itens = el().querySelectorAll('[role="treeitem"]');
      expect(el().querySelector('[role="tree"]')).not.toBeNull();
      expect(itens.length).toBe(4);
      expect(itens[0].getAttribute('aria-expanded')).toBe('true');
      expect(itens[2].getAttribute('aria-level')).toBe('3');
      expect(itens[2].getAttribute('aria-expanded')).toBeNull();
    });

    describe('teclado', () => {
      const item = (id: number) => el().querySelector<HTMLElement>(`[data-local-id="${id}"]`)!;
      const tecla = (id: number, key: string) =>
        item(id).dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));

      it('só um item é alcançável por Tab (foco rotativo)', () => {
        const tabbable = el().querySelectorAll('[role="treeitem"][tabindex="0"]');
        expect(tabbable.length).toBe(1);
        expect(tabbable[0].getAttribute('data-local-id')).toBe('1');
      });

      it('seta para a direita expande; de novo vai ao primeiro filho', () => {
        tecla(1, 'ArrowRight');
        fixture.detectChanges();
        expect(nomes()).toEqual(['Matriz', 'Andar 1', 'Filial Norte']);
        tecla(1, 'ArrowRight');
        expect(document.activeElement).toBe(item(3));
      });

      it('seta para a esquerda recolhe; num filho volta ao pai', () => {
        comp.alternar(1);
        fixture.detectChanges();
        tecla(3, 'ArrowLeft');
        expect(document.activeElement).toBe(item(1));
        tecla(1, 'ArrowLeft');
        fixture.detectChanges();
        expect(nomes()).toEqual(['Matriz', 'Filial Norte']);
      });

      it('setas para baixo e para cima, Home e End movem o foco', () => {
        tecla(1, 'ArrowDown');
        expect(document.activeElement).toBe(item(2));
        tecla(2, 'ArrowUp');
        expect(document.activeElement).toBe(item(1));
        tecla(1, 'End');
        expect(document.activeElement).toBe(item(2));
        tecla(2, 'Home');
        expect(document.activeElement).toBe(item(1));
      });

      it('Enter alterna a expansão', () => {
        tecla(1, 'Enter');
        expect(nomes()).toContain('Andar 1');
      });
    });
  });

  describe('criar e editar', () => {
    beforeEach(() => montar());

    it('adicionar sublocal pré-preenche o pai e expande-o ao salvar', () => {
      comp.openCreate(comp.arvore()[0]);
      expect(comp.form.controls.localPaiId.value).toBe(1);
      comp.form.patchValue({ nome: '  Andar 3 ', codigo: '' });
      comp.save();

      const post = ctrl.expectOne(r => r.method === 'POST' && r.url === BASE);
      expect(post.request.body).toEqual({ nome: 'Andar 3', codigo: undefined, localPaiId: 1 });
      post.flush(no(9, 'Andar 3'), { status: 201, statusText: 'Created' });

      expect(comp.expandidos().has(1)).toBeTrue();
      expect(comp.feedback()).toBe('Local criado.');
      ctrl.expectOne(`${BASE}/arvore`).flush(ARVORE());
    });

    it('exige o nome', () => {
      comp.openCreate();
      comp.save();
      ctrl.expectNone(r => r.method === 'POST');
      expect(comp.erroCampo('nome')).toBe('Campo obrigatório.');
    });

    it('editar envia corpo completo, incluindo ativo e o novo pai (mover)', () => {
      comp.openEdit(comp.arvore()[0].filhos[0]);
      expect(comp.form.controls.localPaiId.value).toBe(1);
      comp.form.patchValue({ localPaiId: 2, ativo: false });
      comp.save();
      const put = ctrl.expectOne(r => r.method === 'PUT' && r.url === `${BASE}/3`);
      expect(put.request.body).toEqual({ nome: 'Andar 1', codigo: undefined, localPaiId: 2, ativo: false });
      put.flush(no(3, 'Andar 1'));
      ctrl.expectOne(`${BASE}/arvore`).flush(ARVORE());
    });

    it('erro de ciclo aparece como mensagem geral do formulário', () => {
      comp.openEdit(comp.arvore()[0]);
      comp.form.patchValue({ localPaiId: 4 });
      comp.save();
      ctrl.expectOne(r => r.method === 'PUT').flush(
        { error: 'A alteração criaria um ciclo na hierarquia de locais.' }, { status: 400, statusText: 'Bad Request' });
      expect(comp.saveError()).toBe('A alteração criaria um ciclo na hierarquia de locais.');
      expect(comp.saving()).toBeFalse();
    });

    it('código duplicado vai para o campo código; nome repetido para o campo nome', () => {
      comp.openCreate();
      comp.form.patchValue({ nome: 'Sala', codigo: 'S1' });
      comp.save();
      ctrl.expectOne(r => r.method === 'POST').flush(
        { error: 'O código "S1" já está em uso por outro local.' }, { status: 400, statusText: 'Bad Request' });
      expect(comp.erroCampo('codigo')).toContain('já está em uso');
      expect(comp.saveError()).toBe('');

      comp.form.patchValue({ codigo: 'S2' });
      comp.save();
      ctrl.expectOne(r => r.method === 'POST').flush(
        { error: 'Já existe um local com o nome "Sala" neste nível.' }, { status: 400, statusText: 'Bad Request' });
      expect(comp.erroCampo('nome')).toContain('Já existe');
    });
  });

  describe('exclusão', () => {
    beforeEach(() => montar());

    it('só exclui após confirmar', async () => {
      const abrir = spyOn(ConfirmDialogComponent.prototype, 'abrir').and.resolveTo(false);
      await comp.excluir(comp.arvore()[1]);
      ctrl.expectNone(r => r.method === 'DELETE');

      abrir.and.resolveTo(true);
      await comp.excluir(comp.arvore()[1]);
      ctrl.expectOne(r => r.method === 'DELETE' && r.url === `${BASE}/2`).flush(null, { status: 204, statusText: 'No Content' });
      expect(comp.feedback()).toBe('Local excluído.');
      ctrl.expectOne(`${BASE}/arvore`).flush(ARVORE());
    });

    it('"possui bens": oferece Desativar e link para os bens do local; Desativar envia PUT ativo=false', async () => {
      spyOn(ConfirmDialogComponent.prototype, 'abrir').and.resolveTo(true);
      const sala = comp.arvore()[0].filhos[0].filhos[0];
      await comp.excluir(sala);
      ctrl.expectOne(r => r.method === 'DELETE').flush(
        { error: 'Não é possível excluir um local que possui bens.' }, { status: 400, statusText: 'Bad Request' });
      fixture.detectChanges();

      expect(el().textContent).toContain('possui bens');
      expect(el().textContent).toContain('Desativar');
      const link = el().querySelector<HTMLAnchorElement>('a[href*="/imobilizado/bens"]')!;
      expect(link.getAttribute('href')).toContain('localId=4');

      comp.desativar();
      const put = ctrl.expectOne(r => r.method === 'PUT' && r.url === `${BASE}/4`);
      expect(put.request.body).toEqual({ nome: 'Sala 101', codigo: 'S101', localPaiId: 3, ativo: false });
      put.flush(no(4, 'Sala 101'));
      expect(comp.bloqueio()).toBeNull();
      expect(comp.feedback()).toContain('desativado');
      ctrl.expectOne(`${BASE}/arvore`).flush(ARVORE());
    });

    it('"possui sublocais": mostra a mensagem e oferece Desativar, sem link para bens', async () => {
      spyOn(ConfirmDialogComponent.prototype, 'abrir').and.resolveTo(true);
      await comp.excluir(comp.arvore()[0]);
      ctrl.expectOne(r => r.method === 'DELETE').flush(
        { error: 'Não é possível excluir um local que possui sublocais.' }, { status: 400, statusText: 'Bad Request' });
      fixture.detectChanges();
      expect(el().textContent).toContain('possui sublocais');
      expect(el().textContent).toContain('Desativar');
      expect(el().querySelector('a[href*="/imobilizado/bens"]')).toBeNull();
    });

    it('local já inativo não oferece Desativar', async () => {
      spyOn(ConfirmDialogComponent.prototype, 'abrir').and.resolveTo(true);
      await comp.excluir(comp.arvore()[0].filhos[1]);
      ctrl.expectOne(r => r.method === 'DELETE').flush(
        { error: 'Não é possível excluir um local que possui bens.' }, { status: 400, statusText: 'Bad Request' });
      fixture.detectChanges();
      expect(el().textContent).not.toContain('Desativar');
    });
  });

  describe('estados', () => {
    it('mostra erro de carregamento e permite tentar de novo', () => {
      spyOn(Modal.prototype, 'show');
      TestBed.configureTestingModule({
        imports: [ImobLocaisComponent],
        providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), provideAuthFake('admin')]
      });
      ctrl = TestBed.inject(HttpTestingController);
      fixture = TestBed.createComponent(ImobLocaisComponent);
      fixture.detectChanges();
      expect(el().textContent).toContain('Carregando');
      ctrl.expectOne(`${BASE}/arvore`).flush({}, { status: 500, statusText: 'Server Error' });
      fixture.detectChanges();
      expect(el().textContent).toContain('Erro ao carregar locais');
      expect(el().textContent).toContain('Tentar novamente');
    });

    it('estado vazio', () => {
      montar('admin', []);
      expect(el().textContent).toContain('Nenhum local cadastrado');
    });
  });

  describe('papéis', () => {
    const textoBotoes = () => Array.from(el().querySelectorAll('button[aria-label], button')).map(b =>
      (b.getAttribute('aria-label') ?? '') + ' ' + (b.textContent ?? ''));

    it('leitura não vê nenhum botão de escrita', () => {
      montar('leitura');
      const t = textoBotoes().join('|');
      expect(t).not.toContain('Novo local');
      expect(t).not.toContain('Editar');
      expect(t).not.toContain('Adicionar sublocal');
      expect(t).not.toContain('Excluir ');
    });

    it('operador cria e edita, mas não exclui', () => {
      montar('operador');
      const t = textoBotoes().join('|');
      expect(t).toContain('Novo local');
      expect(t).toContain('Editar Matriz');
      expect(t).toContain('Adicionar sublocal em Matriz');
      expect(t).not.toContain('Excluir Matriz');
    });

    it('admin vê tudo', () => {
      montar('admin');
      expect(textoBotoes().join('|')).toContain('Excluir Matriz');
    });
  });
});
