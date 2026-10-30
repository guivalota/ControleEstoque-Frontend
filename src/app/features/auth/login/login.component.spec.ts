import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { LoginComponent } from './login.component';
import { AuthService } from '../../../core/services/auth.service';

describe('LoginComponent', () => {
  function criar(aviso = '') {
    TestBed.configureTestingModule({ imports: [LoginComponent], providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
    if (aviso) TestBed.inject(AuthService).avisoLogin.set(aviso);
    const fixture = TestBed.createComponent(LoginComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('mostra a mensagem do servidor quando a empresa está bloqueada (403 empresa_bloqueada)', () => {
    const fixture = criar();
    const ctrl = TestBed.inject(HttpTestingController);
    fixture.componentInstance.form.setValue({ email: 'a@a.com', senha: '12345678' });
    fixture.componentInstance.submit();
    ctrl.expectOne('/api/v1/auth/login').flush(
      { error: 'Empresa bloqueada. Fale com o administrador.', codigo: 'empresa_bloqueada' }, { status: 403, statusText: 'Forbidden' });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Empresa bloqueada. Fale com o administrador.');
  });

  it('mostra e consome o aviso deixado pelo refresh recusado', () => {
    const fixture = criar('Empresa bloqueada. Fale com o administrador.');
    expect(fixture.nativeElement.textContent).toContain('Empresa bloqueada. Fale com o administrador.');
    expect(TestBed.inject(AuthService).avisoLogin()).toBe('');
  });
});
