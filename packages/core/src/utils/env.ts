// Declared locally so the source typechecks in consumers that do not install
// @types/node. Bundlers still replace `process.env.NODE_ENV` textually, and the
// typeof guard keeps unbundled ESM consumers from throwing a ReferenceError.
declare const process: { env: { NODE_ENV?: string } } | undefined;

export function isDevelopment(): boolean {
  return typeof process !== 'undefined' && process.env.NODE_ENV !== 'production';
}
