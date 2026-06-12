import assert from "node:assert/strict";
import test from "node:test";

import {
  buildSepoliaAnchorCalldata,
  demoDossierHash,
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
