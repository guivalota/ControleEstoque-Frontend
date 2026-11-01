import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { Modal } from 'bootstrap';
import { ImobRenovacaoEtiquetasComponent } from './imob-renovacao-etiquetas.component';
import { provideAuthFake } from '../../../testing/auth-fake';

const BASE = '/api/v1/imobilizado/bens';

describe('ImobRenovacaoEtiquetasComponent', () => {
  let fixture: ComponentFixture<ImobRenovacaoEtiquetasComponent>;
  let comp: ImobRenovacaoEtiquetasComponent;
  let ctrl: HttpTestingController;
  const el = () => fixture.nativeElement as HTMLElement;
  const texto = () => (el().textContent ?? '').replace(/\s+/g, ' ');

  function montar(role: 'admin' | 'operador' | 'leitura', oculto = false) {
    TestBed.configureTestingModule({
      imports: [ImobRenovacaoEtiquetasComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), provideAuthFake(role)]
    });
    ctrl = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ImobRenovacaoEtiquetasComponent);
    comp = fixture.componentInstance;
    fixture.detectChanges();
    ctrl.expectOne(`${BASE}/codigo-anterior`).flush({ oculto, bensComCodigoAnterior: 3 });
    fixture.detectChanges();
  }

  beforeEach(() => {
    // o diálogo de confirmação resolve na hora (sem animação do Bootstrap)
    spyOn(Modal.prototype, 'show').and.callFake(function (this: Modal) { return this; });
    spyOn(Modal.prototype, 'hide').and.stub();
  });

  afterEach(() => ctrl.verify());

  const colar = (t: string) => { comp.texto.setValue(t); fixture.detectChanges(); };
  const confirmar = () => {
    const dlg = (comp as unknown as { confirmDialog: () => { resolver?: (ok: boolean) => void } }).confirmDialog();
    dlg.resolver?.(true);
  };

  it('operador vê o estado da virada, mas não as ações de admin', () => {
    montar('operador');
    expect(texto()).toContain('3 bens com código anterior');
    expect(texto()).not.toContain('Aplicar de-para');
    expect(texto()).not.toContain('Ocultar códigos antigos');
    expect(texto()).toContain('Apenas administradores');
  });

  it('admin: prévia bloqueia o envio quando há erro', () => {
    montar('admin');
    colar('antiga;nova\n1;A\n1;B');
    expect(texto()).toContain('repetido no arquivo');
    expect(comp.podeEnviar()).toBeFalse();
  });

  it('admin: envia o de-para e mostra o resultado', async () => {
    montar('admin');
    colar('1001;A-0001\n1002;A-0002\n1003;A-0003');
    expect(comp.podeEnviar()).toBeTrue();
    const p = comp.enviar();
    confirmar();
    await p;
    const req = ctrl.expectOne(`${BASE}/de-para`);
    expect(req.request.body).toEqual({ itens: [
      { antiga: '1001', nova: 'A-0001' }, { antiga: '1002', nova: 'A-0002' }, { antiga: '1003', nova: 'A-0003' }
    ] });
    req.flush({ aplicados: 3, ignorados: 0 });
    ctrl.expectOne(`${BASE}/codigo-anterior`).flush({ oculto: false, bensComCodigoAnterior: 3 });
    fixture.detectChanges();
    expect(texto()).toContain('3 bens atualizados');
    expect(texto()).toContain('0 já estavam aplicados');
  });

  it('admin: 400 mostra a mensagem, diz que nada foi gravado e orienta no caso de inventário', async () => {
    montar('admin');
    colar('1001;A-0001');
    const p = comp.enviar();
    confirmar();
    await p;
    ctrl.expectOne(`${BASE}/de-para`).flush({ error: 'Há inventário em andamento nesta empresa.' }, { status: 400, statusText: 'Bad Request' });
    fixture.detectChanges();
    expect(texto()).toContain('Há inventário em andamento');
    expect(texto()).toContain('Nada foi gravado');
    expect(texto()).toContain('Ir para os inventários');
  });

  it('admin: virada exige confirmação e atualiza o estado', async () => {
    montar('admin');
    const p = comp.alternarVirada();
    confirmar();
    await p;
    const req = ctrl.expectOne(`${BASE}/codigo-anterior`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ oculto: true });
    req.flush({ oculto: true, bensComCodigoAnterior: 3 });
    fixture.detectChanges();
    expect(texto()).toContain('Voltar a exibir');
  });

  it('mais de 5000 pares bloqueia o envio com aviso', () => {
    montar('admin');
    colar(Array.from({ length: 5001 }, (_, i) => `${i};N${i}`).join('\n'));
    expect(comp.podeEnviar()).toBeFalse();
    expect(texto()).toContain('Divida o arquivo');
  });
});
