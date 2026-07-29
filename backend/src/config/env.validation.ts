import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().port().default(3000),

  MONGODB_URI: Joi.string().uri().required(),

  JWT_SECRET: Joi.string().min(32).required(),
  JWT_EXPIRATION: Joi.string().default('15m'),
  JWT_REFRESH_SECRET: Joi.string().min(32).required(),
  JWT_REFRESH_EXPIRATION: Joi.string().default('7d'),

  CORS_ORIGIN: Joi.string().default('http://localhost:4200'),

  // Código requerido para crear un usuario desde /signup. Si no se define,
  // el alta pública queda deshabilitada (AuthService.register siempre
  // rechaza una comparación contra '').
  SIGNUP_CODE: Joi.string().optional(),

  RATE_LIMIT_TTL: Joi.number().default(60),
  RATE_LIMIT_MAX: Joi.number().default(100),
  AUTH_RATE_LIMIT_TTL: Joi.number().default(60),
  AUTH_RATE_LIMIT_MAX: Joi.number().default(5),

  AUTH_MAX_ATTEMPTS: Joi.number().default(5),
  AUTH_LOCKOUT_MINUTES: Joi.number().default(15),

  SEED_ADMIN_USERNAME: Joi.string().optional(),
  SEED_ADMIN_EMAIL: Joi.string().email({ tlds: false }).optional(),
  SEED_ADMIN_PASSWORD: Joi.string().min(8).optional(),
  SEED_ADMIN_FIRST_NAME: Joi.string().optional(),
  SEED_ADMIN_LAST_NAME: Joi.string().optional(),
});
