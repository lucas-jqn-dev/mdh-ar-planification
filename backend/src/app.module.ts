import { join } from 'path';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { ServeStaticModule } from '@nestjs/serve-static';
import configuration from './config/configuration';
import { envValidationSchema } from './config/env.validation';
import { AppConfig } from './config/configuration';
import { DatabaseModule } from './database/database.module';
import { LoggerModule } from './logger/logger.module';
import { HealthModule } from './health/health.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { MasterDataModule } from './master-data/master-data.module';
import { RecepcionesModule } from './recepciones/recepciones.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema: envValidationSchema,
      validationOptions: { abortEarly: false },
    }),
    LoggerModule,
    DatabaseModule,
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService<AppConfig, true>) => {
        const rateLimit = configService.get('rateLimit', { infer: true });
        return [
          { name: 'default', ttl: rateLimit.ttl * 1000, limit: rateLimit.max },
        ];
      },
    }),
    HealthModule,
    UsersModule,
    AuthModule,
    MasterDataModule,
    RecepcionesModule,
    // Sirve el build de Angular (frontend/dist/frontend/browser) para
    // desplegar frontend + backend como un único Web Service en Render —
    // mismo origen, necesario porque las cookies de auth usan
    // `sameSite: 'strict'`. Al final del array a propósito (convención de
    // Nest): así sus rutas catch-all quedan registradas después de las de
    // los módulos de arriba, que tienen prioridad. `exclude` además deja
    // pasar "/api/*" explícitamente hacia los controllers de Nest (montados
    // bajo ese prefijo, ver main.ts) como defensa adicional; todo lo demás
    // cae en el index.html de Angular (client-side routing). No rompe el
    // dev local: `ng serve` (puerto 4200) nunca pasa por acá, y si la
    // carpeta no existe todavía (no se corrió `ng build`) esto simplemente
    // sirve 404 en vez de tirar error.
    ServeStaticModule.forRoot({
      rootPath: join(
        __dirname,
        '..',
        '..',
        'frontend',
        'dist',
        'frontend',
        'browser',
      ),
      exclude: ['/api/{*splat}'],
    }),
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
