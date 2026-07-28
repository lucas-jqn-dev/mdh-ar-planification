export interface AppConfig {
  nodeEnv: string;
  port: number;
  mongoUri: string;
  jwt: {
    secret: string;
    expiresIn: string;
    refreshSecret: string;
    refreshExpiresIn: string;
  };
  corsOrigin: string;
  rateLimit: {
    ttl: number;
    max: number;
    authTtl: number;
    authMax: number;
  };
  auth: {
    maxAttempts: number;
    lockoutMinutes: number;
  };
  seedAdmin: {
    username?: string;
    email?: string;
    password?: string;
    firstName?: string;
    lastName?: string;
  };
}

export default (): AppConfig => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3000', 10),
  mongoUri: process.env.MONGODB_URI ?? '',
  jwt: {
    secret: process.env.JWT_SECRET ?? '',
    expiresIn: process.env.JWT_EXPIRATION ?? '15m',
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? '',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRATION ?? '7d',
  },
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:4200',
  rateLimit: {
    ttl: parseInt(process.env.RATE_LIMIT_TTL ?? '60', 10),
    max: parseInt(process.env.RATE_LIMIT_MAX ?? '100', 10),
    authTtl: parseInt(process.env.AUTH_RATE_LIMIT_TTL ?? '60', 10),
    authMax: parseInt(process.env.AUTH_RATE_LIMIT_MAX ?? '5', 10),
  },
  auth: {
    maxAttempts: parseInt(process.env.AUTH_MAX_ATTEMPTS ?? '5', 10),
    lockoutMinutes: parseInt(process.env.AUTH_LOCKOUT_MINUTES ?? '15', 10),
  },
  seedAdmin: {
    username: process.env.SEED_ADMIN_USERNAME,
    email: process.env.SEED_ADMIN_EMAIL,
    password: process.env.SEED_ADMIN_PASSWORD,
    firstName: process.env.SEED_ADMIN_FIRST_NAME,
    lastName: process.env.SEED_ADMIN_LAST_NAME,
  },
});
