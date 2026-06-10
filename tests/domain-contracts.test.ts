import type {
  AgentRecommendation,
  AuditAnchor,
  CandidateMarket,
  CandidateMarketScreeningResult,
  DecisionDossier,
  DecisionRun,
  DecisionTopic,
  DecisionTimelineState,
  EvidenceSnapshot,
  ExecutionRecord,
  FinalDecision,
  MarketRejection,
  RecommendationAction,
  ScreenedMarket,
  ScreeningOutcome,
  UserApproval,
} from "../src/domain.js";
import type {
  DecisionDossier as PublicDecisionDossier,
  FetchedPolymarketMarket,
} from "../src/index.js";

const allowedAction: RecommendationAction = "BUY_YES_SMALL";

const fullMvpTimeline: DecisionTimelineState[] = [
  "topic_received",
  "markets_fetched",
  "candidate_markets_screened",
  "high_conviction_markets_confirmed",
  "evidence_snapshot_created",
  "agent_recommendations_created",
  "final_decision_selected",
  "audit_anchor_written",
  "user_approval_recorded",
  "execution_record_created",
];

const holdRecommendation: AgentRecommendation = {
  id: "rec_1",
  decisionRunId: "run_1",
  evidenceSnapshotId: "snapshot_1",
  analysisLens: "MARKET_STRUCTURE",
  action: "HOLD",
  rationale: "No target market is safe enough for a wallet action.",
  confidence: "LOW",
  riskLevel: "HIGH",
  evidenceRefs: ["evidence_1"],
  createdAt: "2026-06-10T00:00:00.000Z",
};

const buyYesRecommendation: AgentRecommendation = {
  id: "rec_2",
  decisionRunId: "run_1",
  evidenceSnapshotId: "snapshot_1",
  analysisLens: "EXTERNAL_RISK",
  targetMarketId: "market_1",
  action: "BUY_YES_SMALL",
  walletActionProposal: {
    id: "wallet_action_1",
    marketId: "market_1",
    action: "BUY_YES_SMALL",
    stake: {
      amount: "5.00",
      currency: "USDC",
    },
    rationale: "Small fixed stake follows the one-sided consensus.",
  },
  rationale: "Context does not show major contrary risk.",
  confidence: "MEDIUM",
  riskLevel: "MEDIUM",
  evidenceRefs: ["evidence_1"],
  createdAt: "2026-06-10T00:00:00.000Z",
};

const decisionTopic: DecisionTopic = {
  id: "topic_1",
  text: "Will the Fed cut rates at the next meeting?",
  submittedBy: "user_1",
  receivedAt: "2026-06-10T00:00:00.000Z",
};

const noMarketOutcome: ScreeningOutcome = {
  kind: "screening_outcome",
  topicId: "topic_1",
  status: "NO_SCREENED_MARKETS",
  reason: "No related markets passed the screener.",
  rejectedMarketCount: 3,
  createdAt: "2026-06-10T00:01:00.000Z",
};

const screenedMarket: ScreenedMarket = {
  id: "market_1",
  polymarketId: "poly_1",
  question: "Will the Fed cut rates at the next meeting?",
  outcomes: ["YES", "NO"],
  prices: {
    yes: 0.92,
    no: 0.08,
  },
  volume: 100000,
  liquidity: 25000,
  closeTime: "2026-07-10T00:00:00.000Z",
  resolutionRules: "Resolves YES if the Fed cuts rates at the next meeting.",
  oneSidedSignal: {
    side: "YES",
    price: 0.92,
    rationale: "YES price is strongly one-sided.",
  },
  confirmationRationale: "Rules and context are clear enough for MVP analysis.",
};

const candidateMarket: CandidateMarket = {
  id: "candidate_1",
  sourceMarketId: "market_1",
  question: "Will the Fed cut rates at the next meeting?",
  outcomes: ["YES", "NO"],
  prices: {
    yes: 0.92,
    no: 0.08,
  },
  volume: 100000,
  liquidity: 25000,
  closeTime: "2026-07-10T00:00:00.000Z",
  resolutionRules: "Resolves YES if the Fed cuts rates at the next meeting.",
  oneSidedSignal: {
    side: "YES",
    price: 0.92,
    rationale: "YES price is strongly one-sided.",
  },
  screeningRationale: "Polymarket-only gates passed.",
};

// @ts-expect-error Candidate Markets are not Tavily-confirmed Screened Markets.
const candidateAsScreenedMarket: ScreenedMarket = candidateMarket;

const marketRejection: MarketRejection = {
  sourceMarketId: "market_2",
  reason: "LOW_LIQUIDITY",
  message: "Liquidity cannot support a Small Stake.",
  rejectedAt: "2026-06-10T00:02:00.000Z",
};

const candidateMarketScreeningResult: CandidateMarketScreeningResult = {
  kind: "candidate_markets_screened",
  topicId: "topic_1",
  screenedAt: "2026-06-10T00:02:00.000Z",
  candidateMarkets: [candidateMarket],
  rejectedMarkets: [marketRejection],
  timeline: [
    "topic_received",
    "markets_fetched",
    "candidate_markets_screened",
  ],
};

