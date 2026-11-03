import { useEffect, useMemo, useState } from "react";
import { AlertCircle, ImagePlus, Pencil, Plus, Search, ToggleLeft, Trash2, X } from "lucide-react";
import { getCategories } from "../../../services/categoryService";
import { createService, deleteService, getMyServices, updateService, updateServiceStatus } from "../../../services/serviceService";
import "./Services.css";

const blank = { categoryId: "", title: "", description: "" };

function Services() {
  const [services, setServices] = useState([]); const [categories, setCategories] = useState([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [search, setSearch] = useState(""); const [filter, setFilter] = useState("all"); const [editor, setEditor] = useState(null); const [form, setForm] = useState(blank); const [saving, setSaving] = useState(false); const [working, setWorking] = useState("");
  useEffect(() => { let live = true; Promise.all([getMyServices(), getCategories()]).then(([a, b]) => { if (live) { setServices(a?.services || []); setCategories(b?.categories || []); } }).catch((e) => live && setError(e.response?.data?.message || "Unable to load services.")).finally(() => live && setLoading(false)); return () => { live = false; }; }, []);
  const shown = useMemo(() => {
    const query = search.toLowerCase().trim();
    return services.filter((service) => {
      const statusMatches =
        filter === "all" ||
        (filter === "live" ? service.is_active : !service.is_active);
      const searchMatches =
        !query ||
        [service.title, service.description, service.category_name].some(
          (value) => value?.toLowerCase().includes(query),
        );
      return statusMatches && searchMatches;
    });
  }, [services, search, filter]);
  const openEditor = (service) => { setError(""); setEditor(service || {}); setForm(service ? { categoryId: String(service.category_id), title: service.title, description: service.description } : blank); };
  const save = async (e) => {
    e.preventDefault();
    const payload = {
      categoryId: form.categoryId,
      title: form.title.trim(),
      description: form.description.trim(),
    };
    if (!payload.categoryId || !payload.title || !payload.description) {
      setError("Choose a category and complete the title and description.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const data = editor.id
        ? await updateService(editor.id, payload)
        : await createService(payload);
      const categoryName = categories.find(
        (category) => String(category.id) === String(payload.categoryId),
      )?.name;
      setServices((list) =>
        editor.id
          ? list.map((service) =>
              service.id === editor.id
                ? { ...service, ...data.service, category_name: categoryName }
                : service,
            )
          : [{ ...data.service, category_name: categoryName }, ...list],
      );
      setEditor(null);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to save service.");
    } finally {
      setSaving(false);
    }
  };
  const toggle = async (service) => { setWorking(service.id); try { const data = await updateServiceStatus(service.id, !service.is_active); setServices((list) => list.map((s) => s.id === service.id ? { ...s, ...data.service } : s)); } catch (err) { setError(err.response?.data?.message || "Unable to update service."); } finally { setWorking(""); } };
  const remove = async (service) => { if (!window.confirm(`Delete “${service.title}”?`)) return; setWorking(service.id); try { await deleteService(service.id); setServices((list) => list.filter((s) => s.id !== service.id)); } catch (err) { setError(err.response?.data?.message || "Unable to delete service."); } finally { setWorking(""); } };
  return <div className="provider-services"><header><div><span>PROVIDER WORKSPACE</span><h1>Services</h1><p>Create and manage the services clients can find and book.</p></div><button type="button" className="provider-services__primary" onClick={() => openEditor()}><Plus size={17} />Add service</button></header><div className="provider-services__tools"><div className="provider-services__filters">{[["all", "All"], ["live", "Live"], ["paused", "Paused"]].map(([v, l]) => <button type="button" key={v} className={filter === v ? "active" : ""} onClick={() => setFilter(v)}>{l}</button>)}</div><label><Search size={16} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search services" aria-label="Search services" /></label></div>{error && <p className="provider-services__error" role="alert"><AlertCircle size={16} />{error}</p>}{loading ? <div className="provider-services__empty">Loading services...</div> : shown.length ? <div className="provider-services__grid">{shown.map((s) => <article key={s.id}><div className="provider-services__image">{s.media?.[0]?.url ? <img src={s.media[0].url} alt={s.title} /> : <ImagePlus size={28} />}</div><div className="provider-services__body"><span>{s.category_name || "Service"}</span><h2>{s.title}</h2><p>{s.description}</p><div><button type="button" className={s.is_active ? "provider-services__live" : "provider-services__paused"} disabled={working === s.id} onClick={() => toggle(s)}><ToggleLeft size={16} />{s.is_active ? "Live" : "Paused"}</button><button type="button" aria-label="Edit service" onClick={() => openEditor(s)}><Pencil size={16} /></button><button type="button" aria-label="Delete service" disabled={working === s.id} onClick={() => remove(s)}><Trash2 size={16} /></button></div></div></article>)}</div> : <div className="provider-services__empty"><ImagePlus size={28} /><h2>No services found</h2><p>Add a service to start appearing in the marketplace.</p><button type="button" className="provider-services__primary" onClick={() => openEditor()}><Plus size={17} />Add service</button></div>}{editor && <div className="provider-services__modal"><button type="button" className="provider-services__backdrop" onClick={() => !saving && setEditor(null)} aria-label="Close" /><form onSubmit={save}><button type="button" className="provider-services__close" onClick={() => setEditor(null)} disabled={saving}><X size={18} /></button><span>{editor.id ? "EDIT SERVICE" : "NEW SERVICE"}</span><h2>{editor.id ? "Update service" : "Add a service"}</h2><label>Category<select required value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}><option value="">Select category</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label>Title<input required maxLength="150" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label><label>Description<textarea required rows="5" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label><footer><button type="button" onClick={() => setEditor(null)} disabled={saving}>Cancel</button><button className="provider-services__primary" disabled={saving}>{saving ? "Saving..." : "Save service"}</button></footer></form></div>}</div>;
}
export default Services;
