import type {
  AgentRecommendation,
  BuyFinalDecision,
  DecisionDossier,
  ExecutionRecord,
  PipelineResult,
  RecommendationAction,
  RiskLevel,
} from "../../src/index.js";
import {
  decisionRunDetail,
  decisionRuns,
  strategyParameters,
  type DecisionRunCard,
  type DecisionRunDetail,
  type EvidenceReview,
  type TimelineStage,
} from "../data/mockData.js";

const STORED_RUN_DETAILS_KEY = "coldread.mvp.runDetails";
const STORED_RUN_CARDS_KEY = "coldread.mvp.runCards";

export type SubmitDecisionTopicResult =
  | {
      kind: "decision_run_complete";
      detail: DecisionRunDetail;
      card: DecisionRunCard;
    }
  | {
      kind: "screening_outcome";
      message: string;
    }
  | {
      kind: "api_error";
      message: string;
    };

export async function submitDecisionTopic(
  topicText: string,
): Promise<SubmitDecisionTopicResult> {
  try {
    const response = await fetch("/api/decision-runs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topicText }),
    });

    const body = (await response.json()) as PipelineResult | { kind: "api_error"; message: string };

    if (!response.ok || body.kind === "api_error") {
      return {
        kind: "api_error",
        message: body.kind === "api_error" ? body.message : "Decision Run API failed.",
      };
    }

    if (body.kind === "screening_outcome") {
      return {
        kind: "screening_outcome",
        message: `${body.outcome.status}: ${body.outcome.reason}`,
      };
    }

    const detail = mapDossierToDetail(body.dossier);
    const card = mapDetailToCard(detail);
    saveDecisionRun(detail, card);

    return {
      kind: "decision_run_complete",
      detail,
      card,
    };
  } catch {
    return {
      kind: "api_error",
      message: "无法连接本地 Decision Pipeline API（决策流水线接口）。",
    };
  }
}

export function loadDecisionRunCards(): readonly DecisionRunCard[] {
  return [...loadStoredCards(), ...decisionRuns];
}

export function loadDecisionRunDetail(runId: string): DecisionRunDetail {
  return loadStoredDetails()[runId] ?? {
    ...decisionRunDetail,
    id: runId,
  };
}

function saveDecisionRun(detail: DecisionRunDetail, card: DecisionRunCard): void {
  if (!canUseSessionStorage()) return;

  const details = loadStoredDetails();
  details[detail.id] = detail;
  sessionStorage.setItem(STORED_RUN_DETAILS_KEY, JSON.stringify(details));

  const cards = loadStoredCards().filter((run) => run.id !== card.id);
  sessionStorage.setItem(STORED_RUN_CARDS_KEY, JSON.stringify([card, ...cards]));
}

function loadStoredDetails(): Record<string, DecisionRunDetail> {
  if (!canUseSessionStorage()) return {};

  return parseStoredJson<Record<string, DecisionRunDetail>>(
    sessionStorage.getItem(STORED_RUN_DETAILS_KEY),
    {},
  );
}

function loadStoredCards(): readonly DecisionRunCard[] {
  if (!canUseSessionStorage()) return [];

  return parseStoredJson<readonly DecisionRunCard[]>(
    sessionStorage.getItem(STORED_RUN_CARDS_KEY),
    [],
  );
}

