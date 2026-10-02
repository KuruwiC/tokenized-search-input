/**
 * Token Spacing Plugin
 *
 * Re-exports from the token-spacing module.
 * @see ./token-spacing/index.ts for implementation details
 */

export { SelectionInvariantExtension, selectionInvariantKey } from './selection-invariant-plugin';
export {
  type DocumentRepairPhase,
  type RepairContext,
  TokenSpacingExtension,
  tokenSpacingKey,
} from './token-spacing';
