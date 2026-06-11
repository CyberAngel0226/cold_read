import type {
  DecisionTimelineEntry,
  DecisionTimelineState,
  IsoTimestamp,
} from "./domain.js";

export type AppendTimelineEntryInput = {
  timeline: readonly DecisionTimelineEntry[];
  state: DecisionTimelineState;
  at: IsoTimestamp;
  summary?: string;
  refs?: readonly string[];
};

export function createTimelineEntry(
  state: DecisionTimelineState,
  at: IsoTimestamp,
  details: {
    summary?: string;
    refs?: readonly string[];
  } = {},
): DecisionTimelineEntry {
  return {
    state,
    at,
    ...(details.summary === undefined ? {} : { summary: details.summary }),
    ...(details.refs === undefined ? {} : { refs: details.refs }),
  };
}

export function appendTimelineEntry(
  input: AppendTimelineEntryInput,
): readonly DecisionTimelineEntry[] {
  return [
    ...input.timeline,
    createTimelineEntry(input.state, input.at, {
      summary: input.summary,
      refs: input.refs,
    }),
  ];
}

export function timelineStates(
  timeline: readonly DecisionTimelineEntry[],
): readonly DecisionTimelineState[] {
  return timeline.map((entry) => entry.state);
}