function parseStoredJson<T>(value: string | null, fallback: T): T {
  if (value === null) return fallback;

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function canUseSessionStorage(): boolean {
  return typeof window !== "undefined" && typeof sessionStorage !== "undefined";
}

function mapDossierToDetail(dossier: DecisionDossier): DecisionRunDetail {
  const finalDecision = dossier.finalDecision;
  if (!isBuyFinalDecision(finalDecision)) {
    throw new Error("The MVP UI detail currently expects a buy Final Decision.");
  }

  const executionRecord = dossier.executionRecord ?? createDeferredExecutionRecord(dossier, finalDecision);
  const firstAnchor = dossier.auditAnchors[0];

  return {
    id: dossier.decisionRun.id,
    topic: dossier.topic.text,
    finalDecision,
    riskLevel: deriveRiskLevel(dossier.agentRecommendations),
    auditStatus: firstAnchor === undefined ? "ANCHOR VERIFIED" : "ANCHOR VERIFIED",
    executionRecord,
    stages: mapTimeline(dossier),
    evidenceReviews: dossier.agentRecommendations.map(mapRecommendationToEvidenceReview),
    auditReferences: [
      { label: "network", value: firstAnchor?.network ?? "testnet" },
      { label: "dossier hash", value: firstAnchor?.contentHash ?? "pending" },
      { label: "audit anchor", value: firstAnchor?.id ?? "pending" },
      {
        label: "block explorer",
        value: "testnet explorer pending",
        href: "https://polygonscan.com/",
      },
    ],
    strategyParameters,
  };
}

function mapDetailToCard(detail: DecisionRunDetail): DecisionRunCard {
  return {
    id: detail.id,
    topic: detail.topic,
    stage: "Decision Pipeline complete",
    finalAction: detail.finalDecision.action,
    riskLevel: detail.riskLevel,
    auditStatus: "ANCHOR",
    executionStatus: detail.executionRecord.status,
    strategyName: "MVP fixture pipeline",
  };
}

function mapTimeline(dossier: DecisionDossier): readonly TimelineStage[] {
  const states = new Set(dossier.timeline.map((entry) => entry.state));

  return [
    {
      title: "收到主题",
      domainStates: ["topic_received"],
      status: states.has("topic_received") ? "complete" : "pending",
      summary: "记录用户提交的 Decision Topic（决策主题）。",
    },
    {
      title: "获取盘口",
      domainStates: ["markets_fetched"],
      status: states.has("markets_fetched") ? "complete" : "pending",
      summary: "通过 MVP fixture provider（夹具提供器）获取 Polymarket（预测市场）候选盘口。",
    },
    {
      title: "筛选与确认盘口",
      domainStates: ["candidate_markets_screened", "high_conviction_markets_confirmed"],
      status: states.has("high_conviction_markets_confirmed") ? "complete" : "pending",
      summary: "Market Screener（盘口筛选器）和 Tavily Confirmation（背景确认）完成。",
    },
    {
      title: "冻结证据",
      domainStates: ["evidence_snapshot_created"],
      status: states.has("evidence_snapshot_created") ? "complete" : "pending",
      summary: "Evidence Snapshot（证据快照）固定本次分析使用的盘口与背景材料。",
    },
    {
      title: "Agent 分析建议",
      domainStates: ["agent_recommendations_created"],
      status: states.has("agent_recommendations_created") ? "complete" : "pending",
      summary: "Market Structure Lens（市场结构维度）和 External Risk Lens（外部风险维度）生成建议。",
    },
    {
      title: "最终决策",
      domainStates: ["final_decision_selected"],
      status: "active",
      summary: dossier.finalDecision.rationale,
    },
    {
      title: "审计锚定",
      domainStates: ["audit_anchor_written"],
      status: states.has("audit_anchor_written") ? "complete" : "pending",
      summary: "Audit Anchor（审计锚点）记录本次 Decision Dossier（决策档案）引用。",
    },
    {
      title: "确认与执行",
      domainStates: ["user_approval_recorded", "execution_record_created"],
      status: states.has("execution_record_created") ? "complete" : "pending",
      summary: dossier.executionRecord?.note ?? "MVP（最小可用版本）不会真实下单。",
    },
  ];
}

function mapRecommendationToEvidenceReview(recommendation: AgentRecommendation): EvidenceReview {
  return {
    lens: recommendation.analysisLens,
    action: recommendation.action as RecommendationAction,
    confidence: recommendation.confidence,
    riskLevel: recommendation.riskLevel,
    evidenceRefs: recommendation.evidenceRefs,
    rationale: recommendation.rationale,
  };
}

function deriveRiskLevel(recommendations: readonly AgentRecommendation[]): RiskLevel {
  if (recommendations.some((recommendation) => recommendation.riskLevel === "HIGH")) {
    return "HIGH";
  }

  if (recommendations.some((recommendation) => recommendation.riskLevel === "MEDIUM")) {
    return "MEDIUM";
  }

  return "LOW";
}

function isBuyFinalDecision(
  finalDecision: DecisionDossier["finalDecision"],
): finalDecision is BuyFinalDecision {
  return finalDecision.action === "BUY_YES_SMALL" || finalDecision.action === "BUY_NO_SMALL";
}

function createDeferredExecutionRecord(
  dossier: DecisionDossier,
  finalDecision: BuyFinalDecision,
): ExecutionRecord {
  return {
    id: `execution_${dossier.decisionRun.id}`,
    decisionRunId: dossier.decisionRun.id,
    finalDecisionId: finalDecision.id,
    userApprovalId: "approval_mvp_api",
    status: "DEFERRED_FOR_MVP",
    note: "MVP API recorded the proposed execution plan; no real Polymarket trade was placed.",
    createdAt: finalDecision.createdAt,
  };
}
