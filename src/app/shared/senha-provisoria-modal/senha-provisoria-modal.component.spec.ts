import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Modal } from 'bootstrap';
import { SenhaProvisoriaModalComponent } from './senha-provisoria-modal.component';

describe('SenhaProvisoriaModalComponent', () => {
  let fixture: ComponentFixture<SenhaProvisoriaModalComponent>;
  let comp: SenhaProvisoriaModalComponent;
  const el = () => fixture.nativeElement as HTMLElement;

  beforeEach(() => {
    spyOn(Modal.prototype, 'show');
    TestBed.configureTestingModule({ imports: [SenhaProvisoriaModalComponent] });
    fixture = TestBed.createComponent(SenhaProvisoriaModalComponent);
    comp = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('mostra a senha com aviso de exibição única', () => {
    comp.abrir({ titulo: 'Senha redefinida', descricao: 'Para ana@acme.com', senha: 'Abc123!xyz' });
    fixture.detectChanges();
    expect((el().querySelector('#senhaProvCampo') as HTMLInputElement).value).toBe('Abc123!xyz');
    expect(el().textContent).toContain('Senha redefinida');
    expect(el().textContent).toContain('Para ana@acme.com');
    expect(el().textContent).toContain('somente agora');
    expect(Modal.prototype.show).toHaveBeenCalled();
  });

  it('descarta a senha ao fechar, emite fechado e não a traz de volta', () => {
    let fechados = 0;
    comp.fechado.subscribe(() => fechados++);
    comp.abrir({ titulo: 'T', senha: 'Abc123!xyz' });
    comp.aoFechar();
    fixture.detectChanges();
    expect(comp.senha()).toBeNull();
    expect(el().querySelector('#senhaProvCampo')).toBeNull();
    expect(el().textContent).not.toContain('Abc123!xyz');
    expect(fechados).toBe(1);
  });

  it('copia para a área de transferência', async () => {
    const escrever = jasmine.createSpy('writeText').and.resolveTo();
    spyOnProperty(navigator, 'clipboard', 'get').and.returnValue({ writeText: escrever } as unknown as Clipboard);
    await comp.copiar('Abc123!xyz');
    expect(escrever).toHaveBeenCalledWith('Abc123!xyz');
    expect(comp.copiada()).toBeTrue();
  });

  it('avisa quando a cópia falha', async () => {
    spyOnProperty(navigator, 'clipboard', 'get').and.returnValue({ writeText: () => Promise.reject(new Error('x')) } as unknown as Clipboard);
    await comp.copiar('x');
    expect(comp.copiada()).toBeFalse();
    expect(comp.erroCopia()).toContain('copie manualmente');
  });
});
