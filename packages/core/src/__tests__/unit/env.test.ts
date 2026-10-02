import { afterEach, describe, expect, it, vi } from 'vitest';
import { isDevelopment } from '../../utils/env';

describe('isDevelopment', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('is true outside production', () => {
    vi.stubEnv('NODE_ENV', 'development');
    expect(isDevelopment()).toBe(true);
  });

  it('is false in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(isDevelopment()).toBe(false);
  });

  it('does not throw when process is not defined', () => {
    vi.stubGlobal('process', undefined);
    expect(isDevelopment()).toBe(false);
  });
});
