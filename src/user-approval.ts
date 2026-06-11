import type {
  DecisionDossier,
  ExecutionRecord,
  FinalDecision,
  IsoTimestamp,
  UserApproval,
  WalletActionProposal,
} from "./domain.js";

export type UserApprovalView =
  | {
      canApproveExecution: true;
      walletActionProposal: WalletActionProposal;
      approvalLabel: "Approve proposed execution plan";
      mvpDisclosure: "MVP records approval and defers execution; it does not place real prediction market trades.";
    }
  | {
      canApproveExecution: false;
      approvalLabel: undefined;
      mvpDisclosure: "No execution approval is available because the Final Decision is HOLD.";
    };

export type RecordUserApprovalInput = {
  decisionDossier: DecisionDossier;
  approvedBy: string;
  now: IsoTimestamp;
  createUserApprovalId: () => string;
  createExecutionRecordId: () => string;
  executeWalletAction?: (walletActionProposal: WalletActionProposal) => void;
};

export type UserApprovalRecordedResult = {
  userApproval: UserApproval;
  executionRecord: ExecutionRecord;
  decisionDossier: DecisionDossier;
};

export function recordUserApproval(
  input: RecordUserApprovalInput,
): UserApprovalRecordedResult {
  const finalDecision = input.decisionDossier.finalDecision;
  if (finalDecision.action === "HOLD") {
    throw new Error("HOLD decisions do not offer execution approval.");
  }

  const userApproval: UserApproval = {
    id: input.createUserApprovalId(),
    decisionRunId: finalDecision.decisionRunId,
    finalDecisionId: finalDecision.id,
    walletActionProposalId: finalDecision.walletActionProposal.id,
    approvedBy: input.approvedBy,
    approvedAt: input.now,
  };

  const executionRecord: ExecutionRecord = {
    id: input.createExecutionRecordId(),
    decisionRunId: finalDecision.decisionRunId,
    finalDecisionId: finalDecision.id,
    userApprovalId: userApproval.id,
    status: "DEFERRED_FOR_MVP",
    note: "User approved the proposed wallet action, but MVP does not place real prediction market trades.",
    createdAt: input.now,
  };

  return {
    userApproval,
    executionRecord,
    decisionDossier: {
      ...input.decisionDossier,
      decisionRun: {
        ...input.decisionDossier.decisionRun,
        status: "EXECUTION_RECORD_CREATED",
      },
      userApproval,
      executionRecord,
      timeline: [
        ...input.decisionDossier.timeline,
        "user_approval_recorded",
        "execution_record_created",
      ],
    },
  };
}

export function getUserApprovalView(
  finalDecision: FinalDecision,
): UserApprovalView {
  if (finalDecision.action === "HOLD") {
    return {
      canApproveExecution: false,
      approvalLabel: undefined,
      mvpDisclosure:
        "No execution approval is available because the Final Decision is HOLD.",
    };
  }

  return {
    canApproveExecution: true,
    walletActionProposal: finalDecision.walletActionProposal,
    approvalLabel: "Approve proposed execution plan",
    mvpDisclosure:
      "MVP records approval and defers execution; it does not place real prediction market trades.",
  };
}
