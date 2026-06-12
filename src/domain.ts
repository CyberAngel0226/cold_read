export type RecommendationAction = "BUY_YES_SMALL" | "BUY_NO_SMALL" | "HOLD";

export type DecisionTimelineState =
  | "topic_received"
  | "markets_fetched"
  | "candidate_markets_screened"
  | "high_conviction_markets_confirmed"
  | "evidence_snapshot_created"
  | "agent_recommendations_created"
  | "final_decision_selected"
  | "audit_anchor_written"
  | "user_approval_recorded"
  | "execution_record_created";

export type DecisionTimelineEntry = {
  state: DecisionTimelineState;
  at: IsoTimestamp;
  summary?: string;
  refs?: readonly string[];
};

export type AnalysisLens = "MARKET_STRUCTURE" | "EXTERNAL_RISK";

export type ConfidenceLevel = "LOW" | "MEDIUM" | "HIGH";

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";

export type IsoTimestamp = string;

export type DecisionTopic = {
  id: string;
  text: string;
  submittedBy?: string;
  receivedAt: IsoTimestamp;
};

export type ScreeningOutcome = {
  kind: "screening_outcome";
  topicId: string;
  status: "NO_SCREENED_MARKETS";
  reason: string;
  rejectedMarketCount: number;
  createdAt: IsoTimestamp;
};

export type OneSidedSignal = {
  side: "YES" | "NO";
  price: number;
  rationale: string;
};

export type CandidateMarket = {
  id: string;
  sourceMarketId: string;
  question: string;
  outcomes: readonly ["YES", "NO"];
  prices: {
    yes: number;
    no: number;
  };
  volume: number;
  liquidity: number;
  closeTime: IsoTimestamp;
  resolutionRules: string;
  oneSidedSignal: OneSidedSignal;
  screeningRationale: string;
};

export type MarketRejectionReason =
  | "CLOSED_OR_PAUSED"
  | "NON_YES_NO_OUTCOMES"
  | "UNCLEAR_RESOLUTION_RULES"
  | "LOW_LIQUIDITY"
  | "TOO_NEAR_RESOLUTION"
  | "COMPLEX_MULTI_RESULT_MARKET"
  | "NO_ONE_SIDED_SIGNAL"
  | "SPECIALIZED_KNOWLEDGE_REQUIRED";

export type MarketRejection = {
  sourceMarketId: string;
  reason: MarketRejectionReason;
  message: string;
  rejectedAt: IsoTimestamp;
};

export type CandidateMarketScreeningResult = {
  kind: "candidate_markets_screened";
  topicId: string;
  screenedAt: IsoTimestamp;
  candidateMarkets: readonly CandidateMarket[];
  rejectedMarkets: readonly MarketRejection[];
  timeline: readonly DecisionTimelineEntry[];
};

export type ScreenedMarket = {
  id: string;
  sourceCandidateMarketId: string;
  polymarketId: string;
  question: string;
  outcomes: readonly ["YES", "NO"];
  prices: {
    yes: number;
    no: number;
  };
  volume: number;
  liquidity: number;
  closeTime: IsoTimestamp;
  resolutionRules: string;
  oneSidedSignal: OneSidedSignal;
  confirmationRationale: string;
};

export type DecisionRunStatus =
  | "CREATED"
  | "EVIDENCE_SNAPSHOT_CREATED"
  | "AGENT_RECOMMENDATIONS_CREATED"
  | "FINAL_DECISION_SELECTED"
  | "AUDIT_ANCHOR_WRITTEN"
  | "USER_APPROVAL_RECORDED"
  | "EXECUTION_RECORD_CREATED";

export type DecisionRun = {
  kind: "decision_run";
  id: string;
  topicId: string;
  screenedMarketIds: readonly string[];
  status: DecisionRunStatus;
  createdAt: IsoTimestamp;
};

export type ContextEvidenceItem = {
  id: string;
  marketId: string;
  sourceUrl: string;
  title: string;
  summary: string;
  retrievedAt: IsoTimestamp;
};

export type EvidenceSnapshot = {
  id: string;
  decisionRunId: string;
  createdAt: IsoTimestamp;
  marketEvidence: {
    screenedMarkets: readonly ScreenedMarket[];
  };
  contextEvidence: {
    items: readonly ContextEvidenceItem[];
  };
};

