import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Modal } from 'bootstrap';
import { ImobReplicarDialogComponent } from './imob-replicar-dialog.component';
import { ImobBem, ReplicarImobBemResultado } from '../../../core/models/imob-bem.model';

const URL = '/api/v1/imobilizado/bens/42/replicar';

const bem = { id: 42, plaqueta: 'CAD-001', descricao: 'Cadeira' } as ImobBem;

describe('ImobReplicarDialogComponent', () => {
  let fixture: ComponentFixture<ImobReplicarDialogComponent>;
  let comp: ImobReplicarDialogComponent;
  let ctrl: HttpTestingController;
  const el = () => fixture.nativeElement as HTMLElement;
  const texto = () => (el().textContent ?? '').replace(/\s+/g, ' ');

  beforeEach(() => {
    spyOn(Modal.prototype, 'show').and.stub();
    spyOn(Modal.prototype, 'hide').and.stub();
    TestBed.configureTestingModule({ imports: [ImobReplicarDialogComponent], providers: [provideHttpClient(), provideHttpClientTesting()] });
    ctrl = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ImobReplicarDialogComponent);
    comp = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => ctrl.verify());

  function abrir() {
    comp.abrir(bem);
    fixture.detectChanges();
  }

  it('sugere a sequência a partir da plaqueta do bem e mostra a prévia', () => {
    abrir();
    expect(comp.prefixo).toBe('CAD-');
    expect(comp.numeroInicial).toBe(2);
    expect(comp.largura).toBe(3);
    comp.quantidade = 3;
    fixture.detectChanges();
    expect(el().querySelector('[data-testid="previa"]')!.textContent).toContain('CAD-002, CAD-003, CAD-004');
  });

  it('prévia longa mostra início e fim', () => {
    abrir();
    comp.quantidade = 10;
    fixture.detectChanges();
    const previa = el().querySelector('[data-testid="previa"]')!.textContent!.replace(/\s+/g, ' ');
    expect(previa).toContain('10 cópias');
    expect(previa).toContain('CAD-002, CAD-003 … CAD-011');
  });

  it('envia a lista gerada e emite o resultado', () => {
    abrir();
    comp.quantidade = 2;
    fixture.detectChanges();
    const emitido: ReplicarImobBemResultado[] = [];
    comp.replicado.subscribe(r => emitido.push(r));

    el().querySelector<HTMLButtonElement>('button[type="submit"]')!.click();

    const req = ctrl.expectOne(URL);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ plaquetas: ['CAD-002', 'CAD-003'] });
    req.flush({ origemId: 42, origemPlaqueta: 'CAD-001', total: 2, bens: [] });
    expect(emitido.length).toBe(1);
    expect(emitido[0].total).toBe(2);
  });

  it('modo lista usa as plaquetas digitadas', () => {
    abrir();
    comp.modo.set('lista');
    comp.texto = 'A-1\nA-2, A-3';
    fixture.detectChanges();
    expect(comp.plaquetas()).toEqual(['A-1', 'A-2', 'A-3']);
  });

  it('lista com repetida mostra o erro e bloqueia o envio', () => {
    abrir();
    comp.modo.set('lista');
    comp.texto = 'A-1\na-1';
    fixture.detectChanges();
    expect(texto()).toContain('Plaquetas repetidas');
    expect(el().querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBeTrue();
  });

  it('erro do servidor aparece no diálogo e não emite', () => {
    abrir();
    comp.quantidade = 1;
    fixture.detectChanges();
    let emitiu = false;
    comp.replicado.subscribe(() => (emitiu = true));

    el().querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
    ctrl.expectOne(URL).flush({ error: 'Estas plaquetas já estão em uso: CAD-002. Nada foi criado.' }, { status: 400, statusText: 'Bad Request' });
    fixture.detectChanges();

    expect(texto()).toContain('Estas plaquetas já estão em uso: CAD-002');
    expect(emitiu).toBeFalse();
    expect(comp.salvando()).toBeFalse();
  });
});
