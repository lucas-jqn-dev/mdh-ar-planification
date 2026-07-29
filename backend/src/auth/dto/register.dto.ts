import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class RegisterDto {
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  username: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  firstName: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  lastName: string;

  // Comparado contra SIGNUP_CODE (.env) en AuthService.register — no hay
  // @IsEnum(UserRole) ni "role" acá a propósito: el alta pública siempre crea
  // un USER (default del schema), nunca un ADMIN/SUPER_ADMIN.
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  signupCode: string;
}
