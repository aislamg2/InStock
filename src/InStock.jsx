import { useState, useRef, useEffect } from "react";
import QRCode from "qrcode";
import { Html5Qrcode } from "html5-qrcode";

const uid = () => Math.random().toString(36).slice(2, 12);
const ts  = () => new Date().toLocaleString();

const STATUSES = ["Working", "Needs Maintenance", "Under Repair", "Decommissioned"];
const STATUS_CLR = {
  "Working":           "#16a34a",
  "Needs Maintenance": "#d97706",
  "Under Repair":      "#2563eb",
  "Decommissioned":    "#dc2626",
};

const MAINT_TYPES = ["Inspection", "Repair", "Part Replacement", "Preventive", "Other"];

const DEFAULT_CATEGORIES = [];
const DEFAULT_LOCATIONS  = [];

function loadLS(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    if (!v) return fallback;
    const parsed = JSON.parse(v);
    if (Array.isArray(fallback) && !Array.isArray(parsed)) return fallback;
    if (!Array.isArray(fallback) && typeof parsed !== typeof fallback) return fallback;
    return parsed;
  } catch { return fallback; }
}

// ── Real QR Code component ───────────────────────────────────
function RealQRCode({ value, size = 150 }) {
  const canvasRef = useRef(null);
  const [dataUrl, setDataUrl] = useState(null);

  useEffect(() => {
    if (!value) return;
    QRCode.toCanvas(canvasRef.current, value, {
      width: size,
      margin: 2,
      color: { dark: "#1e293b", light: "#ffffff" },
    }).catch(() => {});
    QRCode.toDataURL(value, {
      width: size * 2,
      margin: 2,
      color: { dark: "#1e293b", light: "#ffffff" },
    }).then(setDataUrl).catch(() => {});
  }, [value, size]);

  const handleDownload = () => {
    if (!dataUrl) return;
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `qr-${value}.png`;
    a.click();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      <canvas ref={canvasRef} style={{ borderRadius: 8, border: "1px solid #e2e4eb" }} />
      <div style={{ fontSize: 11.5, color: "#94a3b8", fontWeight: 600 }}>Equipment QR Code</div>
      <button
        onClick={handleDownload}
        style={{
          background: "#f1f5f9", color: "#475569", border: "1px solid #e2e8f0",
          borderRadius: 8, padding: "5px 14px", fontSize: 12, fontWeight: 600,
          cursor: "pointer", fontFamily: "'DM Sans', system-ui, sans-serif",
        }}
      >
        Download QR
      </button>
    </div>
  );
}

// ── QR Scanner component ─────────────────────────────────────
function QRScanner({ onScan, onClose }) {
  const scannerRef = useRef(null);
  const containerRef = useRef(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const scannerId = "qr-scanner-" + uid();
    if (containerRef.current) {
      containerRef.current.id = scannerId;
    }

    const html5Qr = new Html5Qrcode(scannerId);
    scannerRef.current = html5Qr;

    html5Qr.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: { width: 250, height: 250 } },
      (decoded) => {
        html5Qr.stop().catch(() => {});
        onScan(decoded);
      },
      () => {} // ignore scan failures (no QR in frame)
    ).catch((err) => {
      setError("Camera access denied or not available. Please allow camera permissions.");
    });

    return () => {
      if (html5Qr.isScanning) {
        html5Qr.stop().catch(() => {});
      }
    };
  }, []);

  const font = "'DM Sans', system-ui, sans-serif";

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", zIndex: 60,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
    }}>
      <div style={{
        background: "#fff", borderRadius: 16, padding: 24, width: "100%",
        maxWidth: 420, textAlign: "center",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Scan QR Code</h3>
          <button onClick={onClose} style={{
            background: "#f1f5f9", border: "none", borderRadius: 8, padding: "6px 14px",
            fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: font, color: "#475569",
          }}>Close</button>
        </div>
        {error ? (
          <div style={{ color: "#dc2626", fontSize: 14, padding: 20 }}>{error}</div>
        ) : (
          <div style={{ fontSize: 13, color: "#64748b", marginBottom: 12 }}>
            Point your camera at an equipment QR code
          </div>
        )}
        <div ref={containerRef} style={{ borderRadius: 12, overflow: "hidden" }} />
      </div>
    </div>
  );
}

