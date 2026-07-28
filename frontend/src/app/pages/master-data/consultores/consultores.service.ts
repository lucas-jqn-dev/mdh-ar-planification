import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { Consultor, ConsultorPayload } from '../../../models/consultor.model';

@Injectable({ providedIn: 'root' })
export class ConsultoresService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/master-data/consultores`;

  list(): Observable<Consultor[]> {
    return this.http.get<Consultor[]>(this.baseUrl);
  }

  create(payload: ConsultorPayload): Observable<Consultor> {
    return this.http.post<Consultor>(this.baseUrl, payload);
  }

  update(id: string, payload: ConsultorPayload): Observable<Consultor> {
    return this.http.patch<Consultor>(`${this.baseUrl}/${id}`, payload);
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
