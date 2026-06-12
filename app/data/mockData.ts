import type {
  DecisionTimelineState,
  ExecutionRecord,
  BuyFinalDecision,
  RecommendationAction,
  RiskLevel,
  VetoCondition,
} from "../../src/index.js";

export type SystemStatus = {
  name: string;
  status: string;
  tone: "chain" | "anchor" | "preview" | "warning";
};

export type StrategyParameters = {
  maxStakePerMarket: string;
  dailyRiskBudget: string;
  minimumLiquidity: string;
  minimumHoursUntilClose: string;
  oneSidedPriceThreshold: string;
  minimumConfidence: "LOW" | "MEDIUM" | "HIGH";
  allowedActions: readonly RecommendationAction[];
  vetoOnMajorCounterevidence: boolean;
  requiresUserApproval: boolean;
  executionNetwork: string;
};

export type DecisionRunCard = {
  id: string;
  topic: string;
  stage: string;
  finalAction: RecommendationAction | "PENDING";
  riskLevel: RiskLevel | "VETO";
  auditStatus: "ANCHOR" | "PENDING" | "NO ANCHOR";
  executionStatus: ExecutionRecord["status"] | "NONE";
  strategyName: string;
};

export type MonitoredMarket = {
  question: string;
  price: string;
  status: string;
};

export type TimelineStage = {
  title: string;
  domainStates: readonly DecisionTimelineState[];
  status: "complete" | "active" | "pending";
  summary: string;
};

export type EvidenceReview = {
  lens: string;
  action: RecommendationAction;
  confidence: "LOW" | "MEDIUM" | "HIGH";
  riskLevel: RiskLevel;
  evidenceRefs: readonly string[];
  rationale: string;
};

export type AuditReference = {
  label: string;
  value: string;
  href?: string;
};

export type DecisionRunDetail = {
  id: string;
  topic: string;
  finalDecision: BuyFinalDecision;
  riskLevel: RiskLevel;
  auditStatus: "ANCHOR VERIFIED";
  executionRecord: ExecutionRecord;
  stages: readonly TimelineStage[];
  evidenceReviews: readonly EvidenceReview[];
  auditReferences: readonly AuditReference[];
  strategyParameters: StrategyParameters;
};

export const systemStatuses: readonly SystemStatus[] = [
  { name: "Polymarket", status: "ONLINE", tone: "chain" },
  { name: "Tavily", status: "ONLINE", tone: "chain" },
  { name: "Cobo", status: "V2 PREVIEW", tone: "preview" },
  { name: "Audit Anchor", status: "READY", tone: "anchor" },
  { name: "Agent Queue", status: "2 RUNNING", tone: "warning" },
];

export const strategyParameters: StrategyParameters = {
  maxStakePerMarket: "5 USDC",
  dailyRiskBudget: "25 USDC",
  minimumLiquidity: "1000 USDC",
  minimumHoursUntilClose: "168h",
  oneSidedPriceThreshold: "0.85",
  minimumConfidence: "MEDIUM",
  allowedActions: ["BUY_YES_SMALL", "BUY_NO_SMALL", "HOLD"],
  vetoOnMajorCounterevidence: true,
  requiresUserApproval: true,
  executionNetwork: "Amoy preview",
};

export const decisionRuns: readonly DecisionRunCard[] = [
  {
    id: "run_1",
    topic: "美联储会在 7 月降息吗？",
    stage: "Final Decision selected",
    finalAction: "BUY_YES_SMALL",
    riskLevel: "LOW",
    auditStatus: "ANCHOR",
    executionStatus: "DEFERRED_FOR_MVP",
    strategyName: "Conservative v2",
  },
  {
    id: "run_2",
    topic: "CPI 是否会低于 3%？",
    stage: "Veto downgrade",
    finalAction: "HOLD",
    riskLevel: "VETO",
    auditStatus: "NO ANCHOR",
    executionStatus: "NONE",
    strategyName: "Conservative v2",
  },
  {
    id: "run_3",
    topic: "9 月是否维持利率？",
    stage: "External Risk Lens running",
    finalAction: "PENDING",
    riskLevel: "MEDIUM",
    auditStatus: "PENDING",
    executionStatus: "NONE",
    strategyName: "Conservative v2",
  },
];

export const monitoredMarkets: readonly MonitoredMarket[] = [
  { question: "Fed cuts in July", price: "YES 0.92", status: "$25k liquidity" },
  { question: "CPI below 3%", price: "YES 0.62", status: "rejected" },
  { question: "Fed holds in Sep", price: "NO 0.71", status: "watch" },
];

