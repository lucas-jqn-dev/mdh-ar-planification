import { Component, inject, signal } from '@angular/core';
import { MatTableModule } from '@angular/material/table';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Recepcion } from '../../models/recepcion.model';
import { formatMesAnio } from '../../models/oc.model';
import { injectIsHandset } from '../../core/utils/breakpoint.util';
import { RecepcionesService } from './recepciones.service';
import {
  RecepcionDialogResult,
  RecepcionFormDialog,
  RecepcionFormDialogData,
} from './recepcion-form-dialog/recepcion-form-dialog';

const LOAD_ERROR_MESSAGE = 'No pudimos cargar las recepciones. Intenta nuevamente.';
const SNACKBAR_DURATION_MS = 4000;

@Component({
  selector: 'app-order-recepcions',
  standalone: true,
  imports: [
    MatTableModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './order-recepcions.html',
  styleUrl: './order-recepcions.scss',
})
export class OrderRecepcions {
  private readonly recepcionesService = inject(RecepcionesService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  readonly isHandset = injectIsHandset();
  readonly formatMesAnio = formatMesAnio;
  readonly displayedColumns = [
    'solped',
    'posicion',
    'numeroOc',
    'consultor',
    'pep',
    'mes',
    'horas',
    'documento103',
    'acciones',
  ];

  readonly recepciones = signal<Recepcion[]>([]);
  readonly loading = signal(true);
  readonly errorMessage = signal<string | null>(null);

  constructor() {
    this.loadRecepciones();
  }

  openCreateDialog(): void {
    this.openDialog(null);
  }

  openEditDialog(recepcion: Recepcion): void {
    this.openDialog(recepcion);
  }

  private openDialog(recepcion: Recepcion | null): void {
    const dialogRef = this.dialog.open<
      RecepcionFormDialog,
      RecepcionFormDialogData,
      RecepcionDialogResult
    >(RecepcionFormDialog, {
      width: 'min(600px, 94vw)',
      data: { recepcion },
      autoFocus: 'first-tabbable',
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.applyDialogResult(result);
      }
    });
  }

  private applyDialogResult(result: RecepcionDialogResult): void {
    switch (result.action) {
      case 'created':
        this.recepciones.update((items) => [result.recepcion, ...items]);
        this.snackBar.open('Recepción creada', 'Cerrar', { duration: SNACKBAR_DURATION_MS });
        break;
      case 'updated':
        this.recepciones.update((items) =>
          items.map((item) => (item.id === result.recepcion.id ? result.recepcion : item)),
        );
        this.snackBar.open('Recepción actualizada', 'Cerrar', { duration: SNACKBAR_DURATION_MS });
        break;
      case 'deleted':
        this.recepciones.update((items) => items.filter((item) => item.id !== result.id));
        this.snackBar.open('Recepción eliminada', 'Cerrar', { duration: SNACKBAR_DURATION_MS });
        break;
    }
  }

  private loadRecepciones(): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    this.recepcionesService.list().subscribe({
      next: (recepciones) => {
        this.recepciones.set(recepciones);
        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set(LOAD_ERROR_MESSAGE);
        this.loading.set(false);
      },
    });
  }
}
