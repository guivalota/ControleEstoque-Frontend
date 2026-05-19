import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { tap, switchMap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { User, CreateUserRequest, UpdateUserRequest } from '../models/user.model';

@Injectable({ providedIn: 'root' })
export class UserService {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/users`;

  users = signal<User[]>([]);
  loading = signal(false);

  getAll() {
    this.loading.set(true);
    return this.http.get<User[]>(this.url).pipe(
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
