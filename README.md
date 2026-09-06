# DAPP · Token sale workspace

A fresh, **local-first Ethereum token sale** built with Solidity, OpenZeppelin, Hardhat, React, and TypeScript. Browse live sale data, connect a wallet, review a purchase, and see confirmed DAPP balances and transactions.

> **Development only.** This project starts an isolated Hardhat chain, not Ethereum mainnet or a public testnet. All ETH and DAPP in the workspace are test assets with no monetary value. The custom contracts have **not** been independently audited.

## Start here

Requirements: **Node.js 22.13+** (Node 22 LTS recommended) and npm. If you use nvm, run `nvm use`.

```bash
npm ci
npm run dev
```

One command starts the local chain on port **8545**, deploys and funds the contracts, exports their addresses/ABIs, and starts the frontend on port **5173**. Open the displayed website URL, or the **5173 live preview** in Arena.

1. Select **Use a test wallet**. No extension, private key, or seed phrase is needed.
2. Choose a preset or enter an ETH amount in multiples of **0.001**.
3. Click **Buy DAPP**, review the transaction, then **Confirm purchase**.
4. Check your token balance and transaction history; data refreshes every five seconds.

Stop with `Ctrl+C`. Restarting `npm run dev` creates a **new, empty chain and sale**. Old local balances and transaction history do not persist. The startup script shuts down its child processes together and will not silently reset or reuse a node already listening on port 8545.

### Browser wallets

The frontend also supports injected EIP-1193 wallets such as MetaMask. Connect explicitly using **Connect wallet → Browser wallet** and approve switching to the local chain if prompted.

- Chain ID: **31337** (`0x7a69`)
- Currency: **ETH** (local test ETH only)
- RPC URL: **the current website origin followed by `/rpc`**, shown in **Getting started**

If your wallet already has chain 31337, update that network's RPC URL to this workspace. Switching to an existing chain ID does not necessarily change its RPC URL. Browser wallets need their own local test ETH; the built-in test wallet is the easiest way to try the sale. Never import a real seed phrase or send real ETH to a development address.

All browser-to-chain requests use the same-origin `/rpc` proxy. No browser code depends on a sandbox `localhost` address. The dev server binds to `0.0.0.0` and accepts Arena's `.e2b.app` preview hosts.

## Sale economics

| Property              | Value                                                 |
| --------------------- | ----------------------------------------------------- |
| Token                 | DApp Token (`DAPP`)                                   |
| Standard              | OpenZeppelin ERC-20, 18 decimals                      |
| Fixed supply          | 1,000,000 DAPP                                        |
| Sale allocation       | 750,000 DAPP (75%)                                    |
| Initial owner reserve | 250,000 DAPP (25%)                                    |
| Price                 | 0.001 ETH per whole DAPP                              |
| Smallest purchase     | 1 DAPP                                                |
| Delivery              | Direct token transfer during the purchase transaction |

The original supply, sale allocation, and price are retained. Unlike the legacy token, the new token has explicit ERC-20 decimals: **one DAPP is `10^18` base units**. `buyTokens(amount)`, `tokensSold`, and `saleAllocation` use **whole-token counts**. ERC-20 balances/transfers use base units. `tokenPrice` and `totalRaised` are in wei. The UI and deployment scripts use `bigint`, never floating-point payment calculations.

There are no fake purchase records, market-price feeds, returns projections, vesting schedules, refunds, or post-deployment mint permissions.

## Contract behavior

- `DappToken` mints its entire fixed supply to the initial owner once.
- `DappTokenSale` accepts exact ETH payment for whole tokens, checks inventory and the allocation cap, and transfers tokens with `SafeERC20`.
- The owner can **pause/resume** purchases and **withdraw proceeds** to a nonzero recipient, including during an active or paused sale.
- `endSale()` permanently closes purchases and returns unsold inventory to the owner. It deliberately **does not send ETH**: call `withdrawProceeds(recipient)` separately, so an ETH-rejecting owner cannot prevent closure.
- Ownership transfers require acceptance by the new owner. Renouncing ownership is disabled to avoid orphaning inventory or proceeds.
- Reentrancy protection covers purchases, withdrawals, and closure. Plain ETH transfers to the sale revert.

