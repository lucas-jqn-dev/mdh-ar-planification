import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatRadioModule } from '@angular/material/radio';
import { MatSlideToggleModule, MatSlideToggleChange } from '@angular/material/slide-toggle';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Oc, formatMesAnio } from '../../../models/oc.model';
import { formatMonto } from '../../../core/utils/format.util';
import { injectIsHandset } from '../../../core/utils/breakpoint.util';
import { OcsService } from './ocs.service';
import { OcDialogResult, OcFormDialog, OcFormDialogData } from './oc-form-dialog/oc-form-dialog';

const LOAD_ERROR_MESSAGE = 'No pudimos cargar las OC. Intenta nuevamente.';
const COMPLETADA_ERROR_MESSAGE = 'No pudimos actualizar el estado. Intenta nuevamente.';
const SNACKBAR_DURATION_MS = 4000;

export type SortKey = 'solped' | 'numeroOc' | 'consultor' | 'proveedor' | 'responsable';

export const SORT_OPTIONS: readonly { value: SortKey; label: string }[] = [
  { value: 'solped', label: 'SolPed' },
  { value: 'numeroOc', label: 'Número OC' },
  { value: 'consultor', label: 'Consultor' },
  { value: 'proveedor', label: 'Proveedor' },
  { value: 'responsable', label: 'Responsable' },
];

export interface OcGroupRow {
  kind: 'group';
  solped: string;
}

export type OcDisplayRow = OcGroupRow | Oc;

export function isGroupRow(row: OcDisplayRow): row is OcGroupRow {
  return (row as OcGroupRow).kind === 'group';
}

function sortOcs(items: Oc[]): Oc[] {
  return [...items].sort((a, b) => a.solped.localeCompare(b.solped) || a.posicion - b.posicion);
}

/** Empate se resuelve por SolPed+Posición, para que el orden no "salte" entre recargas. */
function compareOcs(a: Oc, b: Oc, key: SortKey): number {
  const tiebreak = () => a.solped.localeCompare(b.solped) || a.posicion - b.posicion;
  switch (key) {
    case 'solped':
      return tiebreak();
    case 'numeroOc':
      return (a.numeroOc || '').localeCompare(b.numeroOc || '') || tiebreak();
    case 'consultor':
      return (a.consultor?.nombre || '').localeCompare(b.consultor?.nombre || '') || tiebreak();
    case 'proveedor':
      return (a.consultor?.proveedor || '').localeCompare(b.consultor?.proveedor || '') || tiebreak();
    case 'responsable':
      return (
        (a.consultor?.responsable || '').localeCompare(b.consultor?.responsable || '') || tiebreak()
      );
  }
}

function totalPosicion(oc: Oc): number | null {
  const tarifa = oc.consultor?.perfilSap?.tarifaHora;
  return tarifa != null ? tarifa * oc.cantidadHoras : null;
}

@Component({
  selector: 'app-ocs-panel',
  standalone: true,
  imports: [
    FormsModule,
    MatTableModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatRadioModule,
    MatSlideToggleModule,
  ],
  templateUrl: './ocs-panel.html',
  styleUrl: './ocs-panel.scss',
})
export class OcsPanel {
  private readonly ocsService = inject(OcsService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  readonly isHandset = injectIsHandset();
  readonly formatMonto = formatMonto;
  readonly formatMesAnio = formatMesAnio;
  readonly totalPosicion = totalPosicion;
  readonly isGroupRow = isGroupRow;
  readonly sortOptions = SORT_OPTIONS;
  readonly columnCount = 15;

  readonly ocs = signal<Oc[]>([]);
  readonly loading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly sortKey = signal<SortKey>('solped');

  /** Leído por master-data.html para el mat-panel-description del acordeón. */
  readonly summary = computed(() => {
    if (this.loading() || this.errorMessage()) {
      return '';
    }
    const count = this.ocs().length;
    return `${count} registrada${count === 1 ? '' : 's'}`;
  });

  /** Filas ordenadas según `sortKey` (o SolPed+Posición si aún no se tocó el radio-group). */
  readonly sortedOcs = computed(() => {
    const key = this.sortKey();
    if (key === 'solped') {
      return sortOcs(this.ocs());
    }
    return [...this.ocs()].sort((a, b) => compareOcs(a, b, key));
  });

  /**
   * Filas a renderizar en la tabla desktop: agrupadas por SolPed (con una
   * fila separadora por grupo) solo cuando `sortKey` es 'solped' — agrupar
   * dejaría de tener sentido visual si el orden ya no sigue el SolPed.
   */
  readonly displayRows = computed<OcDisplayRow[]>(() => {
    const items = this.sortedOcs();
    if (this.sortKey() !== 'solped') {
      return items;
    }

    const rows: OcDisplayRow[] = [];
    let lastSolped: string | null = null;
    for (const oc of items) {
      if (oc.solped !== lastSolped) {
        rows.push({ kind: 'group', solped: oc.solped });
        lastSolped = oc.solped;
      }
      rows.push(oc);
    }
    return rows;
  });

  constructor() {
    this.loadOcs();
  }

  openCreateDialog(): void {
    this.openDialog(null);
  }

  openEditDialog(oc: Oc): void {
    this.openDialog(oc);
  }

  /** Abre el dialog en modo alta, precargado con los datos de `oc` salvo Posición/PEP/Cant. horas. */
  openCopyDialog(oc: Oc): void {
    this.openDialog(null, oc);
  }

  toggleCompletada(oc: Oc, event: MatSlideToggleChange): void {
    const completada = event.checked;

    this.ocsService.setCompletada(oc.id, completada).subscribe({
      next: (updated) => {
        this.ocs.update((items) => items.map((item) => (item.id === updated.id ? updated : item)));
        this.snackBar.open(
          completada ? 'Posición marcada como completada' : 'Posición marcada como pendiente',
          'Cerrar',
          { duration: SNACKBAR_DURATION_MS },
        );
      },
      error: () => {
        event.source.checked = !completada;
        this.snackBar.open(COMPLETADA_ERROR_MESSAGE, 'Cerrar', { duration: SNACKBAR_DURATION_MS });
      },
    });
  }

  private openDialog(oc: Oc | null, copyFrom?: Oc): void {
    const dialogRef = this.dialog.open<OcFormDialog, OcFormDialogData, OcDialogResult>(
      OcFormDialog,
      {
        width: 'min(600px, 94vw)',
        data: { oc, copyFrom },
        autoFocus: 'first-tabbable',
      },
    );

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.applyDialogResult(result);
      }
    });
  }

  private applyDialogResult(result: OcDialogResult): void {
    switch (result.action) {
      case 'created':
        this.ocs.update((items) => sortOcs([...items, result.oc]));
        this.snackBar.open('OC creada', 'Cerrar', { duration: SNACKBAR_DURATION_MS });
        break;
      case 'updated':
        this.ocs.update((items) =>
          sortOcs(items.map((item) => (item.id === result.oc.id ? result.oc : item))),
        );
        this.snackBar.open('OC actualizada', 'Cerrar', { duration: SNACKBAR_DURATION_MS });
        break;
      case 'deleted':
        this.ocs.update((items) => items.filter((item) => item.id !== result.id));
        this.snackBar.open('OC eliminada', 'Cerrar', { duration: SNACKBAR_DURATION_MS });
        break;
    }
  }

  private loadOcs(): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    this.ocsService.list().subscribe({
      next: (ocs) => {
        this.ocs.set(sortOcs(ocs));
        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set(LOAD_ERROR_MESSAGE);
        this.loading.set(false);
      },
    });
  }
}
