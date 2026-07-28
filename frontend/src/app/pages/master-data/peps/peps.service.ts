import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { Pep, PepPayload } from '../../../models/pep.model';

@Injectable({ providedIn: 'root' })
export class PepsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/master-data/peps`;

  list(): Observable<Pep[]> {
    return this.http.get<Pep[]>(this.baseUrl);
  }

  create(payload: PepPayload): Observable<Pep> {
    return this.http.post<Pep>(this.baseUrl, payload);
  }

  update(id: string, payload: PepPayload): Observable<Pep> {
    return this.http.patch<Pep>(`${this.baseUrl}/${id}`, payload);
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
