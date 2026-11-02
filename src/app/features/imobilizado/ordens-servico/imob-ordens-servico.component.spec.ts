import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { ImobOrdensServicoComponent } from './imob-ordens-servico.component';
import { provideAuthFake } from '../../../testing/auth-fake';

const URL = '/api/v1/imobilizado/ordens-servico';
const pagina = (items: unknown[] = []) => ({ items, total: items.length, page: 1, pageSize: 20 });

describe('ImobOrdensServicoComponent', () => {
  let fixture: ComponentFixture<ImobOrdensServicoComponent>;
  let ctrl: HttpTestingController;
  const el = () => fixture.nativeElement as HTMLElement;

  function montar(query: Record<string, string> = {}) {
    TestBed.configureTestingModule({
      imports: [ImobOrdensServicoComponent],
      providers: [
        provideRouter([]), provideHttpClient(), provideHttpClientTesting(), provideAuthFake('admin'),
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(query) } } }
      ]
    });
    ctrl = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ImobOrdensServicoComponent);
    fixture.detectChanges();
    ctrl.expectOne(r => r.url === URL).flush(pagina());
    fixture.detectChanges();
  }

  afterEach(() => ctrl.verify());

  it('o botão Filtrar consulta o servidor pelo DOM, sem submit nativo (a página não recarrega)', () => {
    montar();
    const comp = fixture.componentInstance;
    comp.busca.setValue('NB-1');

    const botao = Array.from(el().querySelectorAll('form button')).find(b => b.textContent?.includes('Filtrar')) as HTMLButtonElement;
    botao.click();

    const req = ctrl.expectOne(r => r.url === URL);
    expect(req.request.params.get('busca')).toBe('NB-1');
    expect(req.request.params.get('page')).toBe('1');
    req.flush(pagina());
  });

  it('o submit do formulário é cancelado (sem recarregar a página)', () => {
    montar();
    const evento = new Event('submit', { cancelable: true });

    el().querySelector('form')!.dispatchEvent(evento);

    expect(evento.defaultPrevented).toBeTrue();
    ctrl.expectOne(r => r.url === URL).flush(pagina());
  });

  it('abre já filtrada quando o link traz ?status=', () => {
    TestBed.configureTestingModule({
      imports: [ImobOrdensServicoComponent],
      providers: [
        provideRouter([]), provideHttpClient(), provideHttpClientTesting(), provideAuthFake('admin'),
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap({ status: 'pendente', tipo: 'baixa' }) } } }
      ]
    });
    ctrl = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ImobOrdensServicoComponent);
    fixture.detectChanges();

    const req = ctrl.expectOne(r => r.url === URL);
    expect(req.request.params.get('status')).toBe('pendente');
    expect(req.request.params.get('tipo')).toBe('baixa');
    req.flush(pagina());
  });

  it('erro ao carregar mostra a mensagem', () => {
    TestBed.configureTestingModule({
      imports: [ImobOrdensServicoComponent],
      providers: [
        provideRouter([]), provideHttpClient(), provideHttpClientTesting(), provideAuthFake('admin'),
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap({}) } } }
      ]
    });
    ctrl = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ImobOrdensServicoComponent);
    fixture.detectChanges();

    ctrl.expectOne(r => r.url === URL).flush({ error: 'Sem acesso.' }, { status: 403, statusText: 'Forbidden' });
    fixture.detectChanges();

    expect(el().querySelector('[role=alert]')?.textContent).toContain('Sem acesso');
  });
});
