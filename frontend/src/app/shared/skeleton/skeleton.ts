import { Component, input } from '@angular/core';

/** Bloque shimmer genérico para armar placeholders de carga (tabla, cards, gráficos). */
@Component({
  selector: 'app-skeleton',
  standalone: true,
  templateUrl: './skeleton.html',
  styleUrl: './skeleton.scss',
})
export class Skeleton {
  readonly width = input('100%');
  readonly height = input('1rem');
  readonly radius = input('0.25rem');
}
