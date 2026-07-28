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
import { provideNativeDateAdapter } from '@angular/material/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule, MatDatepicker } from '@angular/material/datepicker';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import {
  Oc,
  OcPayload,
  formatDateAsMesAnio,
  formatMesAnio,
  parseMesAnio,
} from '../../../../models/oc.model';
import { Pep } from '../../../../models/pep.model';
import { Consultor } from '../../../../models/consultor.model';
import { formatMonto } from '../../../../core/utils/format.util';
import { OcsService } from '../ocs.service';
import { PepsService } from '../../peps/peps.service';
import { ConsultoresService } from '../../consultores/consultores.service';

export interface OcFormDialogData {
  oc: Oc | null;
  /**
   * Presente en modo "copiar": precarga SolPed/Número OC/Consultor/meses de
   * validez de esta OC, pero el dialog queda en modo alta (isEditMode false,
   * sin botón Eliminar) — Posición, PEP y Cantidad de horas quedan vacíos a
   * propósito para que el usuario los complete de nuevo.
   */
  copyFrom?: Oc | null;
}

export type OcDialogResult =
  | { action: 'created' | 'updated'; oc: Oc }
  | { action: 'deleted'; id: string };

interface OcForm {
  solped: FormControl<string>;
  posicion: FormControl<number | null>;
  numeroOc: FormControl<string>;
  pepId: FormControl<string | null>;
  cantidadHoras: FormControl<number | null>;
  consultorId: FormControl<string | null>;
  mesDesde: FormControl<Date | null>;
  mesHasta: FormControl<Date | null>;
}

const SAVE_ERROR_MESSAGE = 'No pudimos guardar los cambios. Intenta nuevamente.';
const DELETE_ERROR_MESSAGE = 'No pudimos eliminar la OC. Intenta nuevamente.';
const MES_RANGE_ERROR = 'mesRangeInvalid';

function pepLabel(pep: Pep): string {
  return pep.descripcion ? `${pep.pepId} — ${pep.descripcion}` : pep.pepId;
}

function consultorLabel(consultor: Consultor): string {
  return `${consultor.nombre} (${consultor.proveedor})`;
}

function mesKey(date: Date): number {
  return date.getFullYear() * 12 + date.getMonth();
}

function mesRangeValidator(control: AbstractControl): ValidationErrors | null {
  const desde = control.get('mesDesde')?.value as Date | null;
  const hasta = control.get('mesHasta')?.value as Date | null;
  if (!desde || !hasta) {
    return null;
  }
  return mesKey(hasta) < mesKey(desde) ? { [MES_RANGE_ERROR]: true } : null;
}

@Component({
  selector: 'app-oc-form-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  providers: [provideNativeDateAdapter()],
  templateUrl: './oc-form-dialog.html',
  styleUrl: './oc-form-dialog.scss',
})
export class OcFormDialog {
  private readonly dialogRef = inject(MatDialogRef<OcFormDialog, OcDialogResult>);
  private readonly ocsService = inject(OcsService);
  private readonly pepsService = inject(PepsService);
  private readonly consultoresService = inject(ConsultoresService);
  protected readonly data = inject<OcFormDialogData>(MAT_DIALOG_DATA);

  readonly pepLabel = pepLabel;
  readonly consultorLabel = consultorLabel;
  readonly formatMonto = formatMonto;
  readonly formatMesAnio = formatMesAnio;
  readonly mesRangeError = MES_RANGE_ERROR;

  readonly peps = signal<Pep[]>([]);
  readonly consultores = signal<Consultor[]>([]);
  readonly loadingOptions = signal(true);

  readonly isEditMode = this.data.oc !== null;
  readonly saving = signal(false);
  readonly deleting = signal(false);
  readonly confirmingDelete = signal(false);
  readonly errorMessage = signal<string | null>(null);

  /**
   * Fuente de precarga para los campos que se mantienen tanto al editar
   * como al copiar (SolPed, Número OC, Consultor, meses de validez).
   * Posición/PEP/Cantidad de horas usan `this.data.oc` directo más abajo,
   * para que el modo "copiar" los deje vacíos a propósito.
   */
  private readonly prefillSource = this.data.oc ?? this.data.copyFrom ?? null;

