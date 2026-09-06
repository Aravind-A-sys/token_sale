import { useMemo, useRef, useState } from "react";
import { formatEther } from "ethers";
import {
  Activity,
  ArrowDown,
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Coins,
  FlaskConical,
  GitBranch,
  Layers,
  LayoutDashboard,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  Menu,
  RefreshCw,
  Search,
  ShieldCheck,
  Signal,
  Wallet as WalletIcon,
  X,
} from "lucide-react";
import { DappMark, EthereumArtwork, EthereumMark } from "./components/Brand";
import { CopyButton, Modal } from "./components/Modal";
import { useSale } from "./hooks/useSale";
import {
  formatCount,
  formatDapp,
  formatEth,
  formatProgress,
  progressPercent,
  quotePurchase,
  shortAddress,
} from "./lib/amounts";
import type { Purchase } from "./lib/client";

type Page = "overview" | "token" | "transactions";
type Dialog = "connect" | "wallet" | "guide" | "review" | null;

export default function App() {
  const sale = useSale();
  const { snapshot, wallet, deployment, connection, transaction, notice } = sale;
  const [page, setPage] = useState<Page>("overview");
  const [dialog, setDialog] = useState<Dialog>(null);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [amount, setAmount] = useState("0.01");
  const [reviewTokens, setReviewTokens] = useState(0n);
  const [selectedPurchase, setSelectedPurchase] = useState<Purchase | null>(null);
  const [search, setSearch] = useState("");
  const [onlyMine, setOnlyMine] = useState(false);
  const amountRef = useRef<HTMLInputElement>(null);
  const busy = transaction !== "idle";
  const online = connection === "online";
  const quote = quotePurchase(amount, snapshot?.price ?? 0n, snapshot?.available ?? 0n);
  const wrongNetwork = wallet !== null && wallet.chainId !== 31337n;
  const walletLoaded = snapshot?.account?.toLowerCase() === wallet?.address.toLowerCase();
  const status = !online
    ? connection === "loading"
      ? "Connecting"
      : "Chain offline"
    : snapshot?.ended
      ? "Sale ended"
      : snapshot?.paused
        ? "Sale paused"
        : snapshot?.available === 0n
          ? "Sold out"
          : "Sale is live";
  const saleOpen =
    online && !!snapshot && !snapshot.ended && !snapshot.paused && snapshot.available > 0n;
  const canBuy = saleOpen && !quote.error && !busy && !wrongNetwork;
  const allocationPct =
    snapshot && snapshot.totalSupply > 0n
      ? Number((snapshot.allocation * 10n ** 18n * 100n) / snapshot.totalSupply)
      : 75;

  const navigate = (next: Page) => {
    setPage(next);
    setMobileMenu(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const focusBuy = () => {
    setPage("overview");
    setMobileMenu(false);
    requestAnimationFrame(() => {
      document
        .getElementById("buy-tokens")
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
      amountRef.current?.focus({ preventScroll: true });
    });
  };
  const showDialog = (next: Dialog) => {
    sale.dismissNotice();
    setDialog(next);
    setMobileMenu(false);
  };
  const connect = async (mode: "demo" | "injected") => {
    if (await sale.connect(mode)) setDialog(null);
  };
  const confirm = async () => {
    if (await sale.buy(reviewTokens)) setDialog(null);
  };
  const filteredPurchases = useMemo(
    () =>
      sale.purchases.filter((purchase) => {
        const term = search.toLowerCase().trim();
        return (
          (!onlyMine || purchase.buyer.toLowerCase() === wallet?.address.toLowerCase()) &&
          (!term ||
            purchase.hash.toLowerCase().includes(term) ||
            purchase.buyer.toLowerCase().includes(term))
        );
      }),
    [sale.purchases, onlyMine, wallet?.address, search],
  );

  const renderNotice = () =>
    notice && (
      <div
        className={`notice notice-${notice.kind}`}
        role={notice.kind === "error" ? "alert" : "status"}
      >
        {notice.kind === "success" ? <CheckCircle2 size={19} /> : <CircleHelp size={19} />}
        <div>
          <span>{notice.text}</span>
          {notice.hash && (
            <div className="notice-hash">
              <code>{shortAddress(notice.hash)}</code>
              <CopyButton value={notice.hash} label="Copy transaction hash" />
            </div>
          )}
        </div>
        <button
          className="icon-button"
          onClick={sale.dismissNotice}
          aria-label="Dismiss notification"
        >
          <X size={17} />
        </button>
      </div>
    );

  const activityTable = (purchases: Purchase[], full = false) => (
    <div className="activity-table-wrap">
      {purchases.length > 0 ? (
        <table className="activity-table">
          <thead>
            <tr>
              <th>TRANSACTION</th>
              <th>AMOUNT</th>
              <th>PAID</th>
              <th>STATUS</th>
              <th>
                <span className="sr-only">Details</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {purchases.map((purchase) => (
              <tr key={purchase.hash}>
                <td>
                  <div className="transaction-name">
                    <span className="transaction-icon">
                      <ArrowDownLeft size={18} />
                    </span>
                    <span>
                      <button className="table-link" onClick={() => setSelectedPurchase(purchase)}>
                        DAPP purchase
                      </button>
                      <small>
                        {shortAddress(purchase.buyer)}
                        <span className="small-dot">·</span>
                        {new Date(purchase.timestamp * 1000).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </small>
                    </span>
                  </div>
                </td>
                <td className="table-amount">
                  +{formatCount(purchase.amount)} <span>DAPP</span>
                </td>
                <td>
                  {formatEth(purchase.paid)} <span className="muted">ETH</span>
                </td>
                <td>
                  <span className="confirmed">
                    <span className="status-dot" />
                    Confirmed
                  </span>
                </td>
                <td>
                  <button
                    className="icon-button"
                    aria-label={`View transaction ${shortAddress(purchase.hash)}`}
                    onClick={() => setSelectedPurchase(purchase)}
                  >
                    <ArrowUpRight size={17} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className={`empty-state ${full ? "empty-state-large" : ""}`}>
          <span className="empty-icon">
            <Activity size={23} />
          </span>
          <h3>
            {search || onlyMine ? "No matching purchases" : "Your first transaction starts here"}
          </h3>
          <p>
            {search || onlyMine
              ? "Try another address or switch to all activity."
              : "Confirmed purchases will appear here. Try the sale with a local test wallet."}
          </p>
          {!search && !onlyMine && (
            <button className="text-button" onClick={focusBuy}>
              Explore the sale <ArrowRight size={15} />
            </button>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      {mobileMenu && (
        <button
          className="sidebar-scrim"
          aria-label="Close navigation"
          onClick={() => setMobileMenu(false)}
        />
      )}
      <aside className={`sidebar ${mobileMenu ? "sidebar-open" : ""}`} aria-label="Main navigation">
        <button className="brand" onClick={() => navigate("overview")} aria-label="DAPP home">
          <DappMark />
          <span>
            dapp<span className="brand-period">.</span>
          </span>
        </button>
        <div className="workspace-label">TOKEN WORKSPACE</div>
        <nav className="primary-nav">
          <button
            className={page === "overview" ? "nav-link active" : "nav-link"}
            aria-current={page === "overview" ? "page" : undefined}
            onClick={() => navigate("overview")}
          >
            <LayoutDashboard size={19} />
            <span>Overview</span>
            <span className="nav-active-dot" />
          </button>
          <button className="nav-link" onClick={focusBuy}>
            <ArrowDownLeft size={20} />
            <span>Buy tokens</span>
          </button>
          <button
            className={page === "token" ? "nav-link active" : "nav-link"}
            aria-current={page === "token" ? "page" : undefined}
            onClick={() => navigate("token")}
          >
            <Layers size={19} />
            <span>Token details</span>
            <span className="nav-active-dot" />
          </button>
          <button
            className={page === "transactions" ? "nav-link active" : "nav-link"}
            aria-current={page === "transactions" ? "page" : undefined}
            onClick={() => navigate("transactions")}
          >
            <Activity size={19} />
            <span>Transactions</span>
            {sale.purchases.length > 0 && (
              <span className="nav-count">{sale.purchases.length}</span>
            )}
          </button>
        </nav>
        <div className="nav-divider" />
        <div className="workspace-label resources-label">RESOURCES</div>
        <nav className="secondary-nav">
          <button className="nav-link" onClick={() => showDialog("guide")}>
            <BookOpen size={18} />
            <span>Getting started</span>
            <ArrowUpRight size={14} />
          </button>
          <a
            className="nav-link"
            href="https://github.com/Aravind-A-sys/token_sale"
            target="_blank"
            rel="noreferrer"
          >
            <GitBranch size={18} />
            <span>Repository</span>
            <ArrowUpRight size={14} />
          </a>
        </nav>
        <div className="sidebar-bottom">
          <div className="local-node-card">
            <div>
              <span className={`status-dot ${online ? "" : "dot-muted"}`} />
              <strong>{online ? "Local network" : "Local workspace"}</strong>
              <Signal size={15} />
            </div>
            <p>
              Hardhat <span>·</span> Chain 31337
            </p>
            <span className="node-caption">A safe place to build something new.</span>
          </div>
          <div className="workspace-profile">
            <span className="workspace-avatar">D</span>
            <div>
              <strong>DAPP workspace</strong>
              <small>Development environment</small>
            </div>
            <button
              className="icon-button"
              aria-label="Workspace information"
              onClick={() => showDialog("guide")}
            >
              <ChevronDown size={17} />
            </button>
          </div>
        </div>
      </aside>

      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-menu"
              aria-label="Open navigation"
              onClick={() => setMobileMenu(true)}
            >
              <Menu size={21} />
            </button>
            <span>Workspace</span>
            <ChevronRight size={14} />
            <strong>Token sale</strong>
          </div>
          <div className="topbar-actions">
            <span className="environment-label">
              <FlaskConical size={13} />
              Local development
            </span>
            <button
              className="icon-button help-button"
              aria-label="Open getting started guide"
              onClick={() => showDialog("guide")}
            >
              <CircleHelp size={19} />
            </button>
            <span className="topbar-divider" />
            <button
              className={`wallet-button ${wallet ? "wallet-connected" : ""}`}
              onClick={() => showDialog(wallet ? "wallet" : "connect")}
              disabled={(!online && !wallet) || busy}
            >
              {wallet ? <span className="wallet-indicator" /> : <WalletIcon size={16} />}
              <span>{wallet ? shortAddress(wallet.address) : "Connect wallet"}</span>
              {wallet && <ChevronDown size={14} />}
            </button>
          </div>
        </header>

        <main className="main-content" id="main-content">
          {!dialog && renderNotice()}
          {sale.connectionError && (
            <div className="connection-alert" role="alert">
              <CircleHelp size={19} />
              <div>
                <strong>Local chain unavailable</strong>
                <p>{sale.connectionError}</p>
              </div>
              <button className="text-button" onClick={sale.retry}>
                Retry <RefreshCw size={14} />
              </button>
            </div>
          )}
          <div className="page-heading">
            <div>
              <div className="eyebrow">A FRESH START, ON-CHAIN</div>
              <h1>
                {page === "overview"
                  ? "DAPP token sale"
                  : page === "token"
                    ? "Meet the DAPP token"
                    : "Transaction history"}
              </h1>
              <p>
                {page === "overview"
                  ? "The next chapter starts with a token. Make it yours."
                  : page === "token"
                    ? "Simple economics. Open contracts. Everything in one place."
                    : "Every purchase, recorded on your local Ethereum chain."}
              </p>
            </div>
            <div className={`sale-status ${saleOpen ? "sale-status-live" : ""}`}>
              <span className="status-dot" />
              {status}
            </div>
          </div>

          <div className="section-tabs">
            <div>
              <button
                className={page === "overview" ? "section-tab selected" : "section-tab"}
                onClick={() => navigate("overview")}
              >
                Overview
              </button>
              <button
                className={page === "transactions" ? "section-tab selected" : "section-tab"}
                onClick={() => navigate("transactions")}
              >
                Transaction history
                {sale.purchases.length > 0 && <span>{sale.purchases.length}</span>}
              </button>
              {page === "token" && (
                <button className="section-tab selected" onClick={() => navigate("token")}>
                  Token details
                </button>
              )}
            </div>
            <button
              className="refresh-button"
              onClick={() => void sale.refresh()}
              disabled={connection === "loading"}
              aria-label="Refresh on-chain data"
            >
              <RefreshCw size={13} className={connection === "loading" ? "spin" : ""} />
              <span>
                {connection === "loading" ? "Connecting to chain" : "Updates every 5 seconds"}
              </span>
            </button>
          </div>

          {page === "overview" && (
            <>
              <div className="overview-grid">
                <section className="sale-overview" aria-label="Sale overview">
                  <div className="hero-card">
                    <div className="hero-content">
                      <span className="token-badge">
                        <span className="tiny-dapp">D</span>DAPP <span>·</span> ERC-20
                      </span>
                      <h2>
                        Small token.
                        <br />
                        Big possibilities.
                      </h2>
                      <p>
                        One million tokens. One transparent start.
                        <br className="hero-line-break" /> Built for a new chapter on Ethereum.
                      </p>
                      <button onClick={() => navigate("token")} className="hero-link">
                        Explore the token <ArrowUpRight size={17} />
                      </button>
                    </div>
                    <EthereumArtwork />
                    <span className="hero-caption">
                      <EthereumMark size={12} /> BUILT ON ETHEREUM
                    </span>
                  </div>
                  <div className="stats-grid">
                    <div className="stat-card">
                      <div className="stat-label">
                        Token price
                        <span>
                          <Coins size={15} />
                        </span>
                      </div>
                      <div className="stat-value">
                        {snapshot ? formatEth(snapshot.price) : "—"}
                        <small>ETH</small>
                      </div>
                      <p>Fixed price per DAPP</p>
                    </div>
                    <div className="stat-card">
                      <div className="stat-label">
                        Tokens sold
                        <span>
                          <Layers size={15} />
                        </span>
                      </div>
                      <div className="stat-value" data-testid="tokens-sold">
                        {snapshot ? formatCount(snapshot.sold) : "—"}
                        <small>DAPP</small>
                      </div>
                      <p>Of {snapshot ? formatCount(snapshot.allocation) : "—"} in the sale</p>
                    </div>
                    <div className="stat-card">
                      <div className="stat-label">
                        Total raised
                        <span>
                          <EthereumMark size={15} />
                        </span>
                      </div>
                      <div className="stat-value" data-testid="total-raised">
                        {snapshot ? formatEth(snapshot.raised) : "—"}
                        <small>ETH</small>
                      </div>
                      <p>
                        <span className="mini-green-dot" />
                        Local test funds only
                      </p>
                    </div>
                  </div>
                  <div className="progress-card card">
                    <div className="card-heading">
                      <h3>Sale progress</h3>
                      <span className="subtle-label">
                        {snapshot ? formatProgress(snapshot.sold, snapshot.allocation) : "—"}{" "}
                        complete
                      </span>
                    </div>
                    <div className="sale-progress-value">
                      <strong>{snapshot ? formatCount(snapshot.sold) : "—"}</strong>
                      <span>/ {snapshot ? formatCount(snapshot.allocation) : "—"} DAPP</span>
                    </div>
                    <div
                      className="progress-track"
                      role="progressbar"
                      aria-label="Tokens sold"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={
                        snapshot ? progressPercent(snapshot.sold, snapshot.allocation) : 0
                      }
                    >
                      <div
                        style={{
                          width: `${snapshot ? progressPercent(snapshot.sold, snapshot.allocation) : 0}%`,
                        }}
                      />
                    </div>
                    <div className="progress-meta">
                      <span>
                        <span className="legend-dot" />
                        {snapshot ? formatCount(snapshot.available) : "—"} DAPP available
                      </span>
                      <span>{snapshot ? allocationPct : "—"}% of total supply</span>
                    </div>
                  </div>
                  <div className="principles">
                    <div>
                      <ShieldCheck size={17} />
                      <span>Standard ERC-20</span>
                    </div>
                    <span />
                    <div>
                      <LockKeyhole size={16} />
                      <span>Fixed token supply</span>
                    </div>
                    <span />
                    <div>
                      <Activity size={17} />
                      <span>Fully on-chain</span>
                    </div>
                  </div>
                </section>

                <section className="purchase-column" aria-label="Buy DAPP tokens">
                  <div className="purchase-card card" id="buy-tokens">
                    <div className="purchase-heading">
                      <div>
                        <span className="eyebrow">YOUR NEXT MOVE</span>
                        <h2>Get your DAPP</h2>
                      </div>
                      <span className="purchase-token-icon">
                        <DappMark />
                      </span>
                    </div>
                    <div className="network-row">
                      <span>Network</span>
                      <strong>
                        <EthereumMark size={15} />
                        Hardhat Local
                        <span className={`status-dot ${online ? "" : "dot-muted"}`} />
                      </strong>
                    </div>
                    <form
                      onSubmit={(event) => {
                        event.preventDefault();
                        if (!wallet) showDialog("connect");
                        else if (canBuy) {
                          setReviewTokens(quote.tokens);
                          showDialog("review");
                        }
                      }}
                    >
                      <div className="amount-field">
                        <div className="field-label">
                          <label htmlFor="eth-amount">You pay</label>
                          <span>
                            Balance:{" "}
                            {wallet && walletLoaded && snapshot
                              ? formatEth(snapshot.ethBalance, 4)
                              : "—"}{" "}
                            ETH
                          </span>
                        </div>
                        <div
                          className={`amount-input ${quote.error && amount && snapshot ? "input-invalid" : ""}`}
                        >
                          <input
                            ref={amountRef}
                            id="eth-amount"
                            aria-label="Amount in ETH"
                            aria-describedby={quote.error && snapshot ? "amount-error" : undefined}
                            aria-invalid={!!(quote.error && snapshot)}
                            value={amount}
                            onChange={(event) => setAmount(event.target.value)}
                            inputMode="decimal"
                            autoComplete="off"
                            spellCheck={false}
                            maxLength={64}
                            placeholder="0.00"
                            disabled={busy}
                          />
                          <span className="currency-tag">
                            <span className="eth-currency-icon">
                              <EthereumMark size={17} />
                            </span>
                            ETH
                          </span>
                        </div>
                      </div>
                      <div className="presets">
                        {[10n, 50n, 100n].map((tokens) => (
                          <button
                            type="button"
                            key={tokens.toString()}
                            disabled={!snapshot || busy}
                            className={
                              quote.tokens === tokens ? "preset selected-preset" : "preset"
                            }
                            onClick={() =>
                              snapshot && setAmount(formatEther(tokens * snapshot.price))
                            }
                          >
                            {tokens.toString()} DAPP
                          </button>
                        ))}
                      </div>
                      <div className="exchange-divider">
                        <span>
                          <ArrowDown size={15} />
                        </span>
                      </div>
                      <div className="receive-field">
                        <div className="field-label">
                          <span>You receive</span>
                          <span>Available at a fixed price</span>
                        </div>
                        <div className="receive-value">
                          <output htmlFor="eth-amount" data-testid="quoted-tokens">
                            {quote.error ? "—" : formatCount(quote.tokens)}
                          </output>
                          <span className="currency-tag">
                            <span className="dapp-currency-icon">
                              <DappMark />
                            </span>
                            DAPP
                          </span>
                        </div>
                      </div>
                      {quote.error && snapshot && (
                        <p className="field-error" id="amount-error">
                          {quote.error}
                        </p>
                      )}
                      <dl className="purchase-details">
                        <div>
                          <dt>Exchange rate</dt>
                          <dd>
                            1 ETH ={" "}
                            {snapshot && snapshot.price > 0n
                              ? formatCount(10n ** 18n / snapshot.price)
                              : "—"}{" "}
                            DAPP
                          </dd>
                        </div>
                        <div>
                          <dt>
                            Network fee{" "}
                            <span title="The wallet estimates gas before sending your transaction.">
                              <CircleHelp size={12} />
                            </span>
                          </dt>
                          <dd>Estimated by wallet</dd>
                        </div>
                      </dl>
                      {wrongNetwork ? (
                        <button
                          type="button"
                          className="primary-button"
                          onClick={() => void sale.switchNetwork()}
                        >
                          Switch to local network <RefreshCw size={16} />
                        </button>
                      ) : (
                        <button
                          type="submit"
                          className="primary-button"
                          disabled={wallet ? !canBuy : !online || sale.connecting}
                        >
                          {busy ? (
                            <>
                              <LoaderCircle size={17} className="spin" />
                              Confirming purchase
                            </>
                          ) : !wallet ? (
                            <>
                              Connect wallet <ArrowRight size={17} />
                            </>
                          ) : !saleOpen ? (
                            status
                          ) : (
                            <>
                              Buy {quote.error ? "DAPP" : `${formatCount(quote.tokens)} DAPP`}{" "}
                              <ArrowRight size={17} />
                            </>
                          )}
                        </button>
                      )}
                    </form>
                    {!wallet ? (
                      <button
                        className="demo-link"
                        onClick={() => void connect("demo")}
                        disabled={!online || sale.connecting}
                      >
                        {sale.connecting ? (
                          <LoaderCircle size={14} className="spin" />
                        ) : (
                          <FlaskConical size={14} />
                        )}
                        Just exploring? <strong>Use a test wallet</strong>
                      </button>
                    ) : (
                      <div className="connected-caption">
                        <Check size={13} />
                        {wallet.mode === "demo"
                          ? "Connected to a local test wallet"
                          : "Connected to your browser wallet"}
                      </div>
                    )}
                    <div className="test-only-note">
                      <LockKeyhole size={12} />
                      Local test network. No real funds.
                    </div>
                  </div>
                  <div className="self-custody-note">
                    <span>
                      <ShieldCheck size={23} />
                    </span>
                    <div>
                      <h3>Your tokens. Your control.</h3>
                      <p>
                        DAPP goes straight to your wallet.
                        <br />
                        No waiting. No claim steps.
                      </p>
                    </div>
                  </div>
                  {wallet && (
                    <div className="balance-card">
                      <div>
                        <span>Your DAPP balance</span>
                        <strong data-testid="wallet-dapp-balance">
                          {walletLoaded && snapshot ? formatDapp(snapshot.tokenBalance) : "—"}{" "}
                          <small>DAPP</small>
                        </strong>
                      </div>
                      <DappMark />
                    </div>
                  )}
                </section>
              </div>
              <section className="activity-card card">
                <div className="activity-heading">
                  <div>
                    <h3>Recent activity</h3>
                    <p>Straight from the local chain.</p>
                  </div>
                  <button className="text-button" onClick={() => navigate("transactions")}>
                    View all transactions <ArrowUpRight size={15} />
                  </button>
                </div>
                {activityTable(sale.purchases.slice(0, 4))}
              </section>
            </>
          )}

          {page === "transactions" && (
            <section className="activity-card card full-activity">
              <div className="activity-heading">
                <div>
                  <h3>On-chain activity</h3>
                  <p>The latest 20 confirmed purchases. No simulated transactions.</p>
                </div>
                <span className="block-label">
                  <span className="status-dot" />
                  Block #{snapshot?.blockNumber ?? "—"}
                </span>
              </div>
              <div className="activity-filters">
                <div className="filter-pills">
                  <button
                    className={!onlyMine ? "active-filter" : ""}
                    onClick={() => setOnlyMine(false)}
                  >
                    All activity
                  </button>
                  <button
                    className={onlyMine ? "active-filter" : ""}
                    onClick={() => setOnlyMine(true)}
                    disabled={!wallet}
                  >
                    My purchases
                  </button>
                </div>
                <label className="search-field">
                  <Search size={15} />
                  <input
                    aria-label="Search transactions"
                    placeholder="Search address or transaction"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </label>
              </div>
              {activityTable(filteredPurchases, true)}
            </section>
          )}

          {page === "token" && (
            <div className="token-details-grid">
              <section className="card token-profile">
                <div className="token-profile-brand">
                  <DappMark />
                </div>
                <span className="eyebrow">THE FOUNDATION OF THE ECOSYSTEM</span>
                <h2>DApp Token</h2>
                <p>An ERC-20 token with a fixed supply and a straightforward, fixed-price sale.</p>
                <div className="token-tags">
                  <span>DAPP</span>
                  <span>18 decimals</span>
                  <span>ERC-20</span>
                </div>
                <dl className="detail-list">
                  <div>
                    <dt>Total supply</dt>
                    <dd>{snapshot ? formatDapp(snapshot.totalSupply) : "—"} DAPP</dd>
                  </div>
                  <div>
                    <dt>Sale allocation</dt>
                    <dd>{snapshot ? formatCount(snapshot.allocation) : "—"} DAPP</dd>
                  </div>
                  <div>
                    <dt>Price per token</dt>
                    <dd>{snapshot ? formatEth(snapshot.price) : "—"} ETH</dd>
                  </div>
                  <div>
                    <dt>Minimum purchase</dt>
                    <dd>1 DAPP</dd>
                  </div>
                  <div>
                    <dt>Additional minting</dt>
                    <dd>Not available</dd>
                  </div>
                </dl>
                <button className="primary-button" onClick={focusBuy}>
                  Explore the sale <ArrowRight size={17} />
                </button>
              </section>
              <div className="token-details-side">
                <section className="card allocation-card">
                  <div className="card-heading">
                    <h3>Token allocation</h3>
                    <Layers size={18} />
                  </div>
                  <div className="allocation-content">
                    <div
                      className="allocation-donut"
                      style={{
                        background: `conic-gradient(#3d7958 0% ${allocationPct}%, #dce8d5 ${allocationPct}% 100%)`,
                      }}
                    >
                      <div>
                        <strong>
                          {snapshot ? formatCount(snapshot.totalSupply / 10n ** 18n) : "—"}
                        </strong>
                        <span>TOTAL DAPP</span>
                      </div>
                    </div>
                    <div className="allocation-legend">
                      <div>
                        <span className="legend-dot" />
                        <span>
                          Public sale<strong>{snapshot ? allocationPct : "—"}%</strong>
                        </span>
                      </div>
                      <div>
                        <span className="legend-dot reserve-dot" />
                        <span>
                          Initial owner reserve
                          <strong>{snapshot ? 100 - allocationPct : "—"}%</strong>
                        </span>
                      </div>
                    </div>
                  </div>
                  <p className="muted small-text">
                    Allocation at deployment. Unsold inventory returns to the owner when the sale
                    ends; there is no vesting schedule.
                  </p>
                </section>
                <section className="card contracts-card">
                  <div className="card-heading">
                    <h3>On-chain details</h3>
                    <span className="subtle-label">Chain 31337</span>
                  </div>
                  {[
                    { label: "Token contract", value: deployment?.tokenAddress },
                    { label: "Sale contract", value: deployment?.saleAddress },
                    { label: "Sale owner", value: snapshot?.owner },
                  ].map(({ label, value }) => (
                    <div className="contract-address" key={label}>
                      <span>{label}</span>
                      <div>
                        <code>{value ?? "Not deployed"}</code>
                        {value && (
                          <CopyButton value={value} label={`Copy ${label.toLowerCase()} address`} />
                        )}
                      </div>
                    </div>
                  ))}
                  <div className="contract-warning">
                    <CircleHelp size={16} />
                    <p>
                      These are local development contracts, not audited production deployments.
                      Never send real assets to these addresses.
                    </p>
                  </div>
                </section>
              </div>
            </div>
          )}

          <footer className="page-footer">
            <span>
              <DappMark />
              Built on Ethereum. Made for a fresh start.
            </span>
            <span>
              <span className={`status-dot ${online ? "" : "dot-muted"}`} />
              {online ? "Local chain connected" : "Waiting for local chain"}
              <span className="footer-version">v2.0</span>
            </span>
          </footer>
        </main>
      </div>

      {dialog === "connect" && (
        <Modal
          title="Your gateway to DAPP"
          subtitle="Choose how you'd like to explore the local sale."
          onClose={() => setDialog(null)}
          locked={sale.connecting}
        >
          {renderNotice()}
          <button
            className="wallet-option"
            disabled={sale.connecting}
            onClick={() => void connect("injected")}
          >
            <span className="wallet-option-icon browser-wallet-icon">
              <WalletIcon size={24} />
            </span>
            <span>
              <strong>Browser wallet</strong>
              <small>Connect MetaMask or another injected wallet</small>
            </span>
            <ArrowUpRight size={19} />
          </button>
          <div className="option-divider">
            <span>OR KEEP IT SIMPLE</span>
          </div>
          <button
            className="wallet-option test-wallet-option"
            disabled={sale.connecting}
            onClick={() => void connect("demo")}
          >
            <span className="wallet-option-icon">
              <FlaskConical size={24} />
            </span>
            <span>
              <strong>
                Local test wallet <span className="recommended-label">QUICK START</span>
              </strong>
              <small>Pre-funded test ETH. No extension needed.</small>
            </span>
            {sale.connecting ? (
              <LoaderCircle className="spin" size={19} />
            ) : (
              <ArrowRight size={19} />
            )}
          </button>
          <div className="modal-safety">
            <ShieldCheck size={19} />
            <p>
              The test wallet is a shared, publicly known development account. All tokens and ETH in
              this workspace are local test assets with no monetary value.
            </p>
          </div>
        </Modal>
      )}
      {dialog === "wallet" && wallet && (
        <Modal
          title="Your connected wallet"
          subtitle={
            wallet.mode === "demo"
              ? "Shared local test account · No real assets"
              : "Browser wallet · Local development only"
          }
          onClose={() => setDialog(null)}
        >
          {renderNotice()}
          <div className="wallet-summary">
            <span className="wallet-summary-icon">
              <WalletIcon size={26} />
            </span>
            <strong>{shortAddress(wallet.address)}</strong>
            <span className="address-full">
              <code>{wallet.address}</code>
              <CopyButton value={wallet.address} />
            </span>
          </div>
          <dl className="detail-list">
            <div>
              <dt>Local test ETH</dt>
              <dd>{walletLoaded && snapshot ? formatEth(snapshot.ethBalance, 6) : "—"} ETH</dd>
            </div>
            <div>
              <dt>DAPP balance</dt>
              <dd>{walletLoaded && snapshot ? formatDapp(snapshot.tokenBalance) : "—"} DAPP</dd>
            </div>
            <div>
              <dt>Wallet chain ID</dt>
              <dd>{wallet.chainId.toString()}</dd>
            </div>
          </dl>
          {wrongNetwork && (
            <button className="primary-button" onClick={() => void sale.switchNetwork()}>
              Switch to Hardhat Local <RefreshCw size={16} />
            </button>
          )}
          <button
            className="secondary-button disconnect-button"
            onClick={() => {
              sale.disconnect();
              setDialog(null);
            }}
          >
            <LogOut size={16} />
            Disconnect wallet
          </button>
        </Modal>
      )}
      {dialog === "review" && snapshot && (
        <Modal
          title="One step closer."
          subtitle="Review your local token purchase before confirming."
          onClose={() => setDialog(null)}
          locked={busy}
        >
          {renderNotice()}
          <div className="review-token">
            <span className="review-token-mark">
              <DappMark />
            </span>
            <strong>
              {formatCount(reviewTokens)} <span>DAPP</span>
            </strong>
            <p>Delivered directly to your connected wallet</p>
          </div>
          <dl className="detail-list">
            <div>
              <dt>You pay</dt>
              <dd>{formatEth(reviewTokens * snapshot.price)} ETH</dd>
            </div>
            <div>
              <dt>Price per token</dt>
              <dd>{formatEth(snapshot.price)} ETH</dd>
            </div>
            <div>
              <dt>Network</dt>
              <dd>Hardhat Local · 31337</dd>
            </div>
            <div>
              <dt>Recipient</dt>
              <dd>{wallet && shortAddress(wallet.address)}</dd>
            </div>
            <div>
              <dt>Network fee</dt>
              <dd>Additional test ETH</dd>
            </div>
          </dl>
          <div className="review-note">
            <FlaskConical size={16} />
            <span>This is a local test transaction. No real funds are used.</span>
          </div>
          <button className="primary-button" onClick={() => void confirm()} disabled={busy}>
            {busy ? (
              <>
                <LoaderCircle size={17} className="spin" />
                {transaction === "approving" ? "Waiting for confirmation…" : "Confirming on-chain…"}
              </>
            ) : (
              <>
                Confirm purchase <ArrowRight size={17} />
              </>
            )}
          </button>
          {busy && sale.pendingHash && (
            <p className="pending-hash">
              Transaction <code>{shortAddress(sale.pendingHash)}</code>
            </p>
          )}
        </Modal>
      )}
      {dialog === "guide" && (
        <Modal
          title="A fresh start, made simple."
          subtitle="Everything you need to try your first DAPP purchase."
          onClose={() => setDialog(null)}
        >
          <ol className="guide-steps">
            <li>
              <span>01</span>
              <div>
                <h3>Make yourself at home</h3>
                <p>
                  Use the local test wallet for a quick start, or connect your browser wallet to
                  this workspace's local network.
                </p>
              </div>
            </li>
            <li>
              <span>02</span>
              <div>
                <h3>Choose your DAPP</h3>
                <p>
                  Enter an ETH amount or use a preset. Each whole DAPP costs{" "}
                  {snapshot ? formatEth(snapshot.price) : "0.001"} test ETH, plus a small network
                  fee.
                </p>
              </div>
            </li>
            <li>
              <span>03</span>
              <div>
                <h3>See it on-chain</h3>
                <p>
                  Review and confirm your purchase. Your DAPP balance and transaction history update
                  after it is mined.
                </p>
              </div>
            </li>
          </ol>
          <div className="rpc-card">
            <span>LOCAL RPC URL · CHAIN 31337</span>
            <div>
              <code>{new URL("/rpc", window.location.origin).href}</code>
              <CopyButton
                value={new URL("/rpc", window.location.origin).href}
                label="Copy local RPC URL"
              />
            </div>
            <p>
              Already have chain 31337 in your wallet? Update its RPC URL to this address, or use
              the test wallet.
            </p>
          </div>
          <div className="modal-safety">
            <FlaskConical size={20} />
            <p>
              This chain resets when the development server restarts. Balances are shared test data,
              not real assets. The contracts have not been independently audited.
            </p>
          </div>
          <button
            className="primary-button"
            onClick={() => {
              setDialog(null);
              focusBuy();
            }}
          >
            Let's explore <ArrowRight size={17} />
          </button>
        </Modal>
      )}
      {selectedPurchase && (
        <Modal
          title="A little piece of on-chain history."
          subtitle="Confirmed on the local Ethereum development network."
          onClose={() => setSelectedPurchase(null)}
        >
          <div className="transaction-confirmed">
            <CheckCircle2 size={28} />
            <strong>Purchase confirmed</strong>
          </div>
          <dl className="detail-list">
            <div>
              <dt>DAPP received</dt>
              <dd>{formatCount(selectedPurchase.amount)} DAPP</dd>
            </div>
            <div>
              <dt>ETH paid</dt>
              <dd>{formatEth(selectedPurchase.paid)} ETH</dd>
            </div>
            <div>
              <dt>Block</dt>
              <dd>#{selectedPurchase.blockNumber}</dd>
            </div>
            <div>
              <dt>Time</dt>
              <dd>{new Date(selectedPurchase.timestamp * 1000).toLocaleString()}</dd>
            </div>
          </dl>
          <div className="contract-address">
            <span>Transaction hash</span>
            <div>
              <code>{selectedPurchase.hash}</code>
              <CopyButton value={selectedPurchase.hash} label="Copy transaction hash" />
            </div>
          </div>
          <div className="contract-address">
            <span>Buyer</span>
            <div>
              <code>{selectedPurchase.buyer}</code>
              <CopyButton value={selectedPurchase.buyer} label="Copy buyer address" />
            </div>
          </div>
          <p className="small-text muted">
            Local transactions are not visible on public block explorers.
          </p>
        </Modal>
      )}
    </div>
  );
}
