import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { PerfilSap, PerfilSapPayload } from '../../../models/perfil-sap.model';

@Injectable({ providedIn: 'root' })
export class PerfilesSapService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/master-data/perfiles-sap`;

  list(): Observable<PerfilSap[]> {
    return this.http.get<PerfilSap[]>(this.baseUrl);
  }

  create(payload: PerfilSapPayload): Observable<PerfilSap> {
    return this.http.post<PerfilSap>(this.baseUrl, payload);
  }

  update(id: string, payload: PerfilSapPayload): Observable<PerfilSap> {
    return this.http.patch<PerfilSap>(`${this.baseUrl}/${id}`, payload);
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
