import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Modal } from 'bootstrap';
import { PlataformaEmpresaPlanoComponent } from './plataforma-empresa-plano.component';

const BASE = '/api/v1/plataforma';
const PLANOS = [
  { id: 1, codigo: 'basico', nome: 'Básico', modulos: ['estoque'], limites: { max_usuarios: 3 }, padrao: true, ativo: true, empresasUsando: 2 },
  { id: 2, codigo: 'pro', nome: 'Pro', modulos: ['estoque', 'imobilizado'], limites: {}, padrao: false, ativo: true, empresasUsando: 0 }
];
const USO = {
  planoId: 1, planoNome: 'Básico',
  limites: [
    { codigo: 'max_usuarios', descricao: 'Usuários', usado: 2, limite: 3, origem: 'plano' },
    { codigo: 'max_bens', descricao: 'Bens', usado: 10, limite: 50, origem: 'empresa' },
    { codigo: 'max_produtos', descricao: 'Produtos', usado: 0, limite: null, origem: 'ilimitado' }
  ]
};

describe('PlataformaEmpresaPlanoComponent', () => {
  let fixture: ComponentFixture<PlataformaEmpresaPlanoComponent>;
  let comp: PlataformaEmpresaPlanoComponent;
  let ctrl: HttpTestingController;
  const el = () => fixture.nativeElement as HTMLElement;

  function carregarInicial() {
    ctrl.expectOne(`${BASE}/planos`).flush(PLANOS);
    ctrl.expectOne(`${BASE}/empresas/5/uso`).flush(USO);
    fixture.detectChanges();
  }

  beforeEach(() => {
    spyOn(Modal.prototype, 'show');
    spyOn(Modal.prototype, 'hide');
    TestBed.configureTestingModule({
      imports: [PlataformaEmpresaPlanoComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    ctrl = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(PlataformaEmpresaPlanoComponent);
    fixture.componentRef.setInput('empresaId', 5);
    comp = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => ctrl.verify());

  it('mostra o uso com limite e origem', () => {
    carregarInicial();
    const t = el().textContent!;
    expect(t).toContain('Sobrescrito na empresa');
    expect(t).toContain('Ilimitado');
    expect(comp.formLimites.value.max_bens).toBe(50);
    expect(comp.formLimites.value.max_usuarios).toBeNull();
  });

  it('mostra erro ao falhar o carregamento', () => {
    ctrl.expectOne(`${BASE}/planos`).flush({ error: 'Sem acesso.' }, { status: 500, statusText: 'x' });
    ctrl.expectOne(`${BASE}/empresas/5/uso`).flush({}, { status: 500, statusText: 'x' });
    fixture.detectChanges();
    expect(el().textContent).toContain('Sem acesso.');
  });

  it('aplica o plano com sincronizar módulos após confirmar', async () => {
    carregarInicial();
    spyOn(comp['confirmDialog'](), 'abrir').and.resolveTo(true);
    comp.formPlano.patchValue({ planoId: 2, sincronizarModulos: true });
    await comp.aplicarPlano();
    const req = ctrl.expectOne(`${BASE}/empresas/5/plano`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ planoId: 2, sincronizarModulos: true });
    req.flush(null);
    ctrl.expectOne(`${BASE}/planos`).flush(PLANOS);
    ctrl.expectOne(`${BASE}/empresas/5/uso`).flush(USO);
    expect(comp.feedback()).toBe('Plano aplicado.');
  });

  it('não aplica quando a confirmação é cancelada', async () => {
    carregarInicial();
    spyOn(comp['confirmDialog'](), 'abrir').and.resolveTo(false);
    await comp.aplicarPlano();
    ctrl.expectNone(`${BASE}/empresas/5/plano`);
  });

  it('sobrescreve limites enviando só os preenchidos e remove com objeto vazio', () => {
    carregarInicial();
    comp.formLimites.reset({ max_usuarios: 8, max_bens: null, max_produtos: null });
    comp.salvarLimites();
    const req = ctrl.expectOne(`${BASE}/empresas/5/limites`);
    expect(req.request.body).toEqual({ limites: { max_usuarios: 8 } });
    req.flush(null);
    ctrl.expectOne(`${BASE}/planos`).flush(PLANOS);
    ctrl.expectOne(`${BASE}/empresas/5/uso`).flush(USO);

    comp.removerLimites();
    const rem = ctrl.expectOne(`${BASE}/empresas/5/limites`);
    expect(rem.request.body).toEqual({ limites: {} });
    rem.flush(null);
    ctrl.expectOne(`${BASE}/planos`).flush(PLANOS);
    ctrl.expectOne(`${BASE}/empresas/5/uso`).flush(USO);
  });
});
