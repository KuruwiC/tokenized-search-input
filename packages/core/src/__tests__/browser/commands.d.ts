import 'vitest/browser';

declare module 'vitest/browser' {
  interface BrowserCommands {
    /** Inserts text into the focused element as one insertion, the way an input method commits it. */
    insertText: (text: string) => Promise<void>;
    /** Taps the editor with a touch at a position relative to its top-left corner. */
    tapEditor: (position: { x: number; y: number }) => Promise<void>;
  }
}
