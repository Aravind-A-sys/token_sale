import { describe, expect, it } from "vitest";
import { parseEther, parseUnits } from "ethers";
import {
  formatCount,
  formatDapp,
  formatEth,
  formatProgress,
  progressPercent,
  quotePurchase,
  shortAddress,
} from "./amounts";

const price = parseEther("0.001");
const available = 750_000n;

describe("integer-only purchase quotes", () => {
  it("quotes exact whole-token purchases", () => {
    expect(quotePurchase("0.01", price, available)).toEqual({
      wei: parseEther("0.01"),
      tokens: 10n,
      error: null,
    });
    expect(quotePurchase(".001", price, available).tokens).toBe(1n);
    expect(quotePurchase(" 0.100 ", price, available).tokens).toBe(100n);
  });
  it.each(["", "0", "-1", "NaN", "Infinity", "1e3", "1,000", "1.2.3", "0x01", " "])(
    "rejects invalid input %j",
    (input) => {
      expect(quotePurchase(input, price, available).error).not.toBeNull();
    },
  );
  it("rejects fractional tokens, excess decimal precision, and missing prices", () => {
    expect(quotePurchase("0.0015", price, available).error).toContain("whole DAPP");
    expect(quotePurchase("0.0010000000000000001", price, available).error).toContain("18 decimal");
    expect(quotePurchase("1", 0n, available).error).toContain("not available");
  });
  it("accepts the exact allocation but rejects overselling and sold-out inventory", () => {
    expect(quotePurchase("750", price, available).tokens).toBe(available);
    expect(quotePurchase("750.001", price, available).error).toContain("exceeds");
    expect(quotePurchase("0.001", price, 0n).error).toContain("exceeds");
  });
  it("preserves precision above JavaScript's safe integer range", () => {
    const tokens = 9_007_199_254_740_993n;
    expect(quotePurchase("9007199254740.993", price, tokens)).toEqual({
      wei: tokens * price,
      tokens,
      error: null,
    });
  });
});

describe("display formatting", () => {
  it("formats balances and prices without floating-point arithmetic", () => {
    expect(formatEth(price)).toBe("0.001");
    expect(formatEth(parseEther("10000"))).toBe("10,000");
    expect(formatDapp(parseUnits("750000.125", 18))).toBe("750,000.125");
    expect(formatCount(9_007_199_254_740_993n)).toBe("9,007,199,254,740,993");
  });
  it("handles tiny progress, sold-out sales, and zero allocations", () => {
    expect(progressPercent(1n, 0n)).toBe(0);
    expect(progressPercent(2n, 1n)).toBe(100);
    expect(formatProgress(0n, available)).toBe("0%");
    expect(formatProgress(1n, available)).toBe("<0.01%");
    expect(formatProgress(available, available)).toBe("100%");
    expect(shortAddress("0x1234567890123456789012345678901234567890")).toBe("0x1234…7890");
  });
});
