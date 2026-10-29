import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { ImpressoesComponent } from './impressoes.component';

const USUARIOS = '/api/v1/empresa-ativa/usuarios';

describe('ImpressoesComponent', () => {
  let fixture: ComponentFixture<ImpressoesComponent>;
  let ctrl: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ImpressoesComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()]
    });
    ctrl = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ImpressoesComponent);
    fixture.detectChanges();
  });

  afterEach(() => {
    ctrl.expectNone(r => r.url.endsWith('/v1/users'));
    ctrl.verify();
  });

  it('filtro de usuário usa empresa-ativa/usuarios sem ativo (histórico), pageSize 100', () => {
    const req = ctrl.expectOne(r => r.url === USUARIOS);
    expect(req.request.params.has('ativo')).toBeFalse();
    expect(req.request.params.get('pageSize')).toBe('100');
    req.flush({
      items: [
        { id: 'u-1', nome: 'Ana', email: 'a@x.com', perfil: 'leitura', perfilEfetivo: 'admin', ativo: true },
        { id: 'u-2', nome: 'Beto Antigo', email: 'b@x.com', perfil: 'leitura', perfilEfetivo: 'leitura', ativo: false }
      ],
      page: 1, pageSize: 100, total: 2
    });
    ctrl.expectOne(r => r.url.endsWith('/v1/impressoes')).flush({ items: [], page: 1, pageSize: 50, total: 0 });
    fixture.detectChanges();
    const opcoes = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('option')).map(o => o.textContent?.trim());
    expect(opcoes).toContain('Ana');
    expect(opcoes).toContain('Beto Antigo');
  });
});
