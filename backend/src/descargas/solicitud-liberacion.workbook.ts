import { Workbook, Worksheet, Fill, Alignment } from 'exceljs';
import { PaisPep } from '../master-data/peps/schemas/pep.schema';

export const SOLICITUD_LIBERACION_FILE_NAME =
  'Solicitud Liberacion Solpeds - Equipo MDH AR.xlsx';

/** Una fila de la tabla: una posición de `Oc` (completada: false, sin numeroOc). */
export interface SolicitudLiberacionRow {
  recurso: string;
  mesDesde: string;
  mesHasta: string;
  horas: number;
  tarifaHora: number;
  imputacion: string;
  solped: string;
  pais: PaisPep;
}

const COLUMN_COUNT = 8;
const DATA_START_ROW = 6;

// Colores exactos del archivo de referencia (.claude/Solicitud Liberacion
// Solpeds - Equipo MDH AR.xlsx): ahí son theme:5 (accent2, E97132 en el tema
// "Office") con tint 0.6/0.4. Se usan acá como ARGB literal (no theme+tint)
// para no depender de que un workbook armado desde cero por ExcelJS incluya
// la misma paleta de tema — así el color sale idéntico sin importar eso.
const TOTALS_FILL: Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFF6C6AD' },
};
const HEADER_FILL: Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFF2AA84' },
};

const THIN_EDGE = { style: 'thin' as const, color: { argb: 'FF000000' } };
const FULL_BORDER = {
  top: THIN_EDGE,
  left: THIN_EDGE,
  bottom: THIN_EDGE,
  right: THIN_EDGE,
};

const CURRENCY_NUM_FMT = '"$"#,##0.00;[Red]"$"-#,##0.00';
const TOTALS_NUM_FMT = '_ "$"* #,##0_ ;_ "$"* -#,##0_ ;_ "$"* "-"_ ;_ @_ ';
const MES_NUM_FMT = 'mmm-yy';

const MIN_COLUMN_WIDTH = 8;
const MAX_COLUMN_WIDTH = 60;
const COLUMN_WIDTH_PADDING = 2;

