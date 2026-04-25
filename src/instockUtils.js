// instockUtils.js
// Pure utility functions extracted from InStock for testability.

const STATUSES = ["Working", "Needs Maintenance", "Under Repair", "Decommissioned"];

const CSV_HEADERS = [
  "Name","Serial","Category","Location","Status","WarrantyExpiration",
  "ContactName","ContactEmail","ContactPhone","ContactSlack",
  "ManufacturerName","ManufacturerPhone","ManufacturerEmail","ManufacturerWebsite",
  "Notes"
];

/**
 * Validates a URL is http or https only.
 * @param {string} val
 * @returns {boolean}
 */
export function isSafeUrl(val) {
  try { return /^https?:\/\//i.test(new URL(val).href); } catch { return false; }
}

/**
 * Returns "Active" or "Expired" based on warranty date, or null if not set.
 * @param {string} warrantyExpiration - date string
 * @returns {string|null}
 */
export function getWarrantyStatus(warrantyExpiration) {
  if (!warrantyExpiration) return null;
  const exp = new Date(warrantyExpiration);
  const now = new Date();
  now.setHours(0,0,0,0);
  return exp >= now ? "Active" : "Expired";
}

/**
 * Parses a CSV line respecting quoted fields.
 * @param {string} line
 * @returns {string[]}
 */
export function splitCSVLine(line) {
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

/**
 * Parses a full CSV string into rows and errors.
 * @param {string} text - raw CSV content
 * @returns {{ rows: object[], errors: string[] }}
 */
export function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return { rows: [], errors: ["CSV must have a header row and at least one data row."] };

  const headers = splitCSVLine(lines[0]).map(h => h.replace(/^"|"$/g, '').trim());

  // Map user headers to expected headers (case-insensitive, flexible)
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

/**
 * Escapes a value for CSV output.
 * @param {*} val
 * @returns {string}
 */
export function escapeCSVField(val) {
  const s = String(val || "");
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

/**
 * Builds a full CSV string from items, contacts array, and manufacturers array.
 * @param {object[]} items
 * @param {object[]} contacts
 * @param {object[]} manufacturers
 * @returns {string}
 */
export function buildExportCSV(items, contacts = [], manufacturers = []) {
  const contactFor = (id) => contacts.find(c => c.id === id) || null;
  const mfrFor     = (id) => manufacturers.find(m => m.id === id) || null;

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
    ].map(escapeCSVField).join(",");
  });

  return [header, ...rows].join("\n");
}

/**
 * Validates a maintenance report form.
 * @param {object} form - { date, description }
 * @returns {object} errors object (empty = valid)
 */
export function validateMaintenance(form) {
  const errors = {};
  if (!form.date) errors.date = "Required";
  if (!form.description || !form.description.trim()) errors.description = "Required";
  return errors;
}

/**
 * Filters status log entries by a search query.
 * @param {object[]} logs
 * @param {string} query
 * @returns {object[]}
 */
export function filterStatusLogs(logs, query) {
  if (!query || !query.trim()) return logs;
  const q = query.toLowerCase();
  return logs.filter(l =>
    `${l.itemName} ${l.itemSerial} ${l.from} ${l.to}`.toLowerCase().includes(q)
  );
}

/**
 * Deduplicates parsed CSV rows against existing inventory.
 * @param {object[]} rows - parsed CSV rows
 * @param {object[]} existingItems - current inventory
 * @returns {{ deduped: object[], errors: string[] }}
 */
export function deduplicateCSVRows(rows, existingItems = []) {
  const seen = new Set();
  const deduped = [];
  const errors = [];

  for (const row of rows) {
    const key = row.serial.toLowerCase();
    if (seen.has(key)) {
      errors.push(`Duplicate serial in CSV: "${row.serial}"`);
      continue;
    }
    seen.add(key);
    if (existingItems.some(i => i.serial.toLowerCase() === key)) {
      errors.push(`Serial "${row.serial}" already registered — skipped`);
      continue;
    }
    deduped.push(row);
  }

  return { deduped, errors };
}
