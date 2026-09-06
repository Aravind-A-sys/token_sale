import { expect, test, type Page } from "@playwright/test";
import { Contract, JsonRpcProvider, parseEther, parseUnits } from "ethers";

async function openSale(page: Page) {
  await page.goto("/");
  await expect(page.getByText("Sale is live", { exact: true })).toBeVisible();
}

async function connectTestWallet(page: Page) {
  await page.getByRole("button", { name: "Just exploring? Use a test wallet" }).click();
  await expect(page.getByText("Connected to a local test wallet", { exact: true })).toBeVisible();
  await expect(page.getByTestId("wallet-dapp-balance")).not.toContainText("—");
}

test("loads real sale data with a working quote and no browser errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await openSale(page);
  await expect(page.getByRole("heading", { name: "DAPP token sale", exact: true })).toBeVisible();
  await expect(page.getByTestId("quoted-tokens")).toHaveText("10");
  await page.getByRole("button", { name: "100 DAPP", exact: true }).click();
  await expect(page.getByLabel("Amount in ETH")).toHaveValue("0.1");
  await expect(page.getByTestId("quoted-tokens")).toHaveText("100");
  for (const width of [768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  }
  expect(errors).toEqual([]);
});

test("connects a test wallet, reviews a purchase, and verifies on-chain balances and history", async ({
  page,
  request,
}) => {
  const manifest = await (await request.get("/deployment.json")).json();
  const provider = new JsonRpcProvider("http://127.0.0.1:5173/rpc", undefined, {
    cacheTimeout: -1,
    batchMaxCount: 1,
  });
  try {
    const token = new Contract(manifest.tokenAddress, manifest.tokenAbi, provider);
    const sale = new Contract(manifest.saleAddress, manifest.saleAbi, provider);
    const buyer = (await provider.send("eth_accounts", []))[1];
    const [balance, sold, raised] = await Promise.all([
      token.balanceOf(buyer) as Promise<bigint>,
      sale.tokensSold() as Promise<bigint>,
      sale.totalRaised() as Promise<bigint>,
    ]);
    await openSale(page);
    await connectTestWallet(page);
    await page.getByLabel("Amount in ETH").fill("0.025");
    await page.getByRole("button", { name: "Buy 25 DAPP", exact: true }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByRole("dialog").getByText("0.025 ETH", { exact: true })).toBeVisible();
    // Merely opening the review must never submit a transaction.
    expect(await sale.tokensSold()).toBe(sold);
    await page.getByRole("button", { name: "Confirm purchase", exact: true }).click();
    await expect(
      page.getByText("25 DAPP purchased. Your local transaction is confirmed."),
    ).toBeVisible({ timeout: 20_000 });
    expect(await token.balanceOf(buyer)).toBe(balance + parseUnits("25", 18));
    expect(await sale.tokensSold()).toBe(sold + 25n);
    expect(await sale.totalRaised()).toBe(raised + parseEther("0.025"));
    await expect(page.getByTestId("tokens-sold")).toContainText(
      (sold + 25n).toLocaleString("en-US"),
    );
    await page.getByRole("button", { name: "View all transactions" }).click();
    await expect(
      page.getByRole("heading", { name: "Transaction history", exact: true }),
    ).toBeVisible();
    await page.getByLabel("Search transactions").fill(buyer);
    await expect(
      page.getByRole("table").getByRole("cell", { name: "+25 DAPP", exact: true }).first(),
    ).toBeVisible();
    await page.getByRole("button", { name: "DAPP purchase", exact: true }).first().click();
    await expect(
      page.getByRole("dialog").getByText("Purchase confirmed", { exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Close dialog" }).click();
    await page.getByLabel("Search transactions").fill("not-a-transaction");
    await expect(page.getByText("No matching purchases")).toBeVisible();
  } finally {
    provider.destroy();
  }
});

test("blocks invalid amounts before a transaction can be submitted", async ({ page }) => {
  await openSale(page);
  await connectTestWallet(page);
  for (const value of ["0", "-1", "1e3", "0.0015", "750.001", "0.0010000000000000001"]) {
    await page.getByLabel("Amount in ETH").fill(value);
    await expect(page.getByLabel("Amount in ETH")).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByRole("button", { name: "Buy DAPP", exact: true })).toBeDisabled();
  }
  await page.getByLabel("Amount in ETH").fill("0.01");
  await expect(page.getByRole("button", { name: "Buy 10 DAPP", exact: true })).toBeEnabled();
});

test("handles missing browser wallets without trapping the user", async ({ page }) => {
  await openSale(page);
  await page.getByRole("button", { name: "Connect wallet", exact: true }).first().click();
  await page.getByRole("button", { name: "Browser wallet" }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "No browser wallet was detected",
  );
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "Connect wallet", exact: true }).first(),
  ).toBeFocused();
});

