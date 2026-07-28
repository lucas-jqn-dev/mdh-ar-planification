import { Types } from 'mongoose';

/**
 * Renombra `_id -> id` y quita `__v` de un subdocumento poblado (ref de
 * Mongoose) dentro de un `toJSON.transform`. No hace nada si el path no fue
 * poblado (queda `null` o como `Types.ObjectId` sin popular).
 */
export function normalizePopulatedRef(value: unknown): void {
  if (!value || typeof value !== 'object') {
    return;
  }

  const record = value as Record<string, unknown>;

  if (record._id instanceof Types.ObjectId) {
    record.id = record._id.toHexString();
    delete record._id;
  }

  delete record.__v;
}
