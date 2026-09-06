import {
  BrowserProvider,
  Contract,
  EventLog,
  FetchRequest,
  JsonRpcProvider,
  isAddress,
  isError,
  type Eip1193Provider,
  type InterfaceAbi,
  type Signer,
} from "ethers";

export class SaleError extends Error {}

export interface Deployment {
  version: 1;
  chainId: 31337;
  networkName: string;
  instanceId: string;
  deploymentBlock: number;
  tokenAddress: string;
  saleAddress: string;
  tokenAbi: InterfaceAbi;
  saleAbi: InterfaceAbi;
}
export interface Snapshot {
  price: bigint;
  allocation: bigint;
  sold: bigint;
  raised: bigint;
  totalSupply: bigint;
  inventory: bigint;
  available: bigint;
  ended: boolean;
  paused: boolean;
  owner: string;
  account: string | null;
  ethBalance: bigint;
  tokenBalance: bigint;
  blockNumber: number;
}
export interface Purchase {
  hash: string;
  buyer: string;
  amount: bigint;
  paid: bigint;
  blockNumber: number;
  timestamp: number;
}
export interface Wallet {
  mode: "demo" | "injected";
  address: string;
  chainId: bigint;
  provider: JsonRpcProvider | BrowserProvider;
  signer: Signer;
}

export interface InjectedProvider extends Eip1193Provider {
  on?: (event: string, listener: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, listener: (...args: unknown[]) => void) => void;
}
declare global {
  interface Window {
    ethereum?: InjectedProvider;
  }
}

export function validateDeployment(value: unknown): Deployment {
  if (!value || typeof value !== "object")
    throw new SaleError("Local deployment not found. Start the project with npm run dev.");
  const d = value as Partial<Deployment>;
  if (
    d.version !== 1 ||
    d.chainId !== 31337 ||
    typeof d.networkName !== "string" ||
    typeof d.instanceId !== "string" ||
    !/^0x[0-9a-f]{64}$/i.test(d.instanceId) ||
    typeof d.tokenAddress !== "string" ||
    !isAddress(d.tokenAddress) ||
    typeof d.saleAddress !== "string" ||
    !isAddress(d.saleAddress) ||
    !Number.isSafeInteger(d.deploymentBlock) ||
    d.deploymentBlock! < 0 ||
    !Array.isArray(d.tokenAbi) ||
    !Array.isArray(d.saleAbi)
  ) {
    throw new SaleError("The local deployment is invalid. Run npm run deploy:local and retry.");
  }
  return d as Deployment;
}

export class SaleClient {
  readonly token: Contract;
  readonly sale: Contract;

  constructor(
    readonly deployment: Deployment,
    readonly provider: JsonRpcProvider,
  ) {
    this.token = new Contract(deployment.tokenAddress, deployment.tokenAbi, provider);
    this.sale = new Contract(deployment.saleAddress, deployment.saleAbi, provider);
  }

  static async load(signal: AbortSignal) {
    let deployment: Deployment;
    try {
      const response = await fetch("/deployment.json", { cache: "no-store", signal });
      if (!response.ok) throw new Error("Missing deployment");
      deployment = validateDeployment(await response.json());
    } catch (error) {
      if (error instanceof SaleError || signal.aborted) throw error;
      throw new SaleError("Local deployment not found. Start the project with npm run dev.");
    }
    const rpcRequest = new FetchRequest(new URL("/rpc", window.location.origin).href);
    rpcRequest.timeout = 10_000;
    const provider = new JsonRpcProvider(rpcRequest, undefined, {
      batchMaxCount: 1,
      cacheTimeout: -1,
    });
    provider.pollingInterval = 1000;
    const client = new SaleClient(deployment, provider);
    try {
      await client.ensureLocal();
      if (signal.aborted) throw new DOMException("Aborted", "AbortError");
      const codes = await Promise.all([
        provider.getCode(deployment.tokenAddress),
        provider.getCode(deployment.saleAddress),
      ]);
      if (codes.some((code) => code === "0x"))
        throw new SaleError(
          "Contracts are missing from this chain. Run npm run deploy:local and retry.",
        );
      return client;
    } catch (error) {
      provider.destroy();
      throw error;
    }
  }

