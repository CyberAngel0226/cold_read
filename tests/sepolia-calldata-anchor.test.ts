import assert from "node:assert/strict";
import test from "node:test";

import {
  buildSepoliaAnchorCalldata,
  demoDossierHash,
  formatSepoliaAnchorPrettyOutput,
  runSepoliaCalldataAnchor,
} from "../src/sepolia-calldata-anchor.js";

const dossierHash =
  "a1965f90b703224ae9305c7bd9f0b30234837cc75f558935f04cfaa66610d0b2";
const anchorTo = "0x000000000000000000000000000000000000dEaD";

test("dry-run prints target address, calldata, and Sepolia explorer link without sending", async () => {
  let sendCalled = false;

  const result = await runSepoliaCalldataAnchor({
    mode: "dry-run",
    hash: dossierHash,
    env: {
      SEPOLIA_ANCHOR_TO: anchorTo,
    },
    sender: async () => {
      sendCalled = true;
      throw new Error("Dry-run must not send.");
    },
  });

  assert.equal(result.status, "DRY_RUN");
  assert.equal(result.to, anchorTo);
  assert.equal(result.valueEth, "0");
  assert.equal(result.calldata, `0x${dossierHash}`);
  assert.equal(result.explorerLink, "https://sepolia.etherscan.io/tx/<pending>");
  assert.equal(sendCalled, false);
});

test("calldata encodes a sha256 hash as raw transaction data", () => {
  assert.equal(buildSepoliaAnchorCalldata(dossierHash), `0x${dossierHash}`);
});

test("send mode creates a 0 ETH Sepolia transaction through the configured sender", async () => {
  const sent = await runSepoliaCalldataAnchor({
    mode: "send",
    hash: dossierHash,
    env: {
      SEPOLIA_RPC_URL: "https://sepolia.example",
      SEPOLIA_PRIVATE_KEY: "0xprivate",
      SEPOLIA_ANCHOR_TO: anchorTo,
    },
    sender: async (transaction) => {
      assert.equal(transaction.rpcUrl, "https://sepolia.example");
      assert.equal(transaction.privateKey, "0xprivate");
      assert.equal(transaction.to, anchorTo);
      assert.equal(transaction.calldata, `0x${dossierHash}`);
      return {
        transactionHash: "0xtxhash",
      };
    },
  });

  assert.equal(sent.status, "SENT");
  assert.equal(sent.transactionHash, "0xtxhash");
  assert.equal(sent.explorerLink, "https://sepolia.etherscan.io/tx/0xtxhash");
});

test("dry-run can use the committed demo dossier hash when no hash is provided", async () => {
  const result = await runSepoliaCalldataAnchor({
    mode: "dry-run",
    env: {
      SEPOLIA_ANCHOR_TO: anchorTo,
    },
  });

  assert.equal(result.hash, demoDossierHash());
  assert.equal(result.calldata, `0x${demoDossierHash()}`);
});

test("pretty output renders bilingual labels and full verifiable dry-run fields without implying send", async () => {
  const result = await runSepoliaCalldataAnchor({
    mode: "dry-run",
    hash: dossierHash,
    env: {
      SEPOLIA_ANCHOR_TO: anchorTo,
    },
  });

  const pretty = formatSepoliaAnchorPrettyOutput(result);

  assert.match(pretty, /🧊 ColdRead Sepolia 审计锚点 \/ Audit Anchor/);
  assert.match(pretty, /🧾 已读取锚点哈希 \/ Anchor hash loaded/);
  assert.match(pretty, /🧱 已构造 0 ETH 交易 \/ 0 ETH transaction prepared/);
  assert.match(pretty, /🟡 当前为 dry-run，未发送交易 \/ Dry-run only, no transaction sent/);
  assert.doesNotMatch(pretty, /✅ 已写入 Sepolia \/ Written to Sepolia/);
  assert.match(pretty, /网络 \/ Network: Sepolia/);
  assert.match(pretty, /模式 \/ Mode: DRY_RUN/);
  assert.match(pretty, new RegExp(`目标地址 / To: ${anchorTo}`));
  assert.match(pretty, new RegExp(`锚点哈希 / Anchor Hash: ${dossierHash}`));
  assert.match(pretty, new RegExp(`调用数据 / Calldata: 0x${dossierHash}`));
  assert.match(pretty, /浏览器 \/ Explorer: https:\/\/sepolia\.etherscan\.io\/tx\/<pending>/);
});

test("pretty output renders full transaction hash after send", async () => {
  const result = await runSepoliaCalldataAnchor({
    mode: "send",
    hash: dossierHash,
    env: {
      SEPOLIA_RPC_URL: "https://sepolia.example",
      SEPOLIA_PRIVATE_KEY: "0xprivate",
      SEPOLIA_ANCHOR_TO: anchorTo,
    },
    sender: async () => ({
      transactionHash: "0x6ce6da94f6d3b31ac7247cc1c439ba0ce29f873a64f432fe813844f0bbede1ad",
    }),
  });

  const pretty = formatSepoliaAnchorPrettyOutput(result);

  assert.match(pretty, /✅ 已写入 Sepolia \/ Written to Sepolia/);
  assert.match(
    pretty,
    /交易哈希 \/ Tx Hash: 0x6ce6da94f6d3b31ac7247cc1c439ba0ce29f873a64f432fe813844f0bbede1ad/,
  );
  assert.match(
    pretty,
    /浏览器 \/ Explorer: https:\/\/sepolia\.etherscan\.io\/tx\/0x6ce6da94f6d3b31ac7247cc1c439ba0ce29f873a64f432fe813844f0bbede1ad/,
  );
});