const fetchedPolymarketMarket: FetchedPolymarketMarket = {
  id: "poly_1",
  conditionId: "0xabc",
  question: "Will the Fed cut rates at the next meeting?",
  outcomes: ["YES", "NO"],
  prices: {
    YES: 0.92,
    NO: 0.08,
  },
  status: "active",
  volume: 100000,
  liquidity: 25000,
  closeTime: "2026-07-10T00:00:00.000Z",
  resolutionRules: "Resolves YES if the Fed cuts rates at the next meeting.",
  raw: {
    id: "poly_1",
  },
};

// @ts-expect-error Fetched Polymarket material must pass through Market Screener first.
const fetchedAsCandidateMarket: CandidateMarket = fetchedPolymarketMarket;

// @ts-expect-error Fetched Polymarket material is not a Tavily-confirmed Screened Market.
const fetchedAsScreenedMarket: ScreenedMarket = fetchedPolymarketMarket;

const decisionRun: DecisionRun = {
  kind: "decision_run",
  id: "run_1",
  topicId: "topic_1",
  screenedMarketIds: ["market_1"],
  status: "EVIDENCE_SNAPSHOT_CREATED",
  createdAt: "2026-06-10T00:02:00.000Z",
};

const evidenceSnapshot: EvidenceSnapshot = {
  id: "snapshot_1",
  decisionRunId: "run_1",
  createdAt: "2026-06-10T00:03:00.000Z",
  marketEvidence: {
    screenedMarkets: [screenedMarket],
  },
  contextEvidence: {
    items: [
      {
        id: "evidence_1",
        marketId: "market_1",
        sourceUrl: "https://example.com/fed-rates",
        title: "Fed rate context",
        summary: "No major contrary evidence found.",
        retrievedAt: "2026-06-10T00:03:00.000Z",
      },
    ],
  },
};

const finalDecision: FinalDecision = {
  id: "decision_1",
  decisionRunId: "run_1",
  selectedRecommendationId: "rec_2",
  action: "BUY_YES_SMALL",
  rationale: "Selected the external risk recommendation.",
  vetoConditions: [],
  walletActionProposal: buyYesRecommendation.walletActionProposal,
  createdAt: "2026-06-10T00:05:00.000Z",
};

const auditAnchor: AuditAnchor = {
  id: "anchor_1",
  decisionRunId: "run_1",
  network: "testnet",
  contentHash: "0x1234",
  transactionHash: "0xabcd",
  anchoredAt: "2026-06-10T00:06:00.000Z",
};

const userApproval: UserApproval = {
  id: "approval_1",
  decisionRunId: "run_1",
  finalDecisionId: "decision_1",
  walletActionProposalId: "wallet_action_1",
  approvedBy: "user_1",
  approvedAt: "2026-06-10T00:07:00.000Z",
};

const executionRecord: ExecutionRecord = {
  id: "execution_1",
  decisionRunId: "run_1",
  finalDecisionId: "decision_1",
  userApprovalId: "approval_1",
  status: "DEFERRED_FOR_MVP",
  note: "User approved the plan, but real prediction market execution is deferred.",
  createdAt: "2026-06-10T00:08:00.000Z",
};

const decisionDossier: DecisionDossier = {
  id: "dossier_1",
  topic: decisionTopic,
  decisionRun,
  evidenceSnapshot,
  agentRecommendations: [buyYesRecommendation, holdRecommendation],
  finalDecision,
  auditAnchors: [auditAnchor],
  userApproval,
  executionRecord,
  timeline: fullMvpTimeline,
};

const publicDossier: PublicDecisionDossier = decisionDossier;

// @ts-expect-error Recommendation actions are intentionally closed for MVP.
const unsupportedAction: RecommendationAction = "BUY_MAYBE_LARGE";

// @ts-expect-error Buy recommendations need a target market and wallet action proposal.
const malformedBuyRecommendation: AgentRecommendation = {
  id: "rec_4",
  decisionRunId: "run_1",
  evidenceSnapshotId: "snapshot_1",
  analysisLens: "EXTERNAL_RISK",
  action: "BUY_NO_SMALL",
  rationale: "Buy recommendations cannot be ambiguous.",
  confidence: "MEDIUM",
  riskLevel: "MEDIUM",
  evidenceRefs: ["evidence_1"],
  createdAt: "2026-06-10T00:00:00.000Z",
};

// @ts-expect-error HOLD recommendations cannot target a market or execution plan.
const malformedHoldRecommendation: AgentRecommendation = {
  id: "rec_3",
  decisionRunId: "run_1",
  evidenceSnapshotId: "snapshot_1",
  analysisLens: "MARKET_STRUCTURE",
  action: "HOLD",
  targetMarketId: "market_1",
  rationale: "A hold cannot request execution.",
  confidence: "LOW",
  riskLevel: "HIGH",
  evidenceRefs: ["evidence_1"],
  createdAt: "2026-06-10T00:00:00.000Z",
};

void allowedAction;
void fullMvpTimeline;
void holdRecommendation;
void buyYesRecommendation;
void decisionTopic;
void noMarketOutcome;
void candidateMarket;
void candidateAsScreenedMarket;
void marketRejection;
void candidateMarketScreeningResult;
void fetchedPolymarketMarket;
void fetchedAsCandidateMarket;
void fetchedAsScreenedMarket;
void decisionRun;
void evidenceSnapshot;
void finalDecision;
void auditAnchor;
void userApproval;
void executionRecord;
void decisionDossier;
void publicDossier;
void unsupportedAction;
void malformedBuyRecommendation;
void malformedHoldRecommendation;
