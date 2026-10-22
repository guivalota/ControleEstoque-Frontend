import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { ImobEmpresaUsuariosComponent } from './imob-empresa-usuarios.component';
import { ConfirmDialogComponent } from '../shared/confirm-dialog.component';
import { ImobUsuarioEmpresa } from '../../../core/models/imob-empresa.model';
import { User } from '../../../core/models/user.model';

const BASE = '/api/v1/imobilizado/empresas/3/usuarios';

const vinculo = (usuarioId: string, nome: string, ativo = true): ImobUsuarioEmpresa => ({
  usuarioId, nome, email: `${nome.toLowerCase()}@x.com`, ativo, criadoEm: '2026-10-22T14:03:11Z'
});
const usuario = (id: string, nome: string, ativo = true): User => ({
  id, nome, email: `${nome.toLowerCase()}@x.com`, role: 'operador', ativo
});

describe('ImobEmpresaUsuariosComponent', () => {
  let fixture: ComponentFixture<ImobEmpresaUsuariosComponent>;
  let comp: ImobEmpresaUsuariosComponent;
  let ctrl: HttpTestingController;
  const texto = () => (fixture.nativeElement as HTMLElement).textContent ?? '';

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ImobEmpresaUsuariosComponent],
      providers: [
        provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: '3' }) } } }
      ]
    });
    ctrl = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ImobEmpresaUsuariosComponent);
    comp = fixture.componentInstance;
    fixture.detectChanges();
    ctrl.expectOne(r => r.url === '/api/v1/users').flush({
      items: [usuario('u1', 'Ana'), usuario('u2', 'Bruno'), usuario('u3', 'Anita', false), usuario('u4', 'Carlos')],
      page: 1, pageSize: 1000, total: 4
    });
    ctrl.expectOne(BASE).flush([vinculo('u2', 'Bruno'), vinculo('u4', 'Carlos', false)]);
    fixture.detectChanges();
  });

  afterEach(() => ctrl.verify());

  it('lista vínculos ativos e desvinculados', () => {
    expect(texto()).toContain('Bruno');
    expect(texto()).toContain('Desvincular');
    expect(texto()).toContain('Vincular novamente');
  });

  it('sugere só usuários ativos e ainda não vinculados, pelo nome ou e-mail', () => {
    comp.aoDigitar('an');
    expect(comp.sugestoes().map(u => u.id)).toEqual(['u1']);
    comp.aoDigitar('BRUNO@');
    expect(comp.sugestoes()).toEqual([]);
    comp.aoDigitar('carlos');
    expect(comp.sugestoes().map(u => u.id)).toEqual(['u4']);
  });

  it('vincula o usuário escolhido e recarrega', () => {
    comp.aoDigitar('ana');
    comp.escolher(comp.sugestoes()[0]);
    expect(comp.sugestoes()).toEqual([]);
    comp.vincular(comp.selecionado()!.id);

    const post = ctrl.expectOne(r => r.method === 'POST' && r.url === BASE);
    expect(post.request.body).toEqual({ usuarioId: 'u1' });
    post.flush(null, { status: 204, statusText: 'No Content' });

    expect(comp.termo()).toBe('');
    expect(comp.feedback()).toBe('Usuário vinculado.');
    ctrl.expectOne(r => r.method === 'GET' && r.url === BASE).flush([vinculo('u1', 'Ana'), vinculo('u2', 'Bruno')]);
    ctrl.expectOne('/api/v1/imobilizado/minhas-empresas').flush([]);
  });

  it('mostra o erro do servidor ao vincular', () => {
    comp.vincular('u1');
    ctrl.expectOne(r => r.method === 'POST').flush({ error: 'Usuário inativo.' }, { status: 400, statusText: 'Bad Request' });
    expect(comp.erro()).toBe('Usuário inativo.');
    expect(comp.vinculando()).toBeFalse();
  });

  it('desvincula só após confirmar', async () => {
    const abrir = spyOn(ConfirmDialogComponent.prototype, 'abrir').and.resolveTo(false);
    await comp.desvincular(vinculo('u2', 'Bruno'));
    ctrl.expectNone(r => r.method === 'DELETE');

    abrir.and.resolveTo(true);
    await comp.desvincular(vinculo('u2', 'Bruno'));
    ctrl.expectOne(r => r.method === 'DELETE' && r.url === `${BASE}/u2`).flush(null, { status: 204, statusText: 'No Content' });
    ctrl.expectOne(r => r.method === 'GET' && r.url === BASE).flush([vinculo('u2', 'Bruno', false)]);
    ctrl.expectOne('/api/v1/imobilizado/minhas-empresas').flush([]);
    expect(comp.feedback()).toBe('Usuário desvinculado.');
  });

  it('vincular novamente reutiliza o POST de vínculo', () => {
    comp.vincular('u4');
    expect(ctrl.expectOne(r => r.method === 'POST').request.body).toEqual({ usuarioId: 'u4' });
  });
});
