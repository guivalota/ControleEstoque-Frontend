import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Modal } from 'bootstrap';
import { provideAuthFake } from '../../../testing/auth-fake';
import { EmpresaAtivaService } from '../../../core/services/empresa-ativa.service';
import { CatalogoPermissao, CatalogoPermissoes, PerfilAcesso, PerfilAcessoDetalhe } from '../../../core/models/perfil-acesso.model';
import { PerfisComponent } from './perfis.component';

const PERFIS = '/api/v1/perfis';
const perfil = (id: number, extra: Partial<PerfilAcesso> = {}): PerfilAcesso => ({
  id, nome: `Perfil ${id}`, descricao: null, sistema: false, modelo: null, todasPermissoes: false, ativo: true, usuarios: 0, totalPermissoes: 3, ...extra
});
const perm = (codigo: string, extra: Partial<CatalogoPermissao> = {}): CatalogoPermissao => ({
  codigo, acao: codigo.split('.')[2], rotulo: codigo, descricao: `Descrição ${codigo}`, sensivel: false, essencial: false, ...extra
});
const CATALOGO: CatalogoPermissoes = {
  modulos: [{
    modulo: 'estoque',
    recursos: [{
      recurso: 'produtos', rotulo: 'Produtos',
      permissoes: [
        perm('estoque.produtos.ver'),
        perm('estoque.produtos.criar', { dependeDe: 'estoque.produtos.ver' }),
        perm('estoque.produtos.excluir', { dependeDe: 'estoque.produtos.ver', sensivel: true })
      ]
    }]
  }, {
    modulo: 'core',
    recursos: [{ recurso: 'empresa', rotulo: 'Dados da empresa', permissoes: [perm('core.empresa.ver', { essencial: true })] }]
  }]
};
const TODAS = ['core.acesso.ver', 'core.acesso.gerir', 'estoque.produtos.ver', 'estoque.produtos.criar', 'estoque.produtos.excluir', 'core.empresa.ver'];

