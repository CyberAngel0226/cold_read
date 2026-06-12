import { createHash } from "node:crypto";

import type {
  AgentRecommendation,
  AgentRunTraceReference,
  DecisionDossier,
  EvidenceSnapshot,
  ExecutionRecord,
  FinalDecision,
} from "./domain.js";

const AUDIT_HASH_ALGORITHM = "sha256";
const AUDIT_CANONICALIZATION = "coldread-json-v1";

export type AuditHashMetadata = {
  algorithm: typeof AUDIT_HASH_ALGORITHM;
  canonicalization: typeof AUDIT_CANONICALIZATION;
  hash: string;
};

export type DecisionDossierAuditSections = {
  agentRecommendations: readonly AgentRecommendation[];
  agentRunTrace?: AgentRunTraceReference;
  evidenceSnapshot: EvidenceSnapshot;
  executionRecord?: ExecutionRecord;
  finalDecision: FinalDecision;
};

export type DecisionDossierAuditPayload = {
  dossierId: string;
  decisionRunId: string;
  sections: DecisionDossierAuditSections;
  hashes: {
    agentRecommendations: AuditHashMetadata;
    agentRunTrace?: AuditHashMetadata;
    dossier: AuditHashMetadata;
    evidenceSnapshot: AuditHashMetadata;
    executionRecord?: AuditHashMetadata;
    finalDecision: AuditHashMetadata;
  };
};

type JsonValue =
  | null
  | boolean
  | number
  | string
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

export function canonicalizeAuditPayload(value: unknown): string {
  return JSON.stringify(toCanonicalJsonValue(value));
}

export function hashAuditPayload(value: unknown): string {
  return createHash("sha256")
    .update(canonicalizeAuditPayload(value), "utf8")
    .digest("hex");
}

export function createDecisionDossierAuditPayload(
  decisionDossier: DecisionDossier,
): DecisionDossierAuditPayload {
  const sections: DecisionDossierAuditSections = {
    agentRecommendations: decisionDossier.agentRecommendations,
    ...(decisionDossier.agentRunTrace === undefined
      ? {}
      : { agentRunTrace: decisionDossier.agentRunTrace }),
    evidenceSnapshot: decisionDossier.evidenceSnapshot,
    ...(decisionDossier.executionRecord === undefined
      ? {}
      : { executionRecord: decisionDossier.executionRecord }),
    finalDecision: decisionDossier.finalDecision,
  };

  return {
    dossierId: decisionDossier.id,
    decisionRunId: decisionDossier.decisionRun.id,
    sections,
    hashes: {
      agentRecommendations: createAuditHashMetadata(sections.agentRecommendations),
      ...(sections.agentRunTrace === undefined
        ? {}
        : { agentRunTrace: createAuditHashMetadata(sections.agentRunTrace) }),
      dossier: createAuditHashMetadata(sections),
      evidenceSnapshot: createAuditHashMetadata(sections.evidenceSnapshot),
      ...(sections.executionRecord === undefined
        ? {}
        : { executionRecord: createAuditHashMetadata(sections.executionRecord) }),
      finalDecision: createAuditHashMetadata(sections.finalDecision),
    },
  };
}

function createAuditHashMetadata(value: unknown): AuditHashMetadata {
  return {
    algorithm: AUDIT_HASH_ALGORITHM,
    canonicalization: AUDIT_CANONICALIZATION,
    hash: hashAuditPayload(value),
  };
}

function toCanonicalJsonValue(value: unknown): JsonValue {
  if (value === null) {
    return null;
  }

  if (
    typeof value === "boolean"
    || typeof value === "number"
    || typeof value === "string"
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(toCanonicalJsonValue);
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const canonicalRecord: Record<string, JsonValue> = {};
    for (const key of Object.keys(record).sort()) {
      const child = record[key];
      if (child !== undefined) {
        canonicalRecord[key] = toCanonicalJsonValue(child);
      }
    }
    return canonicalRecord;
  }

  throw new Error("Audit payloads must be JSON-compatible.");
}
