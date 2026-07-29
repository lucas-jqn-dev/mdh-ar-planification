import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { map } from 'rxjs';
import {
  MESES,
  Pais,
  Pep,
  PepPayload,
  PresupuestoMensual,
  crearPresupuestoMensualVacio,
  sumPresupuestoMensual,
} from '../../../../models/pep.model';
import { formatMonto } from '../../../../core/utils/format.util';
import { PepsService } from '../peps.service';

export interface PepFormDialogData {
  pep: Pep | null;
}

export type PepDialogResult =
  | { action: 'created' | 'updated'; pep: Pep }
  | { action: 'deleted'; id: string };

type PresupuestoMensualFormGroup = FormGroup<{
  [K in keyof PresupuestoMensual]: FormControl<number>;
}>;

interface PepForm {
  pepId: FormControl<string>;
  descripcion: FormControl<string>;
  pais: FormControl<Pais | null>;
  forecastMensual: PresupuestoMensualFormGroup;
}

const SAVE_ERROR_MESSAGE = 'No pudimos guardar los cambios. Intenta nuevamente.';
const DELETE_ERROR_MESSAGE = 'No pudimos eliminar el PEP. Intenta nuevamente.';
const DUPLICATE_ERROR_MESSAGE = 'Ya existe un PEP con ese ID.';

function buildPresupuestoMensualGroup(inicial: PresupuestoMensual): PresupuestoMensualFormGroup {
  const controls = {} as { [K in keyof PresupuestoMensual]: FormControl<number> };
  for (const mes of MESES) {
    controls[mes.key] = new FormControl(inicial[mes.key], {
      nonNullable: true,
      validators: [Validators.required, Validators.min(0)],
    });
  }
  return new FormGroup(controls);
}

@Component({
  selector: 'app-pep-form-dialog',
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
  templateUrl: './pep-form-dialog.html',
  styleUrl: './pep-form-dialog.scss',
})
export class PepFormDialog {
  private readonly dialogRef = inject(MatDialogRef<PepFormDialog, PepDialogResult>);
  private readonly pepsService = inject(PepsService);
  protected readonly data = inject<PepFormDialogData>(MAT_DIALOG_DATA);

  readonly meses = MESES;
  readonly formatMonto = formatMonto;
  readonly paisOptions = Object.values(Pais);

  readonly isEditMode = this.data.pep !== null;
  readonly saving = signal(false);
  readonly deleting = signal(false);
  readonly confirmingDelete = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly form = new FormGroup<PepForm>({
    pepId: new FormControl(this.data.pep?.pepId ?? '', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(1), Validators.maxLength(60)],
    }),
    descripcion: new FormControl(this.data.pep?.descripcion ?? '', {
      nonNullable: true,
      validators: [Validators.maxLength(500)],
    }),
    pais: new FormControl<Pais | null>(this.data.pep?.pais ?? null, {
      validators: Validators.required,
    }),
    forecastMensual: buildPresupuestoMensualGroup(
      this.data.pep?.saldoActual?.forecastMensual ?? crearPresupuestoMensualVacio(),
    ),
  });

  private readonly forecastMensualValue = toSignal(
    this.form.controls.forecastMensual.valueChanges.pipe(
      map(() => this.form.controls.forecastMensual.getRawValue()),
    ),
    { initialValue: this.form.controls.forecastMensual.getRawValue() },
  );

  readonly total = computed(() => sumPresupuestoMensual(this.forecastMensualValue()));

  constructor() {
    // Un PEP ya creado no puede cambiar su identidad (ID/Descripción/País)
    // desde este dialog — solo el presupuesto planificado mensual queda
    // editable. Se deshabilitan los controles en vez de todo el form (a
    // diferencia del bloqueo de OC con recepciones) porque acá sí se
    // necesita seguir editando `forecastMensual`.
    if (this.isEditMode) {
      this.form.controls.pepId.disable();
      this.form.controls.descripcion.disable();
      this.form.controls.pais.disable();
    }
  }

  submit(): void {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }

    const descripcion = this.form.controls.descripcion.value.trim();
    const payload: PepPayload = {
      pepId: this.form.controls.pepId.value.trim(),
      descripcion: descripcion || undefined,
      pais: this.form.controls.pais.value!,
      forecastMensual: this.form.controls.forecastMensual.getRawValue(),
    };

    this.errorMessage.set(null);
    this.saving.set(true);

    const request$ = this.isEditMode
      ? this.pepsService.update(this.data.pep!.id, payload)
      : this.pepsService.create(payload);

    request$.subscribe({
      next: (pep) => {
        this.saving.set(false);
        this.dialogRef.close({ action: this.isEditMode ? 'updated' : 'created', pep });
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
    if (!this.data.pep || this.deleting()) {
      return;
    }

    const id = this.data.pep.id;
    this.errorMessage.set(null);
    this.deleting.set(true);

    this.pepsService.remove(id).subscribe({
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
