import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map, tap, switchMap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { User, CreateUserRequest, UpdateUserRequest } from '../models/user.model';

interface PagedResult<T> { items: T[]; total: number; }

@Injectable({ providedIn: 'root' })
export class UserService {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/v1/users`;

  users = signal<User[]>([]);
  loading = signal(false);

  getAll() {
    this.loading.set(true);
    const params = new HttpParams().set('pageSize', 1000);
    return this.http.get<PagedResult<User>>(this.url, { params }).pipe(
      map(res => res.items),
      tap(data => {
        this.users.set(data);
        this.loading.set(false);
      })
    );
  }

  getById(id: number) {
    return this.http.get<User>(`${this.url}/${id}`);
  }

  create(req: CreateUserRequest) {
    return this.http.post<User>(this.url, req).pipe(
      switchMap(() => this.getAll())
    );
  }

  update(id: number, req: UpdateUserRequest) {
    return this.http.put<User>(`${this.url}/${id}`, req).pipe(
      switchMap(() => this.getAll())
    );
  }

  delete(id: number) {
    return this.http.delete<void>(`${this.url}/${id}`).pipe(
      tap(() => this.users.update(list => list.filter(u => u.id !== id)))
    );
  }
}
