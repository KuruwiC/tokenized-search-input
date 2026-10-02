import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDevWarnings } from '../../hooks/use-dev-warnings';
import type { FieldDefinition } from '../../types';

const status: FieldDefinition = {
  key: 'status',
  label: 'Status',
  type: 'string',
  operators: ['is'],
};

interface Props {
  fields: FieldDefinition[];
  initialDelimiter?: string;
  defaultValue?: string;
}

describe('useDevWarnings', () => {
  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warn.mockRestore();
    vi.unstubAllEnvs();
  });

  function render(initialProps: Props) {
    return renderHook((props: Props) => useDevWarnings(props), { initialProps });
  }

  it('stays silent for a valid configuration', () => {
    const { rerender } = render({ fields: [status], defaultValue: 'status:is:open' });
    rerender({ fields: [status], defaultValue: 'status:is:open' });

    expect(warn).not.toHaveBeenCalled();
  });

  it('warns about a field without operators', () => {
    const broken = { ...status, key: 'broken', operators: [] } as unknown as FieldDefinition;

    render({ fields: [broken] });

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Field "broken" has no operators'));
  });

  it('warns when initialDelimiter changes after mount', () => {
    const { rerender } = render({ fields: [status], initialDelimiter: ':' });
    expect(warn).not.toHaveBeenCalled();

    rerender({ fields: [status], initialDelimiter: '=' });

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('initialDelimiter changed'));
  });

  it('warns when defaultValue changes after mount', () => {
    const { rerender } = render({ fields: [status], defaultValue: 'status:is:open' });
    expect(warn).not.toHaveBeenCalled();

    rerender({ fields: [status], defaultValue: 'status:is:closed' });

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('defaultValue changed'));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('setValue'));
  });

  it('does not comment on how often the fields array changes identity', () => {
    const { rerender } = render({ fields: [status] });

    for (let i = 0; i < 5; i++) rerender({ fields: [{ ...status }] });

    expect(warn).not.toHaveBeenCalled();
  });

  it('stays silent in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    const broken = { ...status, operators: [] } as unknown as FieldDefinition;

    const { rerender } = render({ fields: [broken], defaultValue: 'a' });
    rerender({ fields: [broken], defaultValue: 'b' });

    expect(warn).not.toHaveBeenCalled();
  });
});