export const decisionRunDetail: DecisionRunDetail = {
  id: "run_1",
  topic: "美联储会在 7 月降息吗？",
  riskLevel: "LOW",
  auditStatus: "ANCHOR VERIFIED",
  finalDecision: {
    id: "decision_1",
    decisionRunId: "run_1",
    selectedRecommendationId: "rec_market_structure_1",
    action: "BUY_YES_SMALL",
    rationale:
      "选择 Market Structure Lens 的建议。External Risk Lens 未发现重大反证；Decision Scorer 没有合成新的钱包动作。",
    vetoConditions: [],
    walletActionProposal: {
      id: "wallet_action_1",
      marketId: "screened_candidate_poly_1",
      action: "BUY_YES_SMALL",
      stake: { amount: "5.00", currency: "USDC" },
      rationale: "Market structure supports a small YES position.",
    },
    createdAt: "2026-06-10T00:06:00.000Z",
  },
  executionRecord: {
    id: "execution_1",
    decisionRunId: "run_1",
    finalDecisionId: "decision_1",
    userApprovalId: "approval_1",
    status: "DEFERRED_FOR_MVP",
    note: "User approved the proposed wallet action, but MVP does not place real prediction market trades.",
    createdAt: "2026-06-10T00:09:00.000Z",
  },
  stages: [
    {
      title: "收到主题",
      domainStates: ["topic_received"],
      status: "complete",
      summary: "记录用户提交的 Decision Topic。",
    },
    {
      title: "获取盘口",
      domainStates: ["markets_fetched"],
      status: "complete",
      summary: "从 Polymarket 获取 18 个相关盘口。",
    },
    {
      title: "筛选与确认盘口",
      domainStates: [
        "candidate_markets_screened",
        "high_conviction_markets_confirmed",
      ],
      status: "complete",
      summary: "3 个候选盘口通过粗筛，1 个被 Tavily 确认为高置信盘口。",
    },
    {
      title: "冻结证据",
      domainStates: ["evidence_snapshot_created"],
      status: "complete",
      summary: "snapshot_1 冻结盘口证据与上下文证据。",
    },
    {
      title: "Agent 分析建议",
      domainStates: ["agent_recommendations_created"],
      status: "complete",
      summary: "Market Structure 和 External Risk 两个 Agent 生成建议。",
    },
    {
      title: "最终决策",
      domainStates: ["final_decision_selected"],
      status: "active",
      summary: "默认展开最终决策，展示选择依据、Veto 检查和钱包动作提案边界。",
    },
    {
      title: "审计锚定",
      domainStates: ["audit_anchor_written"],
      status: "complete",
      summary: "Audit Anchor 写入 Amoy preview 链上引用。",
    },
    {
      title: "确认与执行",
      domainStates: ["user_approval_recorded", "execution_record_created"],
      status: "complete",
      summary: "用户确认拟执行方案，Execution Record 记录为 DEFERRED_FOR_MVP。",
    },
  ],
  evidenceReviews: [
    {
      lens: "Market Structure Lens",
      action: "BUY_YES_SMALL",
      confidence: "MEDIUM",
      riskLevel: "LOW",
      evidenceRefs: [
        "screened_candidate_poly_1",
        "volume:100000",
        "liquidity:25000",
      ],
      rationale: "价格一边倒、流动性足够、结算规则清晰，支持小额 YES。",
    },
    {
      lens: "External Risk Lens",
      action: "BUY_YES_SMALL",
      confidence: "MEDIUM",
      riskLevel: "LOW",
      evidenceRefs: ["context_1", "no_major_counterevidence"],
      rationale: "上下文证据未发现重大反证或临近事件反转风险。",
    },
  ],
  auditReferences: [
    { label: "network", value: "Amoy preview" },
    {
      label: "tx hash",
      value: "0x8f3a...9d21",
      href: "https://amoy.polygonscan.com/tx/0x8f3a9d21",
    },
    { label: "dossier hash", value: "sha256:7fa2...c031" },
    {
      label: "block explorer",
      value: "amoy.polygonscan.com/tx/0x8f3a...",
      href: "https://amoy.polygonscan.com/tx/0x8f3a9d21",
    },
  ],
  strategyParameters,
};

export function auditSummary(run: DecisionRunDetail): string {
  return [
    `ColdRead 决策 ${run.id} 已锚定到 ${run.auditReferences[0]?.value ?? "testnet"}。`,
    `Final Decision: ${run.finalDecision.action}`,
    `Dossier Hash: ${run.auditReferences.find((ref) => ref.label === "dossier hash")?.value ?? "N/A"}`,
    `Tx: ${run.auditReferences.find((ref) => ref.label === "tx hash")?.href ?? "N/A"}`,
  ].join("\n");
}

export function auditJson(run: DecisionRunDetail): string {
  return JSON.stringify(
    {
      decisionRunId: run.id,
      network: run.auditReferences[0]?.value,
      dossierHash: run.auditReferences.find((ref) => ref.label === "dossier hash")?.value,
      finalDecisionId: run.finalDecision.id,
      executionRecordId: run.executionRecord.id,
      transactionHash: run.auditReferences.find((ref) => ref.label === "tx hash")?.value,
      blockExplorerUrl: run.auditReferences.find((ref) => ref.label === "tx hash")?.href,
    },
    null,
    2,
  );
}
