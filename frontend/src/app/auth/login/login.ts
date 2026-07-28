import { Component, ElementRef, ViewChild, afterNextRender, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormControl, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../core/services/auth.service';

const GENERIC_ERROR_MESSAGE = 'Usuario o contraseña incorrectos';
const UNKNOWN_ERROR_MESSAGE = 'No pudimos iniciar sesión. Intenta nuevamente en unos minutos.';

interface LoginForm {
  identifier: FormControl<string>;
  password: FormControl<string>;
}

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  @ViewChild('identifierInput') private readonly identifierInput?: ElementRef<HTMLInputElement>;

  constructor() {
    afterNextRender(() => this.identifierInput?.nativeElement.focus());
  }

  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly hidePassword = signal(true);

  readonly form = new FormGroup<LoginForm>({
    identifier: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(3), Validators.maxLength(120)],
    }),
    password: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(8), Validators.maxLength(128)],
    }),
  });

  toggleHidePassword(event: Event): void {
    event.preventDefault();
    this.hidePassword.update((hidden) => !hidden);
  }

  submit(): void {
    if (this.form.invalid || this.loading()) {
      this.form.markAllAsTouched();
      return;
    }

    const identifier = this.form.controls.identifier.value.trim();
    const password = this.form.controls.password.value;

    this.errorMessage.set(null);
    this.loading.set(true);

    this.authService.login({ identifier, password }).subscribe({
      next: () => {
        this.loading.set(false);
        void this.router.navigate(['/home']);
      },
      error: (error: unknown) => {
        this.loading.set(false);
        this.errorMessage.set(
          error instanceof HttpErrorResponse && error.status === 401
            ? GENERIC_ERROR_MESSAGE
            : UNKNOWN_ERROR_MESSAGE,
        );
      },
    });
  }
}
