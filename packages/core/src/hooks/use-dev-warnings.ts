import { useEffect, useRef } from 'react';
import type { FieldDefinition } from '../types';
import { isDevelopment } from '../utils/env';

interface DevWarningInput {
  fields: readonly FieldDefinition[];
  initialDelimiter?: string | undefined;
  defaultValue?: string | undefined;
}

export function useDevWarnings({ fields, initialDelimiter, defaultValue }: DevWarningInput): void {
  const mountedDelimiterRef = useRef(initialDelimiter);
  const mountedDefaultValueRef = useRef(defaultValue);

  useEffect(() => {
    if (!isDevelopment()) return;
    if (initialDelimiter !== mountedDelimiterRef.current) {
      console.warn(
        '[TokenizedSearchInput] initialDelimiter changed after initialization. ' +
          'This has no effect. initialDelimiter is frozen at mount time.'
      );
    }
  }, [initialDelimiter]);

  useEffect(() => {
    if (!isDevelopment()) return;
    if (defaultValue !== mountedDefaultValueRef.current) {
      console.warn(
        '[TokenizedSearchInput] defaultValue changed after mount. ' +
          'This has no effect. Use ref.setValue() to change the value programmatically.'
      );
    }
  }, [defaultValue]);

  useEffect(() => {
    if (!isDevelopment()) return;
    for (const field of fields) {
      if (!field.operators || field.operators.length === 0) {
        console.warn(
          `[TokenizedSearchInput] Field "${field.key}" has no operators defined. ` +
            'At least one operator is required for proper functionality.'
        );
      }
    }
  }, [fields]);
}
