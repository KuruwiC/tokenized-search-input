import type { QuerySnapshot, TokenizedSearchInputRef } from '@kuruwic/tokenized-search-input';

import { useEffect, useRef, useState } from 'react';

/**
 * Owns an editor ref plus the latest snapshot. The initial snapshot is read from the
 * editor after mount so a `defaultValue` shows up in the readout before any edit.
 */
export function useEditorSnapshot() {
  const ref = useRef<TokenizedSearchInputRef>(null);
  const [snapshot, setSnapshot] = useState<QuerySnapshot | null>(null);

  useEffect(() => {
    setSnapshot(ref.current?.getSnapshot() ?? null);
  }, []);

  /** Replaces the query, as if the user had typed it, and moves focus into the editor. */
  const load = (query: string) => {
    ref.current?.setValue(query);
    setSnapshot(ref.current?.getSnapshot() ?? null);
    ref.current?.focus();
  };

  return { ref, snapshot, setSnapshot, load };
}
