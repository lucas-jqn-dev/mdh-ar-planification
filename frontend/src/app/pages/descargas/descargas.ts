import { Component, inject, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DescargasService } from '../../core/services/descargas.service';
import { downloadBlob } from '../../core/utils/download.util';

const SNACKBAR_DURATION_MS = 4000;
const DESCARGA_ERROR_MESSAGE = 'No pudimos generar el archivo. Intenta nuevamente en unos minutos.';

interface DescargaItem {
  key: string;
  titulo: string;
  descripcion: string;
  icon: string;
  // Debe coincidir con SOLICITUD_LIBERACION_FILE_NAME (backend/src/descargas/solicitud-liberacion.workbook.ts).
  nombreArchivo: string;
  descargar: () => Observable<Blob>;
}

@Component({
  selector: 'app-descargas',
  standalone: true,
  imports: [MatCardModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule],
  templateUrl: './descargas.html',
  styleUrl: './descargas.scss',
})
export class Descargas {
  private readonly descargasService = inject(DescargasService);
  private readonly snackBar = inject(MatSnackBar);

  readonly descargando = signal<string | null>(null);

  readonly items: DescargaItem[] = [
    {
      key: 'solicitud-liberacion',
      titulo: 'Archivo p/solicitar Liberación',
      descripcion:
        'Archivo con las Solpeds cargadas sin OC que están pendientes de ser liberadas por gerencia',
      icon: 'lock_open',
      nombreArchivo: 'Solicitud Liberacion Solpeds - Equipo MDH AR.xlsx',
      descargar: () => this.descargasService.descargarSolicitudLiberacion(),
    },
  ];

  descargar(item: DescargaItem): void {
    if (this.descargando()) {
      return;
    }

    this.descargando.set(item.key);

    item.descargar().subscribe({
      next: (blob) => {
        this.descargando.set(null);
        downloadBlob(blob, item.nombreArchivo);
      },
      error: () => {
        this.descargando.set(null);
        this.snackBar.open(DESCARGA_ERROR_MESSAGE, 'Cerrar', { duration: SNACKBAR_DURATION_MS });
      },
    });
  }
}
