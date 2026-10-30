import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { EmpresaAtivaService } from './empresa-ativa.service';
import { ImobEmpresa } from '../models/imob-empresa.model';

const URL = '/api/v1/imobilizado/minhas-empresas';

const empresa = (id: number): ImobEmpresa => ({
  id, razaoSocial: `Empresa ${id} Ltda`, nomeFantasia: null, cnpj: '11222333000181', ativo: true, criadoEm: '2026-10-22T14:03:11Z'
});

describe('EmpresaAtivaService', () => {
  let service: EmpresaAtivaService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(EmpresaAtivaService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    localStorage.removeItem('imob.empresaBloqueadaId');
  });

  function carregar(lista: ImobEmpresa[]) {
    service.carregar().subscribe();
    http.expectOne(URL).flush(lista);
  }

  it('sem empresas: marca semAcesso e não seleciona nada', () => {
    carregar([]);
    expect(service.semAcesso()).toBeTrue();
    expect(service.id()).toBeNull();
  });

  it('com 1 empresa: seleciona automaticamente e não grava seleção em localStorage', () => {
    carregar([empresa(7)]);
    expect(service.id()).toBe(7);
    expect(service.ativa()?.id).toBe(7);
    expect(localStorage.getItem('imob.empresaId')).toBeNull();
  });

  it('dado legado com 2+ empresas: usa a primeira e não quebra', () => {
    carregar([empresa(1), empresa(2)]);
    expect(service.id()).toBe(1);
    expect(service.ativa()?.id).toBe(1);
    expect(service.semAcesso()).toBeFalse();
  });

  it('ignora e remove a antiga seleção salva em localStorage', () => {
    localStorage.setItem('imob.empresaId', '2');
    carregar([empresa(1), empresa(2)]);
    expect(service.id()).toBe(1);
    expect(localStorage.getItem('imob.empresaId')).toBeNull();
  });

  it('perdeuAcesso zera a empresa, avisa e recarrega a lista', () => {
    carregar([empresa(1)]);

    service.perdeuAcesso();
    expect(service.id()).toBeNull();
    expect(service.aviso()).toBe('Seu acesso a esta empresa foi alterado.');

    http.expectOne(URL).flush([empresa(2)]);
    expect(service.id()).toBe(2);
  });

  it('perdeuAcesso com lista vazia depois de recarregar cai em sem acesso', () => {
    carregar([empresa(1)]);
    service.perdeuAcesso();
    http.expectOne(URL).flush([]);
    expect(service.id()).toBeNull();
    expect(service.semAcesso()).toBeTrue();
  });

  it('perdeuAcesso com lista vazia mostra a tela sem acesso', () => {
    carregar([empresa(1)]);
    service.perdeuAcesso();
    http.expectOne(URL).flush([]);
    expect(service.semAcesso()).toBeTrue();
  });

  it('perdeuAcesso é ignorado enquanto a lista está sendo recarregada', () => {
    carregar([empresa(1)]);
    service.perdeuAcesso();
    service.perdeuAcesso();
    const pedidos = http.match(URL);
    expect(pedidos.length).toBe(1);
    pedidos[0].flush([empresa(2)]);
  });

  it('falha ao carregar: sinaliza erro sem mostrar "sem acesso"', () => {
    service.carregar().subscribe();
    http.expectOne(URL).flush('x', { status: 500, statusText: 'Server Error' });
    expect(service.erroCarregar()).toBeTrue();
    expect(service.semAcesso()).toBeFalse();
    expect(service.carregando()).toBeFalse();
  });
});

