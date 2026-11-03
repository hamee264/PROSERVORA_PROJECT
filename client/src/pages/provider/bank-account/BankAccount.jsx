import { useEffect, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  BadgeCheck,
  Check,
  CircleCheck,
  Clock3,
  Landmark,
  Pencil,
  Save,
  ShieldCheck,
} from "lucide-react";

import {
  addBankAccount,
  getMyBankAccount,
} from "../../../services/bankAccountService";
import "./BankAccount.css";

function BankAccount() {
  const [bankAccount, setBankAccount] = useState(null);
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let active = true;

    getMyBankAccount()
      .then((data) => {
        if (active) setBankAccount(data?.bankAccount || null);
      })
      .catch((requestError) => {
        if (active) {
          setError(
            requestError.response?.data?.message ||
              "Unable to load your bank account.",
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!bankCode.trim() || !/^\d{10}$/.test(accountNumber)) {
      setError("Enter a bank code and a valid 10-digit account number.");
      return;
    }

    setSaving(true);

    try {
      const data = await addBankAccount({
        bankCode: bankCode.trim(),
        accountNumber,
      });

      setBankAccount(data?.bankAccount || null);
      setBankCode("");
      setAccountNumber("");
      setEditing(false);
      setSuccess("Bank account verified and saved as your default account.");
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Unable to verify this bank account.",
      );
    } finally {
      setSaving(false);
    }
  };

  const startEditing = () => {
    setError("");
    setSuccess("");
    setBankCode("");
    setAccountNumber("");
    setEditing(true);
  };

  return (
    <div className="provider-bank-account">
      <header className="provider-bank-account__header">
        <span>PROVIDER PAYOUTS</span>
        <h1>Bank account</h1>
        <p>
          Add the verified account where your released earnings should be sent.
        </p>
      </header>

      {error && (
        <p className="provider-bank-account__notice is-error" role="alert">
          <AlertCircle size={17} />
          {error}
        </p>
      )}
      {success && (
        <p className="provider-bank-account__notice is-success" role="status">
          <Check size={17} />
          {success}
        </p>
      )}

      {loading ? (
        <div className="provider-bank-account__state">Loading account...</div>
      ) : bankAccount?.is_verified && !editing ? (
        <>
          <section className="provider-bank-account__status">
            <div className="provider-bank-account__status-heading">
              <div className="provider-bank-account__icon">
                <Landmark size={24} />
              </div>
              <div>
                <span className="provider-bank-account__eyebrow">
                  <BadgeCheck size={15} />
                  Verified default account
                </span>
                <h2>{bankAccount.bank_name}</h2>
                <p>{bankAccount.account_name}</p>
                <small>
                  Account ending {bankAccount.account_number.slice(-4)}
                </small>
              </div>
            </div>
            <button
              type="button"
              className="provider-bank-account__edit"
              onClick={startEditing}
            >
              <Pencil size={15} />
              Change account
            </button>
          </section>

          <section className="provider-bank-account__account-meta">
            <div>
              <CircleCheck size={18} />
              <span>
                <strong>Ready for payouts</strong>
                <small>Your released earnings can be sent here.</small>
              </span>
            </div>
            <div>
              <ShieldCheck size={18} />
              <span>
                <strong>Account protected</strong>
                <small>Your full account number is never displayed.</small>
              </span>
            </div>
            <div>
              <Clock3 size={18} />
              <span>
                <strong>Fast processing</strong>
                <small>Payout timing depends on your bank.</small>
              </span>
            </div>
          </section>

          <section className="provider-bank-account__info-grid">
            <div className="provider-bank-account__info-card">
              <span className="provider-bank-account__eyebrow">HOW PAYOUTS WORK</span>
              <h2>Simple, secure withdrawals</h2>
              <p>
                Once a customer confirms completed work, your released earnings
                become available in your wallet. You can then request a payout
                from the Earnings page.
              </p>
              <button type="button" className="provider-bank-account__link" onClick={() => window.location.assign("/provider/earnings")}>
                Go to earnings <ArrowRight size={15} />
              </button>
            </div>
            <div className="provider-bank-account__info-card is-ivory">
              <ShieldCheck size={22} />
              <h2>Your details stay private</h2>
              <p>
                We only use your verified account details to route payouts.
                Never share your banking credentials with anyone.
              </p>
            </div>
          </section>
        </>
      ) : (
        <>
          <section className="provider-bank-account__setup">
            <div className="provider-bank-account__setup-copy">
              <div className="provider-bank-account__setup-icon">
                <Landmark size={23} />
              </div>
              <div>
                <span className="provider-bank-account__eyebrow">
                  {bankAccount ? "CHANGE PAYOUT ACCOUNT" : "SET UP PAYOUTS"}
                </span>
                <h2>
                  {bankAccount
                    ? "Verify your replacement account"
                    : "Add your bank account"}
                </h2>
                <p>
                  Paystack will verify the account name before it can receive
                  withdrawals.
                </p>
              </div>
            </div>
            <form onSubmit={submit}>
              <label>
                Bank code
                <input
                  value={bankCode}
                  onChange={(event) => setBankCode(event.target.value)}
                  placeholder="e.g. 058"
                  inputMode="numeric"
                  required
                />
              </label>
              <label>
                Account number
                <input
                  value={accountNumber}
                  onChange={(event) =>
                    setAccountNumber(
                      event.target.value.replace(/\D/g, "").slice(0, 10),
                    )
                  }
                  placeholder="10-digit account number"
                  inputMode="numeric"
                  required
                />
              </label>
              <div className="provider-bank-account__form-actions">
                <button type="submit" disabled={saving}>
                  <Save size={15} />
                  {saving ? "Verifying..." : "Verify and save account"}
                </button>
                {bankAccount && (
                  <button
                    type="button"
                    className="is-secondary"
                    onClick={() => setEditing(false)}
                    disabled={saving}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </section>
          <section className="provider-bank-account__steps">
            <div className="provider-bank-account__steps-heading">
              <span className="provider-bank-account__eyebrow">WHAT HAPPENS NEXT</span>
              <h2>Complete your payout setup</h2>
            </div>
            <div className="provider-bank-account__step-list">
              <div><strong>01</strong><span><b>Enter your account details</b><small>Use the account you want to receive provider earnings.</small></span></div>
              <div><strong>02</strong><span><b>We verify the account</b><small>The account name is checked before it is saved.</small></span></div>
              <div><strong>03</strong><span><b>Request withdrawals</b><small>Withdraw available earnings from your Earnings page.</small></span></div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

export default BankAccount;
