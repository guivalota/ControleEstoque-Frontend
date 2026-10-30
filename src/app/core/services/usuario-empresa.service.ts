import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, expand, map, reduce, EMPTY } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PagedResult } from '../models/paged-result.model';
import { FiltroUsuariosEmpresa, UsuarioEmpresa } from '../models/usuario-empresa.model';
import { montarParams } from '../utils/http-params';

/** Máximo aceito pelo servidor. */
export const USUARIOS_EMPRESA_PAGE_SIZE_MAX = 100;
/** Trava de segurança ao paginar tudo (20 páginas x 100). */
const MAX_PAGINAS = 20;

/** Usuários da empresa ativa (exige X-Empresa-Id, enviado pelo empresaInterceptor). Stateless. */
@Injectable({ providedIn: 'root' })
export class UsuarioEmpresaService {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/v1/empresa-ativa/usuarios`;

  listar(filtro: FiltroUsuariosEmpresa = {}): Observable<PagedResult<UsuarioEmpresa>> {
    const pageSize = Math.min(filtro.pageSize ?? USUARIOS_EMPRESA_PAGE_SIZE_MAX, USUARIOS_EMPRESA_PAGE_SIZE_MAX);
    return this.http.get<PagedResult<UsuarioEmpresa>>(this.url, {
      params: montarParams({ ...filtro, busca: filtro.busca?.trim(), pageSize })
    });
  }

  /** Para seletores: percorre as páginas (100 por vez) e devolve todos os usuários que atendem ao filtro. */
  listarTodos(filtro: Omit<FiltroUsuariosEmpresa, 'page' | 'pageSize'> = {}): Observable<UsuarioEmpresa[]> {
    return this.listar({ ...filtro, page: 1 }).pipe(
      expand(res => res.page < MAX_PAGINAS && res.page * res.pageSize < res.total
        ? this.listar({ ...filtro, page: res.page + 1 })
        : EMPTY),
      map(res => res.items),
      reduce((acc, items) => [...acc, ...items], [] as UsuarioEmpresa[])
    );
  }
}
