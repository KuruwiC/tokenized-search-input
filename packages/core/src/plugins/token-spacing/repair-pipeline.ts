import type { Transaction } from '@tiptap/pm/state';
import { documentRepairPhases } from './phases';
import type { RepairContext } from './types';

/**
 * Mutable pipeline state that tracks document changes across phases.
 * This solves the context staleness problem where phases need to know
 * if previous phases modified the document.
 */
interface PipelineState {
  docChanged: boolean;
}

/**
 * Run the document repair pipeline.
 *
 * Executes all repair phases in order, accumulating modifications into
 * a single transaction. Uses PipelineState to properly propagate
 * docChanged flag to subsequent phases.
 *
 * @param tr - The transaction to modify
 * @param initialContext - The initial repair context
 * @returns true if any phase modified the document
 */
export function runDocumentRepairPipeline(tr: Transaction, initialContext: RepairContext): boolean {
  const state: PipelineState = {
    docChanged: initialContext.docChanged,
  };

  let modified = false;

  for (const phase of documentRepairPhases) {
    const context: RepairContext = {
      ...initialContext,
      docChanged: state.docChanged,
      doc: tr.doc,
    };

    if (phase.shouldRun(context)) {
      const phaseModified = phase.execute(tr, context);
      if (phaseModified) {
        modified = true;
        state.docChanged = true;
      }
    }
  }

  return modified;
}
