import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatTabsModule } from '@angular/material/tabs';
import {
  BarChartModule,
  Color,
  LegendPosition,
  LineChartModule,
  PieChartModule,
  ScaleType,
} from '@swimlane/ngx-charts';
import { MESES, Pep, PresupuestoMensual, sumPresupuestoMensual } from '../../models/pep.model';
import { Oc } from '../../models/oc.model';
import { Recepcion } from '../../models/recepcion.model';
import { formatMonto } from '../../core/utils/format.util';
import { injectIsHandset } from '../../core/utils/breakpoint.util';
import { Skeleton } from '../../shared/skeleton/skeleton';
import { PepsService } from '../master-data/peps/peps.service';
import { OcsService } from '../orders/ocs.service';
import { RecepcionesService } from '../order-recepcions/recepciones.service';

const LOAD_ERROR_MESSAGE = 'No pudimos cargar los PEPs. Intenta nuevamente.';
const LOAD_OCS_ERROR_MESSAGE = 'No pudimos cargar las OC. Intenta nuevamente.';
const LOAD_RECEPCIONES_ERROR_MESSAGE = 'No pudimos cargar las recepciones. Intenta nuevamente.';
const ANUAL = 'ANUAL';

/**
 * Forecast/Real en los colores de marca Easy Cencosud (rojo/amarillo);
 * Asignado en un gris neutro (sin color de marca definido para un tercer
 * dato) para no competir visualmente con los otros dos.
 */
const PEP_COMPARATIVA_SCHEME: Color = {
  name: 'pepComparativa',
  selectable: true,
  group: ScaleType.Ordinal,
  domain: ['#cc212d', '#6b7280', '#eae325'],
};

interface PepComparativaDatum {
  name: string;
  series: { name: string; value: number }[];
}

interface TotalDatum {
  name: string;
  value: number;
}

interface PepMovimientoLineDatum {
  name: string;
  series: { name: string; value: number }[];
}

function pepLabel(pep: Pep): string {
  return pep.descripcion ? `${pep.pepId} — ${pep.descripcion}` : pep.pepId;
}

interface ProveedorMontoDatum {
  name: string;
  value: number;
}

/**
 * Monto total por Proveedor, sumando `tarifaHora × horasConsumidas` de
 * cada OC — horas realmente recepcionadas (ver `Oc.horasConsumidas`, que
 * `RecepcionesService` mantiene sincronizado), no `cantidadHoras` (el total
 * contratado/presupuestado). Este gráfico muestra dinero efectivamente
 * pagado, no comprometido, así que usa el real y no el total de la
 * posición — a diferencia de `totalPosicion()` en `ocs-panel.ts`, que sigue
 * usando `cantidadHoras` para mostrar el valor total de la posición.
 * Agrupa por `oc.consultor.proveedor`; una OC sin Consultor o sin Perfil
 * SAP (dato legacy o sin integridad referencial, ver CLAUDE.md) no se
 * puede atribuir a ningún proveedor y se omite en vez de sumarse en `0` —
 * un valor `0` no tendría sentido como porción de un donut.
 */
function montoPorProveedor(ocs: Oc[]): ProveedorMontoDatum[] {
  const totales = new Map<string, number>();

  for (const oc of ocs) {
    const tarifaHora = oc.consultor?.perfilSap?.tarifaHora;
    const proveedor = oc.consultor?.proveedor;

    if (tarifaHora == null || !proveedor) {
      continue;
    }

    const monto = tarifaHora * oc.horasConsumidas;
    totales.set(proveedor, (totales.get(proveedor) ?? 0) + monto);
  }

  return Array.from(totales, ([name, value]) => ({ name, value }));
}

/** Filtro de período del gráfico: un mes puntual de `PresupuestoMensual`, o "ANUAL" (suma los 12). */
type PeriodoFiltro = keyof PresupuestoMensual | typeof ANUAL;

interface FiltroOption {
  value: PeriodoFiltro;
  label: string;
}

const FILTRO_OPTIONS: FiltroOption[] = [
  ...MESES.map((mes) => ({ value: mes.key, label: mes.label })),
  { value: ANUAL, label: 'Anual' },
];

/** Mes actual ("YYYY-MM"[1] 0-indexado -> mismo orden que MESES) — default del select. */
function mesActual(): PeriodoFiltro {
  return MESES[new Date().getMonth()].key;
}

/** Valor de un `PresupuestoMensual` según el filtro: el mes puntual, o la suma anual. `0` si el PEP no tiene saldo. */
function montoSegunFiltro(
  presupuesto: PresupuestoMensual | undefined,
  filtro: PeriodoFiltro,
): number {
  if (!presupuesto) {
    return 0;
  }
  return filtro === ANUAL ? sumPresupuestoMensual(presupuesto) : presupuesto[filtro] || 0;
}

function sortPeps(items: Pep[]): Pep[] {
  return [...items].sort((a, b) => a.pepId.localeCompare(b.pepId));
}

