import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Recepcion, RecepcionPayload } from '../../../models/recepcion.model';
import { Oc, enumerarMeses, formatMesAnio } from '../../../models/oc.model';
import { formatMonto } from '../../../core/utils/format.util';
import { RecepcionesService } from '../recepciones.service';
import { OcsService } from '../../master-data/ocs/ocs.service';

export interface RecepcionFormDialogData {
  recepcion: Recepcion | null;
}

export type RecepcionDialogResult =
  | { action: 'created' | 'updated'; recepcion: Recepcion }
  | { action: 'deleted'; id: string };

/**
 * Mientras el usuario escribe para filtrar, el control guarda el texto
 * tipeado (string); al elegir una opción del autocomplete, guarda la OC
 * completa — mismo patrón que el ejemplo oficial de Angular Material para
 * "autocomplete con objetos".
 */
type OcControlValue = Oc | string | null;

interface RecepcionForm {
  oc: FormControl<OcControlValue>;
  mes: FormControl<string | null>;
  horasRecepcionadas: FormControl<number | null>;
  documento103: FormControl<string>;
}

interface MesOption {
  value: string;
  label: string;
}

const SAVE_ERROR_MESSAGE = 'No pudimos guardar los cambios. Intenta nuevamente.';
const DELETE_ERROR_MESSAGE = 'No pudimos eliminar la recepción. Intenta nuevamente.';
const OC_INVALIDA_ERROR = 'ocInvalida';

/** NRO OC / POSICION / CONSULTOR / PROVEEDOR — mismo texto para las opciones del autocomplete y para el input una vez seleccionada. */
function ocOptionLabel(oc: Oc): string {
  const nroOc = oc.numeroOc || '—';
  const consultor = oc.consultor?.nombre || '—';
  const proveedor = oc.consultor?.proveedor || '—';
  return `${nroOc} • ${oc.posicion} / ${consultor} / ${proveedor}`;
}

/** El input solo es válido si el valor es una OC elegida de la lista, no un texto libre tipeado. */
function ocSeleccionadaValidator(control: AbstractControl<OcControlValue>): ValidationErrors | null {
  const value = control.value;
  if (value === null || value === '') {
    return null;
  }
  return typeof value === 'object' ? null : { [OC_INVALIDA_ERROR]: true };
}

@Component({
  selector: 'app-recepcion-form-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatAutocompleteModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './recepcion-form-dialog.html',
  styleUrl: './recepcion-form-dialog.scss',
})
export class RecepcionFormDialog {
  private readonly dialogRef = inject(MatDialogRef<RecepcionFormDialog, RecepcionDialogResult>);
  private readonly recepcionesService = inject(RecepcionesService);
  private readonly ocsService = inject(OcsService);
  protected readonly data = inject<RecepcionFormDialogData>(MAT_DIALOG_DATA);

  readonly ocOptionLabel = ocOptionLabel;
  readonly formatMonto = formatMonto;
  readonly ocInvalidaError = OC_INVALIDA_ERROR;

  readonly ocs = signal<Oc[]>([]);
  readonly loadingOptions = signal(true);

  readonly isEditMode = this.data.recepcion !== null;
  readonly saving = signal(false);
  readonly deleting = signal(false);
  readonly confirmingDelete = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly form = new FormGroup<RecepcionForm>({
    oc: new FormControl<OcControlValue>(this.data.recepcion?.oc ?? null, {
      validators: [Validators.required, ocSeleccionadaValidator],
    }),
    mes: new FormControl<string | null>(this.data.recepcion?.mes ?? null, {
      validators: Validators.required,
    }),
    horasRecepcionadas: new FormControl(this.data.recepcion?.horasRecepcionadas ?? null, {
      validators: [Validators.required, Validators.min(0.01)],
    }),
    documento103: new FormControl(this.data.recepcion?.documento103 ?? '', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(50)],
    }),
  });

  private readonly ocValue = toSignal(this.form.controls.oc.valueChanges, {
    initialValue: this.form.controls.oc.value,
  });

  /** OC elegida (objeto completo), para mostrar sus datos derivados y poblar el desplegable de mes. */
  readonly selectedOc = computed<Oc | null>(() => {
    const value = this.ocValue();
    return value && typeof value === 'object' ? value : null;
  });

  /**
   * OC pendientes (no completadas) + la OC de la recepción en edición si ya
   * no estuviera pendiente — para no dejar el campo "huérfano" al editar una
   * recepción cuya OC se marcó como completada después de crearla.
   */
  readonly assignableOcs = computed(() => {
    const pendientes = this.ocs().filter((oc) => !oc.completada);
    const ocActual = this.data.recepcion?.oc;
    if (ocActual && !pendientes.some((oc) => oc.id === ocActual.id)) {
      return [...pendientes, ocActual];
    }
    return pendientes;
  });

  /** Opciones del autocomplete, filtradas por número de OC a medida que se escribe. */
  readonly filteredOcs = computed(() => {
    const value = this.ocValue();
    const search = typeof value === 'string' ? value.trim().toLowerCase() : '';
    const pool = this.assignableOcs();
    if (!search) {
      return pool;
    }
    return pool.filter((oc) => (oc.numeroOc ?? '').toLowerCase().includes(search));
  });

  /** Meses entre mesDesde/mesHasta de la OC seleccionada (ambos inclusive). */
  readonly mesOptions = computed<MesOption[]>(() => {
    const oc = this.selectedOc();
    if (!oc) {
      return [];
    }
    return enumerarMeses(oc.mesDesde, oc.mesHasta).map((mes) => ({
      value: mes,
      label: formatMesAnio(mes),
    }));
  });

  readonly ocDisplayFn = (value: OcControlValue): string => {
    if (!value) {
      return '';
    }
    return typeof value === 'string' ? value : ocOptionLabel(value);
  };

  constructor() {
    this.ocsService.list().subscribe({
      next: (ocs) => {
        this.ocs.set(ocs);
        this.loadingOptions.set(false);
      },
      error: () => this.loadingOptions.set(false),
    });

    // Al cambiar la OC seleccionada, el mes elegido puede quedar fuera del
    // nuevo rango de validez — se limpia para forzar a elegir uno válido.
    // No dispara en la carga inicial del form (valueChanges no emite por el
    // valor inicial del FormControl, solo ante cambios posteriores).
    this.form.controls.oc.valueChanges.subscribe(() => {
      this.form.controls.mes.setValue(null);
    });
  }

  submit(): void {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }

    const oc = this.form.controls.oc.value as Oc;
    const payload: RecepcionPayload = {
      ocId: oc.id,
      mes: this.form.controls.mes.value!,
      horasRecepcionadas: this.form.controls.horasRecepcionadas.value!,
      documento103: this.form.controls.documento103.value.trim(),
    };

    this.errorMessage.set(null);
    this.saving.set(true);

    const request$ = this.isEditMode
      ? this.recepcionesService.update(this.data.recepcion!.id, payload)
      : this.recepcionesService.create(payload);

    request$.subscribe({
      next: (recepcion) => {
        this.saving.set(false);
        this.dialogRef.close({ action: this.isEditMode ? 'updated' : 'created', recepcion });
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
    if (!this.data.recepcion || this.deleting()) {
      return;
    }

    const id = this.data.recepcion.id;
    this.errorMessage.set(null);
    this.deleting.set(true);

    this.recepcionesService.remove(id).subscribe({
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
