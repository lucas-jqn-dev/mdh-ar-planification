import { inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { map } from 'rxjs';

/** Signal reactivo que indica si el viewport actual es de tipo "handset" (mobile). */
export function injectIsHandset() {
  const breakpointObserver = inject(BreakpointObserver);
  return toSignal(
    breakpointObserver.observe(Breakpoints.Handset).pipe(map((result) => result.matches)),
    { initialValue: false },
  );
}
