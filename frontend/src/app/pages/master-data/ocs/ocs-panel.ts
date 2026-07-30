import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatRadioModule } from '@angular/material/radio';
import { MatCheckboxModule } from '@angular/material/checkbox';
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
  label: string;
}

export type OcDisplayRow = OcGroupRow | Oc;

export function isGroupRow(row: OcDisplayRow): row is OcGroupRow {
  return (row as OcGroupRow).kind === 'group';
}

const GROUP_LABELS: Record<SortKey, string> = {
  solped: 'SolPed',
  numeroOc: 'Número OC',
  consultor: 'Consultor',
  proveedor: 'Proveedor',
  responsable: 'Responsable',
};

/** Valor por el que se agrupa/desempata según `key` — mismo campo que usa el radio-group. */
function groupValue(oc: Oc, key: SortKey): string {
  switch (key) {
    case 'solped':
      return oc.solped;
    case 'numeroOc':
      return oc.numeroOc || '—';
    case 'consultor':
      return oc.consultor?.nombre || '—';
    case 'proveedor':
      return oc.consultor?.proveedor || '—';
    case 'responsable':
      return oc.consultor?.responsable || '—';
  }
}

function sortOcs(items: Oc[]): Oc[] {
  return [...items].sort((a, b) => a.solped.localeCompare(b.solped) || a.posicion - b.posicion);
}

/** Empate se resuelve por SolPed+Posición, para que el orden no "salte" entre recargas. */
function compareOcs(a: Oc, b: Oc, key: SortKey): number {
  const tiebreak = () => a.solped.localeCompare(b.solped) || a.posicion - b.posicion;
  if (key === 'solped') {
    return tiebreak();
  }
  return groupValue(a, key).localeCompare(groupValue(b, key)) || tiebreak();
}

function totalPosicion(oc: Oc): number | null {
  const tarifa = oc.consultor?.perfilSap?.tarifaHora;
  return tarifa != null ? tarifa * oc.cantidadHoras : null;
}

function horasDisponibles(oc: Oc): number {
  return oc.cantidadHoras - oc.horasConsumidas;
}

/** Resalta filas todavía sin Número OC (esperando que Compras/gerencia lo cargue). */
function sinNumeroOc(oc: Oc): boolean {
  return !oc.numeroOc;
}

/** Resalta filas sin horas disponibles que siguen sin marcarse como Completada. */
function horasAgotadasSinCompletar(oc: Oc): boolean {
  return !oc.completada && horasDisponibles(oc) === 0;
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
    MatCheckboxModule,
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
  readonly horasDisponibles = horasDisponibles;
  readonly sinNumeroOc = sinNumeroOc;
  readonly horasAgotadasSinCompletar = horasAgotadasSinCompletar;
  readonly isGroupRow = isGroupRow;
  readonly sortOptions = SORT_OPTIONS;
  readonly columnCount = 15;

  readonly ocs = signal<Oc[]>([]);
  readonly loading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly sortKey = signal<SortKey>('solped');
  readonly onlyPending = signal(true);
  readonly onlyPendienteLiberacion = signal(false);

  /** Leído por master-data.html para el mat-panel-description del acordeón (total sin filtrar). */
  readonly summary = computed(() => {
    if (this.loading() || this.errorMessage()) {
      return '';
    }
    const count = this.ocs().length;
    return `${count} registrada${count === 1 ? '' : 's'}`;
  });

  /**
   * Todas las OC, angostadas por los checkboxes tildados: "En curso" (no
   * completadas) y "Pendiente de OC/Liberación" (sin numeroOc todavía) se
   * aplican en conjunto (AND), no son mutuamente excluyentes.
   */
  readonly filteredOcs = computed(() => {
    let items = this.ocs();
    if (this.onlyPending()) {
      items = items.filter((oc) => !oc.completada);
    }
    if (this.onlyPendienteLiberacion()) {
      items = items.filter((oc) => !oc.numeroOc);
    }
    return items;
  });

  /** Filas filtradas y ordenadas según `sortKey` (SolPed+Posición por default). */
  readonly sortedOcs = computed(() => {
    const key = this.sortKey();
    const items = this.filteredOcs();
    if (key === 'solped') {
      return sortOcs(items);
    }
    return [...items].sort((a, b) => compareOcs(a, b, key));
  });

  /**
   * Filas a renderizar en la tabla desktop: siempre agrupadas, según el
   * campo que corresponda al `sortKey` activo (SolPed, Número OC, Consultor,
   * Proveedor o Responsable) — una fila separadora por cada valor distinto.
   */
  readonly displayRows = computed<OcDisplayRow[]>(() => {
    const key = this.sortKey();
    const items = this.sortedOcs();

    const rows: OcDisplayRow[] = [];
    let lastValue: string | null = null;
    for (const oc of items) {
      const value = groupValue(oc, key);
      if (value !== lastValue) {
        rows.push({ kind: 'group', label: `${GROUP_LABELS[key]} ${value}` });
        lastValue = value;
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
