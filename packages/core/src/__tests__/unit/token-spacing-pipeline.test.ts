/**
 * Unit tests for Token Spacing Pipeline.
 *
 * Tests the pipeline state management to ensure docChanged flag
 * is properly propagated between phases.
 */
import type { Node as ProseMirrorNode, Schema } from '@tiptap/pm/model';
import type { Transaction } from '@tiptap/pm/state';
import { describe, expect, it, vi } from 'vitest';
import type { DocumentRepairPhase, RepairContext } from '../../plugins/token-spacing/types';

// Mock objects for testing
const mockDoc = {} as ProseMirrorNode;
const mockSchema = {} as Schema;
const mockTransaction = {} as Transaction;

/**
 * Creates a mock RepairContext for testing.
 */
function createMockContext(overrides: Partial<RepairContext> = {}): RepairContext {
  return {
    doc: mockDoc,
    schema: mockSchema,
    oldFocusedPos: null,
    newFocusedPos: null,
    docChanged: false,
    focusChanged: true,
    isHistoryOperation: false,
    ...overrides,
  };
}

/**
 * Creates an execute function for testing phases.
 */
function createExecutor(): (phase: DocumentRepairPhase, context: RepairContext) => boolean {
  return (phase: DocumentRepairPhase, context: RepairContext) => {
    if (phase.shouldRun(context)) {
      return phase.execute(mockTransaction, context);
    }
    return false;
  };
}

/**
 * Mock implementation of runPipelineWithState for testing.
 * This mimics the actual pipeline execution behavior.
 */
function runPipelineWithState(
  phases: DocumentRepairPhase[],
  initialContext: RepairContext,
  execute: (phase: DocumentRepairPhase, context: RepairContext) => boolean
): { modified: boolean; finalDocChanged: boolean } {
  let docChanged = initialContext.docChanged;
  let modified = false;

  for (const phase of phases) {
    const context: RepairContext = {
      ...initialContext,
      docChanged,
    };

    if (phase.shouldRun(context)) {
      const phaseModified = execute(phase, context);
      if (phaseModified) {
        modified = true;
        docChanged = true;
      }
    }
  }

  return { modified, finalDocChanged: docChanged };
}

describe('Token Spacing Pipeline', () => {
  describe('Pipeline State Management', () => {
    it('propagates docChanged to subsequent phases after modification', () => {
      const phase1ShouldRun = vi.fn().mockReturnValue(true);
      const phase1Execute = vi.fn().mockReturnValue(true);
      const phase2ShouldRun = vi.fn().mockReturnValue(true);
      const phase2Execute = vi.fn().mockReturnValue(false);

      const phases: DocumentRepairPhase[] = [
        {
          name: 'phase1',
          shouldRun: phase1ShouldRun,
          execute: phase1Execute,
        },
        {
          name: 'phase2',
          shouldRun: phase2ShouldRun,
          execute: phase2Execute,
        },
      ];

      const initialContext = createMockContext({ docChanged: false, focusChanged: true });

      runPipelineWithState(phases, initialContext, createExecutor());

      // Phase 2 should see docChanged=true after phase 1 modifies document
      expect(phase2ShouldRun).toHaveBeenCalledWith(expect.objectContaining({ docChanged: true }));
    });

    it('does not set docChanged if no phase modifies document', () => {
      const phase1ShouldRun = vi.fn().mockReturnValue(true);
      const phase1Execute = vi.fn().mockReturnValue(false);
      const phase2ShouldRun = vi.fn().mockReturnValue(true);
      const phase2Execute = vi.fn().mockReturnValue(false);

      const phases: DocumentRepairPhase[] = [
        {
          name: 'phase1',
          shouldRun: phase1ShouldRun,
          execute: phase1Execute,
        },
        {
          name: 'phase2',
          shouldRun: phase2ShouldRun,
          execute: phase2Execute,
        },
      ];

      const initialContext = createMockContext({ docChanged: false, focusChanged: true });

      runPipelineWithState(phases, initialContext, createExecutor());

      // Phase 2 should still see docChanged=false
      expect(phase2ShouldRun).toHaveBeenCalledWith(expect.objectContaining({ docChanged: false }));
    });

    it('skips phases that should not run', () => {
      const phase1ShouldRun = vi.fn().mockReturnValue(false);
      const phase1Execute = vi.fn();
      const phase2ShouldRun = vi.fn().mockReturnValue(true);
      const phase2Execute = vi.fn().mockReturnValue(false);

      const phases: DocumentRepairPhase[] = [
        {
          name: 'phase1',
          shouldRun: phase1ShouldRun,
          execute: phase1Execute,
        },
        {
          name: 'phase2',
          shouldRun: phase2ShouldRun,
          execute: phase2Execute,
        },
      ];

      const initialContext = createMockContext({ docChanged: false, focusChanged: true });

      runPipelineWithState(phases, initialContext, createExecutor());

      expect(phase1Execute).not.toHaveBeenCalled();
      expect(phase2ShouldRun).toHaveBeenCalled();
    });

    it('returns modified=true if any phase modifies document', () => {
      const phases: DocumentRepairPhase[] = [
        {
          name: 'phase1',
          shouldRun: () => true,
          execute: () => false,
        },
        {
          name: 'phase2',
          shouldRun: () => true,
          execute: () => true,
        },
        {
          name: 'phase3',
          shouldRun: () => true,
          execute: () => false,
        },
      ];

      const initialContext = createMockContext({ docChanged: true, focusChanged: false });

      const result = runPipelineWithState(phases, initialContext, createExecutor());

      expect(result.modified).toBe(true);
    });

    it('preserves initial docChanged=true through all phases', () => {
      const shouldRunCalls: boolean[] = [];
      const phases: DocumentRepairPhase[] = [
        {
          name: 'phase1',
          shouldRun: (ctx) => {
            shouldRunCalls.push(ctx.docChanged);
            return false;
          },
          execute: () => false,
        },
        {
          name: 'phase2',
          shouldRun: (ctx) => {
            shouldRunCalls.push(ctx.docChanged);
            return false;
          },
          execute: () => false,
        },
      ];

      const initialContext = createMockContext({ docChanged: true, focusChanged: false });

      runPipelineWithState(phases, initialContext, createExecutor());

      expect(shouldRunCalls).toEqual([true, true]);
    });
  });
});