  async ensureLocal() {
    const [chainId, metadata] = await Promise.all([
      this.provider.send("eth_chainId", []),
      this.provider.send("hardhat_metadata", []),
    ]);
    if (BigInt(chainId) !== 31337n)
      throw new SaleError(
        "This workspace only supports the local test chain. Real-network transactions are disabled.",
      );
    if (metadata.instanceId !== this.deployment.instanceId)
      throw new SaleError("The local chain was restarted. Reload the deployment to reconnect.");
  }

  async read(account: string | null): Promise<{ snapshot: Snapshot; purchases: Purchase[] }> {
    await this.ensureLocal();
    const blockNumber = await this.provider.getBlockNumber();
    const options = { blockTag: blockNumber };
    const [
      price,
      allocation,
      sold,
      raised,
      totalSupply,
      inventory,
      ended,
      paused,
      owner,
      ethBalance,
      tokenBalance,
    ] = await Promise.all([
      this.sale.tokenPrice(options) as Promise<bigint>,
      this.sale.saleAllocation(options) as Promise<bigint>,
      this.sale.tokensSold(options) as Promise<bigint>,
      this.sale.totalRaised(options) as Promise<bigint>,
      this.token.totalSupply(options) as Promise<bigint>,
      this.token.balanceOf(this.deployment.saleAddress, options) as Promise<bigint>,
      this.sale.saleEnded(options) as Promise<boolean>,
      this.sale.paused(options) as Promise<boolean>,
      this.sale.owner(options) as Promise<string>,
      account ? this.provider.getBalance(account, blockNumber) : 0n,
      account ? (this.token.balanceOf(account, options) as Promise<bigint>) : 0n,
    ]);
    const remaining = allocation - sold;
    const wholeInventory = inventory / 10n ** 18n;
    const available = ended ? 0n : remaining < wholeInventory ? remaining : wholeInventory;
    const logs = await this.sale.queryFilter(
      this.sale.filters.TokensPurchased(),
      this.deployment.deploymentBlock,
      blockNumber,
    );
    const purchases = await Promise.all(
      logs
        .filter((log): log is EventLog => log instanceof EventLog)
        .slice(-20)
        .reverse()
        .map(async (log) => ({
          hash: log.transactionHash,
          buyer: log.args.buyer as string,
          amount: log.args.amount as bigint,
          paid: log.args.paid as bigint,
          blockNumber: log.blockNumber,
          timestamp: (await log.getBlock()).timestamp,
        })),
    );
    return {
      snapshot: {
        price,
        allocation,
        sold,
        raised,
        totalSupply,
        inventory,
        available,
        ended,
        paused,
        owner,
        account,
        ethBalance,
        tokenBalance,
        blockNumber,
      },
      purchases,
    };
  }

  async connectDemo(): Promise<Wallet> {
    await this.ensureLocal();
    const signer = await this.provider.getSigner(1);
    return {
      mode: "demo",
      address: await signer.getAddress(),
      chainId: 31337n,
      provider: this.provider,
      signer,
    };
  }

