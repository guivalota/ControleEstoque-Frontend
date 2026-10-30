import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { UsuarioEmpresaService } from './usuario-empresa.service';
import { UsuarioEmpresa } from '../models/usuario-empresa.model';
import { PagedResult } from '../models/paged-result.model';

const URL = '/api/v1/empresa-ativa/usuarios';
const u = (id: string, ativo = true): UsuarioEmpresa =>
  ({ id, nome: `Nome ${id}`, email: `${id}@x.com`, perfil: 'leitura', perfilEfetivo: 'admin', ativo });

describe('UsuarioEmpresaService', () => {
  let service: UsuarioEmpresaService;
  let ctrl: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(UsuarioEmpresaService);
    ctrl = TestBed.inject(HttpTestingController);
  });
  afterEach(() => ctrl.verify());

  it('envia busca, ativo, page e pageSize em camelCase e omite o que não foi definido', () => {
    let res: PagedResult<UsuarioEmpresa> | undefined;
    service.listar({ busca: ' ana ', ativo: true, page: 2, pageSize: 20 }).subscribe(r => (res = r));
    const req = ctrl.expectOne(r => r.url === URL);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('busca')).toBe('ana');
    expect(req.request.params.get('ativo')).toBe('true');
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('pageSize')).toBe('20');
    req.flush({ items: [u('a')], page: 2, pageSize: 20, total: 21 });
    expect(res!.items[0].perfilEfetivo).toBe('admin');
    expect(res!.total).toBe(21);
  });

  it('ativo=false é enviado; sem filtros só vai pageSize 100', () => {
    service.listar({ ativo: false }).subscribe();
    const a = ctrl.expectOne(r => r.url === URL);
    expect(a.request.params.get('ativo')).toBe('false');
    a.flush({ items: [], page: 1, pageSize: 100, total: 0 });

    service.listar().subscribe();
    const b = ctrl.expectOne(r => r.url === URL);
    expect(b.request.params.keys().sort()).toEqual(['pageSize']);
    b.flush({ items: [], page: 1, pageSize: 100, total: 0 });
  });

  it('nunca pede mais de 100 por página', () => {
    service.listar({ pageSize: 1000 }).subscribe();
    const req = ctrl.expectOne(r => r.url === URL);
    expect(req.request.params.get('pageSize')).toBe('100');
    req.flush({ items: [], page: 1, pageSize: 100, total: 0 });
  });

  it('listarTodos percorre as páginas e junta os itens', () => {
    let todos: UsuarioEmpresa[] = [];
    service.listarTodos({ ativo: true }).subscribe(r => (todos = r));
    const p1 = ctrl.expectOne(r => r.url === URL && r.params.get('page') === '1');
    expect(p1.request.params.get('ativo')).toBe('true');
    expect(p1.request.params.get('pageSize')).toBe('100');
    p1.flush({ items: [u('1'), u('2')], page: 1, pageSize: 2, total: 3 });
    const p2 = ctrl.expectOne(r => r.url === URL && r.params.get('page') === '2');
    p2.flush({ items: [u('3')], page: 2, pageSize: 2, total: 3 });
    expect(todos.map(x => x.id)).toEqual(['1', '2', '3']);
  });
});
