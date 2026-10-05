/** The result of reading a date, a time or a datetime from text. */

export type ParseOk<T> = { readonly ok: true; readonly value: T };
export type ParseErr = { readonly ok: false; readonly error: string; readonly hint?: string };
export type ParseResult<T> = ParseOk<T> | ParseErr;

export const ok = <T>(value: T): ParseOk<T> => ({ ok: true, value });

export const err = (error: string, hint?: string): ParseErr => ({ ok: false, error, hint });
