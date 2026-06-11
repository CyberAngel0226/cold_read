import type {
  AuditHashMetadata,
  DecisionDossierAuditPayload,
} from "./decision-dossier-audit.js";
import type {
  AuditAnchor,
  DecisionDossier,
  IsoTimestamp,
} from "./domain.js";

export type AuditAnchorNetwork = "testnet";

export type AuditAnchorRequest = {
  version: "coldread.audit-anchor.v1";
  network: AuditAnchorNetwork;
  decisionRunId: string;
  dossierId: string;
  contentHash: string;
  hashAlgorithm: AuditHashMetadata["algorithm"];
  canonicalization: AuditHashMetadata["canonicalization"];
  sectionHashes: {
    agentRecommendations: string;
    evidenceSnapshot: string;
    executionRecord?: string;
    finalDecision: string;
  };
};

export type CreateAuditAnchorRequestInput = {
  auditPayload: DecisionDossierAuditPayload;
  network: AuditAnchorNetwork;
};

export type AuditAnchorChainMetadata = {
  network: AuditAnchorNetwork;
  transactionHash?: string;
};

export type RecordAuditAnchorMetadataInput = {
  decisionDossier: DecisionDossier;
  anchorRequest: AuditAnchorRequest;
  chainMetadata: AuditAnchorChainMetadata;
  now: IsoTimestamp;
  createAuditAnchorId: () => string;
};

export type AuditAnchorRecordedResult = {
  auditAnchor: AuditAnchor;
  decisionDossier: DecisionDossier;
};

export function createAuditAnchorRequest(
  input: CreateAuditAnchorRequestInput,
): AuditAnchorRequest {
  return {
    version: "coldread.audit-anchor.v1",
    network: input.network,
    decisionRunId: input.auditPayload.decisionRunId,
    dossierId: input.auditPayload.dossierId,
    contentHash: input.auditPayload.hashes.dossier.hash,
    hashAlgorithm: input.auditPayload.hashes.dossier.algorithm,
    canonicalization: input.auditPayload.hashes.dossier.canonicalization,
    sectionHashes: {
      agentRecommendations: input.auditPayload.hashes.agentRecommendations.hash,
      evidenceSnapshot: input.auditPayload.hashes.evidenceSnapshot.hash,
      ...(input.auditPayload.hashes.executionRecord === undefined
        ? {}
        : { executionRecord: input.auditPayload.hashes.executionRecord.hash }),
      finalDecision: input.auditPayload.hashes.finalDecision.hash,
    },
  };
}

export function recordAuditAnchorMetadata(
  input: RecordAuditAnchorMetadataInput,
): AuditAnchorRecordedResult {
  if (input.chainMetadata.network !== input.anchorRequest.network) {
    throw new Error("Audit Anchor chain metadata network must match the request.");
  }

  const auditAnchor: AuditAnchor = {
    id: input.createAuditAnchorId(),
    decisionRunId: input.anchorRequest.decisionRunId,
    network: input.chainMetadata.network,
    contentHash: input.anchorRequest.contentHash,
    ...(input.chainMetadata.transactionHash === undefined
      ? {}
      : { transactionHash: input.chainMetadata.transactionHash }),
    anchoredAt: input.now,
  };

  return {
    auditAnchor,
    decisionDossier: {
      ...input.decisionDossier,
      decisionRun: {
        ...input.decisionDossier.decisionRun,
        status: "AUDIT_ANCHOR_WRITTEN",
      },
      auditAnchors: [...input.decisionDossier.auditAnchors, auditAnchor],
      timeline: [...input.decisionDossier.timeline, "audit_anchor_written"],
    },
  };
}