// ── SavedSelector ────────────────────────────────────────────
function SavedSelector({ label, savedLabel, saved, selectedId, onSelect, addingState, setAddingState, newState, setNewState, fields, onSave, onDelete, styles }) {
  const S = styles;
  return (
    <div>
      <div style={S.section}>{label}</div>
      {saved.length === 0 ? (
        <button type="button" style={S.dashed()} onClick={()=>setAddingState(true)}>+ Add {savedLabel}…</button>
      ) : (
        <select style={{...S.input(false),cursor:"pointer"}} value={selectedId} onChange={e=>{
          if(e.target.value==="__add__") setAddingState(true);
          else { onSelect(e.target.value); setAddingState(false); }
        }}>
          <option value="">— None —</option>
          {saved.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
          <option value="__add__">+ Add new {savedLabel}…</option>
        </select>
      )}
      {addingState && (
        <div style={{...S.addBox, marginTop:8}}>
          <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:8}}>
            {fields.map(f=>(
              <div key={f.key} style={f.full ? {gridColumn:"1/-1"} : {}}>
                <label style={{fontSize:12,fontWeight:600,marginBottom:2,display:"block",color:"#64748b"}}>{f.label}{f.required?" *":""}</label>
                <input style={{...S.input(false),fontSize:13}} placeholder={f.placeholder||""} value={newState[f.key]} onChange={e=>setNewState(p=>({...p,[f.key]:e.target.value}))}/>
              </div>
            ))}
          </div>
          <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
            <button style={S.btn("#e2e8f0","#475569")} onClick={()=>{setAddingState(false);setNewState(fields.reduce((a,f)=>({...a,[f.key]:""}),{}));}}>Cancel</button>
            <button style={S.btn()} onClick={onSave}>Save</button>
          </div>
        </div>
      )}
      {saved.length > 0 && (
        <div style={{display:"flex",flexWrap:"wrap",gap:6,marginTop:8}}>
          {saved.map(s=>(
            <span key={s.id} style={{...S.tag, background:selectedId===s.id?"#d1fae5":"#f1f5f9", border:selectedId===s.id?`1px solid ${S.accent}`:"1px solid #e2e8f0"}}>
              {s.name}
              <button style={S.tagX} title={`Remove "${s.name}"`} onClick={()=>onDelete(s.id)}>×</button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// Only allow http/https URLs
function isSafeUrl(val) {
  try { return /^https?:\/\//i.test(new URL(val).href); } catch { return false; }
}

// ── EditableContactCard ──────────────────────────────────────
function EditableContactCard({ title, data, fields, onSave, accent, font }) {
  const [editing, setEditing] = useState(false);
  const [draft,   setDraft]   = useState({});

  if (!data) return null;
  const hasAny = fields.some(f => data[f.key]);

  const startEdit = () => { setDraft({...data}); setEditing(true); };
  const cancelEdit = () => setEditing(false);
  const saveEdit = () => { onSave(draft); setEditing(false); };

  const inputStyle = {
    border:"1.5px solid #d1d5db", borderRadius:8, padding:"7px 10px",
    fontSize:13, outline:"none", width:"100%", fontFamily:font,
    background:"#fff", boxSizing:"border-box",
  };

  return (
    <div style={{background:"#f8fafc",borderRadius:10,padding:"14px 16px",marginBottom:14,border:"1px solid #e2e8f0"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:editing?12:hasAny?10:0}}>
        <div style={{fontSize:12,fontWeight:700,color:accent,textTransform:"uppercase",letterSpacing:.5}}>{title}</div>
        {!editing && (
          <button onClick={startEdit} style={{background:"none",border:"1px solid #e2e8f0",borderRadius:7,padding:"3px 10px",fontSize:12,fontWeight:600,color:"#475569",cursor:"pointer",fontFamily:font}}>
            Edit
          </button>
        )}
      </div>

      {editing ? (
        <>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
            {fields.map(f=>(
              <div key={f.key}>
                <label style={{fontSize:11,fontWeight:700,color:"#94a3b8",textTransform:"uppercase",marginBottom:3,display:"block"}}>{f.label}</label>
                <input style={inputStyle} placeholder={f.placeholder||""} value={draft[f.key]||""} onChange={e=>setDraft(d=>({...d,[f.key]:e.target.value}))}/>
              </div>
            ))}
          </div>
          <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
            <button onClick={cancelEdit} style={{background:"#e2e8f0",color:"#475569",border:"none",borderRadius:8,padding:"7px 16px",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:font}}>Cancel</button>
            <button onClick={saveEdit}   style={{background:accent,color:"#fff",border:"none",borderRadius:8,padding:"7px 16px",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:font}}>Save</button>
          </div>
        </>
      ) : hasAny ? (
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px 24px"}}>
          {fields.map(f => {
            const val = data[f.key];
            if (!val) return null;
            return (
              <div key={f.key}>
                <div style={{fontSize:11,fontWeight:700,color:"#94a3b8",textTransform:"uppercase",marginBottom:2}}>{f.label}</div>
                {f.isLink && isSafeUrl(val)
                  ? <a href={val} target="_blank" rel="noreferrer" style={{fontSize:13,color:accent,fontWeight:500,wordBreak:"break-all"}}>{val}</a>
                  : <div style={{fontWeight:500,fontSize:13,wordBreak:"break-all"}}>{val}</div>
                }
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{fontSize:13,color:"#94a3b8",fontStyle:"italic"}}>No information saved — click Edit to add.</div>
      )}
    </div>
  );
}

// ── Warranty helpers ─────────────────────────────────────────
function getWarrantyStatus(warrantyExpiration) {
  if (!warrantyExpiration) return null;
  const exp = new Date(warrantyExpiration);
  const now = new Date();
  now.setHours(0,0,0,0);
  return exp >= now ? "Active" : "Expired";
}

function WarrantyBadge({ warrantyExpiration }) {
  const status = getWarrantyStatus(warrantyExpiration);
  if (!status) return <span style={{fontSize:12,color:"#94a3b8",fontStyle:"italic"}}>Not set</span>;
  const isActive = status === "Active";
  return (
    <span style={{
      display:"inline-block", padding:"3px 12px", borderRadius:20,
      fontSize:12, fontWeight:600, color:"#fff",
      background: isActive ? "#16a34a" : "#dc2626",
    }}>
      {status}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────
const SEED = [];
const blankContact = { name:"", email:"", phone:"", slack:"" };
const blankMfr     = { name:"", phone:"", email:"", website:"" };
const blankMaintenance = { date:"", type:"Repair", description:"", technician:"", cost:"" };

export default function InStock() {
  const [items,      setItems]      = useState(() => loadLS("instock_items", SEED));
  const [view,       setView]       = useState("list");  // list | detail | scan | logs
  const [toast,      setToast]      = useState(null);
  const [selected,   setSelected]   = useState(null);
  const [search,     setSearch]     = useState("");
  const [scanInput,  setScanInput]  = useState("");
  const scanRef = useRef();

  // ── categories / locations ──
  const [categories,     setCategories]     = useState(() => loadLS("instock_categories", DEFAULT_CATEGORIES));
  const [locations,      setLocations]      = useState(() => loadLS("instock_locations",  DEFAULT_LOCATIONS));
  const [customCategory, setCustomCategory] = useState("");
  const [customLocation, setCustomLocation] = useState("");
  const [addingCategory, setAddingCategory] = useState(false);
  const [addingLocation, setAddingLocation] = useState(false);

  // ── contacts / manufacturers ──
  const [contacts,      setContacts]      = useState(() => loadLS("instock_contacts", []));
  const [addingContact, setAddingContact] = useState(false);
  const [newContact,    setNewContact]    = useState(blankContact);

  const [manufacturers, setManufacturers] = useState(() => loadLS("instock_manufacturers", []));
  const [addingMfr,     setAddingMfr]     = useState(false);
  const [newMfr,        setNewMfr]        = useState(blankMfr);

  // ── status change log ──
  const [statusLogs, setStatusLogs] = useState(() => loadLS("instock_status_logs", []));
  const [logSearch,  setLogSearch]  = useState("");

  // ── maintenance reports ──
  const [maintenanceLogs, setMaintenanceLogs] = useState(() => loadLS("instock_maintenance_logs", []));
  const [showMaintForm,   setShowMaintForm]   = useState(false);
  const [maintForm,       setMaintForm]       = useState(blankMaintenance);

  // ── QR scanner state ──
  const [showScanner, setShowScanner] = useState(false);

  // ── register choice + CSV import state ──
  const [showRegisterChoice, setShowRegisterChoice] = useState(false);
  const [showCsvImport,      setShowCsvImport]      = useState(false);
  const [csvData,             setCsvData]            = useState(null);   // parsed rows
  const [csvErrors,           setCsvErrors]          = useState([]);
  const [csvFileName,         setCsvFileName]        = useState("");
  const csvFileRef = useRef();

  const makeBlank = () => ({
    name:"", serial:"",
    category:  categories[0]       ?? "",
    location:  locations[0]        ?? "",
    contactId: contacts[0]?.id     ?? "",
    mfrId:     manufacturers[0]?.id ?? "",
    status:    "Working",
    notes:"",
    warrantyExpiration: "",
  });

  const [form,       setForm]       = useState(makeBlank());
  const [formErrors, setFormErrors] = useState({});
  const [showForm,   setShowForm]   = useState(false);

  // ── persist to localStorage ──
  useEffect(() => { localStorage.setItem("instock_items",            JSON.stringify(items));            }, [items]);
  useEffect(() => { localStorage.setItem("instock_categories",       JSON.stringify(categories));       }, [categories]);
  useEffect(() => { localStorage.setItem("instock_locations",        JSON.stringify(locations));        }, [locations]);
  useEffect(() => { localStorage.setItem("instock_contacts",         JSON.stringify(contacts));         }, [contacts]);
  useEffect(() => { localStorage.setItem("instock_manufacturers",    JSON.stringify(manufacturers));    }, [manufacturers]);
  useEffect(() => { localStorage.setItem("instock_status_logs",      JSON.stringify(statusLogs));       }, [statusLogs]);
  useEffect(() => { localStorage.setItem("instock_maintenance_logs", JSON.stringify(maintenanceLogs)); }, [maintenanceLogs]);

  const flash = (m) => { setToast(m); setTimeout(()=>setToast(null),2800); };
  useEffect(()=>{ if(view==="scan" && scanRef.current) scanRef.current.focus(); },[view]);

  // ── helpers: category / location ──
  const handleAddCategory = () => {
    const val = customCategory.trim();
    if (!val || categories.includes(val)) { setAddingCategory(false); setCustomCategory(""); return; }
    setCategories(prev => [...prev, val]);
    setForm(f => ({...f, category: val}));
    setCustomCategory(""); setAddingCategory(false);
  };
  const handleDeleteCategory = (cat) => {
    setCategories(prev => { const next = prev.filter(c=>c!==cat); if(form.category===cat) setForm(f=>({...f,category:next[0]||""})); return next; });
  };
  const handleAddLocation = () => {
    const val = customLocation.trim();
    if (!val || locations.includes(val)) { setAddingLocation(false); setCustomLocation(""); return; }
    setLocations(prev => [...prev, val]);
    setForm(f => ({...f, location: val}));
    setCustomLocation(""); setAddingLocation(false);
  };
  const handleDeleteLocation = (loc) => {
    setLocations(prev => { const next = prev.filter(l=>l!==loc); if(form.location===loc) setForm(f=>({...f,location:next[0]||""})); return next; });
  };

  // ── helpers: contact / manufacturer ──
  const handleSaveContact = () => {
    if (!newContact.name.trim()) return;
    const entry = { ...newContact, id: uid() };
    setContacts(prev => [...prev, entry]);
    setForm(f => ({...f, contactId: entry.id}));
    setNewContact(blankContact); setAddingContact(false);
  };
  const handleDeleteContact = (id) => {
    setContacts(prev => prev.filter(c=>c.id!==id));
    if (form.contactId === id) setForm(f => ({...f, contactId: ""}));
  };
  const handleSaveMfr = () => {
    if (!newMfr.name.trim()) return;
    const entry = { ...newMfr, id: uid() };
    setManufacturers(prev => [...prev, entry]);
    setForm(f => ({...f, mfrId: entry.id}));
    setNewMfr(blankMfr); setAddingMfr(false);
  };
  const handleDeleteMfr = (id) => {
    setManufacturers(prev => prev.filter(m=>m.id!==id));
    if (form.mfrId === id) setForm(f => ({...f, mfrId: ""}));
  };

  // ── status change (with log entry) ──
  const changeStatus = (item, newStatus) => {
    if (item.status === newStatus) return;
    const logEntry = {
      id:          uid(),
      itemId:      item.id,
      itemName:    item.name,
      itemSerial:  item.serial,
      from:        item.status,
      to:          newStatus,
      changedAt:   ts(),
    };
    setStatusLogs(prev => [logEntry, ...prev]);
    setItems(prev => prev.map(i => i.id === item.id ? {...i, status: newStatus} : i));
    if (selected?.id === item.id) setSelected(s => ({...s, status: newStatus}));
    flash(`Status updated to "${newStatus}"`);
  };

  // ── maintenance report helpers ──
  const handleAddMaintenance = (itemId) => {
    if (!maintForm.date || !maintForm.description.trim()) {
      flash("Date and description are required");
      return;
    }
    const entry = {
      id: uid(),
      itemId,
      date: maintForm.date,
      type: maintForm.type,
      description: maintForm.description.trim(),
      technician: maintForm.technician.trim(),
      cost: maintForm.cost ? parseFloat(maintForm.cost) : null,
      createdAt: ts(),
    };
    setMaintenanceLogs(prev => [entry, ...prev]);
    setMaintForm(blankMaintenance);
    setShowMaintForm(false);
    flash("Maintenance report added");
  };

  const handleDeleteMaintenance = (id) => {
    setMaintenanceLogs(prev => prev.filter(m => m.id !== id));
    flash("Maintenance report removed");
  };

  // ── scan / register / delete ──
  const handleScan = () => {
    const s = scanInput.trim();
    if (!s) return;
    const found = items.find(i => i.serial.toLowerCase() === s.toLowerCase());
    if (found) { setSelected(found); setView("detail"); setScanInput(""); flash("Equipment found!"); }
    else { setForm({...makeBlank(), serial:s}); setShowForm(true); setView("list"); setScanInput(""); flash("Serial not found — register it below"); }
  };

  const handleQRScan = (decoded) => {
    setShowScanner(false);
    const serial = decoded.trim();
    if (!serial) return;
    const found = items.find(i => i.serial.toLowerCase() === serial.toLowerCase());
    if (found) { setSelected(found); setView("detail"); flash("Equipment found via QR!"); }
    else { setForm({...makeBlank(), serial}); setShowForm(true); setView("list"); flash("Serial not found — register it below"); }
  };

  const handleRegister = () => {
    const errs = {};
    if (!form.name.trim())   errs.name   = "Required";
    if (!form.serial.trim()) errs.serial = "Required";
    else if (items.some(i => i.serial.toLowerCase() === form.serial.trim().toLowerCase())) errs.serial = "Serial already registered";
    setFormErrors(errs);
    if (Object.keys(errs).length) return;
    const newItem = {
      ...form,
      name: form.name.trim(),
      serial: form.serial.trim(),
      notes: form.notes.trim(),
      warrantyExpiration: form.warrantyExpiration || "",
      id: uid(),
      registeredAt: ts(),
    };
    setItems(prev => [newItem, ...prev]);
    // log initial status
    setStatusLogs(prev => [{
      id: uid(), itemId: newItem.id, itemName: newItem.name, itemSerial: newItem.serial,
      from: "—", to: newItem.status, changedAt: newItem.registeredAt,
    }, ...prev]);
    setForm(makeBlank()); setFormErrors({}); setShowForm(false);
    flash("Equipment registered successfully!");
  };

  const handleDelete = (id) => {
    setItems(prev => prev.filter(i => i.id !== id));
    if (selected?.id === id) { setSelected(null); setView("list"); }
    flash("Equipment removed");
  };

  // ── warranty update on existing item ──
  const updateWarranty = (itemId, date) => {
    setItems(prev => prev.map(i => i.id === itemId ? {...i, warrantyExpiration: date} : i));
    if (selected?.id === itemId) setSelected(s => ({...s, warrantyExpiration: date}));
    flash("Warranty date updated");
  };

  // ── CSV helpers ──────────────────────────────────────────────
  const CSV_HEADERS = [
    "Name","Serial","Category","Location","Status","WarrantyExpiration",
    "ContactName","ContactEmail","ContactPhone","ContactSlack",
    "ManufacturerName","ManufacturerPhone","ManufacturerEmail","ManufacturerWebsite",
    "Notes"
  ];

  function parseCSV(text) {
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) return { rows: [], errors: ["CSV must have a header row and at least one data row."] };

    // parse a CSV line respecting quoted fields
    function splitCSVLine(line) {
      const result = [];
      let current = "";
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
          else inQuotes = !inQuotes;
        } else if (ch === ',' && !inQuotes) {
          result.push(current.trim());
          current = "";
        } else {
          current += ch;
        }
      }
      result.push(current.trim());
      return result;
    }

    const headers = splitCSVLine(lines[0]).map(h => h.replace(/^"|"$/g, '').trim());

    // Map user headers to our expected headers (case-insensitive, flexible)
    const headerMap = {};
    const normalize = (s) => s.toLowerCase().replace(/[^a-z]/g, '');
    const expectedNorm = CSV_HEADERS.map(h => normalize(h));
    headers.forEach((h, i) => {
      const n = normalize(h);
      const match = expectedNorm.findIndex(e => e === n);
      if (match !== -1) headerMap[CSV_HEADERS[match]] = i;
    });

    const missing = ["Name","Serial"].filter(h => headerMap[h] === undefined);
    if (missing.length) return { rows: [], errors: [`Missing required columns: ${missing.join(", ")}`] };

    const rows = [];
    const errors = [];

    for (let i = 1; i < lines.length; i++) {
      const vals = splitCSVLine(lines[i]);
      const get = (key) => (headerMap[key] !== undefined ? (vals[headerMap[key]] || "").replace(/^"|"$/g, '') : "").trim();

      const name   = get("Name");
      const serial = get("Serial");

      if (!name && !serial) continue; // skip blank rows

      if (!name)   { errors.push(`Row ${i + 1}: Missing equipment name`); continue; }
      if (!serial) { errors.push(`Row ${i + 1}: Missing serial number`); continue; }

      const status = get("Status");
      const validStatus = STATUSES.find(s => s.toLowerCase() === status.toLowerCase());

      rows.push({
        name, serial,
        category:           get("Category"),
        location:           get("Location"),
        status:             validStatus || "Working",
        warrantyExpiration: get("WarrantyExpiration"),
        contactName:        get("ContactName"),
        contactEmail:       get("ContactEmail"),
        contactPhone:       get("ContactPhone"),
        contactSlack:       get("ContactSlack"),
        mfrName:            get("ManufacturerName"),
        mfrPhone:           get("ManufacturerPhone"),
        mfrEmail:           get("ManufacturerEmail"),
        mfrWebsite:         get("ManufacturerWebsite"),
        notes:              get("Notes"),
      });
    }

    return { rows, errors };
  }

  const handleCsvFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const { rows, errors } = parseCSV(ev.target.result);

      // check for duplicate serials within the CSV itself
      const seen = new Set();
      const deduped = [];
      for (const row of rows) {
        const key = row.serial.toLowerCase();
        if (seen.has(key)) { errors.push(`Duplicate serial in CSV: "${row.serial}"`); continue; }
        seen.add(key);
        // also check against existing inventory
        if (items.some(i => i.serial.toLowerCase() === key)) {
          errors.push(`Serial "${row.serial}" already registered — skipped`);
          continue;
        }
        deduped.push(row);
      }

      setCsvData(deduped);
      setCsvErrors(errors);
    };
    reader.readAsText(file);
    // reset input so re-selecting same file works
    e.target.value = "";
  };

  const handleCsvImport = () => {
    if (!csvData || csvData.length === 0) return;

    let newCategories = [...categories];
    let newLocations  = [...locations];
    let newContacts   = [...contacts];
    let newMfrs       = [...manufacturers];
    const newItems    = [];
    const newLogs     = [];

    for (const row of csvData) {
      // ensure category exists
      if (row.category && !newCategories.includes(row.category)) {
        newCategories.push(row.category);
      }
      // ensure location exists
      if (row.location && !newLocations.includes(row.location)) {
        newLocations.push(row.location);
      }

      // find or create contact
      let contactId = "";
      if (row.contactName) {
        let existing = newContacts.find(c => c.name.toLowerCase() === row.contactName.toLowerCase());
        if (!existing) {
          existing = { id: uid(), name: row.contactName, email: row.contactEmail, phone: row.contactPhone, slack: row.contactSlack };
          newContacts.push(existing);
        }
        contactId = existing.id;
      }

      // find or create manufacturer
      let mfrId = "";
      if (row.mfrName) {
        let existing = newMfrs.find(m => m.name.toLowerCase() === row.mfrName.toLowerCase());
        if (!existing) {
          existing = { id: uid(), name: row.mfrName, phone: row.mfrPhone, email: row.mfrEmail, website: row.mfrWebsite };
          newMfrs.push(existing);
        }
        mfrId = existing.id;
      }

      const itemId = uid();
      const now = ts();
      newItems.push({
        id: itemId,
        name:               row.name,
        serial:             row.serial,
        category:           row.category || "",
        location:           row.location || "",
        status:             row.status,
        warrantyExpiration: row.warrantyExpiration || "",
        contactId,
        mfrId,
        notes:              row.notes || "",
        registeredAt:       now,
      });

      newLogs.push({
        id: uid(), itemId, itemName: row.name, itemSerial: row.serial,
        from: "—", to: row.status, changedAt: now,
      });
    }

    // batch update all state
    setCategories(newCategories);
    setLocations(newLocations);
    setContacts(newContacts);
    setManufacturers(newMfrs);
    setItems(prev => [...newItems, ...prev]);
    setStatusLogs(prev => [...newLogs, ...prev]);

    flash(`Imported ${newItems.length} item${newItems.length !== 1 ? "s" : ""} successfully!`);
    setShowCsvImport(false);
    setCsvData(null);
    setCsvErrors([]);
    setCsvFileName("");
  };

  const handleExportCsv = () => {
    const escapeField = (val) => {
      const s = String(val || "");
      if (s.includes(",") || s.includes('"') || s.includes("\n")) {
        return '"' + s.replace(/"/g, '""') + '"';
      }
      return s;
    };

    const header = CSV_HEADERS.join(",");
    const rows = items.map(item => {
      const contact = contactFor(item.contactId);
      const mfr     = mfrFor(item.mfrId);
      return [
        item.name, item.serial, item.category, item.location, item.status,
        item.warrantyExpiration || "",
        contact?.name || "", contact?.email || "", contact?.phone || "", contact?.slack || "",
        mfr?.name || "", mfr?.phone || "", mfr?.email || "", mfr?.website || "",
        item.notes || "",
      ].map(escapeField).join(",");
    });

    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `instock-inventory-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    flash("CSV exported!");
  };

  const handleDownloadTemplate = () => {
    const csv = CSV_HEADERS.join(",") + "\n" +
      'HP LaserJet Pro,HP-LJ-90214,Printer,Room 101,Working,2027-06-15,Jane Smith,jane@example.com,+1 555 000 0000,@jane.smith,HP,+1 800 474 6836,support@hp.com,https://hp.com,Floor 2 printer room';
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "instock-import-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const filtered = items.filter(i =>
    `${i.name} ${i.serial} ${i.location} ${i.category}`.toLowerCase().includes(search.toLowerCase())
  );

  const filteredLogs = statusLogs.filter(l =>
    `${l.itemName} ${l.itemSerial} ${l.from} ${l.to}`.toLowerCase().includes(logSearch.toLowerCase())
  );

  const font   = "'DM Sans', 'Segoe UI', system-ui, sans-serif";
  const accent = "#0f766e";
  const S = {
    wrap:    { fontFamily:font, background:"#f0fdf4", minHeight:"100vh", color:"#1e293b" },
    header:  { background:"#fff", borderBottom:"1px solid #e2e8f0", padding:"0 28px", display:"flex", alignItems:"center", justifyContent:"space-between", height:60, position:"sticky", top:0, zIndex:20 },
    logo:    { fontWeight:800, fontSize:21, color:accent, letterSpacing:"-0.5px", display:"flex", alignItems:"center", gap:8 },
    body:    { maxWidth:960, margin:"0 auto", padding:"24px 20px 60px" },
    pill:    (a) => ({ padding:"7px 16px", borderRadius:22, border:`1.5px solid ${a?accent:"#cbd5e1"}`, background:a?accent:"#fff", color:a?"#fff":"#475569", fontWeight:600, fontSize:13, cursor:"pointer", fontFamily:font }),
    input:   (err) => ({ border:`1.5px solid ${err?"#ef4444":"#d1d5db"}`, borderRadius:10, padding:"10px 14px", fontSize:14, outline:"none", width:"100%", fontFamily:font, background:"#fff", boxSizing:"border-box" }),
    btn:     (bg=accent,c="#fff") => ({ background:bg, color:c, border:"none", borderRadius:10, padding:"10px 20px", fontSize:14, fontWeight:600, cursor:"pointer", fontFamily:font }),
    card:    { background:"#fff", borderRadius:14, border:"1px solid #e2e8f0", overflow:"hidden" },
    badge:   (color) => ({ display:"inline-block", padding:"3px 12px", borderRadius:20, fontSize:12, fontWeight:600, color:"#fff", background:color }),
    overlay: { position:"fixed", inset:0, background:"rgba(0,0,0,.3)", zIndex:50, display:"flex", alignItems:"center", justifyContent:"center", padding:16 },
    modal:   { background:"#fff", borderRadius:16, padding:28, width:"100%", maxWidth:520, maxHeight:"90vh", overflowY:"auto" },
    toast:   { position:"fixed", bottom:24, left:"50%", transform:"translateX(-50%)", background:"#1e293b", color:"#fff", padding:"12px 24px", borderRadius:12, fontSize:14, fontWeight:600, zIndex:100, boxShadow:"0 8px 30px rgba(0,0,0,.18)" },
    th:      { padding:"10px 14px", textAlign:"left", fontSize:11.5, fontWeight:700, color:"#64748b", textTransform:"uppercase", letterSpacing:".5px", borderBottom:"1px solid #e2e8f0" },
    td:      { padding:"12px 14px", fontSize:14, borderBottom:"1px solid #f1f5f9" },
    tag:     { display:"inline-flex", alignItems:"center", gap:4, padding:"3px 8px 3px 10px", borderRadius:20, fontSize:12, fontWeight:600, background:"#f1f5f9", color:"#475569", border:"1px solid #e2e8f0" },
    tagX:    { background:"none", border:"none", cursor:"pointer", color:"#94a3b8", fontSize:13, lineHeight:1, padding:"0 2px", fontFamily:font, display:"flex", alignItems:"center" },
    section: { fontSize:12, fontWeight:700, color:accent, textTransform:"uppercase", letterSpacing:.5, margin:"18px 0 8px" },
    addBox:  { background:"#f8fafc", borderRadius:10, padding:"14px 16px", border:"1px solid #e2e8f0", display:"flex", flexDirection:"column", gap:10 },
    dashed:  (bg="#f1f5f9",c="#475569") => ({ background:bg, color:c, border:"1.5px dashed #cbd5e1", borderRadius:10, padding:"10px 14px", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:font, width:"100%", textAlign:"left" }),
    accent,
  };

  const contactFor = (id) => contacts.find(c=>c.id===id) || null;
  const mfrFor     = (id) => manufacturers.find(m=>m.id===id) || null;
  const maintFor   = (itemId) => maintenanceLogs.filter(m => m.itemId === itemId);
  const totalMaintCost = (itemId) => {
    const logs = maintFor(itemId);
    return logs.reduce((sum, l) => sum + (l.cost || 0), 0);
  };

  return (
    <div style={S.wrap}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>

      {/* ── HEADER ── */}
      <div style={S.header}>
        <div style={S.logo}><span style={{fontSize:24}}>📦</span> InStock</div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <button style={S.pill(view==="list"||view==="detail")} onClick={()=>{setView("list");setSelected(null)}}>Inventory</button>
          <button style={S.pill(view==="scan")} onClick={()=>setView("scan")}>Scan Serial</button>
          <button style={S.pill(view==="logs")} onClick={()=>setView("logs")}>
            Logs {statusLogs.length > 0 && <span style={{marginLeft:4,background:"#e2e8f0",borderRadius:10,padding:"1px 7px",fontSize:11,fontWeight:700,color:"#475569"}}>{statusLogs.length}</span>}
          </button>
          <button style={S.btn()} onClick={()=>setShowRegisterChoice(true)}>+ Register</button>
        </div>
      </div>

      <div style={S.body}>

        {/* ── SCAN ── */}
        {view === "scan" && (
          <div style={{...S.card, padding:40, textAlign:"center"}}>
            <div style={{fontSize:48,marginBottom:10}}>📷</div>
            <h2 style={{margin:"0 0 6px",fontSize:21,fontWeight:700}}>Scan or Enter Serial Number</h2>
            <p style={{color:"#64748b",fontSize:14,margin:"0 0 22px"}}>If found you'll see its details. If not, you can register it.</p>
            <div style={{display:"flex",gap:10,maxWidth:400,margin:"0 auto"}}>
              <input ref={scanRef} value={scanInput} onChange={e=>setScanInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleScan()} placeholder="e.g. HP-LJ-90214" style={{...S.input(false),fontSize:15,textAlign:"center",letterSpacing:.8}}/>
              <button style={S.btn()} onClick={handleScan}>Look Up</button>
            </div>
            <div style={{margin:"24px auto 0", maxWidth:400}}>
              <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}>
                <div style={{flex:1,height:1,background:"#e2e8f0"}}/>
                <span style={{fontSize:12,color:"#94a3b8",fontWeight:600}}>OR</span>
                <div style={{flex:1,height:1,background:"#e2e8f0"}}/>
              </div>
              <button
                onClick={() => setShowScanner(true)}
                style={{
                  ...S.btn(accent),
                  width:"100%",
                  display:"flex", alignItems:"center", justifyContent:"center", gap:8,
                  padding:"14px 20px", fontSize:15,
                }}
              >
                <span style={{fontSize:20}}>📸</span> Scan QR Code with Camera
              </button>
            </div>
          </div>
        )}

        {/* ── DETAIL ── */}
        {view === "detail" && selected && (() => {
          const contact = contactFor(selected.contactId);
          const mfr     = mfrFor(selected.mfrId);
          const itemLogs = statusLogs.filter(l => l.itemId === selected.id);
          const itemMaint = maintFor(selected.id);
          const maintCost = totalMaintCost(selected.id);
          const warrantyStatus = getWarrantyStatus(selected.warrantyExpiration);

          return (
            <div>
              <button onClick={()=>{setView("list");setSelected(null)}} style={{background:"none",border:"none",color:accent,fontWeight:600,cursor:"pointer",fontSize:14,marginBottom:14,fontFamily:font,padding:0}}>← Back to Inventory</button>
              <div style={{...S.card, padding:28}}>
                <div style={{display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:20}}>
                  <div style={{flex:1,minWidth:240}}>
                    <h2 style={{margin:"0 0 2px",fontSize:22,fontWeight:700}}>{selected.name}</h2>
                    <div style={{color:"#64748b",fontSize:14,marginBottom:18}}>Serial: <span style={{fontFamily:"monospace",fontWeight:600,color:"#1e293b"}}>{selected.serial}</span></div>

                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px 24px",marginBottom:18}}>
                      {[["Category",selected.category],["Location",selected.location]].map(([l,v])=>(
                        <div key={l}><div style={{fontSize:11,fontWeight:700,color:"#94a3b8",textTransform:"uppercase",marginBottom:2}}>{l}</div><div style={{fontWeight:600}}>{v}</div></div>
                      ))}
                      <div>
                        <div style={{fontSize:11,fontWeight:700,color:"#94a3b8",textTransform:"uppercase",marginBottom:6}}>Status</div>
                        <select
                          value={selected.status}
                          onChange={e=>changeStatus(selected, e.target.value)}
                          style={{border:`2px solid ${STATUS_CLR[selected.status]}`, borderRadius:8, padding:"5px 10px", fontSize:13, fontWeight:700, color:STATUS_CLR[selected.status], background:"#fff", cursor:"pointer", fontFamily:font, outline:"none"}}
                        >
                          {STATUSES.map(s=><option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                      <div><div style={{fontSize:11,fontWeight:700,color:"#94a3b8",textTransform:"uppercase",marginBottom:2}}>Registered</div><div style={{fontWeight:500,fontSize:13}}>{selected.registeredAt}</div></div>
                    </div>

                    {/* ── Warranty Section ── */}
                    <div style={{background:"#f8fafc",borderRadius:10,padding:"14px 16px",marginBottom:14,border:"1px solid #e2e8f0"}}>
                      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
                        <div style={{fontSize:12,fontWeight:700,color:accent,textTransform:"uppercase",letterSpacing:.5}}>Warranty</div>
                        <WarrantyBadge warrantyExpiration={selected.warrantyExpiration} />
                      </div>
                      <div style={{display:"flex",alignItems:"center",gap:12}}>
                        <div style={{flex:1}}>
                          <label style={{fontSize:11,fontWeight:700,color:"#94a3b8",textTransform:"uppercase",marginBottom:4,display:"block"}}>Expiration Date</label>
                          <input
                            type="date"
                            value={selected.warrantyExpiration || ""}
                            onChange={e => updateWarranty(selected.id, e.target.value)}
                            style={{...S.input(false), fontSize:13, padding:"7px 10px"}}
                          />
                        </div>
                        {selected.warrantyExpiration && (
                          <div style={{textAlign:"right",minWidth:100}}>
                            <div style={{fontSize:11,fontWeight:700,color:"#94a3b8",textTransform:"uppercase",marginBottom:4}}>Days Left</div>
                            <div style={{fontSize:18,fontWeight:700,color: warrantyStatus === "Active" ? "#16a34a" : "#dc2626"}}>
                              {(() => {
                                const days = Math.ceil((new Date(selected.warrantyExpiration) - new Date()) / (1000*60*60*24));
                                return days >= 0 ? days : "Expired";
                              })()}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {selected.notes && <div style={{background:"#f8fafc",borderRadius:10,padding:"10px 14px",fontSize:13.5,color:"#475569",marginBottom:14}}><strong>Notes:</strong> {selected.notes}</div>}

                    <EditableContactCard
                      title="Contact Person" data={contact} accent={accent} font={font}
                      fields={[
                        {key:"name",  label:"Name",  placeholder:"Jane Smith"},
                        {key:"email", label:"Email", placeholder:"jane@example.com"},
                        {key:"phone", label:"Phone", placeholder:"+1 555 000 0000"},
                        {key:"slack", label:"Slack", placeholder:"@jane.smith"},
                      ]}
                      onSave={updated => setContacts(prev => prev.map(c => c.id===updated.id ? updated : c))}
                    />
                    <EditableContactCard
                      title="Manufacturer" data={mfr} accent={accent} font={font}
                      fields={[
                        {key:"name",    label:"Company Name", placeholder:"Acme Corp"},
                        {key:"phone",   label:"Phone",        placeholder:"+1 800 000 0000"},
                        {key:"email",   label:"Email",        placeholder:"support@acme.com"},
                        {key:"website", label:"Website",      placeholder:"https://acme.com", isLink:true},
                      ]}
                      onSave={updated => setManufacturers(prev => prev.map(m => m.id===updated.id ? updated : m))}
                    />

                    {/* ── Maintenance Reports ── */}
                    <div style={{marginBottom:18}}>
                      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
                        <div style={{fontSize:12,fontWeight:700,color:accent,textTransform:"uppercase",letterSpacing:.5}}>
                          Maintenance Reports ({itemMaint.length})
                        </div>
                        <button
                          onClick={() => { setShowMaintForm(!showMaintForm); setMaintForm(blankMaintenance); }}
                          style={{background:"none",border:"1px solid #e2e8f0",borderRadius:7,padding:"3px 10px",fontSize:12,fontWeight:600,color:"#475569",cursor:"pointer",fontFamily:font}}
                        >
                          {showMaintForm ? "Cancel" : "+ Add Report"}
                        </button>
                      </div>

                      {/* Maintenance cost summary */}
                      {itemMaint.length > 0 && maintCost > 0 && (
                        <div style={{background:"#fef3c7",borderRadius:8,padding:"8px 12px",marginBottom:10,fontSize:13,fontWeight:600,color:"#92400e",border:"1px solid #fde68a"}}>
                          Total Maintenance Cost: ${maintCost.toFixed(2)} across {itemMaint.length} report{itemMaint.length !== 1 ? "s" : ""}
                        </div>
                      )}

                      {/* Repair vs Replace indicator */}
                      {warrantyStatus === "Expired" && itemMaint.length >= 3 && (
                        <div style={{background:"#fef2f2",borderRadius:8,padding:"10px 14px",marginBottom:10,border:"1px solid #fecaca"}}>
                          <div style={{fontSize:13,fontWeight:700,color:"#dc2626",marginBottom:2}}>Consider Replacement</div>
                          <div style={{fontSize:12,color:"#991b1b"}}>
                            Warranty expired + {itemMaint.length} maintenance events logged. This device may be more cost-effective to replace.
                          </div>
                        </div>
                      )}

                      {/* Add maintenance form */}
                      {showMaintForm && (
                        <div style={{...S.addBox, marginBottom:12}}>
                          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                            <div>
                              <label style={{fontSize:12,fontWeight:600,marginBottom:2,display:"block",color:"#64748b"}}>Date *</label>
                              <input type="date" style={{...S.input(false),fontSize:13}} value={maintForm.date} onChange={e=>setMaintForm(f=>({...f,date:e.target.value}))}/>
                            </div>
                            <div>
                              <label style={{fontSize:12,fontWeight:600,marginBottom:2,display:"block",color:"#64748b"}}>Type</label>
                              <select style={{...S.input(false),fontSize:13,cursor:"pointer"}} value={maintForm.type} onChange={e=>setMaintForm(f=>({...f,type:e.target.value}))}>
                                {MAINT_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
                              </select>
                            </div>
                            <div style={{gridColumn:"1/-1"}}>
                              <label style={{fontSize:12,fontWeight:600,marginBottom:2,display:"block",color:"#64748b"}}>Description *</label>
                              <textarea style={{...S.input(false),fontSize:13,minHeight:50,resize:"vertical"}} placeholder="What was done…" value={maintForm.description} onChange={e=>setMaintForm(f=>({...f,description:e.target.value}))}/>
                            </div>
                            <div>
                              <label style={{fontSize:12,fontWeight:600,marginBottom:2,display:"block",color:"#64748b"}}>Technician</label>
                              <input style={{...S.input(false),fontSize:13}} placeholder="Name" value={maintForm.technician} onChange={e=>setMaintForm(f=>({...f,technician:e.target.value}))}/>
                            </div>
                            <div>
                              <label style={{fontSize:12,fontWeight:600,marginBottom:2,display:"block",color:"#64748b"}}>Cost ($)</label>
                              <input type="number" step="0.01" min="0" style={{...S.input(false),fontSize:13}} placeholder="0.00" value={maintForm.cost} onChange={e=>setMaintForm(f=>({...f,cost:e.target.value}))}/>
                            </div>
                          </div>
                          <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
                            <button style={S.btn("#e2e8f0","#475569")} onClick={()=>{setShowMaintForm(false);setMaintForm(blankMaintenance);}}>Cancel</button>
                            <button style={S.btn()} onClick={()=>handleAddMaintenance(selected.id)}>Save Report</button>
                          </div>
                        </div>
                      )}

                      {/* Maintenance history */}
                      {itemMaint.length === 0 && !showMaintForm && (
                        <div style={{fontSize:13,color:"#94a3b8",fontStyle:"italic",background:"#f8fafc",borderRadius:8,padding:"12px 14px",border:"1px solid #e2e8f0"}}>
                          No maintenance reports yet. Click "+ Add Report" to log one.
                        </div>
                      )}
                      {itemMaint.length > 0 && (
                        <div style={{display:"flex",flexDirection:"column",gap:6}}>
                          {itemMaint.map(m => (
                            <div key={m.id} style={{background:"#f8fafc",borderRadius:8,padding:"10px 14px",border:"1px solid #e2e8f0"}}>
                              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
                                <div style={{flex:1}}>
                                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                                    <span style={{...S.badge("#6366f1"),fontSize:11}}>{m.type}</span>
                                    <span style={{fontSize:12,color:"#64748b",fontWeight:500}}>{m.date}</span>
                                    {m.cost > 0 && <span style={{fontSize:12,fontWeight:600,color:"#d97706"}}>${m.cost.toFixed(2)}</span>}
                                  </div>
                                  <div style={{fontSize:13,color:"#1e293b",marginBottom:2}}>{m.description}</div>
                                  {m.technician && <div style={{fontSize:12,color:"#94a3b8"}}>Technician: {m.technician}</div>}
                                </div>
                                <button
                                  onClick={() => handleDeleteMaintenance(m.id)}
                                  title="Delete report"
                                  style={{background:"none",border:"none",cursor:"pointer",color:"#94a3b8",fontSize:16,padding:"0 4px",fontFamily:font}}
                                >×</button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* ── per-item status history ── */}
                    {itemLogs.length > 0 && (
                      <div style={{marginBottom:18}}>
                        <div style={{fontSize:12,fontWeight:700,color:accent,textTransform:"uppercase",letterSpacing:.5,marginBottom:8}}>Status History</div>
                        <div style={{display:"flex",flexDirection:"column",gap:6}}>
                          {itemLogs.map(l=>(
                            <div key={l.id} style={{display:"flex",alignItems:"center",gap:10,fontSize:13,background:"#f8fafc",borderRadius:8,padding:"7px 12px"}}>
                              {l.from !== "—" ? (
                                <>
                                  <span style={{...S.badge(STATUS_CLR[l.from]||"#94a3b8"), fontSize:11}}>{l.from}</span>
                                  <span style={{color:"#94a3b8",fontSize:12}}>→</span>
                                </>
                              ) : (
                                <span style={{fontSize:11,color:"#94a3b8",fontWeight:600}}>Registered as</span>
                              )}
                              <span style={S.badge(STATUS_CLR[l.to]||"#94a3b8")}>{l.to}</span>
                              <span style={{marginLeft:"auto",color:"#94a3b8",fontSize:12,whiteSpace:"nowrap"}}>{l.changedAt}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <button style={S.btn("#dc2626")} onClick={()=>handleDelete(selected.id)}>Delete Equipment</button>
                  </div>
                  <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:8}}>
                    <RealQRCode value={selected.serial} size={150}/>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* ── LIST ── */}
        {view === "list" && (
          <div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18,flexWrap:"wrap",gap:10}}>
              <h2 style={{margin:0,fontSize:21,fontWeight:700}}>Registered Equipment <span style={{color:"#94a3b8",fontWeight:500,fontSize:15}}>({items.length})</span></h2>
              <div style={{display:"flex",gap:8,alignItems:"center"}}>
                <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name, serial, location…" style={{...S.input(false),maxWidth:260}}/>
                {items.length > 0 && (
                  <button onClick={handleExportCsv} style={{...S.btn("#f1f5f9","#475569"),border:"1px solid #e2e8f0",whiteSpace:"nowrap",padding:"10px 16px"}}>
                    Export CSV
                  </button>
                )}
              </div>
            </div>
            <div style={S.card}>
              <div style={{overflowX:"auto"}}>
                <table style={{width:"100%",borderCollapse:"collapse"}}>
                  <thead style={{background:"#f8fafc"}}>
                    <tr>{["Name","Serial","Category","Location","Status","Warranty","Registered"].map(h=><th key={h} style={S.th}>{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {filtered.length===0 && <tr><td colSpan={7} style={{...S.td,textAlign:"center",color:"#94a3b8",padding:36}}>No equipment found</td></tr>}
                    {filtered.map(item=>(
                      <tr key={item.id} style={{cursor:"pointer"}} onMouseEnter={e=>e.currentTarget.style.background="#f0fdf4"} onMouseLeave={e=>e.currentTarget.style.background=""}>
                        <td style={{...S.td,fontWeight:600}} onClick={()=>{setSelected(item);setView("detail")}}>{item.name}</td>
                        <td style={{...S.td,fontFamily:"monospace",fontSize:13}} onClick={()=>{setSelected(item);setView("detail")}}>{item.serial}</td>
                        <td style={S.td} onClick={()=>{setSelected(item);setView("detail")}}>{item.category}</td>
                        <td style={S.td} onClick={()=>{setSelected(item);setView("detail")}}>{item.location}</td>
                        <td style={{...S.td}} onClick={e=>e.stopPropagation()}>
                          <select
                            value={item.status}
                            onChange={e=>changeStatus(item, e.target.value)}
                            style={{border:`2px solid ${STATUS_CLR[item.status]}`, borderRadius:8, padding:"4px 8px", fontSize:12, fontWeight:700, color:STATUS_CLR[item.status], background:"#fff", cursor:"pointer", fontFamily:font, outline:"none"}}
                          >
                            {STATUSES.map(s=><option key={s} value={s}>{s}</option>)}
                          </select>
                        </td>
                        <td style={S.td} onClick={()=>{setSelected(item);setView("detail")}}>
                          <WarrantyBadge warrantyExpiration={item.warrantyExpiration} />
                        </td>
                        <td style={{...S.td,fontSize:13,color:"#64748b"}} onClick={()=>{setSelected(item);setView("detail")}}>{item.registeredAt}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── LOGS ── */}
        {view === "logs" && (
          <div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18,flexWrap:"wrap",gap:10}}>
              <h2 style={{margin:0,fontSize:21,fontWeight:700}}>Status Change Log <span style={{color:"#94a3b8",fontWeight:500,fontSize:15}}>({statusLogs.length})</span></h2>
              <div style={{display:"flex",gap:8,alignItems:"center"}}>
                <input value={logSearch} onChange={e=>setLogSearch(e.target.value)} placeholder="Search device, status…" style={{...S.input(false),maxWidth:220}}/>
                {statusLogs.length > 0 && (
                  <button
                    style={S.btn("#dc2626")}
                    onClick={()=>{ if(window.confirm("Clear all log entries? This cannot be undone.")) { setStatusLogs([]); setLogSearch(""); } }}
                  >
                    Clear Logs
                  </button>
                )}
              </div>
            </div>
            <div style={S.card}>
              <div style={{overflowX:"auto"}}>
                <table style={{width:"100%",borderCollapse:"collapse"}}>
                  <thead style={{background:"#f8fafc"}}>
                    <tr>{["Device","Serial","From","To","Changed At"].map(h=><th key={h} style={S.th}>{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {filteredLogs.length===0 && <tr><td colSpan={5} style={{...S.td,textAlign:"center",color:"#94a3b8",padding:36}}>No status changes logged yet</td></tr>}
                    {filteredLogs.map(l=>(
                      <tr key={l.id} style={{cursor:"pointer"}} onClick={()=>{ const item=items.find(i=>i.id===l.itemId); if(item){setSelected(item);setView("detail");} }} onMouseEnter={e=>e.currentTarget.style.background="#f0fdf4"} onMouseLeave={e=>e.currentTarget.style.background=""}>
                        <td style={{...S.td,fontWeight:600}}>{l.itemName}</td>
                        <td style={{...S.td,fontFamily:"monospace",fontSize:13}}>{l.itemSerial}</td>
                        <td style={S.td}>
                          {l.from === "—"
                            ? <span style={{color:"#94a3b8",fontSize:12,fontStyle:"italic"}}>Registered</span>
                            : <span style={S.badge(STATUS_CLR[l.from]||"#94a3b8")}>{l.from}</span>
                          }
                        </td>
                        <td style={S.td}><span style={S.badge(STATUS_CLR[l.to]||"#94a3b8")}>{l.to}</span></td>
                        <td style={{...S.td,fontSize:13,color:"#64748b"}}>{l.changedAt}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* ── REGISTRATION MODAL ── */}
      {showForm && (
        <div style={S.overlay} onClick={e=>e.target===e.currentTarget&&setShowForm(false)}>
          <div style={S.modal}>
            <h2 style={{margin:"0 0 4px",fontSize:19,fontWeight:700}}>Register New Equipment</h2>
            <p style={{color:"#64748b",fontSize:13,margin:"0 0 4px"}}>Serial number must be unique.</p>
            <div style={{display:"flex",flexDirection:"column",gap:14}}>

              <div>
                <label style={{fontSize:13,fontWeight:600,marginBottom:3,display:"block"}}>Serial Number *</label>
                <input style={S.input(formErrors.serial)} value={form.serial} onChange={e=>setForm({...form,serial:e.target.value})} placeholder="e.g. HP-LJ-90214"/>
                {formErrors.serial && <div style={{color:"#ef4444",fontSize:12,marginTop:2}}>{formErrors.serial}</div>}
              </div>
              <div>
                <label style={{fontSize:13,fontWeight:600,marginBottom:3,display:"block"}}>Equipment Name *</label>
                <input style={S.input(formErrors.name)} value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="e.g. HP LaserJet Pro"/>
                {formErrors.name && <div style={{color:"#ef4444",fontSize:12,marginTop:2}}>{formErrors.name}</div>}
              </div>

              {/* ── STATUS (on registration) ── */}
              <div>
                <label style={{fontSize:13,fontWeight:600,marginBottom:6,display:"block"}}>Initial Status</label>
                <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                  {STATUSES.map(s=>(
                    <button
                      key={s} type="button"
                      onClick={()=>setForm(f=>({...f,status:s}))}
                      style={{
                        padding:"6px 14px", borderRadius:20, fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:font,
                        background: form.status===s ? STATUS_CLR[s] : "#f1f5f9",
                        color:      form.status===s ? "#fff"         : "#475569",
                        border:     form.status===s ? `2px solid ${STATUS_CLR[s]}` : "2px solid #e2e8f0",
                      }}
                    >{s}</button>
                  ))}
                </div>
              </div>

              {/* ── WARRANTY EXPIRATION ── */}
              <div>
                <label style={{fontSize:13,fontWeight:600,marginBottom:3,display:"block"}}>Warranty Expiration Date</label>
                <input type="date" style={S.input(false)} value={form.warrantyExpiration} onChange={e=>setForm({...form,warrantyExpiration:e.target.value})}/>
                <div style={{fontSize:11,color:"#94a3b8",marginTop:2}}>Leave blank if unknown</div>
              </div>

              {/* ── CATEGORY ── */}
              <div>
                <label style={{fontSize:13,fontWeight:600,marginBottom:3,display:"block"}}>Category</label>
                {categories.length === 0 ? (
                  <button type="button" style={S.dashed()} onClick={()=>setAddingCategory(true)}>+ Add a category…</button>
                ) : (
                  <select style={{...S.input(false),cursor:"pointer"}} value={form.category} onChange={e=>{
                    if(e.target.value==="__add__") setAddingCategory(true);
                    else { setForm({...form,category:e.target.value}); setAddingCategory(false); }
                  }}>
                    {categories.map(c=><option key={c}>{c}</option>)}
                    <option value="__add__">+ Add custom…</option>
                  </select>
                )}
                {addingCategory && (
                  <div style={{display:"flex",gap:6,marginTop:6}}>
                    <input autoFocus style={{...S.input(false),fontSize:13}} placeholder="New category…" value={customCategory} onChange={e=>setCustomCategory(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")handleAddCategory();if(e.key==="Escape"){setAddingCategory(false);setCustomCategory("");}}}/>
                    <button style={S.btn(accent)} onClick={handleAddCategory}>Add</button>
                  </div>
                )}
                {categories.length > 0 && (
                  <div style={{display:"flex",flexWrap:"wrap",gap:6,marginTop:8}}>
                    {categories.map(c=>(
                      <span key={c} style={S.tag}>{c}<button style={S.tagX} title={`Remove "${c}"`} onClick={()=>handleDeleteCategory(c)}>×</button></span>
                    ))}
                  </div>
                )}
              </div>

              {/* ── LOCATION ── */}
              <div>
                <label style={{fontSize:13,fontWeight:600,marginBottom:3,display:"block"}}>Location</label>
                {locations.length === 0 ? (
                  <button type="button" style={S.dashed()} onClick={()=>setAddingLocation(true)}>+ Add a location…</button>
                ) : (
                  <select style={{...S.input(false),cursor:"pointer"}} value={form.location} onChange={e=>{
                    if(e.target.value==="__add__") setAddingLocation(true);
                    else { setForm({...form,location:e.target.value}); setAddingLocation(false); }
                  }}>
                    {locations.map(l=><option key={l}>{l}</option>)}
                    <option value="__add__">+ Add custom…</option>
                  </select>
                )}
                {addingLocation && (
                  <div style={{display:"flex",gap:6,marginTop:6}}>
                    <input autoFocus style={{...S.input(false),fontSize:13}} placeholder="New location…" value={customLocation} onChange={e=>setCustomLocation(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")handleAddLocation();if(e.key==="Escape"){setAddingLocation(false);setCustomLocation("");}}}/>
                    <button style={S.btn(accent)} onClick={handleAddLocation}>Add</button>
                  </div>
                )}
                {locations.length > 0 && (
                  <div style={{display:"flex",flexWrap:"wrap",gap:6,marginTop:8}}>
                    {locations.map(l=>(
                      <span key={l} style={S.tag}>{l}<button style={S.tagX} title={`Remove "${l}"`} onClick={()=>handleDeleteLocation(l)}>×</button></span>
                    ))}
                  </div>
                )}
              </div>

              {/* ── CONTACT PERSON ── */}
              <SavedSelector
                label="Contact Person" savedLabel="contact"
                saved={contacts} selectedId={form.contactId}
                onSelect={id=>setForm(f=>({...f,contactId:id}))}
                addingState={addingContact} setAddingState={setAddingContact}
                newState={newContact} setNewState={setNewContact}
                fields={[
                  {key:"name",  label:"Name",  placeholder:"Jane Smith",       required:true},
                  {key:"email", label:"Email", placeholder:"jane@example.com"},
                  {key:"phone", label:"Phone", placeholder:"+1 555 000 0000"},
                  {key:"slack", label:"Slack", placeholder:"@jane.smith"},
                ]}
                onSave={handleSaveContact} onDelete={handleDeleteContact} styles={S}
              />

              {/* ── MANUFACTURER ── */}
              <SavedSelector
                label="Manufacturer" savedLabel="manufacturer"
                saved={manufacturers} selectedId={form.mfrId}
                onSelect={id=>setForm(f=>({...f,mfrId:id}))}
                addingState={addingMfr} setAddingState={setAddingMfr}
                newState={newMfr} setNewState={setNewMfr}
                fields={[
                  {key:"name",    label:"Company Name", placeholder:"Acme Corp",          required:true},
                  {key:"phone",   label:"Phone",        placeholder:"+1 800 000 0000"},
                  {key:"email",   label:"Email",        placeholder:"support@acme.com"},
                  {key:"website", label:"Website",      placeholder:"https://acme.com"},
                ]}
                onSave={handleSaveMfr} onDelete={handleDeleteMfr} styles={S}
              />

              {/* ── NOTES ── */}
              <div>
                <label style={{fontSize:13,fontWeight:600,marginBottom:3,display:"block"}}>Notes (optional)</label>
                <textarea style={{...S.input(false),minHeight:60,resize:"vertical"}} value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} placeholder="Any additional details…"/>
              </div>

              <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:2}}>
                <button style={S.btn("#e2e8f0","#475569")} onClick={()=>setShowForm(false)}>Cancel</button>
                <button style={S.btn()} onClick={handleRegister}>Register Equipment</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── REGISTER CHOICE MODAL ── */}
      {showRegisterChoice && (
        <div style={S.overlay} onClick={e=>e.target===e.currentTarget&&setShowRegisterChoice(false)}>
          <div style={{...S.modal, maxWidth:420, textAlign:"center"}}>
            <h2 style={{margin:"0 0 6px",fontSize:19,fontWeight:700}}>Register Equipment</h2>
            <p style={{color:"#64748b",fontSize:14,margin:"0 0 24px"}}>How would you like to add equipment?</p>
            <div style={{display:"flex",gap:14}}>
              <button
                onClick={() => {
                  setShowRegisterChoice(false);
                  setShowCsvImport(true);
                  setCsvData(null); setCsvErrors([]); setCsvFileName("");
                }}
                style={{
                  flex:1, background:"#f0fdf4", border:`2px solid ${accent}`, borderRadius:14,
                  padding:"24px 16px", cursor:"pointer", fontFamily:font, textAlign:"center",
                }}
              >
                <div style={{fontSize:32,marginBottom:8}}>📄</div>
                <div style={{fontSize:15,fontWeight:700,color:accent,marginBottom:4}}>Import CSV</div>
                <div style={{fontSize:12,color:"#64748b"}}>Bulk import multiple items from a CSV file</div>
              </button>
              <button
                onClick={() => {
                  setShowRegisterChoice(false);
                  setShowForm(true); setForm(makeBlank()); setFormErrors({});
                }}
                style={{
                  flex:1, background:"#f8fafc", border:"2px solid #e2e8f0", borderRadius:14,
                  padding:"24px 16px", cursor:"pointer", fontFamily:font, textAlign:"center",
                }}
              >
                <div style={{fontSize:32,marginBottom:8}}>✏️</div>
                <div style={{fontSize:15,fontWeight:700,color:"#1e293b",marginBottom:4}}>Manual Entry</div>
                <div style={{fontSize:12,color:"#64748b"}}>Register a single item with the form</div>
              </button>
            </div>
            <button
              onClick={() => setShowRegisterChoice(false)}
              style={{...S.btn("#e2e8f0","#475569"), marginTop:16, width:"100%"}}
            >Cancel</button>
          </div>
        </div>
      )}

      {/* ── CSV IMPORT MODAL ── */}
      {showCsvImport && (
        <div style={S.overlay} onClick={e=>e.target===e.currentTarget&&setShowCsvImport(false)}>
          <div style={{...S.modal, maxWidth:560}}>
            <h2 style={{margin:"0 0 4px",fontSize:19,fontWeight:700}}>Import Equipment from CSV</h2>
            <p style={{color:"#64748b",fontSize:13,margin:"0 0 18px"}}>
              Upload a CSV file with equipment data. Each row becomes one registered item.
            </p>

            {/* Template download */}
            <div style={{background:"#f0fdf4",borderRadius:10,padding:"12px 16px",marginBottom:16,border:`1px solid ${accent}22`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div>
                <div style={{fontSize:13,fontWeight:600,color:"#1e293b"}}>Need a template?</div>
                <div style={{fontSize:12,color:"#64748b"}}>Download a sample CSV with all the columns pre-filled</div>
              </div>
              <button onClick={handleDownloadTemplate} style={{...S.btn("#fff",accent),border:`1px solid ${accent}`,padding:"7px 14px",fontSize:13}}>
                Download Template
              </button>
            </div>

            {/* File upload area */}
            <input ref={csvFileRef} type="file" accept=".csv,.txt" onChange={handleCsvFileSelect} style={{display:"none"}} />
            <button
              onClick={() => csvFileRef.current?.click()}
              style={{
                width:"100%", padding:"28px 16px", background:"#f8fafc",
                border:"2px dashed #cbd5e1", borderRadius:12, cursor:"pointer",
                fontFamily:font, textAlign:"center", marginBottom:16,
              }}
            >
              <div style={{fontSize:28,marginBottom:6}}>📁</div>
              <div style={{fontSize:14,fontWeight:600,color:"#475569"}}>
                {csvFileName ? csvFileName : "Click to select a CSV file"}
              </div>
              <div style={{fontSize:12,color:"#94a3b8",marginTop:4}}>Supports .csv files</div>
            </button>

            {/* Errors */}
            {csvErrors.length > 0 && (
              <div style={{background:"#fef2f2",borderRadius:10,padding:"12px 16px",marginBottom:14,border:"1px solid #fecaca",maxHeight:120,overflowY:"auto"}}>
                <div style={{fontSize:12,fontWeight:700,color:"#dc2626",marginBottom:4}}>Warnings ({csvErrors.length})</div>
                {csvErrors.map((err, i) => (
                  <div key={i} style={{fontSize:12,color:"#991b1b",marginBottom:2}}>{err}</div>
                ))}
              </div>
            )}

            {/* Preview */}
            {csvData && csvData.length > 0 && (
              <div style={{marginBottom:14}}>
                <div style={{fontSize:13,fontWeight:700,color:accent,marginBottom:8}}>
                  Ready to import {csvData.length} item{csvData.length !== 1 ? "s" : ""}
                </div>
                <div style={{...S.card, maxHeight:200, overflowY:"auto"}}>
                  <table style={{width:"100%",borderCollapse:"collapse"}}>
                    <thead style={{background:"#f8fafc",position:"sticky",top:0}}>
                      <tr>{["Name","Serial","Category","Status"].map(h=><th key={h} style={{...S.th,fontSize:11,padding:"6px 10px"}}>{h}</th>)}</tr>
                    </thead>
                    <tbody>
                      {csvData.map((row, i) => (
                        <tr key={i}>
                          <td style={{...S.td,fontSize:12,padding:"6px 10px"}}>{row.name}</td>
                          <td style={{...S.td,fontSize:12,padding:"6px 10px",fontFamily:"monospace"}}>{row.serial}</td>
                          <td style={{...S.td,fontSize:12,padding:"6px 10px"}}>{row.category}</td>
                          <td style={{...S.td,fontSize:12,padding:"6px 10px"}}>
                            <span style={S.badge(STATUS_CLR[row.status]||"#94a3b8")}>{row.status}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {csvData && csvData.length === 0 && csvFileName && csvErrors.length === 0 && (
              <div style={{fontSize:13,color:"#94a3b8",fontStyle:"italic",textAlign:"center",padding:12}}>
                No valid rows found in the file.
              </div>
            )}

            <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
              <button style={S.btn("#e2e8f0","#475569")} onClick={()=>{setShowCsvImport(false);setCsvData(null);setCsvErrors([]);setCsvFileName("");}}>Cancel</button>
              <button
                style={{...S.btn(), opacity: csvData && csvData.length > 0 ? 1 : 0.5}}
                disabled={!csvData || csvData.length === 0}
                onClick={handleCsvImport}
              >
                Import {csvData ? csvData.length : 0} Item{csvData?.length !== 1 ? "s" : ""}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── QR SCANNER OVERLAY ── */}
      {showScanner && (
        <QRScanner
          onScan={handleQRScan}
          onClose={() => setShowScanner(false)}
        />
      )}

      {toast && <div style={S.toast}>{toast}</div>}
    </div>
  );
}
