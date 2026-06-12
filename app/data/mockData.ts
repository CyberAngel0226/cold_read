import type {
  DecisionTimelineState,
  ExecutionRecord,
  FinalDecision,
  RecommendationAction,
  RiskLevel,
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

export type AgentRunTraceStep = {
  index: number;
  title: string;
  tool: string;
  status: "completed" | "failed";
  observation: string;
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
  finalDecision: FinalDecision;
  riskLevel: RiskLevel;
  auditStatus: "SEPOLIA READY" | "ANCHOR VERIFIED";
  executionRecord: ExecutionRecord;
  stages: readonly TimelineStage[];
  evidenceReviews: readonly EvidenceReview[];
  auditReferences: readonly AuditReference[];
  agentRunTrace: readonly AgentRunTraceStep[];
  traceHash: string;
  calldata: string;
  explorerLink: string;
  strategyParameters: StrategyParameters;
};

export const systemStatuses: readonly SystemStatus[] = [
  { name: "Polymarket", status: "LIVE DATA", tone: "chain" },
  { name: "GLM-5.1", status: "LONG-HORIZON", tone: "warning" },
  { name: "Trace Hash", status: "COMPUTED", tone: "anchor" },
  { name: "Sepolia Anchor", status: "DRY-RUN READY", tone: "anchor" },
  { name: "Cobo", status: "V2 PREVIEW", tone: "preview" },
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
  executionNetwork: "Sepolia audit anchor; Polymarket execution deferred",
};

export const decisionRuns: readonly DecisionRunCard[] = [
  {
    id: "run_glm_1",
    topic: "New Rihanna Album before GTA VI?",
    stage: "GLM-5.1 long-horizon audit complete",
    finalAction: "HOLD",
    riskLevel: "MEDIUM",
    auditStatus: "ANCHOR",
    executionStatus: "DEFERRED_FOR_MVP",
    strategyName: "Z.AI Hackathon demo",
  },
  {
    id: "run_glm_2",
    topic: "Fed cuts in July",
    stage: "Trace validation pending",
    finalAction: "PENDING",
    riskLevel: "MEDIUM",
    auditStatus: "PENDING",
    executionStatus: "NONE",
    strategyName: "Cached replay demo",
  },
  {
    id: "run_glm_3",
    topic: "CPI below 3%",
    stage: "Veto downgrade",
    finalAction: "HOLD",
    riskLevel: "VETO",
    auditStatus: "NO ANCHOR",
    executionStatus: "NONE",
    strategyName: "Risk boundary demo",
  },
];

export const monitoredMarkets: readonly MonitoredMarket[] = [
  { question: "New Rihanna Album before GTA VI?", price: "YES 0.51 / NO 0.49", status: "live Polymarket material" },
  { question: "Fed cuts in July", price: "YES 0.92", status: "demo watch only" },
  { question: "CPI below 3%", price: "YES 0.62", status: "veto example" },
];

const traceHash = "2ad57cbc33ecaa236a671390614cbe560b66b2757354e192478a5f4a4ad8b763";

export const decisionRunDetail: DecisionRunDetail = {
  id: "run_glm_1",
  topic: "New Rihanna Album before GTA VI?",
  riskLevel: "MEDIUM",
  auditStatus: "SEPOLIA READY",
  finalDecision: {
    id: "decision_glm_hold_1",
    decisionRunId: "run_glm_1",
    selectedRecommendationId: "rec_external_risk_hold_1",
    action: "HOLD",
    rationale:
      "GLM-5.1 完成长程审计后选择 HOLD：盘口是真实可分析的，但外部风险字段在校验阶段缺失，系统要求先修复并保留审计证据，不直接进入交易执行。",
    vetoConditions: ["INCOMPLETE_EVIDENCE_SNAPSHOT"],
    createdAt: "2026-06-13T00:00:00.000Z",
  },
  executionRecord: {
    id: "execution_glm_1",
    decisionRunId: "run_glm_1",
    finalDecisionId: "decision_glm_hold_1",
    userApprovalId: "approval_demo_1",
    status: "DEFERRED_FOR_MVP",
    note: "MVP 只记录可审计决策链路，不执行真实 Polymarket 下单；Cobo 钱包执行属于 V2。",
    createdAt: "2026-06-13T00:06:00.000Z",
  },
  stages: [
    {
      title: "任务拆解",
      domainStates: ["topic_received"],
      status: "complete",
      summary: "GLM-5.1 将 Polymarket 盘口分析拆成 6 步可审计任务。",
    },
    {
      title: "读取真实盘口",
      domainStates: ["markets_fetched"],
      status: "complete",
      summary: "读取 New Rihanna Album before GTA VI? 的 Polymarket 市场材料并保留来源链接。",
    },
    {
      title: "生成轨迹草稿",
      domainStates: ["agent_recommendations_created"],
      status: "complete",
      summary: "生成第一版 Agent Run Trace，记录模型行动、工具调用和观察结果。",
    },
    {
      title: "轨迹校验失败",
      domainStates: ["agent_recommendations_created"],
      status: "complete",
      summary: "校验器发现 externalRiskFlags 缺失，拒绝进入审计载荷。",
    },
    {
      title: "自我修复",
      domainStates: ["final_decision_selected"],
      status: "complete",
      summary: "Agent 补齐风险字段并将建议降级为 HOLD。",
    },
    {
      title: "哈希与锚点准备",
      domainStates: ["audit_anchor_written"],
      status: "active",
      summary: "计算 trace hash，并准备 Sepolia calldata audit anchor。",
    },
  ],
  evidenceReviews: [
    {
      lens: "Live Polymarket Material",
      action: "HOLD",
      confidence: "MEDIUM",
      riskLevel: "MEDIUM",
      evidenceRefs: [
        "polymarket:event/new-rhianna-album-before-gta-vi-926",
        "YES 0.51",
        "NO 0.49",
      ],
      rationale: "市场是真实盘口，价格接近均衡；仅凭盘口结构不足以触发小额买入。",
    },
    {
      lens: "GLM-5.1 Trace Validator",
      action: "HOLD",
      confidence: "MEDIUM",
      riskLevel: "MEDIUM",
      evidenceRefs: ["step-4 validation_failed", "step-5 repair_agent_trace"],
      rationale: "轨迹校验发现缺失风险字段后，Agent 修复并保守降级为 HOLD。",
    },
  ],
  auditReferences: [
    { label: "network", value: "Sepolia" },
    { label: "trace hash", value: traceHash },
    { label: "calldata", value: `0x${traceHash}` },
    {
      label: "block explorer",
      value: "sepolia.etherscan.io/tx/<pending>",
      href: "https://sepolia.etherscan.io/tx/<pending>",
    },
    { label: "agent run record", value: "demo/agent-run-record.latest.json" },
  ],
  agentRunTrace: [
    {
      index: 1,
      title: "任务拆解 / Plan task",
      tool: "plan_task",
      status: "completed",
      observation: "GLM-5.1 制定 6 步审计计划。",
    },
    {
      index: 2,
      title: "读取真实盘口 / Fetch live market",
      tool: "fetch_polymarket_market",
      status: "completed",
      observation: "找到真实 Polymarket 市场并保留来源链接。",
    },
    {
      index: 3,
      title: "生成轨迹草稿 / Draft trace",
      tool: "draft_agent_trace",
      status: "completed",
      observation: "GLM-5.1 生成第一版 Agent Run Trace。",
    },
    {
      index: 4,
      title: "轨迹校验失败 / Trace validation failed",
      tool: "validate_agent_trace",
      status: "failed",
      observation: "trace 缺少 externalRiskFlags，工具拒绝进入审计载荷。",
    },
    {
      index: 5,
      title: "自我修复 / Self repair",
      tool: "repair_agent_trace",
      status: "completed",
      observation: "GLM-5.1 补齐风险字段，并将建议降级为 HOLD。",
    },
    {
      index: 6,
      title: "计算哈希并准备锚点 / Compute hash and prepare anchor",
      tool: "prepare_sepolia_anchor",
      status: "completed",
      observation: "已计算 trace hash 并准备 Sepolia calldata anchor。",
    },
  ],
  traceHash,
  calldata: `0x${traceHash}`,
  explorerLink: "https://sepolia.etherscan.io/tx/<pending>",
  strategyParameters,
};

export function auditSummary(run: DecisionRunDetail): string {
  return [
    `ColdRead ${run.id} 使用 GLM-5.1 完成长程审计。`,
    `Final Decision: ${run.finalDecision.action}`,
    `Trace Hash: ${run.traceHash}`,
    `Sepolia: ${run.explorerLink}`,
  ].join("\n");
}

export function auditJson(run: DecisionRunDetail): string {
  return JSON.stringify(
    {
      decisionRunId: run.id,
      engine: "GLM-5.1",
      mode: "live",
      finalDecision: run.finalDecision.action,
      traceHash: run.traceHash,
      calldata: run.calldata,
      explorerLink: run.explorerLink,
      agentRunRecord: "demo/agent-run-record.latest.json",
    },
    null,
    2,
  );
}
