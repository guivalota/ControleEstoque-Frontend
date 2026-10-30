import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { LogoComponent } from './logo.component';
import { EmpresaPerfilService } from '../../../core/services/empresa-perfil.service';

const URL = '/api/v1/empresa-ativa/logo';

describe('LogoComponent', () => {
  let fixture: ComponentFixture<LogoComponent>;
  let ctrl: HttpTestingController;
  let service: EmpresaPerfilService;
  const el = () => fixture.nativeElement as HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [LogoComponent], providers: [provideHttpClient(), provideHttpClientTesting()] });
    ctrl = TestBed.inject(HttpTestingController);
    service = TestBed.inject(EmpresaPerfilService);
    fixture = TestBed.createComponent(LogoComponent);
  });
  afterEach(() => ctrl.verify());

  it('404 do logo não quebra: mostra "Sem logo"', () => {
    fixture.detectChanges();
    ctrl.expectOne(URL).flush(new Blob(['']), { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();
    expect(service.logoUrl()).toBeNull();
    expect(el().textContent).toContain('Sem logo');
  });

  it('logo existente vira object URL e é exibido', () => {
    fixture.detectChanges();
    ctrl.expectOne(URL).flush(new Blob(['x'], { type: 'image/png' }));
    fixture.detectChanges();
    expect(service.logoUrl()).toMatch(/^blob:/);
    expect(el().querySelector('img[alt="Logo da empresa"]')).toBeTruthy();
  });

  it('envia multipart com o campo "arquivo" e atualiza a pré-visualização', () => {
    fixture.detectChanges();
    ctrl.expectOne(URL).flush(new Blob(['']), { status: 404, statusText: 'Not Found' });
    const comp = fixture.componentInstance;
    comp.arquivo.set(new File(['x'], 'logo.png', { type: 'image/png' }));
    comp.enviar();
    const req = ctrl.expectOne(r => r.method === 'PUT' && r.url === URL);
    expect(req.request.body instanceof FormData).toBeTrue();
    expect((req.request.body as FormData).get('arquivo')).toBeTruthy();
    req.flush(null, { status: 204, statusText: 'No Content' });
    fixture.detectChanges();
    expect(service.logoUrl()).toMatch(/^blob:/);
    expect(el().textContent).toContain('Logo atualizado.');
  });

  it('exibe o erro 400 do servidor como veio', () => {
    fixture.detectChanges();
    ctrl.expectOne(URL).flush(new Blob(['']), { status: 404, statusText: 'Not Found' });
    fixture.componentInstance.arquivo.set(new File(['x'], 'a.gif'));
    fixture.componentInstance.enviar();
    ctrl.expectOne(r => r.method === 'PUT').flush({ error: 'O arquivo deve ser PNG ou JPG.' }, { status: 400, statusText: 'Bad Request' });
    fixture.detectChanges();
    expect(el().querySelector('.alert-danger')!.textContent).toContain('O arquivo deve ser PNG ou JPG.');
  });

  it('remove o logo (DELETE) e volta ao padrão', () => {
    fixture.detectChanges();
    ctrl.expectOne(URL).flush(new Blob(['x'], { type: 'image/png' }));
    fixture.componentInstance.remover();
    ctrl.expectOne(r => r.method === 'DELETE' && r.url === URL).flush(null, { status: 204, statusText: 'No Content' });
    fixture.detectChanges();
    expect(service.logoUrl()).toBeNull();
    expect(el().textContent).toContain('Sem logo');
  });
});
