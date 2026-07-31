import { Component, computed, inject, signal } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { PerfilSap } from '../../../models/perfil-sap.model';
import { formatMonto } from '../../../core/utils/format.util';
import { injectIsHandset } from '../../../core/utils/breakpoint.util';
import { range } from '../../../core/utils/range.util';
import { Skeleton } from '../../../shared/skeleton/skeleton';
import { PerfilesSapService } from './perfiles-sap.service';
import {
  PerfilSapDialogResult,
  PerfilSapFormDialog,
  PerfilSapFormDialogData,
} from './perfil-sap-form-dialog/perfil-sap-form-dialog';

const LOAD_ERROR_MESSAGE = 'No pudimos cargar los perfiles SAP. Intenta nuevamente.';
const SNACKBAR_DURATION_MS = 4000;

/** Fila separadora de grupo (una por Proveedor distinto) — mismo patrón que OcGroupRow en ocs-panel.ts. */
export interface PerfilSapGroupRow {
  kind: 'group';
  label: string;
}

export type PerfilSapDisplayRow = PerfilSapGroupRow | PerfilSap;

export function isGroupRow(row: PerfilSapDisplayRow): row is PerfilSapGroupRow {
  return (row as PerfilSapGroupRow).kind === 'group';
}

function sortPerfilesSap(items: PerfilSap[]): PerfilSap[] {
  return [...items].sort(
    (a, b) => a.proveedor.localeCompare(b.proveedor) || a.codigoSap.localeCompare(b.codigoSap),
  );
}

@Component({
  selector: 'app-perfiles-sap-panel',
  standalone: true,
  imports: [MatCardModule, MatButtonModule, MatIconModule, Skeleton],
  templateUrl: './perfiles-sap-panel.html',
  styleUrl: './perfiles-sap-panel.scss',
})
export class PerfilesSapPanel {
  private readonly perfilesSapService = inject(PerfilesSapService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  readonly isHandset = injectIsHandset();
  readonly formatMonto = formatMonto;
  readonly isGroupRow = isGroupRow;
  readonly columnCount = 5;
  readonly skeletonRows = range(6);
  readonly skeletonCards = range(3);
  readonly skeletonColumns = range(this.columnCount);

  readonly perfilesSap = signal<PerfilSap[]>([]);
  readonly loading = signal(true);
  readonly errorMessage = signal<string | null>(null);

  /** Leído por master-data.html para el mat-panel-description del acordeón. */
  readonly summary = computed(() => {
    if (this.loading() || this.errorMessage()) {
      return '';
    }
    const count = this.perfilesSap().length;
    return `${count} registrado${count === 1 ? '' : 's'}`;
  });

  /**
   * Filas a renderizar en la tabla desktop: siempre agrupadas por
   * Proveedor (la lista ya viene ordenada por ese campo), una fila
   * separadora por cada valor distinto — mismo patrón que `displayRows` en
   * ocs-panel.ts.
   */
  readonly displayRows = computed<PerfilSapDisplayRow[]>(() => {
    const items = this.perfilesSap();
    const rows: PerfilSapDisplayRow[] = [];
    let lastValue: string | null = null;
    for (const perfilSap of items) {
      if (perfilSap.proveedor !== lastValue) {
        rows.push({ kind: 'group', label: `Proveedor ${perfilSap.proveedor}` });
        lastValue = perfilSap.proveedor;
      }
      rows.push(perfilSap);
    }
    return rows;
  });

  constructor() {
    this.loadPerfilesSap();
  }

  openCreateDialog(): void {
    this.openDialog(null);
  }

  openEditDialog(perfilSap: PerfilSap): void {
    this.openDialog(perfilSap);
  }

  private openDialog(perfilSap: PerfilSap | null): void {
    const dialogRef = this.dialog.open<
      PerfilSapFormDialog,
      PerfilSapFormDialogData,
      PerfilSapDialogResult
    >(PerfilSapFormDialog, {
      width: 'min(480px, 92vw)',
      data: { perfilSap },
      autoFocus: 'first-tabbable',
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.applyDialogResult(result);
      }
    });
  }

  private applyDialogResult(result: PerfilSapDialogResult): void {
    switch (result.action) {
      case 'created':
        this.perfilesSap.update((items) => sortPerfilesSap([...items, result.perfilSap]));
        this.snackBar.open('Perfil SAP creado', 'Cerrar', { duration: SNACKBAR_DURATION_MS });
        break;
      case 'updated':
        this.perfilesSap.update((items) =>
          sortPerfilesSap(
            items.map((item) => (item.id === result.perfilSap.id ? result.perfilSap : item)),
          ),
        );
        this.snackBar.open('Perfil SAP actualizado', 'Cerrar', { duration: SNACKBAR_DURATION_MS });
        break;
      case 'deleted':
        this.perfilesSap.update((items) => items.filter((item) => item.id !== result.id));
        this.snackBar.open('Perfil SAP eliminado', 'Cerrar', { duration: SNACKBAR_DURATION_MS });
        break;
    }
  }

  private loadPerfilesSap(): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    this.perfilesSapService.list().subscribe({
      next: (perfilesSap) => {
        this.perfilesSap.set(sortPerfilesSap(perfilesSap));
        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set(LOAD_ERROR_MESSAGE);
        this.loading.set(false);
      },
    });
  }
}
