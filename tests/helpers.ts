import {
  createTimelineEntry,
  timelineStates,
  type DecisionTimelineEntry,
  type DecisionTimelineState,
  type IsoTimestamp,
} from "../src/index.js";

export const testTimelineAt: IsoTimestamp = "2026-06-10T00:00:00.000Z";

export function timelineEntries(
  states: readonly DecisionTimelineState[],
  at: IsoTimestamp = testTimelineAt,
): readonly DecisionTimelineEntry[] {
  return states.map((state) => createTimelineEntry(state, at));
}

export { timelineStates };
