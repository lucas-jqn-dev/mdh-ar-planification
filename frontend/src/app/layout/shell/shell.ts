import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { AuthService } from '../../core/services/auth.service';
import { injectIsHandset } from '../../core/utils/breakpoint.util';

interface NavItem {
  label: string;
  path: string;
  icon: string;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Home', path: 'home', icon: 'home' },
  { label: 'Datos Maestros', path: 'master_data', icon: 'inventory_2' },
  { label: 'Recepciones', path: 'order_recepcions', icon: 'move_to_inbox' },
];

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatToolbarModule,
    MatSidenavModule,
    MatListModule,
    MatIconModule,
    MatButtonModule,
  ],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
})
export class Shell {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly navItems = NAV_ITEMS;
  readonly currentUser = this.authService.currentUser;
  readonly isHandset = injectIsHandset();

  logout(): void {
    this.authService.logout().subscribe({
      complete: () => void this.router.navigate(['/login']),
    });
  }
}
