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
    localStorage.removeItem('imob.empresaId');
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(EmpresaAtivaService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    localStorage.removeItem('imob.empresaId');
  });

  function carregar(lista: ImobEmpresa[]) {
    service.carregar().subscribe();
    http.expectOne(URL).flush(lista);
  }

  it('sem empresas: marca semAcesso e não seleciona nada', () => {
    carregar([]);
    expect(service.semAcesso()).toBeTrue();
    expect(service.id()).toBeNull();
    expect(service.precisaEscolher()).toBeFalse();
  });

  it('com 1 empresa: seleciona automaticamente e persiste o id', () => {
    carregar([empresa(7)]);
    expect(service.id()).toBe(7);
    expect(service.precisaEscolher()).toBeFalse();
    expect(service.podeTrocar()).toBeFalse();
    expect(localStorage.getItem('imob.empresaId')).toBe('7');
  });

  it('com 2+ empresas e sem seleção salva: pede escolha', () => {
    carregar([empresa(1), empresa(2)]);
    expect(service.id()).toBeNull();
    expect(service.precisaEscolher()).toBeTrue();
    expect(service.seletorAberto()).toBeTrue();
  });

  it('com 2+ empresas: restaura a seleção salva quando ela está na lista', () => {
    localStorage.setItem('imob.empresaId', '2');
    carregar([empresa(1), empresa(2)]);
    expect(service.id()).toBe(2);
    expect(service.ativa()?.id).toBe(2);
  });

  it('descarta a seleção salva quando a empresa não está mais na lista', () => {
    localStorage.setItem('imob.empresaId', '9');
    carregar([empresa(1), empresa(2)]);
    expect(service.id()).toBeNull();
    expect(localStorage.getItem('imob.empresaId')).toBeNull();
  });

  it('ignora valor inválido no localStorage', () => {
    localStorage.setItem('imob.empresaId', 'abc');
    carregar([empresa(1), empresa(2)]);
    expect(service.id()).toBeNull();
  });

  it('selecionar persiste o id e ignora empresa fora da lista', () => {
    carregar([empresa(1), empresa(2)]);
    service.selecionar(99);
    expect(service.id()).toBeNull();
    service.selecionar(2);
    expect(service.id()).toBe(2);
    expect(localStorage.getItem('imob.empresaId')).toBe('2');
  });

  it('trocar só abre com 2+ empresas e pode ser cancelado', () => {
    carregar([empresa(1), empresa(2)]);
    service.selecionar(1);
    service.abrirTroca();
    expect(service.seletorAberto()).toBeTrue();
    service.cancelarTroca();
    expect(service.seletorAberto()).toBeFalse();
  });

  it('perdeuAcesso limpa a seleção, avisa e recarrega a lista', () => {
    carregar([empresa(1), empresa(2)]);
    service.selecionar(1);

    service.perdeuAcesso();
    expect(service.id()).toBeNull();
    expect(localStorage.getItem('imob.empresaId')).toBeNull();
    expect(service.aviso()).toBe('Seu acesso a esta empresa foi alterado.');

    http.expectOne(URL).flush([empresa(2)]);
    expect(service.id()).toBe(2);
  });

  it('perdeuAcesso com lista vazia mostra a tela sem acesso', () => {
    carregar([empresa(1)]);
    service.perdeuAcesso();
    http.expectOne(URL).flush([]);
    expect(service.semAcesso()).toBeTrue();
  });

  it('perdeuAcesso é ignorado enquanto a lista está sendo recarregada', () => {
    carregar([empresa(1), empresa(2)]);
    service.selecionar(1);
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