/**
 * Forecast/Asignado/Real sumados entre TODOS los PEP (a diferencia de
 * `comparativaData`, que desglosa por PEP individual) para el período
 * elegido — mismo fallback en `0` que el resto de la página si un PEP
 * todavía no tiene `SaldoPep`.
 */
function totalPorTipo(peps: Pep[], filtro: PeriodoFiltro): TotalDatum[] {
  let forecast = 0;
  let asignado = 0;
  let real = 0;

  for (const pep of peps) {
    forecast += montoSegunFiltro(pep.saldoActual?.forecastMensual, filtro);
    asignado += montoSegunFiltro(pep.saldoActual?.asignacionMensual, filtro);
    real += montoSegunFiltro(pep.saldoActual?.realMensual, filtro);
  }

  return [
    { name: 'Forecast', value: forecast },
    { name: 'Asignado', value: asignado },
    { name: 'Real', value: real },
  ];
}

/** Rojo de marca — bar chart de una sola serie (horas), no hace falta distinguir colores por consultor. */
const CONSULTOR_HORAS_SCHEME: Color = {
  name: 'consultorHoras',
  selectable: true,
  group: ScaleType.Ordinal,
  domain: ['#cc212d'],
};

interface ConsultorHorasDatum {
  name: string;
  value: number;
}

/**
 * `true` si el mes de la Recepción ("YYYY-MM") cae dentro del período
 * elegido, siempre acotado al año en curso — mismo criterio "año en curso"
 * que ya usa `SaldoPep.validezDesde`/`validezHasta`
 * (`defaultValidezAnioActual()` en el backend), para que "Período"
 * signifique lo mismo en todo el dashboard. "ANUAL" matchea cualquier mes
 * de este año; un mes puntual matchea solo ese mes de este año (no ese mes
 * en años anteriores).
 */
function recepcionEnPeriodo(mesRecepcion: string, filtro: PeriodoFiltro): boolean {
  const [anio, mes] = mesRecepcion.split('-');

  if (Number(anio) !== new Date().getFullYear()) {
    return false;
  }

  return filtro === ANUAL || MESES[Number(mes) - 1]?.key === filtro;
}

/**
 * Horas recepcionadas totales por Consultor en el período elegido, sumando
 * `Recepcion.horasRecepcionadas` de las recepciones cuyo `mes` cae en ese
 * período (ver `recepcionEnPeriodo()`). Se agrupa por
 * `oc.consultor.nombre` — mismo campo que ya usa `groupValue()` en
 * `ocs-panel.ts` para agrupar por Consultor. Una Recepción sin OC o sin
 * Consultor (dato legacy o sin integridad referencial, ver CLAUDE.md) no
 * se puede atribuir a nadie y se omite. Ordenado de mayor a menor horas, a
 * pedido explícito.
 */