describe('PerfisComponent e editor', () => {
  let ctrl: HttpTestingController;

  function iniciar(permissoes: string[] = TODAS, lista: PerfilAcesso[] = [perfil(1, { nome: 'Administrador', sistema: true, todasPermissoes: true, modelo: 'administrador', usuarios: 2 }),
    perfil(2, { nome: 'Operador', sistema: true, modelo: 'operador' }), perfil(3, { nome: 'Caixa' })]) {
    spyOn(Modal.prototype, 'show');
    TestBed.configureTestingModule({ imports: [PerfisComponent], providers: [provideHttpClient(), provideHttpClientTesting(), provideAuthFake('admin')] });
    const empresa = TestBed.inject(EmpresaAtivaService);
    empresa.empresas.set([{ id: 1, razaoSocial: 'X', cnpj: '', ativo: true, criadoEm: '', perfil: 'admin', modulos: ['estoque'], permissoes }]);
    empresa.id.set(1);
    ctrl = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(PerfisComponent);
    fixture.detectChanges();
    ctrl.expectOne(PERFIS).flush(lista);
    fixture.detectChanges();
    return fixture;
  }

  const texto = (f: { nativeElement: unknown }) => (f.nativeElement as HTMLElement).textContent ?? '';
  const botao = (f: { nativeElement: unknown }, rotulo: string) =>
    (f.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(`button[aria-label="${rotulo}"]`);

  afterEach(() => ctrl.verify());

  it('lista os perfis com usuários e permissões; o Administrador aparece bloqueado, sem editar/excluir/inativar', () => {
    const f = iniciar();

    expect(texto(f)).toContain('Administrador');
    expect(texto(f)).toContain('Todas');
    expect(botao(f, 'Ver Administrador')).not.toBeNull();
    expect(botao(f, 'Editar Administrador')).toBeNull();
    expect(botao(f, 'Excluir Administrador')).toBeNull();
    expect(botao(f, 'Inativar Administrador')).toBeNull();
  });

  it('perfil padrão (Operador) pode restaurar o padrão mas não excluir; o próprio pode excluir', () => {
    const f = iniciar();

    expect(botao(f, 'Restaurar o padrão de Operador')).not.toBeNull();
    expect(botao(f, 'Excluir Operador')).toBeNull();
    expect(botao(f, 'Excluir Caixa')).not.toBeNull();
    expect(botao(f, 'Restaurar o padrão de Caixa')).toBeNull();
  });

  it('sem core.acesso.gerir os botões de escrita ficam desabilitados', () => {
    const f = iniciar(['core.acesso.ver']);

    expect(botao(f, 'Copiar Caixa')!.disabled).toBeTrue();
    expect(botao(f, 'Excluir Caixa')!.disabled).toBeTrue();
    expect(botao(f, 'Editar Caixa')!.disabled).toBeFalse();
  });

  it('inativar chama PUT /ativo e recarrega; mostra a mensagem do servidor quando recusa', () => {
    const f = iniciar();

    botao(f, 'Inativar Caixa')!.click();
    const req = ctrl.expectOne(`${PERFIS}/3/ativo`);
    expect(req.request.body).toEqual({ ativo: false });
    req.flush({ error: 'Perfil com usuários não pode ser inativado.' }, { status: 400, statusText: 'Bad Request' });
    f.detectChanges();

    expect(texto(f)).toContain('Perfil com usuários não pode ser inativado.');
  });

  it('copiar abre o editor com as permissões do perfil de origem, nome "(cópia)" e cria por POST', () => {
    const f = iniciar();
    botao(f, 'Copiar Caixa')!.click();
    f.detectChanges();
    ctrl.expectOne('/api/v1/permissoes').flush(CATALOGO);
    const origem: PerfilAcessoDetalhe = { ...perfil(3, { nome: 'Caixa' }), permissoes: ['estoque.produtos.ver', 'estoque.produtos.criar'] };
    ctrl.expectOne(`${PERFIS}/3`).flush(origem);
    f.detectChanges();

    const nome = (f.nativeElement as HTMLElement).querySelector<HTMLInputElement>('#pfNome')!;
    expect(nome.value).toBe('Caixa (cópia)');

    (f.nativeElement as HTMLElement).querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
    const req = ctrl.expectOne(r => r.method === 'POST' && r.url === PERFIS);
    expect(req.request.body.permissoes).toEqual(['core.empresa.ver', 'estoque.produtos.criar', 'estoque.produtos.ver']);
    req.flush({ ...origem, id: 9, nome: 'Caixa (cópia)' });
    ctrl.expectOne(PERFIS).flush([]);
  });

  describe('matriz do editor', () => {
    function abrirNovo() {
      const f = iniciar();
      botao(f, 'Editar Caixa')!.click();
      f.detectChanges();
      ctrl.expectOne('/api/v1/permissoes').flush(CATALOGO);
      ctrl.expectOne(`${PERFIS}/3`).flush({ ...perfil(3, { nome: 'Caixa' }), permissoes: ['estoque.produtos.ver'] });
      f.detectChanges();
      return f;
    }
    const caixa = (f: { nativeElement: unknown }, rotulo: string) =>
      (f.nativeElement as HTMLElement).querySelector<HTMLInputElement>(`input[aria-label="${rotulo}"]`)!;

    it('mostra só os módulos do catálogo, destaca a ação sensível e trava a essencial', () => {
      const f = abrirNovo();

      expect(texto(f)).toContain('Estoque');
      expect(texto(f)).toContain('Cadastros e empresa');
      expect(caixa(f, 'Descrição estoque.produtos.excluir').closest('td')!.classList).toContain('sensivel');
      const essencial = caixa(f, 'Descrição core.empresa.ver');
      expect(essencial.checked).toBeTrue();
      expect(essencial.disabled).toBeTrue();
    });

    it('marcar "criar" mantém o "ver" e desmarcar o "ver" derruba "criar"', () => {
      const f = abrirNovo();

      caixa(f, 'Descrição estoque.produtos.criar').click();
      f.detectChanges();
      expect(caixa(f, 'Descrição estoque.produtos.criar').checked).toBeTrue();

      caixa(f, 'Descrição estoque.produtos.ver').click();
      f.detectChanges();
      expect(caixa(f, 'Descrição estoque.produtos.ver').checked).toBeFalse();
      expect(caixa(f, 'Descrição estoque.produtos.criar').checked).toBeFalse();
    });

    it('"Tudo" da linha marca todas as ações do recurso', () => {
      const f = abrirNovo();

      caixa(f, 'Marcar todas as ações de Produtos').click();
      f.detectChanges();

      expect(caixa(f, 'Descrição estoque.produtos.excluir').checked).toBeTrue();
      expect(caixa(f, 'Descrição estoque.produtos.criar').checked).toBeTrue();
    });

    it('o que o usuário não tem não pode ser concedido (caixa desabilitada)', () => {
      const f = iniciar(['core.acesso.ver', 'core.acesso.gerir', 'estoque.produtos.ver', 'core.empresa.ver']);
      botao(f, 'Editar Caixa')!.click();
      f.detectChanges();
      ctrl.expectOne('/api/v1/permissoes').flush(CATALOGO);
      ctrl.expectOne(`${PERFIS}/3`).flush({ ...perfil(3), permissoes: ['estoque.produtos.ver'] });
      f.detectChanges();

      expect(caixa(f, 'Descrição estoque.produtos.excluir').disabled).toBeTrue();
      expect(caixa(f, 'Descrição estoque.produtos.ver').disabled).toBeFalse();
    });

    it('salvar envia PUT com nome, descrição e as permissões marcadas', () => {
      const f = abrirNovo();
      caixa(f, 'Descrição estoque.produtos.criar').click();
      f.detectChanges();

      (f.nativeElement as HTMLElement).querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
      const req = ctrl.expectOne(r => r.method === 'PUT' && r.url === `${PERFIS}/3`);
      expect(req.request.body).toEqual({ nome: 'Caixa', descricao: null, permissoes: ['core.empresa.ver', 'estoque.produtos.criar', 'estoque.produtos.ver'] });
      req.flush({ ...perfil(3), permissoes: [] });
      ctrl.expectOne(PERFIS).flush([]);
    });

    it('mostra o erro do servidor ao salvar (ex.: tentar conceder o que não tem)', () => {
      const f = abrirNovo();
      (f.nativeElement as HTMLElement).querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
      ctrl.expectOne(r => r.method === 'PUT').flush({ error: 'Você não pode conceder permissões que não possui.' }, { status: 400, statusText: 'Bad Request' });
      f.detectChanges();

      expect(texto(f)).toContain('não pode conceder');
    });

    it('o Administrador abre somente leitura, sem botão de salvar', () => {
      const f = iniciar();
      botao(f, 'Ver Administrador')!.click();
      f.detectChanges();
      ctrl.expectOne('/api/v1/permissoes').flush(CATALOGO);
      ctrl.expectOne(`${PERFIS}/1`).flush({ ...perfil(1, { nome: 'Administrador', sistema: true, todasPermissoes: true }), permissoes: [] });
      f.detectChanges();

      expect(texto(f)).toContain('tem todas as permissões');
      expect(texto(f)).not.toContain('Salvar perfil');
      expect(caixa(f, 'Descrição estoque.produtos.excluir').disabled).toBeTrue();
      expect(caixa(f, 'Descrição estoque.produtos.excluir').checked).toBeTrue();
    });
  });
});
