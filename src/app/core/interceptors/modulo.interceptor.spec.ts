import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { moduloInterceptor } from './modulo.interceptor';
import { empresaInterceptor } from './empresa.interceptor';
import { EmpresaAtivaService } from '../services/empresa-ativa.service';
import { ImobEmpresa } from '../models/imob-empresa.model';

const MINHAS = '/api/v1/imobilizado/minhas-empresas';
const emp = (modulos: string[]): ImobEmpresa =>
  ({ id: 1, razaoSocial: 'X', cnpj: '', ativo: true, criadoEm: '', perfil: 'admin', modulos });

describe('moduloInterceptor', () => {
  let http: HttpClient;
  let ctrl: HttpTestingController;
  let router: Router;
  let empresa: EmpresaAtivaService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        // mesma ordem do app.config: o modulo fica depois do empresa (mais interno)
        provideHttpClient(withInterceptors([empresaInterceptor, moduloInterceptor])),
        provideHttpClientTesting()
      ]
    });
    http = TestBed.inject(HttpClient);
    ctrl = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    empresa = TestBed.inject(EmpresaAtivaService);
    empresa.empresas.set([emp(['estoque'])]);
    empresa.id.set(1);
    spyOn(router, 'navigateByUrl').and.resolveTo(true);
    spyOnProperty(router, 'url').and.returnValue('/produtos');
  });

  afterEach(() => ctrl.verify());

  function falhar(corpo: object, status = 403) {
    const erros: unknown[] = [];
    http.get('/api/v1/produtos').subscribe({ error: e => erros.push(e) });
    ctrl.expectOne('/api/v1/produtos').flush(corpo, { status, statusText: 'x' });
    return erros;
  }

  it('modulo_desativado: avisa o plano, recarrega, navega para a pagina inicial segura e nao propaga erro', () => {
    const erros = falhar({ codigo: 'modulo_desativado', modulo: 'estoque' });
    expect(empresa.aviso()).toBe('Seu plano não inclui este módulo.');
    ctrl.expectOne(MINHAS).flush([emp(['imobilizado'])]);
    expect(router.navigateByUrl).toHaveBeenCalledWith('/imobilizado');
    expect(erros.length).toBe(0);
  });

  it('modulo_nao_permitido e modulo_nao_declarado: aviso de falta de acesso', () => {
    falhar({ codigo: 'modulo_nao_permitido', modulo: 'estoque' });
    expect(empresa.aviso()).toBe('Você não tem acesso a este módulo.');
    ctrl.expectOne(MINHAS).flush([emp(['estoque'])]);
    empresa.aviso.set('');
    falhar({ codigo: 'modulo_nao_declarado' });
    expect(empresa.aviso()).toBe('Você não tem acesso a este módulo.');
    ctrl.expectOne(MINHAS).flush([emp(['estoque'])]);
  });

  it('nao volta ao modulo negado mesmo que a lista ainda o traga (evita laco)', () => {
    falhar({ codigo: 'modulo_desativado', modulo: 'estoque' });
    ctrl.expectOne(MINHAS).flush([emp(['estoque'])]);
    expect(router.navigateByUrl).toHaveBeenCalledWith('/clientes');
  });

  it('nao interfere com a perda de vinculo: o empresaInterceptor nao ve o 403 de modulo', () => {
    spyOn(empresa, 'perdeuAcesso');
    falhar({ codigo: 'modulo_desativado', modulo: 'estoque' });
    ctrl.expectOne(MINHAS).flush([emp([])]);
    expect(empresa.perdeuAcesso).not.toHaveBeenCalled();
  });

  it('403 sem codigo de modulo segue como erro e o empresaInterceptor ainda trata', () => {
    spyOn(empresa, 'perdeuAcesso');
    const erros = falhar({ error: 'Usuário sem acesso à empresa' });
    expect(erros.length).toBe(1);
    expect(empresa.perdeuAcesso).toHaveBeenCalled();
    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });

  it('outros erros passam adiante', () => {
    const erros = falhar({}, 500);
    expect(erros.length).toBe(1);
    expect(empresa.aviso()).toBe('');
  });
});
