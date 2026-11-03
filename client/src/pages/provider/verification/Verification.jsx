import { useCallback, useEffect, useState } from "react";
import { AlertCircle, BadgeCheck, Clock3, RefreshCw, ShieldCheck, XCircle } from "lucide-react";
import {
  getMyProviderVerification,
  submitProviderVerification,
} from "../../../services/providerService";
import "./Verification.css";

const stateDetails = {
  verified: ["Verified", "Your provider profile is verified and visible to customers.", BadgeCheck],
  pending: ["Pending review", "Your verification is being reviewed. This page will update automatically.", Clock3],
  rejected: ["Verification needs attention", "Your verification was not approved. Please contact support for the next steps.", XCircle],
};

function Verification() {
  const [provider, setProvider] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    dateOfBirth: "",
    residentialAddress: "",
    idType: "national_id",
    idNumber: "",
    idDocument: null,
  });
  const [submitting, setSubmitting] = useState(false);

  const loadVerification = useCallback(async (background = false) => {
    if (background) setRefreshing(true);
    else setLoading(true);
    try {
      const data = await getMyProviderVerification();
      setProvider(data?.provider || null);
      setError("");
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to load your verification status.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => loadVerification(), 0);
    const interval = window.setInterval(() => loadVerification(true), 15000);
    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(interval);
    };
  }, [loadVerification]);

  const status = provider?.is_verified ? "verified" : provider?.verification_status || "pending";
  const [label, description, StatusIcon] = stateDetails[status] || stateDetails.pending;

  const updateForm = (field, value) =>
    setForm((current) => ({ ...current, [field]: value }));

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const payload = new FormData();
      payload.append("dateOfBirth", form.dateOfBirth);
      payload.append("residentialAddress", form.residentialAddress);
      payload.append("idType", form.idType);
      payload.append("idNumber", form.idNumber);
      if (form.idDocument) payload.append("idDocument", form.idDocument);

      const data = await submitProviderVerification(payload);
      setProvider(data?.provider || provider);
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Unable to submit your verification details.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="provider-verification">
      <header className="provider-verification__header">
        <div><span>PROVIDER ACCOUNT</span><h1>Verification</h1><p>Track the approval status of your provider account.</p></div>
        <button type="button" className="provider-verification__refresh" onClick={() => loadVerification(true)} disabled={refreshing}><RefreshCw size={15} />{refreshing ? "Checking..." : "Check status"}</button>
      </header>
      {error && <p className="provider-verification__notice is-error" role="alert"><AlertCircle size={16} />{error}</p>}
      {loading ? <div className="provider-verification__state">Loading verification status...</div> : <><section className={`provider-verification__card is-${status}`}><div className="provider-verification__icon"><StatusIcon size={28} /></div><div><span className="provider-verification__eyebrow"><ShieldCheck size={15} />Provider verification</span><h2>{label}</h2><p>{description}</p></div></section>{status !== "verified" && <form className="provider-verification__form" onSubmit={submit}><div><span className="provider-verification__eyebrow">PERSONAL INFORMATION</span><h2>Submit your verification details</h2><p>Use your legal details. Upload a clear JPG, PNG, or WEBP image of your identity document.</p></div><div className="provider-verification__fields"><label>Date of birth<input type="date" value={form.dateOfBirth} onChange={(event) => updateForm("dateOfBirth", event.target.value)} required /></label><label>Residential address<textarea value={form.residentialAddress} onChange={(event) => updateForm("residentialAddress", event.target.value)} rows="3" required /></label><label>ID type<select value={form.idType} onChange={(event) => updateForm("idType", event.target.value)}><option value="national_id">National ID</option><option value="passport">Passport</option><option value="drivers_license">Driver&apos;s licence</option><option value="voters_card">Voter&apos;s card</option></select></label><label>ID number<input value={form.idNumber} onChange={(event) => updateForm("idNumber", event.target.value)} required /></label><label className="provider-verification__upload">ID document<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => updateForm("idDocument", event.target.files?.[0] || null)} required={!provider?.verification_submitted_at} /></label></div><button type="submit" disabled={submitting}>{submitting ? "Submitting..." : "Submit for verification"}</button></form>}</>}
    </main>
  );
}

export default Verification;