export type Currency = "USDC";

export type SmallStake = {
  amount: string;
  currency: Currency;
};

export type WalletActionProposal = {
  id: string;
  marketId: string;
  action: Exclude<RecommendationAction, "HOLD">;
  stake: SmallStake;
  rationale: string;
};

type AgentRecommendationBase = {
  id: string;
  decisionRunId: string;
  evidenceSnapshotId: string;
  analysisLens: AnalysisLens;
  rationale: string;
  confidence: ConfidenceLevel;
  riskLevel: RiskLevel;
  evidenceRefs: readonly string[];
  createdAt: string;
};

export type BuyAgentRecommendation = AgentRecommendationBase & {
  action: "BUY_YES_SMALL" | "BUY_NO_SMALL";
  targetMarketId: string;
  walletActionProposal: WalletActionProposal;
};

export type HoldAgentRecommendation = AgentRecommendationBase & {
  action: "HOLD";
  targetMarketId?: never;
  walletActionProposal?: never;
};

export type AgentRecommendation =
  | BuyAgentRecommendation
  | HoldAgentRecommendation;

export type VetoCondition =
  | "UNCLEAR_RESOLUTION_RULES"
  | "INSUFFICIENT_LIQUIDITY"
  | "TOO_NEAR_RESOLUTION"
  | "MAJOR_EXTERNAL_COUNTEREVIDENCE"
  | "INCOMPLETE_EVIDENCE_SNAPSHOT"
  | "MISSING_EVIDENCE_CITATIONS"
  | "WEAK_AGENT_CONVERGENCE";

type FinalDecisionBase = {
  id: string;
  decisionRunId: string;
  selectedRecommendationId?: string;
  rationale: string;
  vetoConditions: readonly VetoCondition[];
  createdAt: IsoTimestamp;
};

export type BuyFinalDecision = FinalDecisionBase & {
  action: "BUY_YES_SMALL" | "BUY_NO_SMALL";
  selectedRecommendationId: string;
  walletActionProposal: WalletActionProposal;
};

export type HoldFinalDecision = FinalDecisionBase & {
  action: "HOLD";
  walletActionProposal?: never;
};

export type FinalDecision = BuyFinalDecision | HoldFinalDecision;

export type AuditAnchor = {
  id: string;
  decisionRunId: string;
  network: "testnet";
  contentHash: string;
  transactionHash?: string;
  anchoredAt: IsoTimestamp;
};

export type UserApproval = {
  id: string;
  decisionRunId: string;
  finalDecisionId: string;
  walletActionProposalId: string;
  approvedBy: string;
  approvedAt: IsoTimestamp;
};

export type ExecutionRecord = {
  id: string;
  decisionRunId: string;
  finalDecisionId: string;
  userApprovalId?: string;
  status: "DEFERRED_FOR_MVP" | "REJECTED_BY_EXECUTION_GATE" | "EXECUTED";
  note: string;
  createdAt: IsoTimestamp;
};

export type AgentRunTraceReference = {
  engine: "GLM-5.1";
  generatedAt: IsoTimestamp;
  task: {
    targetMarketId: string;
    objective: string;
  };
  steps: readonly {
    id: string;
    title: string;
    phase: string;
    observation: string;
    evidenceRefs: readonly string[];
    riskChecks?: readonly string[];
    selfCorrections?: readonly string[];
  }[];
  finalLensDraft: {
    action: string;
    targetMarketId: string;
    confidence: number;
    riskLevel: string;
    rationale: string;
    evidenceRefs: readonly string[];
    externalRiskFlags: readonly string[];
  };
};

export type DecisionDossier = {
  id: string;
  topic: DecisionTopic;
  decisionRun: DecisionRun;
  evidenceSnapshot: EvidenceSnapshot;
  agentRunTrace?: AgentRunTraceReference;
  agentRecommendations: readonly AgentRecommendation[];
  finalDecision: FinalDecision;
  auditAnchors: readonly AuditAnchor[];
  userApproval?: UserApproval;
  executionRecord?: ExecutionRecord;
  timeline: readonly DecisionTimelineEntry[];
};
