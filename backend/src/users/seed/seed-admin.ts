import { ConflictException, Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from '../../app.module';
import { AppConfig } from '../../config/configuration';
import { UsersService } from '../users.service';
import { UserRole } from '../schemas/user.schema';

/**
 * Crea el primer usuario ADMIN a partir de variables de entorno.
 * No existe endpoint publico de registro en esta etapa: uso `npm run seed:admin`.
 */
async function bootstrap(): Promise<void> {
  const logger = new Logger('SeedAdmin');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  const configService = app.get(ConfigService<AppConfig, true>);
  const usersService = app.get(UsersService);
  const seedAdmin = configService.get('seedAdmin', { infer: true });

  const { username, email, password, firstName, lastName } = seedAdmin;

  if (!username || !email || !password || !firstName || !lastName) {
    logger.error(
      'Faltan variables de entorno SEED_ADMIN_USERNAME / SEED_ADMIN_EMAIL / ' +
        'SEED_ADMIN_PASSWORD / SEED_ADMIN_FIRST_NAME / SEED_ADMIN_LAST_NAME en .env',
    );
    await app.close();
    process.exit(1);
  }

  try {
    await usersService.create({
      username,
      email,
      password,
      firstName,
      lastName,
      role: UserRole.ADMIN,
    });
    logger.log(`Usuario ADMIN "${username}" creado correctamente.`);
  } catch (error) {
    if (error instanceof ConflictException) {
      logger.warn(
        `El usuario "${username}" o el email "${email}" ya existe. No se creo nada.`,
      );
    } else {
      logger.error(
        'Error creando el usuario admin',
        error instanceof Error ? error.stack : error,
      );
      await app.close();
      process.exit(1);
    }
  }

  await app.close();
}

void bootstrap();
