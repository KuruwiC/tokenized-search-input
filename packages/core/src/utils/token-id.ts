import { nanoid } from 'nanoid';
import { isDevelopment } from './env';

const TOKEN_ID_LENGTH = 21;

export function generateTokenId(): string {
  return nanoid(TOKEN_ID_LENGTH);
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
