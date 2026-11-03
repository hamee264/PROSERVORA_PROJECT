import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowUpRight,
  Banknote,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Landmark,
  Search,
  ShieldCheck,
  WalletCards,
  X,
} from "lucide-react";
import { getMyBookings } from "../../../services/bookingService";
import {
  getPayoutPreview,
  getProviderPayouts,
  getProviderWallet,
  requestPayout,
} from "../../../services/payoutService";
import {
  addBankAccount,
  getMyBankAccount,
} from "../../../services/bankAccountService";
import "./Earnings.css";

const amount = (value, currency = "NGN") =>
  new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const date = (value) => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? "—"
    : new Intl.DateTimeFormat("en", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(parsed);
};

function Earnings() {
  const [bookings, setBookings] = useState([]);
  const [wallet, setWallet] = useState(null);
  const [payouts, setPayouts] = useState([]);
  const [bankAccount, setBankAccount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [withdrawalAmount, setWithdrawalAmount] = useState("");
  const [withdrawing, setWithdrawing] = useState(false);
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [savingBank, setSavingBank] = useState(false);
  const [payoutPreview, setPayoutPreview] = useState(null);
  const [withdrawModalOpen, setWithdrawModalOpen] = useState(false);
  const [bankModalOpen, setBankModalOpen] = useState(false);

  useEffect(() => {
    let active = true;

    Promise.all([
      getMyBookings(),
      getProviderWallet(),
      getProviderPayouts(),
      getMyBankAccount(),
    ])
      .then(([bookingsData, walletData, payoutsData, bankData]) => {
        if (!active) return;

        setBookings(bookingsData?.bookings || []);
        setWallet(walletData?.wallet || null);
        setPayouts(payoutsData?.payouts || []);
        setBankAccount(bankData?.bankAccount || null);
      })
      .catch((err) => {
        if (active) {
          setError(err.response?.data?.message || "Unable to load your earnings.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const confirmed = useMemo(
    () =>
      bookings.filter(
        (booking) =>
          ["paid", "released"].includes(booking.payment_status) &&
          booking.status === "completed" &&
          booking.customer_confirmed_at,
      ),
    [bookings],
  );

  const pending = useMemo(
    () =>
      bookings.filter(
        (booking) =>
          ["accepted", "in_progress"].includes(booking.status) ||
          (booking.status === "completed" && !booking.customer_confirmed_at),
      ),
    [bookings],
  );

  const totalEarned = confirmed.reduce(
    (sum, booking) => sum + Number(booking.agreed_amount || 0),
    0,
  );
  const pendingAmount = pending.reduce(
    (sum, booking) => sum + Number(booking.agreed_amount || 0),
    0,
  );
  const currency = wallet?.currency || bookings[0]?.currency || "NGN";

  const handleWithdrawal = async (event) => {
    event.preventDefault();

    const amountValue = Number(withdrawalAmount);
    if (!Number.isInteger(amountValue) || amountValue <= 0) {
      setError("Enter a valid whole-naira withdrawal amount.");
      return;
    }

    if (!bankAccount?.is_verified || !bankAccount?.is_default) {
      setError("Add and verify a default bank account before withdrawing.");
      return;
    }

    setWithdrawing(true);
    setError("");

    try {
      const data = await requestPayout(amountValue);
      setWallet(data?.wallet || wallet);
      setPayouts((current) => [data.payout, ...current]);
      setWithdrawalAmount("");
      setPayoutPreview(null);
      setWithdrawModalOpen(false);
    } catch (withdrawalError) {
      setError(
        withdrawalError.response?.data?.message || "Unable to submit withdrawal.",
      );
    } finally {
      setWithdrawing(false);
    }
  };

  const previewWithdrawal = async () => {
    const amountValue = Number(withdrawalAmount);
    if (!Number.isInteger(amountValue) || amountValue <= 0) {
      setPayoutPreview(null);
      return;
    }

    try {
      const data = await getPayoutPreview(amountValue);
      setPayoutPreview(data?.payout || null);
    } catch (previewError) {
      setPayoutPreview(null);
      setError(
        previewError.response?.data?.message || "Unable to calculate withdrawal fee.",
      );
    }
  };

  const handleBankAccount = async (event) => {
    event.preventDefault();

    if (!/^\d{10}$/.test(accountNumber) || !bankCode.trim()) {
      setError("Enter a bank code and a valid 10-digit account number.");
      return;
    }

    setSavingBank(true);
    setError("");

    try {
      const data = await addBankAccount({ bankCode, accountNumber });
      setBankAccount(data?.bankAccount || null);
      setBankCode("");
      setAccountNumber("");
      setBankModalOpen(false);
    } catch (bankError) {
      setError(
        bankError.response?.data?.message || "Unable to verify bank account.",
      );
    } finally {
      setSavingBank(false);
    }
  };

  const recentPayouts = useMemo(() => payouts.slice(0, 3), [payouts]);

  const visible = useMemo(() => {
    const query = search.toLowerCase().trim();

    return bookings.filter((booking) => {
      const matchesFilter =
        filter === "all"
          ? true
          : filter === "earned"
            ? booking.status === "completed" && booking.customer_confirmed_at
            : pending.some((entry) => entry.id === booking.id);

      if (!matchesFilter) return false;
      if (!query) return true;

      const haystack = [
        booking.opportunity_title,
        booking.service_title,
        booking.customer_first_name,
        booking.customer_last_name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [bookings, filter, pending, search]);

  return (
    <div className="provider-earnings">
      <header className="provider-earnings__hero">
        <div>
          <span>PROVIDER WORKSPACE</span>
          <h1>Earnings</h1>
          <p>
            Track confirmed income, payouts in progress, and the jobs still waiting on
            client completion.
          </p>
        </div>

        <div className="provider-earnings__balance-card">
          <div className="provider-earnings__balance-head">
            <WalletCards size={18} />
            <span>Available to withdraw</span>
          </div>
          <strong>{amount(wallet?.available_balance, currency)}</strong>
          <div className="provider-earnings__balance-actions">
            <button
              type="button"
              className="provider-earnings__primary-button"
              onClick={() => setWithdrawModalOpen(true)}
            >
              Withdraw
            </button>
            <button
              type="button"
              className="provider-earnings__secondary-button"
              onClick={() => setBankModalOpen(true)}
            >
              {bankAccount?.is_verified ? "Update bank" : "Add bank"}
            </button>
          </div>
        </div>
      </header>

      <section className="provider-earnings__stats">
        <article>
          <span className="is-green">
            <CheckCircle2 size={18} />
          </span>
          <div>
            <small>Confirmed earnings</small>
            <strong>{amount(totalEarned, currency)}</strong>
            <p>
              {confirmed.length} {confirmed.length === 1 ? "completed job" : "completed jobs"}
            </p>
          </div>
        </article>

        <article>
          <span className="is-amber">
            <Clock3 size={18} />
          </span>
          <div>
            <small>In your pipeline</small>
            <strong>{amount(pendingAmount, currency)}</strong>
            <p>{pending.length} jobs awaiting completion</p>
          </div>
        </article>

        <article>
          <span className="is-ink">
            <CalendarDays size={18} />
          </span>
          <div>
            <small>Active jobs</small>
            <strong>{bookings.filter((booking) => booking.status === "in_progress").length}</strong>
            <p>currently in progress</p>
          </div>
        </article>
      </section>

      {error && (
        <div className="provider-earnings__error">
          <AlertCircle size={14} />
          <span>{error}</span>
        </div>
      )}

      <section className="provider-earnings__overview">
        <div className="provider-earnings__panel">
          <div className="provider-earnings__panel-header">
            <div>
              <span>ACCOUNT</span>
              <h2>Bank account</h2>
            </div>
            {bankAccount?.is_verified && (
              <button
                type="button"
                className="provider-earnings__text-button"
                onClick={() => setBankModalOpen(true)}
              >
                Update
              </button>
            )}
          </div>

          {bankAccount?.is_verified ? (
            <div className="provider-earnings__bank-status">
              <div className="provider-earnings__bank-pill">
                <ShieldCheck size={14} />
                Verified
              </div>
              <h3>{bankAccount.bank_name}</h3>
              <p>{bankAccount.account_name}</p>
              <small>•••• {String(bankAccount.account_number || "").slice(-4)}</small>
            </div>
          ) : (
            <div className="provider-earnings__empty-state provider-earnings__empty-state--compact">
              <Building2 size={20} />
              <div>
                <h3>No bank account linked yet</h3>
                <p>Add your verified account so withdrawals can be processed securely.</p>
              </div>
              <button
                type="button"
                className="provider-earnings__primary-button"
                onClick={() => setBankModalOpen(true)}
              >
                Add bank account
              </button>
            </div>
          )}
        </div>

        <div className="provider-earnings__panel">
          <div className="provider-earnings__panel-header">
            <div>
              <span>WITHDRAWAL</span>
              <h2>Quick payout</h2>
            </div>
            <Banknote size={18} />
          </div>

          <div className="provider-earnings__payout-summary">
            <div>
              <small>Available now</small>
              <strong>{amount(wallet?.available_balance, currency)}</strong>
            </div>
            <div>
              <small>Processing fee</small>
              <strong>
                {payoutPreview ? amount(payoutPreview.withdrawalFee, currency) : "—"}
              </strong>
            </div>
          </div>

          <div className="provider-earnings__recent-payouts">
            <small>Recent payouts</small>
            {recentPayouts.length ? (
              recentPayouts.map((payout) => (
                <div key={payout.id || `${payout.amount}-${payout.created_at}`} className="provider-earnings__recent-payout-item">
                  <span>{payout.status || "Pending"}</span>
                  <strong>{amount(payout.amount, currency)}</strong>
                </div>
              ))
            ) : (
              <p>No payouts yet.</p>
            )}
          </div>

          <button
            type="button"
            className="provider-earnings__primary-button provider-earnings__primary-button--full"
            onClick={() => setWithdrawModalOpen(true)}
            disabled={!wallet?.available_balance || !bankAccount?.is_verified}
          >
            {bankAccount?.is_verified ? "Request payout" : "Verify bank account first"}
          </button>
        </div>
      </section>

      <section className="provider-earnings__history">
        <div className="provider-earnings__heading">
          <div>
            <span>TRANSACTIONS</span>
            <h2>Payout history</h2>
          </div>

          <label className="provider-earnings__search">
            <Search size={14} />
            <input
              type="text"
              placeholder="Search jobs or customer"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
        </div>

        <div className="provider-earnings__tabs">
          <button
            type="button"
            className={filter === "all" ? "is-active" : ""}
            onClick={() => setFilter("all")}
          >
            All
          </button>
          <button
            type="button"
            className={filter === "earned" ? "is-active" : ""}
            onClick={() => setFilter("earned")}
          >
            Earned
          </button>
          <button
            type="button"
            className={filter === "pending" ? "is-active" : ""}
            onClick={() => setFilter("pending")}
          >
            Pending
          </button>
        </div>

        {loading ? (
          <div className="provider-earnings__empty-state">
            <div className="provider-earnings__spinner" />
            <p>Loading your earnings...</p>
          </div>
        ) : visible.length ? (
          <div className="provider-earnings__list">
            {visible.map((booking) => {
              const isReleased = booking.payment_status === "released";
              const title =
                booking.service_title || booking.opportunity_title || "Completed service";
              const statusLabel = isReleased ? "Released" : booking.customer_confirmed_at ? "Added" : "Pending";

              return (
                <article key={booking.id} className="provider-earnings__item">
                  <span className={`provider-earnings__icon ${isReleased ? "is-released" : ""}`}>
                    {isReleased ? <CheckCircle2 size={16} /> : <ArrowUpRight size={16} />}
                  </span>

                  <div className="provider-earnings__job">
                    <h3>{title}</h3>
                    <p>
                      {booking.customer_first_name || "Customer"} • {date(booking.completed_at || booking.created_at)}
                    </p>
                    <small>{statusLabel}</small>
                  </div>

                  <div className="provider-earnings__value">
                    <strong>{amount(booking.agreed_amount, currency)}</strong>
                    <span className={isReleased ? "is-released" : ""}>{statusLabel}</span>
                  </div>

                  <ChevronRight size={16} />
                </article>
              );
            })}
          </div>
        ) : (
          <div className="provider-earnings__empty-state">
            <Landmark size={22} />
            <h3>No matching payout history</h3>
            <p>Try a different search or check back after more jobs are completed.</p>
          </div>
        )}
      </section>

      {withdrawModalOpen && (
        <div className="provider-earnings__modal-backdrop" onClick={() => setWithdrawModalOpen(false)}>
          <div
            className="provider-earnings__modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="provider-earnings__modal-header">
              <div>
                <span>WITHDRAW</span>
                <h3>Request payout</h3>
              </div>
              <button type="button" onClick={() => setWithdrawModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleWithdrawal} className="provider-earnings__modal-form">
              <label>
                Amount (NGN)
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={withdrawalAmount}
                  onChange={(event) => {
                    setWithdrawalAmount(event.target.value);
                    setPayoutPreview(null);
                  }}
                  onBlur={previewWithdrawal}
                  placeholder="Enter amount"
                />
              </label>

              <div className="provider-earnings__preview-box">
                <div>
                  <small>Available balance</small>
                  <strong>{amount(wallet?.available_balance, currency)}</strong>
                </div>
                <div>
                  <small>Fee</small>
                  <strong>{payoutPreview ? amount(payoutPreview.withdrawalFee, currency) : "—"}</strong>
                </div>
              </div>

              <div className="provider-earnings__modal-actions">
                <button
                  type="button"
                  className="provider-earnings__secondary-button"
                  onClick={() => setWithdrawModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" disabled={withdrawing || !wallet?.available_balance}>
                  {withdrawing ? "Processing..." : "Confirm withdrawal"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {bankModalOpen && (
        <div className="provider-earnings__modal-backdrop" onClick={() => setBankModalOpen(false)}>
          <div
            className="provider-earnings__modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="provider-earnings__modal-header">
              <div>
                <span>BANK ACCOUNT</span>
                <h3>{bankAccount?.is_verified ? "Update account" : "Add bank account"}</h3>
              </div>
              <button type="button" onClick={() => setBankModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleBankAccount} className="provider-earnings__modal-form">
              <label>
                Bank code
                <input
                  type="text"
                  value={bankCode}
                  onChange={(event) => setBankCode(event.target.value.trim())}
                  placeholder="e.g. 058"
                />
              </label>

              <label>
                Account number
                <input
                  type="text"
                  inputMode="numeric"
                  value={accountNumber}
                  onChange={(event) =>
                    setAccountNumber(event.target.value.replace(/\D/g, "").slice(0, 10))
                  }
                  placeholder="10-digit account number"
                />
              </label>

              <div className="provider-earnings__modal-actions">
                <button
                  type="button"
                  className="provider-earnings__secondary-button"
                  onClick={() => setBankModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" disabled={savingBank}>
                  {savingBank ? "Verifying..." : bankAccount?.is_verified ? "Verify new account" : "Verify account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Earnings;
