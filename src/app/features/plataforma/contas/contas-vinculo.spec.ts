import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PlataformaContasComponent } from './contas.component';

const URL = '/api/v1/users';
const EMP = '/api/v1/plataforma/empresas';
const conta = (id: string, tipo: string) => ({
  id, nome: `Conta ${id}`, email: `${id}@x.com`, role: 'admin', tipo, ativo: true, criadoEm: '2026-10-22T14:03:11Z'
});
const EMPRESAS = { items: [
  { id: 1, razaoSocial: 'Alfa', cnpj: '11222333000181', ativo: true, criadoEm: '' },
  { id: 2, razaoSocial: 'Beta', cnpj: '11222333000262', ativo: true, criadoEm: '' }
], page: 1, pageSize: 100, total: 2 };
const semCorpo = (status = 204) => ({ status, statusText: 'x' });

describe('PlataformaContasComponent (vínculo e nova conta plataforma)', () => {
  let fixture: ComponentFixture<PlataformaContasComponent>;
  let ctrl: HttpTestingController;
  const el = () => fixture.nativeElement as HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [PlataformaContasComponent], providers: [provideHttpClient(), provideHttpClientTesting()] });
    ctrl = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(PlataformaContasComponent);
    fixture.detectChanges();
    ctrl.expectOne(x => x.url === URL).flush({ items: [conta('a', 'cliente'), conta('s', 'superadmin')], page: 1, pageSize: 50, total: 2 });
    fixture.detectChanges();
  });
  afterEach(() => ctrl.verify());

  function abrirVinculo() {
    (el().querySelector('button[aria-label="Vínculo de Conta a"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    ctrl.expectOne(x => x.url === EMP).flush(EMPRESAS);
    fixture.detectChanges();
  }

  function escolher(id: string, indice: number) {
    const s = el().querySelector(`#${id}`) as HTMLSelectElement;
    s.selectedIndex = indice;
    s.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  }

  const confirmar = () => (el().querySelector('app-conta-vinculo .btn-primary') as HTMLButtonElement).click();

  it('super admin não tem botão de vínculo', () => {
    expect(el().querySelector('button[aria-label="Vínculo de Conta s"]')).toBeNull();
    expect(el().querySelector('button[aria-label="Vínculo de Conta a"]')).not.toBeNull();
  });

  it('vincula a uma empresa', () => {
    abrirVinculo();
    escolher('vincDestino', 2);
    confirmar();
    const r = ctrl.expectOne(`${EMP}/2/usuarios`);
    expect(r.request.method).toBe('POST');
    expect(r.request.body).toEqual({ usuarioId: 'a' });
    r.flush(null, semCorpo());
    fixture.detectChanges();
    expect(el().textContent).toContain('Conta vinculada.');
  });

  it('transfere: desvincula da origem e vincula ao destino', () => {
    abrirVinculo();
    escolher('vincAcao', 1);
    escolher('vincOrigem', 1);
    escolher('vincDestino', 2);
    confirmar();
    ctrl.expectOne(x => x.method === 'DELETE' && x.url === `${EMP}/1/usuarios/a`).flush(null, semCorpo());
    ctrl.expectOne(x => x.method === 'POST' && x.url === `${EMP}/2/usuarios`).flush(null, semCorpo());
    fixture.detectChanges();
    expect(el().textContent).toContain('Conta transferida.');
  });

  it('exibe o 400 do servidor como veio', () => {
    abrirVinculo();
    escolher('vincDestino', 1);
    confirmar();
    ctrl.expectOne(`${EMP}/1/usuarios`).flush(
      { error: 'Este usuário já pertence a outra empresa. Um usuário só pode pertencer a uma empresa.' }, semCorpo(400));
    fixture.detectChanges();
    expect(el().querySelector('.alert-danger')!.textContent).toContain('Este usuário já pertence a outra empresa. Um usuário só pode pertencer a uma empresa.');
  });

  it('desvincula sem pedir destino', () => {
    abrirVinculo();
    escolher('vincAcao', 2);
    expect(el().querySelector('#vincDestino')).toBeNull();
    escolher('vincOrigem', 1);
    confirmar();
    ctrl.expectOne(x => x.method === 'DELETE' && x.url === `${EMP}/1/usuarios/a`).flush(null, semCorpo());
    fixture.detectChanges();
    expect(el().textContent).toContain('Conta desvinculada.');
  });

  it('cria conta plataforma e vincula à empresa', () => {
    (el().querySelector('.btn-primary') as HTMLButtonElement).click();
    fixture.detectChanges();
    ctrl.expectOne(x => x.url === EMP).flush(EMPRESAS);
    fixture.detectChanges();
    const set = (id: string, v: string) => {
      const i = el().querySelector(`#${id}`) as HTMLInputElement;
      i.value = v;
      i.dispatchEvent(new Event('input'));
    };
    set('cnNome', 'Sup');
    set('cnEmail', 'sup@x.com');
    set('cnSenha', 'Senha@1234');
    escolher('cnEmpresa', 2);
    (el().querySelector('app-conta-nova form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    const post = ctrl.expectOne(x => x.method === 'POST' && x.url === URL);
    expect(post.request.body).toEqual({ nome: 'Sup', email: 'sup@x.com', senha: 'Senha@1234', role: 'operador' });
    post.flush({ ...conta('n', 'plataforma'), email: 'sup@x.com' }, { status: 201, statusText: 'Created' });
    const v = ctrl.expectOne(`${EMP}/2/usuarios`);
    expect(v.request.body).toEqual({ usuarioId: 'n', perfil: 'operador' });
    v.flush(null, semCorpo());
    ctrl.expectOne(x => x.method === 'GET' && x.url === URL).flush({ items: [], page: 1, pageSize: 50, total: 0 });
    fixture.detectChanges();
    expect(el().textContent).toContain('criada e vinculada');
  });
});
