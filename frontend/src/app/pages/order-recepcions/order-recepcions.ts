import { Component, computed, inject, signal } from '@angular/core';
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

/** Fila separadora de grupo (una por Mes recepcionado distinto) — mismo patrón que OcGroupRow en ocs-panel.ts. */
export interface RecepcionGroupRow {
  kind: 'group';
  label: string;
}

export type RecepcionDisplayRow = RecepcionGroupRow | Recepcion;

export function isGroupRow(row: RecepcionDisplayRow): row is RecepcionGroupRow {
  return (row as RecepcionGroupRow).kind === 'group';
}

/**
 * Orden cronológico por `mes` ("YYYY-MM", comparable como string) y, dentro
 * del mismo mes, por SolPed+Posición de la OC asociada — mismo desempate
 * que usa `compareOcs()` en ocs-panel.ts. `oc` puede ser `null` (OC
 * eliminada luego de crear la recepción, sin integridad referencial), en
 * cuyo caso el desempate cae al final.
 */
function sortRecepciones(items: Recepcion[]): Recepcion[] {
  return [...items].sort(
    (a, b) =>
      a.mes.localeCompare(b.mes) ||
      (a.oc?.solped ?? '').localeCompare(b.oc?.solped ?? '') ||
      (a.oc?.posicion ?? 0) - (b.oc?.posicion ?? 0),
  );
}

@Component({
  selector: 'app-order-recepcions',
  standalone: true,
  imports: [MatCardModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule],
  templateUrl: './order-recepcions.html',
  styleUrl: './order-recepcions.scss',
})
export class OrderRecepcions {
  private readonly recepcionesService = inject(RecepcionesService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  readonly isHandset = injectIsHandset();
  readonly formatMesAnio = formatMesAnio;
  readonly isGroupRow = isGroupRow;
  readonly columnCount = 9;

  readonly recepciones = signal<Recepcion[]>([]);
  readonly loading = signal(true);
  readonly errorMessage = signal<string | null>(null);

  /**
   * Filas a renderizar en la tabla desktop: siempre agrupadas por Mes
   * recepcionado (la lista ya viene ordenada por ese campo), una fila
   * separadora por cada valor distinto — mismo patrón que `displayRows` en
   * ocs-panel.ts.
   */
  readonly displayRows = computed<RecepcionDisplayRow[]>(() => {
    const items = this.recepciones();
    const rows: RecepcionDisplayRow[] = [];
    let lastValue: string | null = null;
    for (const recepcion of items) {
      if (recepcion.mes !== lastValue) {
        rows.push({ kind: 'group', label: `Mes recepcionado ${formatMesAnio(recepcion.mes)}` });
        lastValue = recepcion.mes;
      }
      rows.push(recepcion);
    }
    return rows;
  });

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
        this.recepciones.update((items) => sortRecepciones([result.recepcion, ...items]));
        this.snackBar.open('Recepción creada', 'Cerrar', { duration: SNACKBAR_DURATION_MS });
        break;
      case 'updated':
        this.recepciones.update((items) =>
          sortRecepciones(
            items.map((item) => (item.id === result.recepcion.id ? result.recepcion : item)),
          ),
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
        this.recepciones.set(sortRecepciones(recepciones));
        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set(LOAD_ERROR_MESSAGE);
        this.loading.set(false);
      },
    });
  }
}