Admin methods are available through the contracts/Hardhat, not an admin frontend. Sale status, balances, allocation, and activity are read from the chain rather than hard-coded demo data. Read [SECURITY.md](SECURITY.md) before extending the contracts.

## Development commands

| Command                | Purpose                                                         |
| ---------------------- | --------------------------------------------------------------- |
| `npm run dev`          | Start chain, deploy/fund contracts, and launch the frontend     |
| `npm run chain`        | Start just the local Hardhat node                               |
| `npm run deploy:local` | Deploy a new token and funded sale to the running local node    |
| `npm run web`          | Start just the frontend and RPC proxy                           |
| `npm run compile`      | Compile Solidity and generate TypeScript bindings               |
| `npm test`             | Run isolated smart-contract tests                               |
| `npm run test:ui`      | Run amount, formatting, manifest, and error-handling unit tests |
| `npm run test:e2e`     | Run Chromium browser integration tests                          |
| `npm run check`        | Compile, type-check, test contracts/UI utilities, and build     |
| `npm run build`        | Build the frontend into `dist/`                                 |
| `npm run preview`      | Serve the built frontend on port 4173 with the local RPC proxy  |
| `npm run format`       | Format maintained TypeScript, CSS, JSON, and documentation      |
| `npm run format:check` | Check formatting without editing files                          |

For separate terminals, use `npm run chain`, then `npm run deploy:local`, then `npm run web` **instead of** `npm run dev`. `deploy:local` creates new contracts without deleting old ones. It refuses networks other than the named local Hardhat connection with chain ID 31337 and valid Hardhat metadata. No public deployment network or real signing key is configured.

### Validation

```bash
npm run check
npm run format:check
npm audit

# First browser-test run on a normal development machine:
npx playwright install --with-deps chromium
npm run test:e2e
```

Playwright starts the app automatically if it is not running. Outside CI it may reuse an existing local dev server, and its purchase test **adds a real local test transaction** to that sale. Restart the dev server afterwards if you want a clean demo. An existing Chromium binary can be selected with `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`; this is optional and primarily useful in restricted environments.

Browser tests cover purchase review and confirmation, on-chain balance verification, validation, rejected/missing wallets, a simulated injected wallet's network switching, stale deployment/RPC recovery, public-chain rejection, and mobile navigation. These tests do not replace testing an actual wallet extension before any public deployment.

### Build and deployment files

`frontend/public/deployment.json` is generated by `deploy:local` and ignored by Git. It includes local contract addresses, ABIs, the deployment block, and the Hardhat instance ID—**never a private key**. The frontend rejects a stale instance after a node restart and offers a retry action.

For a built preview, deploy locally first, then run `npm run build` and `npm run preview` while the chain remains running. A new chain/deployment requires rebuilding the preview's manifest. Serving `dist/` on a generic static host alone will **not** provide a working sale; the matching RPC proxy and running chain are required. Public/testnet deployment and static hosting are intentionally out of scope for this restart.

Solidity **0.8.30** is pinned through the `solc` npm package and loaded locally, avoiding an extra compiler-binary download. The maintained stack uses Hardhat 3, OpenZeppelin 5, ethers 6, React 19, Vite 8, and self-hosted DM Sans fonts. The lockfile is committed for reproducibility. Small, targeted transitive dependency overrides keep the development compiler/test tooling on patched dependencies; revalidate them when upgrading.

## Repository layout

```text
contracts/              New token and sale contracts
  test/                 Test-only helper contracts (not deployed by the app)
test/                   Isolated contract behavior/security tests
scripts/                Local deployment and process orchestration
frontend/src/           React UI, typed chain client, bigint helpers, unit tests
frontend/public/        Favicon and generated local deployment manifest
e2e/                    Playwright browser integration tests
legacy/                 Preserved original Truffle project
.github/workflows/      Build, test, and browser-test CI (no deployments)
```

### Original project preserved

All **32 original tracked files** are preserved byte-for-byte under [`legacy/`](legacy/README.md), including contracts, migrations, tests, bundled frontend, package files, and deployment configuration. The old `build/` directory is archived as `legacy/truffle-artifacts/`. Original attribution remains in `legacy/package.json` and the Git history.

The archived Truffle project is not compiled, installed, served, or tested by the new root-level commands. Do not run its old deployment script: it contains historical commit/push commands and is retained for reference only.
