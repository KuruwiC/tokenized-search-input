/**
 * ParseResult type for robust error handling in parsers.
 * Uses discriminated union pattern for type-safe result handling.
 */

export type ParseOk<T> = { readonly ok: true; readonly value: T };
export type ParseErr = { readonly ok: false; readonly error: string; readonly hint?: string };
export type ParseResult<T> = ParseOk<T> | ParseErr;

/**
 * Parser function type that returns a ParseResult.
 */
export type ParseFn<T> = (input: string) => ParseResult<T>;

export const ok = <T>(value: T): ParseOk<T> => ({ ok: true, value });

export const err = (error: string, hint?: string): ParseErr => ({ ok: false, error, hint });

export const isOk = <T>(r: ParseResult<T>): r is ParseOk<T> => r.ok;

/**
 * Chain multiple parsers, returning the first successful result.
 * Returns the first Ok result, or the last Err if all fail.
 */
export const chainParsers = <T>(parsers: readonly ParseFn<T>[]): ParseFn<T> => {
  return (input: string): ParseResult<T> => {
    let lastErr: ParseErr = err('No parsers provided');
    for (const parse of parsers) {
      const result = parse(input);
      if (result.ok) return result;
      lastErr = result;
    }
    return lastErr;
  };
};
