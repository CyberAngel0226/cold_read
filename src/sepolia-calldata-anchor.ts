import { Wallet, JsonRpcProvider } from "ethers";
import { cachedDemoAgentRunTrace } from "./agent-run-trace.js";
import { hashAuditPayload } from "./decision-dossier-audit.js";

export type SepoliaAnchorMode = "dry-run" | "send";

export type SepoliaCalldataAnchorEnv = {
  SEPOLIA_RPC_URL?: string;
  SEPOLIA_PRIVATE_KEY?: string;
  SEPOLIA_ANCHOR_TO?: string;
};

export type SepoliaCalldataAnchorSender = (input: {
  rpcUrl: string;
  privateKey: string;
  to: string;
  calldata: string;
}) => Promise<{
  transactionHash: string;
}>;

export type RunSepoliaCalldataAnchorInput = {
  mode: SepoliaAnchorMode;
  hash?: string;
  env?: SepoliaCalldataAnchorEnv;
  sender?: SepoliaCalldataAnchorSender;
};

export type SepoliaCalldataAnchorResult =
  | {
      status: "DRY_RUN";
      network: "sepolia";
      hash: string;
      to: string;
      calldata: string;
      valueEth: "0";
      explorerLink: string;
    }
  | {
      status: "SENT";
      network: "sepolia";
      hash: string;
      to: string;
      calldata: string;
      valueEth: "0";
      transactionHash: string;
      explorerLink: string;
    };

const SEPOLIA_ETHERSCAN_TX_BASE = "https://sepolia.etherscan.io/tx";

export function buildSepoliaAnchorCalldata(hash: string): string {
  const normalizedHash = normalizeSha256Hash(hash);
  return `0x${normalizedHash}`;
}

export async function runSepoliaCalldataAnchor(
  input: RunSepoliaCalldataAnchorInput,
): Promise<SepoliaCalldataAnchorResult> {
  const environment = input.env ?? process.env;
  const hash = normalizeSha256Hash(input.hash ?? demoDossierHash());
  const to = requireEnv(environment, "SEPOLIA_ANCHOR_TO");
  const calldata = buildSepoliaAnchorCalldata(hash);

  if (input.mode === "dry-run") {
    return {
      status: "DRY_RUN",
      network: "sepolia",
      hash,
      to,
      calldata,
      valueEth: "0",
      explorerLink: `${SEPOLIA_ETHERSCAN_TX_BASE}/<pending>`,
    };
  }

  const rpcUrl = requireEnv(environment, "SEPOLIA_RPC_URL");
  const privateKey = requireEnv(environment, "SEPOLIA_PRIVATE_KEY");
  const sender = input.sender ?? sendZeroEthCalldataTransaction;
  const sent = await sender({
    rpcUrl,
    privateKey,
    to,
    calldata,
  });

  return {
    status: "SENT",
    network: "sepolia",
    hash,
    to,
    calldata,
    valueEth: "0",
    transactionHash: sent.transactionHash,
    explorerLink: `${SEPOLIA_ETHERSCAN_TX_BASE}/${sent.transactionHash}`,
  };
}

export function demoDossierHash(): string {
  return hashAuditPayload({
    version: "coldread.demo-dossier-anchor.v1",
    agentRunTrace: cachedDemoAgentRunTrace,
  });
}

async function sendZeroEthCalldataTransaction(input: {
  rpcUrl: string;
  privateKey: string;
  to: string;
  calldata: string;
}): Promise<{ transactionHash: string }> {
  const provider = new JsonRpcProvider(input.rpcUrl);
  const wallet = new Wallet(input.privateKey, provider);
  const transaction = await wallet.sendTransaction({
    to: input.to,
    value: 0n,
    data: input.calldata,
  });

  return {
    transactionHash: transaction.hash,
  };
}

function normalizeSha256Hash(hash: string): string {
  const normalized = hash.startsWith("0x") ? hash.slice(2) : hash;
  if (!/^[0-9a-fA-F]{64}$/.test(normalized)) {
    throw new Error("Sepolia Audit Anchor hash must be a sha256 hex string.");
  }

  return normalized.toLowerCase();
}

function requireEnv(
  env: SepoliaCalldataAnchorEnv,
  key: keyof SepoliaCalldataAnchorEnv,
): string {
  const value = env[key];
  if (value === undefined || value.trim() === "") {
    throw new Error(`${key} is required for Sepolia Audit Anchor.`);
  }

  return value;
}