test("handles an explicitly rejected wallet connection", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "ethereum", {
      value: {
        request: async () => {
          throw { code: 4001, message: "User rejected" };
        },
      },
      configurable: true,
    });
  });
  await openSale(page);
  await page.getByRole("button", { name: "Connect wallet", exact: true }).first().click();
  await page.getByRole("button", { name: "Browser wallet" }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "Request cancelled. Nothing was purchased.",
  );
});

test("requires the correct wallet network before enabling purchases", async ({ page }) => {
  await page.addInitScript(() => {
    let chainId = "0x1";
    Object.defineProperty(window, "ethereum", {
      value: {
        request: async ({ method, params }: { method: string; params?: unknown[] }) => {
          if (method === "eth_chainId") return chainId;
          if (method === "wallet_switchEthereumChain") {
            chainId = "0x7a69";
            return null;
          }
          const rpcMethod = method === "eth_requestAccounts" ? "eth_accounts" : method;
          const response = await fetch("/rpc", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              jsonrpc: "2.0",
              id: 1,
              method: rpcMethod,
              params: params ?? [],
            }),
          });
          const data = await response.json();
          if (data.error) throw data.error;
          return rpcMethod === "eth_accounts" ? [data.result[1]] : data.result;
        },
      },
      configurable: true,
    });
  });
  await openSale(page);
  await page.getByRole("button", { name: "Connect wallet", exact: true }).first().click();
  await page.getByRole("button", { name: "Browser wallet" }).click();
  await expect(page.getByRole("button", { name: "Switch to local network" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Buy 10 DAPP", exact: true })).not.toBeVisible();
  await page.getByRole("button", { name: "Switch to local network" }).click();
  await expect(page.getByRole("button", { name: "Buy 10 DAPP", exact: true })).toBeEnabled();
});

test("shows a recoverable error for a stale chain manifest", async ({ page }) => {
  await page.route("**/deployment.json", async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    await route.fulfill({ response, json: { ...body, instanceId: `0x${"00".repeat(32)}` } });
  });
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText("The local chain was restarted");
  await expect(
    page.getByRole("button", { name: "Connect wallet", exact: true }).first(),
  ).toBeDisabled();
  await page.unroute("**/deployment.json");
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(page.getByText("Sale is live", { exact: true })).toBeVisible();
});

test("rejects public-chain deployment manifests", async ({ page }) => {
  await page.route("**/deployment.json", async (route) => {
    const response = await route.fetch();
    await route.fulfill({ response, json: { ...(await response.json()), chainId: 1 } });
  });
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText("The local deployment is invalid");
});

test("works on a narrow mobile viewport, including navigation and guide", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openSale(page);
  for (const width of [320, 375, 390]) {
    await page.setViewportSize({ width, height: 844 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  }
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("button", { name: "Token details", exact: true }).first().click();
  await expect(page.getByRole("heading", { name: "Meet the DAPP token" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("button", { name: "Getting started", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "This chain resets when the development server restarts.",
  );
  await page.getByRole("button", { name: "Let's explore" }).click();
  await expect(page.getByLabel("Amount in ETH")).toBeFocused();
  await connectTestWallet(page);
  await page.screenshot({ path: testInfo.outputPath("mobile.png"), fullPage: true });
});

test("recovers when the local RPC is unavailable", async ({ page }) => {
  await page.route("**/rpc", (route) =>
    route.fulfill({ status: 503, body: "Local chain unavailable" }),
  );
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText("Could not reach the local blockchain");
  await expect(
    page.getByRole("button", { name: "Connect wallet", exact: true }).first(),
  ).toBeDisabled();
  await page.unroute("**/rpc");
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(page.getByText("Sale is live", { exact: true })).toBeVisible();
});
