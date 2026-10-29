import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map, tap, switchMap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { User, CreateUserRequest, UpdateUserRequest, UpdateMyProfileRequest } from '../models/user.model';

interface PagedResult<T> { items: T[]; total: number; }
interface PagedResultCompleto<T> extends PagedResult<T> { page: number; pageSize: number; }

@Injectable({ providedIn: 'root' })
export class UserService {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/v1/users`;

  // TODO(E03): getAll/getById/create/update/delete e os signals abaixo são do painel do super administrador
  // (`GET v1/users` é só do SA, D-034). Usuários da empresa: use UsuarioEmpresaService. Ainda referenciados por
  // audit-logs e imob-empresa-usuarios (telas fora desta tarefa). Só `updateMe` é de uso geral.
  users = signal<User[]>([]);
  loading = signal(false);

  getAll() {
    this.loading.set(true);
    const params = new HttpParams().set('pageSize', 100);
    return this.http.get<PagedResult<User>>(this.url, { params }).pipe(
      map(res => res.items),
      tap(data => {
        this.users.set(data);
        this.loading.set(false);
      })
    );
  }

  /** Diretório de contas do super admin (GET v1/users): uma página, sem tocar nos signals. */
  listarPagina(page: number, pageSize: number) {
    const params = new HttpParams().set('page', page).set('pageSize', pageSize);
    return this.http.get<PagedResultCompleto<User>>(this.url, { params });
  }

  /** Cria uma conta (SA) sem tocar nos signals; o vínculo com a empresa é feito à parte (PlataformaVinculoService). */
  criarConta(req: CreateUserRequest) {
    return this.http.post<User>(this.url, req);
  }

  getById(id: string) {
    return this.http.get<User>(`${this.url}/${id}`);
  }

  create(req: CreateUserRequest) {
    return this.http.post<User>(this.url, req).pipe(
      switchMap(() => this.getAll())
    );
  }

  update(id: string, req: UpdateUserRequest) {
    return this.http.put<User>(`${this.url}/${id}`, req).pipe(
      switchMap(() => this.getAll())
    );
  }

  delete(id: string) {
    return this.http.delete<void>(`${this.url}/${id}`).pipe(
      tap(() => this.users.update(list => list.filter(u => u.id !== id)))
    );
  }

  updateMe(req: UpdateMyProfileRequest) {
    return this.http.put<void>(`${environment.apiUrl}/v1/users/me`, req);
  }
}
