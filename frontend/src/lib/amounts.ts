import { formatEther, formatUnits, parseEther } from "ethers";

export type Quote = { wei: bigint; tokens: bigint; error: string | null };

/** No floating-point numbers enter purchase calculations. */
export function quotePurchase(input: string, price: bigint, available: bigint): Quote {
  const invalid = (error: string): Quote => ({ wei: 0n, tokens: 0n, error });
  const value = input.trim();
  if (!value || value.length > 64 || !/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(value)) {
    return invalid("Enter a valid ETH amount.");
  }
  if ((value.split(".")[1]?.length ?? 0) > 18)
    return invalid("ETH supports up to 18 decimal places.");
  if (price <= 0n) return invalid("The token price is not available yet.");
  let wei: bigint;
  try {
    wei = parseEther(value);
  } catch {
    return invalid("Enter a valid ETH amount.");
  }
  if (wei <= 0n) return invalid("Enter an amount greater than zero.");
  if (wei % price !== 0n)
    return invalid(`Buy whole DAPP tokens in multiples of ${formatEther(price)} ETH.`);
  const tokens = wei / price;
  if (tokens > available) return invalid("This amount exceeds the tokens available in the sale.");
  return { wei, tokens, error: null };
}

export function formatEth(value: bigint, places = 6): string {
  const [whole, fraction = ""] = formatEther(value).split(".");
  const tail = fraction.slice(0, places).replace(/0+$/, "");
  return `${BigInt(whole).toLocaleString("en-US")}${tail ? `.${tail}` : ""}`;
}

export function formatDapp(baseUnits: bigint): string {
  const [whole, fraction = ""] = formatUnits(baseUnits, 18).split(".");
  const tail = fraction.slice(0, 4).replace(/0+$/, "");
  return `${BigInt(whole).toLocaleString("en-US")}${tail ? `.${tail}` : ""}`;
}

export const formatCount = (value: bigint) => value.toLocaleString("en-US");
export const shortAddress = (value: string) => `${value.slice(0, 6)}…${value.slice(-4)}`;
export const progressPercent = (sold: bigint, total: bigint) =>
  total > 0n ? Math.min(100, Math.max(0, Number((sold * 1_000_000n) / total) / 10_000)) : 0;

export function formatProgress(sold: bigint, total: bigint): string {
  const progress = progressPercent(sold, total);
  return sold > 0n && progress < 0.01
    ? "<0.01%"
    : `${progress.toLocaleString("en-US", { maximumFractionDigits: 2 })}%`;
}