  readonly form = new FormGroup<OcForm>(
    {
      solped: new FormControl(this.prefillSource?.solped ?? '', {
        nonNullable: true,
        validators: [Validators.required, Validators.minLength(1), Validators.maxLength(30)],
      }),
      posicion: new FormControl(this.data.oc?.posicion ?? null, {
        validators: [Validators.required, Validators.min(0)],
      }),
      numeroOc: new FormControl(this.prefillSource?.numeroOc ?? '', {
        nonNullable: true,
        validators: [Validators.maxLength(30)],
      }),
      pepId: new FormControl<string | null>(this.data.oc?.pep?.id ?? null, {
        validators: Validators.required,
      }),
      cantidadHoras: new FormControl(this.data.oc?.cantidadHoras ?? null, {
        validators: [Validators.required, Validators.min(0)],
      }),
      consultorId: new FormControl<string | null>(this.prefillSource?.consultor?.id ?? null, {
        validators: Validators.required,
      }),
      mesDesde: new FormControl<Date | null>(
        this.prefillSource ? parseMesAnio(this.prefillSource.mesDesde) : null,
        { validators: Validators.required },
      ),
      mesHasta: new FormControl<Date | null>(
        this.prefillSource ? parseMesAnio(this.prefillSource.mesHasta) : null,
        { validators: Validators.required },
      ),
    },
    { validators: mesRangeValidator },
  );

  private readonly consultorIdValue = toSignal(this.form.controls.consultorId.valueChanges, {
    initialValue: this.form.controls.consultorId.value,
  });

  private readonly cantidadHorasValue = toSignal(this.form.controls.cantidadHoras.valueChanges, {
    initialValue: this.form.controls.cantidadHoras.value,
  });

  /** Consultor seleccionado, para mostrar Perfil SAP/Tarifa/Proveedor/Responsable derivados. */
  readonly selectedConsultor = computed(() => {
    const id = this.consultorIdValue();
    return this.consultores().find((consultor) => consultor.id === id) ?? null;
  });

  /** Tarifa hora del Perfil SAP del consultor seleccionado x cantidad de horas cargada. */
  readonly totalPosicion = computed(() => {
    const tarifa = this.selectedConsultor()?.perfilSap?.tarifaHora;
    const horas = this.cantidadHorasValue();
    return tarifa != null && horas != null ? tarifa * horas : null;
  });

  constructor() {
    this.pepsService.list().subscribe({
      next: (peps) => this.peps.set(peps),
      error: () => {
        /* el select queda vacío; el usuario ve el mat-hint */
      },
    });

    this.consultoresService.list().subscribe({
      next: (consultores) => {
        this.consultores.set(consultores);
        this.loadingOptions.set(false);
      },
      error: () => this.loadingOptions.set(false),
    });
  }

  submit(): void {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }

    const numeroOc = this.form.controls.numeroOc.value.trim();
    const payload: OcPayload = {
      solped: this.form.controls.solped.value.trim(),
      posicion: this.form.controls.posicion.value!,
      numeroOc: numeroOc || undefined,
      pepId: this.form.controls.pepId.value!,
      cantidadHoras: this.form.controls.cantidadHoras.value!,
      consultorId: this.form.controls.consultorId.value!,
      mesDesde: formatDateAsMesAnio(this.form.controls.mesDesde.value!),
      mesHasta: formatDateAsMesAnio(this.form.controls.mesHasta.value!),
    };

    this.errorMessage.set(null);
    this.saving.set(true);

    const request$ = this.isEditMode
      ? this.ocsService.update(this.data.oc!.id, payload)
      : this.ocsService.create(payload);

    request$.subscribe({
      next: (oc) => {
        this.saving.set(false);
        this.dialogRef.close({ action: this.isEditMode ? 'updated' : 'created', oc });
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
    if (!this.data.oc || this.deleting()) {
      return;
    }

    const id = this.data.oc.id;
    this.errorMessage.set(null);
    this.deleting.set(true);

    this.ocsService.remove(id).subscribe({
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

  /**
   * Los datepickers de mes/año se restringen a granularidad de mes: abren
   * directo en la vista "multiyear" y se cierran apenas se elige el mes,
   * sin pasar nunca por la vista de día. No hace falta un header custom del
   * calendario (recipe oficial de Angular Material para "month picker").
   */
  chosenMonthHandlerDesde(date: Date, picker: MatDatepicker<Date>): void {
    this.form.controls.mesDesde.setValue(date);
    picker.close();
  }

  chosenMonthHandlerHasta(date: Date, picker: MatDatepicker<Date>): void {
    this.form.controls.mesHasta.setValue(date);
    picker.close();
  }
}
