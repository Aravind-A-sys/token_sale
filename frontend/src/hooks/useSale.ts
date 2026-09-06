import { useCallback, useEffect, useRef, useState } from "react";
import {
  SaleClient,
  SaleError,
  connectBrowserWallet,
  errorMessage,
  switchToLocalNetwork,
  type Deployment,
  type Purchase,
  type Snapshot,
  type Wallet,
} from "../lib/client";

export interface Notice {
  kind: "success" | "error" | "info";
  text: string;
  hash?: string;
}
export type TransactionState = "idle" | "approving" | "pending";

export function useSale() {
  const clientRef = useRef<SaleClient | null>(null);
  const walletRef = useRef<Wallet | null>(null);
  const transactionLock = useRef(false);
  const requestVersion = useRef(0);
  const [deployment, setDeployment] = useState<Deployment | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [connection, setConnection] = useState<"loading" | "online" | "offline">("loading");
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [transaction, setTransaction] = useState<TransactionState>("idle");
  const [pendingHash, setPendingHash] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const refresh = useCallback(async () => {
    const client = clientRef.current;
    if (!client) return;
    const version = ++requestVersion.current;
    try {
      const result = await client.read(walletRef.current?.address ?? null);
      if (clientRef.current !== client || requestVersion.current !== version) return;
      setSnapshot(result.snapshot);
      setPurchases(result.purchases);
      setConnection("online");
      setConnectionError(null);
    } catch (error) {
      if (clientRef.current !== client || requestVersion.current !== version) return;
      setConnection("offline");
      setConnectionError(errorMessage(error));
    }
  }, []);

  const disconnect = useCallback(() => {
    if (walletRef.current?.mode === "injected") walletRef.current.provider.destroy();
    walletRef.current = null;
    setWallet(null);
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const controller = new AbortController();
    let interval: ReturnType<typeof setInterval> | undefined;
    let ownedClient: SaleClient | null = null;
    setConnection("loading");
    setConnectionError(null);
    async function start() {
      try {
        const client = await SaleClient.load(controller.signal);
        if (controller.signal.aborted) {
          client.provider.destroy();
          return;
        }
        ownedClient = client;
        clientRef.current = client;
        setDeployment(client.deployment);
        await refresh();
        if (!controller.signal.aborted)
          interval = setInterval(() => {
            void refresh();
          }, 5000);
      } catch (error) {
        if (!controller.signal.aborted) {
          setConnection("offline");
          setConnectionError(errorMessage(error));
        }
      }
    }
    void start();
    return () => {
      controller.abort();
      clearInterval(interval);
      if (clientRef.current === ownedClient) clientRef.current = null;
      ownedClient?.provider.destroy();
    };
  }, [reloadKey, refresh]);

  useEffect(() => {
    const injected = window.ethereum;
    const changed = () => {
      if (walletRef.current?.mode !== "injected") return;
      disconnect();
      setNotice({
        kind: "info",
        text: "Your wallet account or network changed. Reconnect to continue.",
      });
    };
    injected?.on?.("accountsChanged", changed);
    injected?.on?.("chainChanged", changed);
    return () => {
      injected?.removeListener?.("accountsChanged", changed);
      injected?.removeListener?.("chainChanged", changed);
    };
  }, [disconnect]);

  const connect = async (mode: Wallet["mode"]): Promise<boolean> => {
    const client = clientRef.current;
    if (!client || connecting) return false;
    setConnecting(true);
    setNotice(null);
    try {
      const connected = mode === "demo" ? await client.connectDemo() : await connectBrowserWallet();
      if (walletRef.current?.mode === "injected") walletRef.current.provider.destroy();
      walletRef.current = connected;
      setWallet(connected);
      await refresh();
      return true;
    } catch (error) {
      setNotice({ kind: "error", text: errorMessage(error) });
      return false;
    } finally {
      setConnecting(false);
    }
  };

  const switchNetwork = async () => {
    try {
      await switchToLocalNetwork();
      await connect("injected");
    } catch (error) {
      setNotice({ kind: "error", text: errorMessage(error) });
    }
  };

  const buy = async (tokens: bigint): Promise<boolean> => {
    const client = clientRef.current;
    const currentWallet = walletRef.current;
    if (transactionLock.current) return false;
    if (!client || !currentWallet || !snapshot) {
      setNotice({
        kind: "error",
        text: "Reconnect your wallet and the local chain before purchasing.",
      });
      return false;
    }
    let submittedHash: string | undefined;
    transactionLock.current = true;
    setNotice(null);
    setPendingHash(null);
    setTransaction("approving");
    try {
      if (connection !== "online")
        throw new SaleError("Reconnect to the local blockchain before purchasing.");
      const hash = await client.buy(currentWallet, tokens, snapshot.price, (hash) => {
        submittedHash = hash;
        setPendingHash(hash);
        setTransaction("pending");
      });
      await refresh();
      setNotice({
        kind: "success",
        text: `${tokens.toLocaleString("en-US")} DAPP purchased. Your local transaction is confirmed.`,
        hash,
      });
      return true;
    } catch (error) {
      setNotice({ kind: "error", text: errorMessage(error), hash: submittedHash });
      return false;
    } finally {
      transactionLock.current = false;
      setTransaction("idle");
    }
  };

  const retry = () => {
    if (transactionLock.current) return;
    disconnect();
    setDeployment(null);
    setSnapshot(null);
    setPurchases([]);
    setReloadKey((key) => key + 1);
  };

  return {
    deployment,
    snapshot,
    purchases,
    wallet,
    connection,
    connectionError,
    connecting,
    transaction,
    pendingHash,
    notice,
    connect,
    disconnect,
    switchNetwork,
    buy,
    retry,
    refresh,
    dismissNotice: () => setNotice(null),
  };
}
