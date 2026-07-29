import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { AppConfig } from './config/configuration';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const logger = app.get(Logger);
  app.useLogger(logger);

  const configService = app.get(ConfigService<AppConfig, true>);
  const isProduction =
    configService.get('nodeEnv', { infer: true }) === 'production';

  // El frontend (en producción, servido desde este mismo proceso vía
  // ServeStaticModule) espera la API bajo "/api" (ver `environment.ts`).
  // Los endpoints reales (`/auth/...`, `/master-data/...`, etc.) no
  // cambian de nombre, solo quedan montados bajo este prefijo.
  app.setGlobalPrefix('api');

  // Este proceso ahora sirve también el index.html de Angular (ver
  // ServeStaticModule en app.module.ts), así que por primera vez la propia
  // página carga con el header CSP de Helmet puesto (en dev, `ng serve`
  // corre en otro proceso/puerto y nunca lo lleva). Helmet ya permite
  // style-src/font-src desde cualquier https: por default, pero no define
  // connect-src (cae al default-src 'self') — y el service worker de
  // Angular reintenta el fetch de Google Fonts como una llamada fetch()
  // propia, que sí cae bajo connect-src. Se agrega solo esa directiva,
  // scopeada a los dos dominios de Google Fonts, sin tocar el resto de los
  // defaults de Helmet.
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          ...helmet.contentSecurityPolicy.getDefaultDirectives(),
          'connect-src': [
            "'self'",
            'https://fonts.googleapis.com',
            'https://fonts.gstatic.com',
          ],
        },
      },
    }),
  );
  app.use(cookieParser());
  app.enableCors({
    origin: configService.get('corsOrigin', { infer: true }),
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());

  if (!isProduction) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('planification-mdh-team API')
      .setDescription('API de autenticacion y recursos de la aplicacion')
      .setVersion('0.1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = configService.get('port', { infer: true });
  await app.listen(port);
  logger.log(`Backend escuchando en http://localhost:${port}`);
}

void bootstrap();
