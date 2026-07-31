import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class DescargasService {
  private readonly http = inject(HttpClient);

  /** `body === null` (204) cuando el backend no tiene nada para exportar — ver `Descargas.descargar()`. */
  descargarSolicitudLiberacion(): Observable<HttpResponse<Blob>> {
    return this.http.get(`${environment.apiUrl}/descargas/solicitud-liberacion`, {
      responseType: 'blob',
      observe: 'response',
    });
  }
}