  async buy(
    wallet: Wallet,
    tokens: bigint,
    price: bigint,
    onHash: (hash: string) => void,
  ): Promise<string> {
    await this.ensureLocal();
    if (BigInt(await wallet.provider.send("eth_chainId", [])) !== 31337n) {
      throw new SaleError("Switch your wallet to Hardhat Local before purchasing.");
    }
    const code = await wallet.provider.getCode(this.deployment.saleAddress);
    if (code === "0x" || code !== (await this.provider.getCode(this.deployment.saleAddress))) {
      throw new SaleError(
        "Your wallet is connected to a different local chain. Use this workspace's RPC URL or the local test wallet.",
      );
    }
    const [walletBlock, localBlock] = await Promise.all([
      wallet.provider.getBlock(this.deployment.deploymentBlock),
      this.provider.getBlock(this.deployment.deploymentBlock),
    ]);
    if (!walletBlock || walletBlock.hash !== localBlock?.hash) {
      throw new SaleError(
        "Your wallet is on another local chain. Update chain 31337 to this workspace's RPC URL or use the test wallet.",
      );
    }
    if (tokens <= 0n) throw new SaleError("Choose at least one DAPP token.");
    const sale = new Contract(this.deployment.saleAddress, this.deployment.saleAbi, wallet.signer);
    const tx = await sale.buyTokens(tokens, { value: tokens * price });
    onHash(tx.hash);
    try {
      const receipt = await tx.wait(1, 60_000);
      if (!receipt || receipt.status !== 1)
        throw new SaleError("The transaction did not succeed. No purchase was recorded.");
      return receipt.hash;
    } catch (error) {
      if (isError(error, "TRANSACTION_REPLACED")) {
        if (!error.cancelled && error.receipt.status === 1) return error.receipt.hash;
        throw new SaleError("The transaction was cancelled in your wallet.");
      }
      if (isError(error, "TIMEOUT")) {
        throw new SaleError(
          "The transaction was submitted, but confirmation timed out. Check transaction history before retrying.",
        );
      }
      if (!(error instanceof SaleError) && !isError(error, "CALL_EXCEPTION")) {
        throw new SaleError(
          "The transaction was submitted, but its confirmation is unavailable. Check transaction history before retrying.",
        );
      }
      throw error;
    }
  }
}

export async function connectBrowserWallet(): Promise<Wallet> {
  if (!window.ethereum)
    throw new SaleError(
      "No browser wallet was detected. Use the local test wallet, or open this page in a wallet-enabled browser.",
    );
  const provider = new BrowserProvider(window.ethereum, "any");
  try {
    await provider.send("eth_requestAccounts", []);
    const signer = await provider.getSigner();
    return {
      mode: "injected",
      address: await signer.getAddress(),
      chainId: (await provider.getNetwork()).chainId,
      provider,
      signer,
    };
  } catch (error) {
    provider.destroy();
    throw error;
  }
}

export async function switchToLocalNetwork() {
  if (!window.ethereum) throw new SaleError("No browser wallet was detected.");
  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: "0x7a69" }],
    });
  } catch (error) {
    const code = (error as { code?: number }).code;
    if (code !== 4902) throw error;
    await window.ethereum.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: "0x7a69",
          chainName: "DAPP · Hardhat Local",
          nativeCurrency: { name: "Test Ether", symbol: "ETH", decimals: 18 },
          rpcUrls: [new URL("/rpc", window.location.origin).href],
        },
      ],
    });
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: "0x7a69" }],
    });
  }
}

export function errorMessage(error: unknown): string {
  if (error instanceof SaleError) return error.message;
  if (isError(error, "ACTION_REJECTED") || (error as { code?: number } | null)?.code === 4001)
    return "Request cancelled. Nothing was purchased.";
  if (isError(error, "INSUFFICIENT_FUNDS"))
    return "Not enough test ETH for this purchase and the network fee.";
  if (isError(error, "CALL_EXCEPTION")) {
    const messages: Record<string, string> = {
      EnforcedPause: "The sale is paused. Purchases are temporarily unavailable.",
      SaleClosed: "This sale has ended. No further purchases are possible.",
      AllocationExceeded:
        "There are not enough tokens left for this purchase. Try a smaller amount.",
      InsufficientInventory: "The sale does not have enough tokens available.",
      IncorrectPayment:
        "The payment does not match the current token price. Refresh and try again.",
    };
    return (
      messages[error.revert?.name ?? ""] ??
      "The contract rejected this transaction. Refresh the sale and check your amount and test ETH balance."
    );
  }
  return "Could not reach the local blockchain. Check that npm run dev is running, then retry.";
}
