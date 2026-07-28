import { Component, computed, inject, signal } from '@angular/core';
import { MatTableModule } from '@angular/material/table';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Consultor } from '../../../models/consultor.model';
import { injectIsHandset } from '../../../core/utils/breakpoint.util';
import { ConsultoresService } from './consultores.service';
import {
  ConsultorDialogResult,
  ConsultorFormDialog,
  ConsultorFormDialogData,
} from './consultor-form-dialog/consultor-form-dialog';

const LOAD_ERROR_MESSAGE = 'No pudimos cargar los consultores. Intenta nuevamente.';
const SNACKBAR_DURATION_MS = 4000;

function sortConsultores(items: Consultor[]): Consultor[] {
  return [...items].sort(
    (a, b) => a.proveedor.localeCompare(b.proveedor) || a.nombre.localeCompare(b.nombre),
  );
}

@Component({
  selector: 'app-consultores-panel',
  standalone: true,
  imports: [MatTableModule, MatCardModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule],
  templateUrl: './consultores-panel.html',
  styleUrl: './consultores-panel.scss',
})
export class ConsultoresPanel {
  private readonly consultoresService = inject(ConsultoresService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  readonly isHandset = injectIsHandset();
  readonly displayedColumns = ['proveedor', 'nombre', 'equipo', 'responsable', 'acciones'];

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
