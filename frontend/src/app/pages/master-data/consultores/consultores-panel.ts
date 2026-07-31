import { Component, computed, inject, signal } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Consultor } from '../../../models/consultor.model';
import { injectIsHandset } from '../../../core/utils/breakpoint.util';
import { range } from '../../../core/utils/range.util';
import { Skeleton } from '../../../shared/skeleton/skeleton';
import { ConsultoresService } from './consultores.service';
import {
  ConsultorDialogResult,
  ConsultorFormDialog,
  ConsultorFormDialogData,
} from './consultor-form-dialog/consultor-form-dialog';

const LOAD_ERROR_MESSAGE = 'No pudimos cargar los consultores. Intenta nuevamente.';
const SNACKBAR_DURATION_MS = 4000;

/** Fila separadora de grupo (una por Responsable distinto) — mismo patrón que OcGroupRow en ocs-panel.ts. */
export interface ConsultorGroupRow {
  kind: 'group';
  label: string;
}

export type ConsultorDisplayRow = ConsultorGroupRow | Consultor;

export function isGroupRow(row: ConsultorDisplayRow): row is ConsultorGroupRow {
  return (row as ConsultorGroupRow).kind === 'group';
}

function sortConsultores(items: Consultor[]): Consultor[] {
  return [...items].sort(
    (a, b) => a.responsable.localeCompare(b.responsable) || a.nombre.localeCompare(b.nombre),
  );
}

@Component({
  selector: 'app-consultores-panel',
  standalone: true,
  imports: [MatCardModule, MatButtonModule, MatIconModule, Skeleton],
  templateUrl: './consultores-panel.html',
  styleUrl: './consultores-panel.scss',
})
export class ConsultoresPanel {
  private readonly consultoresService = inject(ConsultoresService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  readonly isHandset = injectIsHandset();
  readonly isGroupRow = isGroupRow;
  readonly columnCount = 6;
  readonly skeletonRows = range(6);
  readonly skeletonCards = range(3);
  readonly skeletonColumns = range(this.columnCount);

  readonly consultores = signal<Consultor[]>([]);
  readonly loading = signal(true);
  readonly errorMessage = signal<string | null>(null);

  /** Leído por master-data.html para el mat-panel-description del acordeón. */
  readonly summary = computed(() => {
    if (this.loading() || this.errorMessage()) {
      return '';
    }
    const count = this.consultores().length;
    return `${count} registrado${count === 1 ? '' : 's'}`;
  });

  /**
   * Filas a renderizar en la tabla desktop: siempre agrupadas por
   * Responsable (la lista ya viene ordenada por ese campo), una fila
   * separadora por cada valor distinto — mismo patrón que `displayRows` en
   * ocs-panel.ts.
   */
  readonly displayRows = computed<ConsultorDisplayRow[]>(() => {
    const items = this.consultores();
    const rows: ConsultorDisplayRow[] = [];
    let lastValue: string | null = null;
    for (const consultor of items) {
      if (consultor.responsable !== lastValue) {
        rows.push({ kind: 'group', label: `Responsable ${consultor.responsable}` });
        lastValue = consultor.responsable;
      }
      rows.push(consultor);
    }
    return rows;
  });

  constructor() {
    this.loadConsultores();
  }

  openCreateDialog(): void {
    this.openDialog(null);
  }

  openEditDialog(consultor: Consultor): void {
    this.openDialog(consultor);
  }

  private openDialog(consultor: Consultor | null): void {
    const dialogRef = this.dialog.open<
      ConsultorFormDialog,
      ConsultorFormDialogData,
      ConsultorDialogResult
    >(ConsultorFormDialog, {
      width: 'min(480px, 92vw)',
      data: { consultor },
      autoFocus: 'first-tabbable',
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.applyDialogResult(result);
      }
    });
  }

  private applyDialogResult(result: ConsultorDialogResult): void {
    switch (result.action) {
      case 'created':
        this.consultores.update((items) => sortConsultores([...items, result.consultor]));
        this.snackBar.open('Consultor creado', 'Cerrar', { duration: SNACKBAR_DURATION_MS });
        break;
      case 'updated':
        this.consultores.update((items) =>
          sortConsultores(
            items.map((item) => (item.id === result.consultor.id ? result.consultor : item)),
          ),
        );
        this.snackBar.open('Consultor actualizado', 'Cerrar', { duration: SNACKBAR_DURATION_MS });
        break;
      case 'deleted':
        this.consultores.update((items) => items.filter((item) => item.id !== result.id));
        this.snackBar.open('Consultor eliminado', 'Cerrar', { duration: SNACKBAR_DURATION_MS });
        break;
    }
  }

  private loadConsultores(): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    this.consultoresService.list().subscribe({
      next: (consultores) => {
        this.consultores.set(sortConsultores(consultores));
        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set(LOAD_ERROR_MESSAGE);
        this.loading.set(false);
      },
    });
  }
}
