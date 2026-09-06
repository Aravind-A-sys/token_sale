# Security and development boundaries

## This is not a production sale

OpenZeppelin supplies standard contract components, but **the custom sale and application have not received an independent security audit**. Passing tests and a clean dependency audit do not establish production safety.

The default deployment is an isolated, disposable Hardhat network. The startup/deployment scripts do not accept a real private key and do not configure a public chain. The UI rejects non-local manifests, checks the Hardhat instance, requires wallet chain 31337, and verifies contract code and the deployment block before sending a purchase.

## Public development accounts

Hardhat's funded accounts and keys are publicly known. The in-browser **local test wallet** uses the node's unlocked second account; it does not generate or hold a real wallet secret. The first unlocked account owns the contracts.

The chain and website listen on `0.0.0.0` for sandbox previews. The RPC endpoint is **unauthenticated development infrastructure**. Anyone who can reach the preview/RPC can use its test accounts, modify the shared local state, or call owner-only methods from the unlocked owner account. Do not run this setup with valuable assets, reused keys, an externally funded chain, or on an untrusted public server. No browser-origin allowlist is a substitute for RPC authentication or network isolation.

Never enter a seed phrase/private key in the frontend. Never send real ETH or real tokens to the displayed addresses. Local addresses may also exist on unrelated networks, where funds may be irretrievable.

## Contract trust model

- Supply is fixed at deployment; there are no later mint privileges.
- The sale is designed for the supplied standard, non-rebasing, non-fee-on-transfer, 18-decimal DAPP token. It is **not a general-purpose token sale**.
- Price and allocation are immutable. Whole-token counts are distinct from ERC-20 base units.
- Exact payments are required. There is no refund mechanism, sale deadline, vesting, price oracle, or escrow guarantee.
- The owner may pause, permanently close the sale, and withdraw ETH **before** closure. A real sale would need an explicit governance and treasury-custody design.
- `endSale()` returns unsold tokens. Proceeds must be withdrawn separately. No `selfdestruct` is used.
- Reentrancy protection, checked arithmetic, safe ERC-20 transfers, two-step ownership transfer, and disabled ownership renunciation reduce specific failure modes; they do not remove all risk.
- Tokens accidentally sent directly to a sale **after it ends** have no recovery method in this implementation. Do not transfer assets to a closed sale.

## Before considering a public deployment

1. Define sale governance, administration, treasury custody, buyer protections, and applicable legal requirements.
2. Obtain independent contract and application reviews; add invariants/fuzzing and adversarial integration testing appropriate to the final design.
3. Replace unlocked development accounts and RPC exposure with proper signer management, network configuration, and access controls.
4. Add explicit per-chain deployment manifests and allowlists, public explorer verification, a production RPC strategy, and deployment/recovery procedures.
5. Validate with real wallet extensions on a supported public testnet, including gas, transaction replacement, account/network switching, failed payments, pause/closure, and stale UI behavior.
6. Recheck all dependency advisories and compiler settings. Keep secrets out of Git, frontend bundles, and logs.

The browser suite uses both an unlocked local test wallet and a simulated EIP-1193 wallet. It does not prove compatibility with every wallet extension or public network.
