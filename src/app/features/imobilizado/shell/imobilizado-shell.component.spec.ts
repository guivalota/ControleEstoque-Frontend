import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { ImobilizadoShellComponent } from './imobilizado-shell.component';
import { AuthService } from '../../../core/services/auth.service';
import { EmpresaAtivaService } from '../../../core/services/empresa-ativa.service';
import { ImobEmpresa } from '../../../core/models/imob-empresa.model';

const empresa = (id: number, nomeFantasia: string | null = null): ImobEmpresa => ({
  id, razaoSocial: `Empresa ${id} Ltda`, nomeFantasia, cnpj: '11222333000181', ativo: true, criadoEm: '2026-10-22T14:03:11Z'
});

describe('ImobilizadoShellComponent', () => {
  let fixture: ComponentFixture<ImobilizadoShellComponent>;
  let svc: EmpresaAtivaService;
  const texto = () => (fixture.nativeElement as HTMLElement).textContent ?? '';

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ImobilizadoShellComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()]
    });
    fixture = TestBed.createComponent(ImobilizadoShellComponent);
    svc = TestBed.inject(EmpresaAtivaService);
  });

  function estado(lista: ImobEmpresa[], id: number | null) {
    svc.empresas.set(lista);
    svc.id.set(id);
    svc.carregado.set(true);
    fixture.detectChanges();
  }

  it('sem empresas mostra a tela de sem acesso', () => {
    estado([], null);
    expect(texto()).toContain('Você ainda não tem acesso a nenhuma empresa');
  });

  it('mostra a empresa ativa com CNPJ formatado e o botão Trocar com 2+ empresas', () => {
    estado([empresa(1, 'Alfa'), empresa(2)], 1);
    expect(texto()).toContain('Alfa');
    expect(texto()).toContain('11.222.333/0001-81');
    expect(texto()).toContain('Trocar');
  });

  it('com 1 empresa não oferece Trocar', () => {
    estado([empresa(1)], 1);
    expect(texto()).not.toContain('Trocar');
  });

  it('exibe o aviso de acesso alterado', () => {
    estado([empresa(1)], 1);
    svc.aviso.set('Seu acesso a esta empresa foi alterado.');
    fixture.detectChanges();
    expect(texto()).toContain('Seu acesso a esta empresa foi alterado.');
  });

  it('exibe erro com opção de tentar novamente quando falha ao carregar', () => {
    svc.erroCarregar.set(true);
    fixture.detectChanges();
    expect(texto()).toContain('Não foi possível carregar suas empresas');
    expect(texto()).toContain('Tentar novamente');
  });
});

describe('ImobilizadoShellComponent — papéis e administração', () => {
  function criar(role: string) {
    TestBed.configureTestingModule({
      imports: [ImobilizadoShellComponent],
      providers: [
        provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
        { provide: AuthService, useValue: { currentUser: signal({ role }) } }
      ]
    });
    const fixture = TestBed.createComponent(ImobilizadoShellComponent);
    const svc = TestBed.inject(EmpresaAtivaService);
    return { fixture, svc, texto: () => (fixture.nativeElement as HTMLElement).textContent ?? '' };
  }

  it('admin vê o link Empresas', () => {
    const { fixture, svc, texto } = criar('admin');
    svc.empresas.set([empresa(1)]);
    svc.id.set(1);
    svc.carregado.set(true);
    fixture.detectChanges();
    expect(texto()).toContain('Empresas');
  });

  for (const role of ['operador', 'leitura']) {
    it(`${role} não vê o link Empresas nem o atalho de administração`, () => {
      const { fixture, svc, texto } = criar(role);
      svc.carregado.set(true);
      fixture.detectChanges();
      expect(texto()).toContain('Você ainda não tem acesso');
      expect(texto()).not.toContain('Administrar empresas');
      expect(texto()).not.toContain('Empresas');
    });
  }

  it('admin sem empresas vê o atalho para administrar empresas', () => {
    const { fixture, svc, texto } = criar('admin');
    svc.carregado.set(true);
    fixture.detectChanges();
    expect(texto()).toContain('Administrar empresas');
  });

  it('em tela de administração não mostra "sem acesso" e não abre o seletor obrigatório', () => {
    const { fixture, svc, texto } = criar('admin');
    svc.empresas.set([empresa(1), empresa(2)]);
    svc.carregado.set(true);
    expect(svc.seletorAberto()).toBeTrue();
    svc.emAdministracao.set(true);
    fixture.detectChanges();
    expect(svc.seletorAberto()).toBeFalse();

    svc.empresas.set([]);
    fixture.detectChanges();
    expect(texto()).not.toContain('Você ainda não tem acesso');
  });
});