export async function buildSolicitudLiberacionWorkbook(
  rows: SolicitudLiberacionRow[],
): Promise<Buffer> {
  const workbook = new Workbook();
  workbook.creator = 'MDH AR • Planificador';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Solicitud Liberación');

  writeHeaderTotals(sheet, rows);
  writeTableHeader(sheet);
  writeDataRows(sheet, rows);
  autoFitColumns(sheet);

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

/** Filas 1-3: Total OPEX COL / Total OPEX ARG / Total Gasto, mismo orden que el archivo de referencia. */
function writeHeaderTotals(
  sheet: Worksheet,
  rows: SolicitudLiberacionRow[],
): void {
  const totalCol = sumaMontoPorPais(rows, PaisPep.COLOMBIA);
  const totalArg = sumaMontoPorPais(rows, PaisPep.ARGENTINA);
  const totalGasto = totalArg + totalCol;

  const filas: Array<{ label: string; value: number }> = [
    { label: 'Total OPEX COL', value: totalCol },
    { label: 'Total OPEX ARG', value: totalArg },
    { label: 'Total Gasto ', value: totalGasto },
  ];

  filas.forEach((fila, index) => {
    const rowNumber = index + 1;

    for (let col = 1; col <= COLUMN_COUNT; col++) {
      const cell = sheet.getCell(rowNumber, col);
      cell.font = { bold: true, size: 11, name: 'Calibri' };
      cell.fill = TOTALS_FILL;
      cell.border = FULL_BORDER;
    }

    sheet.getCell(rowNumber, 1).value = fila.label;
    sheet.getCell(rowNumber, 1).alignment = {
      horizontal: 'right',
      vertical: 'middle',
    };

    const valueCell = sheet.getCell(rowNumber, 2);
    valueCell.value = fila.value;
    valueCell.numFmt = TOTALS_NUM_FMT;
    valueCell.alignment = { horizontal: 'left', vertical: 'middle' };

    sheet.mergeCells(rowNumber, 2, rowNumber, COLUMN_COUNT);
  });
}

/** Filas 4-5: encabezado de la tabla (con "Validez OC" repartido en F.Desde/F.Hasta). */
function writeTableHeader(sheet: Worksheet): void {
  for (const rowNumber of [4, 5]) {
    for (let col = 1; col <= COLUMN_COUNT; col++) {
      const cell = sheet.getCell(rowNumber, col);
      cell.font = { bold: true, size: 9, name: 'Calibri' };
      cell.fill = HEADER_FILL;
      cell.border = FULL_BORDER;
      cell.alignment = {
        horizontal: 'center',
        vertical: 'middle',
        wrapText: true,
      };
    }
  }

  sheet.getCell(4, 1).value = 'Recurso';
  sheet.mergeCells(4, 1, 5, 1);

  sheet.getCell(4, 2).value = 'Validez OC';
  sheet.mergeCells(4, 2, 4, 3);
  sheet.getCell(5, 2).value = 'F. Desde';
  sheet.getCell(5, 3).value = 'F. Hasta';

  sheet.getCell(4, 4).value = 'Horas';
  sheet.mergeCells(4, 4, 5, 4);

  sheet.getCell(4, 5).value = 'Tarifa';
  sheet.mergeCells(4, 5, 5, 5);

  sheet.getCell(4, 6).value = 'Imputacion';
  sheet.mergeCells(4, 6, 5, 6);

  sheet.getCell(4, 7).value = 'SolPed';
  sheet.mergeCells(4, 7, 5, 7);

  sheet.getCell(4, 8).value = 'TOTAL SOLPED';
  sheet.mergeCells(4, 8, 5, 8);
}

/**
 * A partir de la fila 6: una fila por posición de OC. Las columnas SolPed /
 * Total Solped solo llevan valor en la primera fila de cada grupo de SolPed
 * (las filas ya vienen ordenadas por solped, así que un grupo siempre es un
 * rango contiguo) — el resto queda sin valor y termina "tapado" por el merge
 * vertical del grupo, igual que en el archivo de referencia.
 */
function writeDataRows(sheet: Worksheet, rows: SolicitudLiberacionRow[]): void {
  if (rows.length === 0) {
    return;
  }

  const montos = rows.map((row) => row.tarifaHora * row.horas);
  const totalesPorSolped = calcularTotalPorSolped(rows, montos);

  let inicioGrupo = DATA_START_ROW;

  rows.forEach((row, index) => {
    const rowNumber = DATA_START_ROW + index;
    const esInicioDeGrupo =
      index === 0 || rows[index - 1].solped !== row.solped;

    if (esInicioDeGrupo) {
      inicioGrupo = rowNumber;
    }

    writeCell(sheet, rowNumber, 1, row.recurso, { horizontal: 'left' });
    writeCell(
      sheet,
      rowNumber,
      2,
      mesAnioToDate(row.mesDesde),
      { horizontal: 'center' },
      MES_NUM_FMT,
    );
    writeCell(
      sheet,
      rowNumber,
      3,
      mesAnioToDate(row.mesHasta),
      { horizontal: 'center' },
      MES_NUM_FMT,
    );
    writeCell(sheet, rowNumber, 4, row.horas, { horizontal: 'center' });
    writeCell(
      sheet,
      rowNumber,
      5,
      row.tarifaHora,
      { horizontal: 'center' },
      CURRENCY_NUM_FMT,
    );
    writeCell(sheet, rowNumber, 6, row.imputacion, {
      horizontal: 'center',
      vertical: 'middle',
      wrapText: true,
    });

    if (esInicioDeGrupo) {
      writeCell(sheet, rowNumber, 7, parseSolped(row.solped), {
        horizontal: 'center',
        vertical: 'middle',
      });
      writeCell(
        sheet,
        rowNumber,
        8,
        totalesPorSolped.get(row.solped) ?? 0,
        { horizontal: 'center', vertical: 'middle' },
        CURRENCY_NUM_FMT,
      );
    } else {
      writeCell(sheet, rowNumber, 7, undefined, {
        horizontal: 'center',
        vertical: 'middle',
      });
      writeCell(
        sheet,
        rowNumber,
        8,
        undefined,
        { horizontal: 'center', vertical: 'middle' },
        CURRENCY_NUM_FMT,
      );
    }

    const esFinDeGrupo =
      index === rows.length - 1 || rows[index + 1].solped !== row.solped;
    if (esFinDeGrupo && rowNumber > inicioGrupo) {
      sheet.mergeCells(inicioGrupo, 7, rowNumber, 7);
      sheet.mergeCells(inicioGrupo, 8, rowNumber, 8);
    }
  });
}

function writeCell(
  sheet: Worksheet,
  row: number,
  col: number,
  value: string | number | Date | undefined,
  alignment: Partial<Alignment>,
  numFmt?: string,
): void {
  const cell = sheet.getCell(row, col);
  if (value !== undefined) {
    cell.value = value;
  }
  cell.font = { size: 9, name: 'Calibri' };
  cell.border = FULL_BORDER;
  cell.alignment = { vertical: 'middle', ...alignment };
  if (numFmt) {
    cell.numFmt = numFmt;
  }
}

/** Ancho de cada columna según el texto más largo que va a mostrar (headers + datos). */
function autoFitColumns(sheet: Worksheet): void {
  for (let col = 1; col <= COLUMN_COUNT; col++) {
    let maxLength = MIN_COLUMN_WIDTH;

    sheet.getColumn(col).eachCell({ includeEmpty: false }, (cell) => {
      maxLength = Math.max(maxLength, displayLength(cell.value, cell.numFmt));
    });

    sheet.getColumn(col).width = Math.min(
      maxLength + COLUMN_WIDTH_PADDING,
      MAX_COLUMN_WIDTH,
    );
  }
}

function displayLength(value: unknown, numFmt?: string): number {
  if (value instanceof Date) {
    return value.toLocaleDateString('es-AR', {
      month: 'short',
      year: '2-digit',
    }).length;
  }

  if (typeof value === 'number') {
    const esMoneda = typeof numFmt === 'string' && numFmt.includes('$');
    const formatted = esMoneda
      ? `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : value.toLocaleString('en-US');
    return formatted.length;
  }

  if (typeof value === 'string') {
    return value.length;
  }

  return 0;
}

function sumaMontoPorPais(
  rows: SolicitudLiberacionRow[],
  pais: PaisPep,
): number {
  return rows
    .filter((row) => row.pais === pais)
    .reduce((total, row) => total + row.tarifaHora * row.horas, 0);
}

function calcularTotalPorSolped(
  rows: SolicitudLiberacionRow[],
  montos: number[],
): Map<string, number> {
  const totales = new Map<string, number>();
  rows.forEach((row, index) => {
    totales.set(row.solped, (totales.get(row.solped) ?? 0) + montos[index]);
  });
  return totales;
}

/** SolPed como número si es todo dígitos (mismo look que el archivo de referencia), string si no. */
function parseSolped(solped: string): string | number {
  return /^\d+$/.test(solped) ? Number(solped) : solped;
}

/** "YYYY-MM" -> Date UTC del día 1 — evita el corrimiento de huso horario ya documentado para mesDesde/mesHasta. */
function mesAnioToDate(mesAnio: string): Date {
  const [anio, mes] = mesAnio.split('-').map(Number);
  return new Date(Date.UTC(anio, mes - 1, 1));
}