function horasPorConsultor(recepciones: Recepcion[], filtro: PeriodoFiltro): ConsultorHorasDatum[] {
  const totales = new Map<string, number>();

  for (const recepcion of recepciones) {
    const nombre = recepcion.oc?.consultor?.nombre;

    if (!nombre || !recepcionEnPeriodo(recepcion.mes, filtro)) {
      continue;
    }

    totales.set(nombre, (totales.get(nombre) ?? 0) + recepcion.horasRecepcionadas);
  }

  return Array.from(totales, ([name, value]) => ({ name, value })).sort(
    (a, b) => b.value - a.value,
  );
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    FormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatSelectModule,
    MatTabsModule,
    BarChartModule,
    LineChartModule,
    PieChartModule,
    Skeleton,
  ],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home {
  private readonly pepsService = inject(PepsService);
  private readonly ocsService = inject(OcsService);
  private readonly recepcionesService = inject(RecepcionesService);

  readonly isHandset = injectIsHandset();
  readonly formatMonto = formatMonto;
  readonly pepLabel = pepLabel;
  readonly scheme = PEP_COMPARATIVA_SCHEME;
  readonly pieScheme = 'natural';
  readonly consultorScheme = CONSULTOR_HORAS_SCHEME;
  readonly filtroOptions = FILTRO_OPTIONS;
  /** Leyenda a la derecha en desktop/tablet, debajo del gráfico en mobile para no angostar el chart. */
  readonly legendPosition = computed(() =>
    this.isHandset() ? LegendPosition.Below : LegendPosition.Right,
  );

  readonly peps = signal<Pep[]>([]);
  readonly loading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly filtro = signal<PeriodoFiltro>(mesActual());

  readonly yAxisLabel = computed(() => {
    const filtro = this.filtro();
    const option = this.filtroOptions.find((o) => o.value === filtro);
    return filtro === ANUAL ? 'Monto anual' : `Monto ${option?.label ?? ''}`;
  });

  /** Filtro de período del total agregado — independiente del de `comparativaData`, mismas opciones/default. */
  readonly totalFiltro = signal<PeriodoFiltro>(mesActual());

  readonly totalYAxisLabel = computed(() => {
    const filtro = this.totalFiltro();
    const option = this.filtroOptions.find((o) => o.value === filtro);
    return filtro === ANUAL ? 'Monto anual' : `Monto ${option?.label ?? ''}`;
  });

  /** Forecast/Asignado/Real sumados entre todos los PEP, para el primer gráfico del tab PEPS. */
  readonly totalPorTipoData = computed<TotalDatum[]>(() =>
    totalPorTipo(this.peps(), this.totalFiltro()),
  );

  /**
   * Forecast vs Asignado vs Real por PEP para el bar chart agrupado, según
   * el `filtro` elegido (un mes puntual de `PresupuestoMensual`, o la suma
   * anual) — `0` en los PEP que todavía no tienen `SaldoPep` (legacy, nunca
   * editado desde que se creó `saldos_peps`), mismo criterio de fallback
   * que `peps-panel.ts`.
   */
  readonly comparativaData = computed<PepComparativaDatum[]>(() => {
    const filtro = this.filtro();
    return this.peps().map((pep) => ({
      name: pep.pepId,
      series: [
        { name: 'Forecast', value: montoSegunFiltro(pep.saldoActual?.forecastMensual, filtro) },
        { name: 'Asignado', value: montoSegunFiltro(pep.saldoActual?.asignacionMensual, filtro) },
        { name: 'Real', value: montoSegunFiltro(pep.saldoActual?.realMensual, filtro) },
      ],
    }));
  });

  /** PEP elegido en el selector del line chart — `null` hasta que el usuario elige uno explícitamente. */
  readonly selectedPepId = signal<string | null>(null);
  /** El elegido, o el primero de la lista (ya ordenada por pepId) mientras no se haya elegido ninguno. */
  readonly effectivePepId = computed(() => this.selectedPepId() ?? (this.peps()[0]?.id ?? null));
  readonly selectedPep = computed(
    () => this.peps().find((pep) => pep.id === this.effectivePepId()) ?? null,
  );

  /**
   * Forecast, Asignado y Real mes a mes (enero a diciembre) del PEP
   * elegido, como tres líneas paralelas — `0` en cada mes si el PEP no
   * tiene `SaldoPep` todavía, mismo criterio de fallback que el resto de la
   * página. Mismos nombres de serie que `comparativaData` para que
   * `scheme` los coloree igual en los dos gráficos.
   */
  readonly movimientosPorMesData = computed<PepMovimientoLineDatum[]>(() => {
    const pep = this.selectedPep();
    if (!pep) {
      return [];
    }
    const saldo = pep.saldoActual;
    const lineaDe = (presupuesto: PresupuestoMensual | undefined) =>
      MESES.map((mes) => ({ name: mes.label, value: presupuesto ? presupuesto[mes.key] || 0 : 0 }));

    return [
      { name: 'Forecast', series: lineaDe(saldo?.forecastMensual) },
      { name: 'Asignado', series: lineaDe(saldo?.asignacionMensual) },
      { name: 'Real', series: lineaDe(saldo?.realMensual) },
    ];
  });

  readonly ocs = signal<Oc[]>([]);
  readonly ocsLoading = signal(true);
  readonly ocsErrorMessage = signal<string | null>(null);

  /** Monto total por Proveedor entre todas las OC cargadas, para el donut chart del tab OC. */
  readonly montoPorProveedorData = computed<ProveedorMontoDatum[]>(() =>
    montoPorProveedor(this.ocs()),
  );

  readonly recepciones = signal<Recepcion[]>([]);
  readonly recepcionesLoading = signal(true);
  readonly recepcionesErrorMessage = signal<string | null>(null);
  /** Filtro de período independiente del de PEPS — mismas opciones, mismo default (mes en curso). */
  readonly consultorFiltro = signal<PeriodoFiltro>(mesActual());

  /** Horas recepcionadas por Consultor en el período elegido, para el bar chart del tab CONSULTORES. */
  readonly horasPorConsultorData = computed<ConsultorHorasDatum[]>(() =>
    horasPorConsultor(this.recepciones(), this.consultorFiltro()),
  );

  constructor() {
    this.loadPeps();
    this.loadOcs();
    this.loadRecepciones();
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

  private loadOcs(): void {
    this.ocsLoading.set(true);
    this.ocsErrorMessage.set(null);

    this.ocsService.list().subscribe({
      next: (ocs) => {
        this.ocs.set(ocs);
        this.ocsLoading.set(false);
      },
      error: () => {
        this.ocsErrorMessage.set(LOAD_OCS_ERROR_MESSAGE);
        this.ocsLoading.set(false);
      },
    });
  }

  private loadRecepciones(): void {
    this.recepcionesLoading.set(true);
    this.recepcionesErrorMessage.set(null);

    this.recepcionesService.list().subscribe({
      next: (recepciones) => {
        this.recepciones.set(recepciones);
        this.recepcionesLoading.set(false);
      },
      error: () => {
        this.recepcionesErrorMessage.set(LOAD_RECEPCIONES_ERROR_MESSAGE);
        this.recepcionesLoading.set(false);
      },
    });
  }
}
