import { Component, computed, inject, signal } from '@angular/core';
import { MatTableModule } from '@angular/material/table';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Pep } from '../../../models/pep.model';
import { formatMonto } from '../../../core/utils/format.util';
import { injectIsHandset } from '../../../core/utils/breakpoint.util';
import { PepsService } from './peps.service';
import { PepDialogResult, PepFormDialog, PepFormDialogData } from './pep-form-dialog/pep-form-dialog';

const LOAD_ERROR_MESSAGE = 'No pudimos cargar los PEPs. Intenta nuevamente.';
const SNACKBAR_DURATION_MS = 4000;

function sortPeps(items: Pep[]): Pep[] {
  return [...items].sort((a, b) => a.pepId.localeCompare(b.pepId));
}

@Component({
  selector: 'app-peps-panel',
  standalone: true,
  imports: [MatTableModule, MatCardModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule],
  templateUrl: './peps-panel.html',
  styleUrl: './peps-panel.scss',
})
export class PepsPanel {
  private readonly pepsService = inject(PepsService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  readonly isHandset = injectIsHandset();
  readonly formatMonto = formatMonto;
  readonly displayedColumns = ['pepId', 'descripcion', 'presupuestoTotal', 'acciones'];

  readonly peps = signal<Pep[]>([]);
  readonly loading = signal(true);
  readonly errorMessage = signal<string | null>(null);

  /** Leído por master-data.html para el mat-panel-description del acordeón. */
  readonly summary = computed(() => {
    if (this.loading() || this.errorMessage()) {
      return '';
    }
    const count = this.peps().length;
    return `${count} registrado${count === 1 ? '' : 's'}`;
  });

  constructor() {
    this.loadPeps();
  }

  openCreateDialog(): void {
    this.openDialog(null);
  }

  openEditDialog(pep: Pep): void {
    this.openDialog(pep);
  }

  private openDialog(pep: Pep | null): void {
    const dialogRef = this.dialog.open<PepFormDialog, PepFormDialogData, PepDialogResult>(
      PepFormDialog,
      {
        width: 'min(600px, 94vw)',
        data: { pep },
        autoFocus: 'first-tabbable',
      },
    );

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.applyDialogResult(result);
      }
    });
  }

  private applyDialogResult(result: PepDialogResult): void {
    switch (result.action) {
      case 'created':
        this.peps.update((items) => sortPeps([...items, result.pep]));
        this.snackBar.open('PEP creado', 'Cerrar', { duration: SNACKBAR_DURATION_MS });
        break;
      case 'updated':
        this.peps.update((items) =>
          sortPeps(items.map((item) => (item.id === result.pep.id ? result.pep : item))),
        );
        this.snackBar.open('PEP actualizado', 'Cerrar', { duration: SNACKBAR_DURATION_MS });
        break;
      case 'deleted':
        this.peps.update((items) => items.filter((item) => item.id !== result.id));
        this.snackBar.open('PEP eliminado', 'Cerrar', { duration: SNACKBAR_DURATION_MS });
        break;
    }
  }

  private loadPeps(): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    this.pepsService.list().subscribe({
      next: (peps) => {
        this.peps.set(sortPeps(peps));
        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set(LOAD_ERROR_MESSAGE);
        this.loading.set(false);
      },
    });
  }
}
