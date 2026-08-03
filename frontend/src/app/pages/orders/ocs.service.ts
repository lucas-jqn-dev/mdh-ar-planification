import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Oc, OcPayload } from '../../models/oc.model';

@Injectable({ providedIn: 'root' })
export class OcsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/master-data/ocs`;

  list(): Observable<Oc[]> {
    return this.http.get<Oc[]>(this.baseUrl);
  }

  create(payload: OcPayload): Observable<Oc> {
    return this.http.post<Oc>(this.baseUrl, payload);
  }

  update(id: string, payload: OcPayload): Observable<Oc> {
    return this.http.patch<Oc>(`${this.baseUrl}/${id}`, payload);
  }

  setCompletada(id: string, completada: boolean): Observable<Oc> {
    return this.http.patch<Oc>(`${this.baseUrl}/${id}/completada`, { completada });
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
