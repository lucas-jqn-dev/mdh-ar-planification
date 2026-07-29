import { Component, ElementRef, ViewChild, afterNextRender, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormControl, FormGroup, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../core/services/auth.service';

const UNKNOWN_ERROR_MESSAGE = 'No pudimos crear la cuenta. Intenta nuevamente en unos minutos.';

interface SignupForm {
  username: FormControl<string>;
  email: FormControl<string>;
  firstName: FormControl<string>;
  lastName: FormControl<string>;
  password: FormControl<string>;
  signupCode: FormControl<string>;
}

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './signup.html',
  styleUrl: './signup.scss',
})
export class Signup {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  @ViewChild('usernameInput') private readonly usernameInput?: ElementRef<HTMLInputElement>;

  constructor() {
    afterNextRender(() => this.usernameInput?.nativeElement.focus());
  }

  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly hidePassword = signal(true);

  readonly form = new FormGroup<SignupForm>({
    username: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(3), Validators.maxLength(50)],
    }),
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    firstName: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(80)],
    }),
    lastName: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(80)],
    }),
    password: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(8), Validators.maxLength(128)],
    }),
    signupCode: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(120)],
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

    const { username, email, firstName, lastName, password, signupCode } = this.form.getRawValue();

    this.errorMessage.set(null);
    this.loading.set(true);

    this.authService
      .register({
        username: username.trim(),
        email: email.trim(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        password,
        signupCode: signupCode.trim(),
      })
      .subscribe({
        next: () => {
          this.loading.set(false);
          void this.router.navigate(['/home']);
        },
        error: (error: unknown) => {
          this.loading.set(false);
          const message =
            error instanceof HttpErrorResponse && typeof error.error?.message === 'string'
              ? error.error.message
              : UNKNOWN_ERROR_MESSAGE;
          this.errorMessage.set(message);
        },
      });
  }
}
