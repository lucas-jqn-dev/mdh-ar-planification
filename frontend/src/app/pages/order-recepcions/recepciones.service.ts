import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Recepcion, RecepcionPayload } from '../../models/recepcion.model';

@Injectable({ providedIn: 'root' })
export class RecepcionesService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/recepciones`;

  list(): Observable<Recepcion[]> {
    return this.http.get<Recepcion[]>(this.baseUrl);
  }

  create(payload: RecepcionPayload): Observable<Recepcion> {
    return this.http.post<Recepcion>(this.baseUrl, payload);
  }

  update(id: string, payload: RecepcionPayload): Observable<Recepcion> {
    return this.http.patch<Recepcion>(`${this.baseUrl}/${id}`, payload);
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
