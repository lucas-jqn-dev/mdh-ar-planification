import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import {
  Consultor,
  ConsultorPayload,
  Equipo,
  Proveedor,
  Responsable,
} from '../../../../models/consultor.model';
import { ConsultoresService } from '../consultores.service';

export interface ConsultorFormDialogData {
  consultor: Consultor | null;
}

export type ConsultorDialogResult =
  | { action: 'created' | 'updated'; consultor: Consultor }
  | { action: 'deleted'; id: string };

interface ConsultorForm {
  nombre: FormControl<string>;
  proveedor: FormControl<Proveedor | null>;
  equipo: FormControl<Equipo | null>;
  responsable: FormControl<Responsable | null>;
}

const SAVE_ERROR_MESSAGE = 'No pudimos guardar los cambios. Intenta nuevamente.';
const DELETE_ERROR_MESSAGE = 'No pudimos eliminar el consultor. Intenta nuevamente.';

@Component({
  selector: 'app-consultor-form-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './consultor-form-dialog.html',
  styleUrl: './consultor-form-dialog.scss',
})
export class ConsultorFormDialog {
  private readonly dialogRef = inject(MatDialogRef<ConsultorFormDialog, ConsultorDialogResult>);
  private readonly consultoresService = inject(ConsultoresService);
  protected readonly data = inject<ConsultorFormDialogData>(MAT_DIALOG_DATA);

  readonly proveedorOptions = Object.values(Proveedor);
  readonly equipoOptions = Object.values(Equipo);
  readonly responsableOptions = Object.values(Responsable);

  readonly isEditMode = this.data.consultor !== null;
  readonly saving = signal(false);
  readonly deleting = signal(false);
  readonly confirmingDelete = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly form = new FormGroup<ConsultorForm>({
    nombre: new FormControl(this.data.consultor?.nombre ?? '', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(2), Validators.maxLength(120)],
    }),
    proveedor: new FormControl<Proveedor | null>(this.data.consultor?.proveedor ?? null, {
      validators: Validators.required,
    }),
    equipo: new FormControl<Equipo | null>(this.data.consultor?.equipo ?? null, {
      validators: Validators.required,
    }),
    responsable: new FormControl<Responsable | null>(this.data.consultor?.responsable ?? null, {
      validators: Validators.required,
    }),
  });

  submit(): void {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }

    const payload: ConsultorPayload = {
      nombre: this.form.controls.nombre.value.trim(),
      proveedor: this.form.controls.proveedor.value!,
      equipo: this.form.controls.equipo.value!,
      responsable: this.form.controls.responsable.value!,
    };

    this.errorMessage.set(null);
    this.saving.set(true);

    const request$ = this.isEditMode
      ? this.consultoresService.update(this.data.consultor!.id, payload)
      : this.consultoresService.create(payload);

    request$.subscribe({
      next: (consultor) => {
        this.saving.set(false);
        this.dialogRef.close({ action: this.isEditMode ? 'updated' : 'created', consultor });
      },
      error: () => {
        this.saving.set(false);
        this.errorMessage.set(SAVE_ERROR_MESSAGE);
      },
    });
  }

  askDeleteConfirmation(): void {
    this.errorMessage.set(null);
    this.confirmingDelete.set(true);
  }

  cancelDeleteConfirmation(): void {
    this.confirmingDelete.set(false);
  }

  confirmDelete(): void {
    if (!this.data.consultor || this.deleting()) {
      return;
    }

    const id = this.data.consultor.id;
    this.errorMessage.set(null);
    this.deleting.set(true);

    this.consultoresService.remove(id).subscribe({
      next: () => {
        this.deleting.set(false);
        this.dialogRef.close({ action: 'deleted', id });
      },
      error: () => {
        this.deleting.set(false);
        this.confirmingDelete.set(false);
        this.errorMessage.set(DELETE_ERROR_MESSAGE);
      },
    });
  }

  cancel(): void {
    this.dialogRef.close();
  }
}
