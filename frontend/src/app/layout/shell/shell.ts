import { Component, inject, signal, viewChild } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatSidenavContainer, MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { AuthService } from '../../core/services/auth.service';
import { injectIsHandset } from '../../core/utils/breakpoint.util';
import { ConfirmDialog, ConfirmDialogData } from '../../shared/confirm-dialog/confirm-dialog';

interface NavItem {
  label: string;
  path: string;
  icon: string;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', path: 'home', icon: 'home' },
  { label: 'Datos Maestros', path: 'master_data', icon: 'inventory_2' },
  { label: 'Órdenes de Compra', path: 'orders', icon: 'shopping_cart' },
  { label: 'Recepciones', path: 'order_recepcions', icon: 'move_to_inbox' },
  { label: 'Descargas', path: 'descargas', icon: 'download' },
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
  private readonly dialog = inject(MatDialog);

  readonly navItems = NAV_ITEMS;
  readonly currentUser = this.authService.currentUser;
  readonly isHandset = injectIsHandset();

  private readonly sidenavContainer = viewChild.required(MatSidenavContainer);

  /** Solo aplica en desktop (mode="side"); en mobile el drawer es "over" y siempre a ancho completo. */
  readonly collapsed = signal(false);

  toggleCollapsed(): void {
    this.collapsed.update((collapsed) => !collapsed);
  }

  /**
   * `MatDrawerContainer` solo recalcula el `margin-left` de `mat-sidenav-content`
   * en cambios de estado abierto/cerrado o de `mode` — nunca en un cambio de
   * ancho in-place como el de este toggle (drawer se mantiene `opened`/`side`
   * todo el tiempo). Sin este hook el margin queda pegado en el ancho viejo
   * (240px) y se ve un hueco entre el sidenav colapsado y el contenido.
   */
  onSidenavTransitionEnd(event: TransitionEvent): void {
    if (event.propertyName === 'width') {
      this.sidenavContainer().updateContentMargins();
    }
  }

  logout(): void {
    const dialogRef = this.dialog.open<ConfirmDialog, ConfirmDialogData, boolean>(ConfirmDialog, {
      width: 'min(420px, 92vw)',
      data: {
        title: 'Cerrar sesión',
        message: '¿Desea cerrar sesión y salir?',
        confirmText: 'Cerrar sesión',
        cancelText: 'Cancelar',
      },
    });

    dialogRef.afterClosed().subscribe((confirmed) => {
      if (confirmed) {
        this.authService.logout().subscribe({
          complete: () => void this.router.navigate(['/login']),
        });
      }
    });
  }
}
