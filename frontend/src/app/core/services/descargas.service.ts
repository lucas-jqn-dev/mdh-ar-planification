import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class DescargasService {
  private readonly http = inject(HttpClient);

  descargarSolicitudLiberacion(): Observable<Blob> {
    return this.http.get(`${environment.apiUrl}/descargas/solicitud-liberacion`, {
      responseType: 'blob',
    });
  }
}
