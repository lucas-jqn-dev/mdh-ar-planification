import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Proveedor } from '../../../../models/consultor.model';
import { PerfilSap, PerfilSapPayload } from '../../../../models/perfil-sap.model';
import { PerfilesSapService } from '../perfiles-sap.service';

export interface PerfilSapFormDialogData {
  perfilSap: PerfilSap | null;
}

export type PerfilSapDialogResult =
  | { action: 'created' | 'updated'; perfilSap: PerfilSap }
  | { action: 'deleted'; id: string };

interface PerfilSapForm {
  codigoSap: FormControl<string>;
  descripcion: FormControl<string>;
  tarifaHora: FormControl<number | null>;
  proveedor: FormControl<Proveedor | null>;
}

const SAVE_ERROR_MESSAGE = 'No pudimos guardar los cambios. Intenta nuevamente.';
const DELETE_ERROR_MESSAGE = 'No pudimos eliminar el perfil SAP. Intenta nuevamente.';
const DUPLICATE_ERROR_MESSAGE = 'Ya existe un perfil SAP con ese código.';

@Component({
  selector: 'app-perfil-sap-form-dialog',
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
  templateUrl: './perfil-sap-form-dialog.html',
  styleUrl: './perfil-sap-form-dialog.scss',
})
export class PerfilSapFormDialog {
  private readonly dialogRef = inject(
    MatDialogRef<PerfilSapFormDialog, PerfilSapDialogResult>,
  );
  private readonly perfilesSapService = inject(PerfilesSapService);
  protected readonly data = inject<PerfilSapFormDialogData>(MAT_DIALOG_DATA);

  readonly proveedorOptions = Object.values(Proveedor);

  readonly isEditMode = this.data.perfilSap !== null;
  readonly saving = signal(false);
  readonly deleting = signal(false);
  readonly confirmingDelete = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly form = new FormGroup<PerfilSapForm>({
    codigoSap: new FormControl(this.data.perfilSap?.codigoSap ?? '', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(1), Validators.maxLength(30)],
    }),
    descripcion: new FormControl(this.data.perfilSap?.descripcion ?? '', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(2), Validators.maxLength(200)],
    }),
    tarifaHora: new FormControl(this.data.perfilSap?.tarifaHora ?? null, {
      validators: [Validators.required, Validators.min(0)],
    }),
    proveedor: new FormControl<Proveedor | null>(this.data.perfilSap?.proveedor ?? null, {
      validators: Validators.required,
    }),
  });

  submit(): void {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }

    const payload: PerfilSapPayload = {
      codigoSap: this.form.controls.codigoSap.value.trim(),
      descripcion: this.form.controls.descripcion.value.trim(),
      tarifaHora: this.form.controls.tarifaHora.value!,
      proveedor: this.form.controls.proveedor.value!,
    };

    this.errorMessage.set(null);
    this.saving.set(true);

    const request$ = this.isEditMode
      ? this.perfilesSapService.update(this.data.perfilSap!.id, payload)
      : this.perfilesSapService.create(payload);

    request$.subscribe({
      next: (perfilSap) => {
        this.saving.set(false);
        this.dialogRef.close({ action: this.isEditMode ? 'updated' : 'created', perfilSap });
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.errorMessage.set(
          error instanceof HttpErrorResponse && error.status === 409
            ? DUPLICATE_ERROR_MESSAGE
            : SAVE_ERROR_MESSAGE,
        );
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
    if (!this.data.perfilSap || this.deleting()) {
      return;
    }

    const id = this.data.perfilSap.id;
    this.errorMessage.set(null);
    this.deleting.set(true);

    this.perfilesSapService.remove(id).subscribe({
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
