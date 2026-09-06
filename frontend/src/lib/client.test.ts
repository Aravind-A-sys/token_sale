import { describe, expect, it } from "vitest";
import { SaleError, errorMessage, validateDeployment } from "./client";

const manifest = {
  version: 1,
  chainId: 31337,
  networkName: "Hardhat Local",
  instanceId: `0x${"ab".repeat(32)}`,
  deploymentBlock: 2,
  tokenAddress: `0x${"11".repeat(20)}`,
  saleAddress: `0x${"22".repeat(20)}`,
  tokenAbi: [],
  saleAbi: [],
};

describe("local-only deployment validation", () => {
  it("accepts a well-formed local manifest", () => {
    expect(validateDeployment(manifest)).toEqual(manifest);
  });
  it.each([1, 11155111, 0, "31337"])("rejects non-local chain ID %j", (chainId) => {
    expect(() => validateDeployment({ ...manifest, chainId })).toThrow(SaleError);
  });
  it("rejects missing contracts, malformed metadata, and invalid blocks", () => {
    for (const value of [
      null,
      {},
      { ...manifest, saleAddress: "0x0" },
      { ...manifest, instanceId: "stale" },
      { ...manifest, deploymentBlock: -1 },
      { ...manifest, saleAbi: null },
    ]) {
      expect(() => validateDeployment(value)).toThrow(SaleError);
    }
  });
});

describe("actionable errors", () => {
  it("handles wallet rejection, known application errors, and network failures", () => {
    expect(errorMessage({ code: 4001 })).toContain("cancelled");
    expect(errorMessage(new SaleError("Sale is paused"))).toBe("Sale is paused");
    expect(errorMessage(new Error("socket hangup"))).toContain("local blockchain");
  });
});
