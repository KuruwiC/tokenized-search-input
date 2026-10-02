import { isDevelopment } from './env';

export function generateTokenId(): string {
  return crypto.randomUUID();
}

export function ensureTokenId(id: string | undefined | null): string {
  if (id && typeof id === 'string' && id.length > 0) {
    return id;
  }

  // Log warning in development for debugging
  if (isDevelopment() && id === undefined) {
    console.warn(
      '[TokenizedSearchInput] Token missing ID, regenerating. This may indicate a schema migration issue.'
    );
  }

  return generateTokenId();
}
