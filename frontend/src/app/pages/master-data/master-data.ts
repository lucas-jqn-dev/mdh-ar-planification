import { Component, viewChild } from '@angular/core';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ConsultoresPanel } from './consultores/consultores-panel';
import { PepsPanel } from './peps/peps-panel';

@Component({
  selector: 'app-master-data',
  standalone: true,
  imports: [MatExpansionModule, MatButtonModule, MatIconModule, ConsultoresPanel, PepsPanel],
  templateUrl: './master-data.html',
  styleUrl: './master-data.scss',
})
export class MasterData {
  readonly consultoresPanel = viewChild(ConsultoresPanel);
  readonly pepsPanel = viewChild(PepsPanel);
}