describe('EmpresaAtivaService (carga da sessao e modulos)', () => {
  let service: EmpresaAtivaService;
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.removeItem('imob.empresaBloqueadaId');
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(EmpresaAtivaService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    localStorage.removeItem('imob.empresaBloqueadaId');
  });

  const comModulos = (id: number, modulos?: string[]): ImobEmpresa => ({ ...empresa(id), modulos });

  function garantir(dono: string, lista?: ImobEmpresa[]) {
    service.garantirCarregada(dono).subscribe();
    if (lista) http.expectOne(URL).flush(lista);
  }

  it('0 empresas: sem acesso e sem modulos', () => {
    garantir('u1', []);
    expect(service.semAcesso()).toBeTrue();
    expect(service.id()).toBeNull();
    expect(service.modulos()).toEqual([]);
    expect(service.semModulos()).toBeFalse();
  });

  it('1 empresa: ativa sozinha', () => {
    garantir('u1', [comModulos(7, ['estoque'])]);
    expect(service.id()).toBe(7);
    expect(service.temModulo('estoque')).toBeTrue();
    expect(service.temModulo('imobilizado')).toBeFalse();
  });

  it('empresa ativa sem modulo algum: semModulos', () => {
    garantir('u1', [comModulos(1, [])]);
    expect(service.semModulos()).toBeTrue();
  });

  it('nao recarrega para o mesmo usuario, mas recarrega e zera ao trocar de usuario', () => {
    garantir('u1', [comModulos(1, ['estoque'])]);
    garantir('u1');
    http.expectNone(URL);
    garantir('u2');
    expect(service.id()).toBeNull();
    expect(service.carregado()).toBeFalse();
    http.expectOne(URL).flush([comModulos(9, ['estoque'])]);
    expect(service.id()).toBe(9);
  });

  it('rotaInicial segue os modulos e respeita o modulo excluido', () => {
    garantir('u1', [comModulos(1, ['estoque', 'imobilizado'])]);
    expect(service.rotaInicial()).toBe('/dashboard');
    expect(service.rotaInicial('estoque')).toBe('/imobilizado');
    expect(service.rotaInicial('imobilizado')).toBe('/dashboard');
  });

  it('sem modulos a pagina inicial segura e o cadastro Core', () => {
    garantir('u1', [comModulos(1, [])]);
    expect(service.rotaInicial()).toBe('/clientes');
  });

  it('F5 com empresa bloqueada: lista vazia + id guardado confirma o bloqueio com uma única sonda', () => {
    localStorage.setItem('imob.empresaBloqueadaId', '7');
    service.carregar().subscribe();
    http.expectOne(URL).flush([]);
    const sonda = http.expectOne('/api/v1/imobilizado/empresa-ativa');
    expect(sonda.request.headers.get('X-Empresa-Id')).toBe('7');
    sonda.flush({ error: 'Empresa bloqueada. Fale com o administrador.', codigo: 'empresa_bloqueada' }, { status: 403, statusText: 'Forbidden' });
    expect(service.semAcesso()).toBeTrue();
    expect(service.bloqueadaMsg()).toBe('Empresa bloqueada. Fale com o administrador.');
    expect(localStorage.getItem('imob.empresaBloqueadaId')).toBe('7');
  });

  it('lista vazia sem id guardado não faz sonda; sonda com outro 403 limpa o id e mantém a tela genérica', () => {
    service.carregar().subscribe(); http.expectOne(URL).flush([]);
    expect(service.bloqueadaMsg()).toBe('');
    localStorage.setItem('imob.empresaBloqueadaId', '7');
    service.carregar().subscribe();
    http.expectOne(URL).flush([]);
    http.expectOne('/api/v1/imobilizado/empresa-ativa').flush({ error: 'Sem acesso à empresa informada.' }, { status: 403, statusText: 'Forbidden' });
    expect(service.bloqueadaMsg()).toBe('');
    expect(localStorage.getItem('imob.empresaBloqueadaId')).toBeNull();
  });

  it('empresaBloqueada guarda a empresa para o F5 e a lista com empresas apaga o registro', () => {
    service.carregar().subscribe(); http.expectOne(URL).flush([empresa(3)]);
    service.empresaBloqueada('Empresa bloqueada. Fale com o administrador.');
    expect(localStorage.getItem('imob.empresaBloqueadaId')).toBe('3');
    service.carregar().subscribe(); http.expectOne(URL).flush([empresa(3)]);
    expect(localStorage.getItem('imob.empresaBloqueadaId')).toBeNull();
  });

  it('empresaBloqueada limpa a seleção, guarda a mensagem e a próxima carga bem-sucedida a apaga', () => {
    service.carregar().subscribe();
    http.expectOne(URL).flush([empresa(1)]);
    service.empresaBloqueada('Empresa bloqueada. Fale com o administrador.');
    expect(service.bloqueadaMsg()).toContain('bloqueada');
    expect(service.semAcesso()).toBeTrue();
    expect(service.id()).toBeNull();
    service.carregar().subscribe();
    http.expectOne(URL).flush([empresa(1)]);
    expect(service.bloqueadaMsg()).toBe('');
    expect(service.id()).toBe(1);
  });
});
