// Unit Tests — instockUtils
// Tests pure utility functions: URL validation, warranty status, CSV parsing,
// CSV export, maintenance validation, log filtering, and CSV deduplication.

import { describe, it, expect, vi } from 'vitest';
import {
  isSafeUrl,
  getWarrantyStatus,
  splitCSVLine,
  parseCSV,
  escapeCSVField,
  buildExportCSV,
  validateMaintenance,
  filterStatusLogs,
  deduplicateCSVRows,
} from '../src/instockUtils.js';

/* ═══════════════════ isSafeUrl ═══════════════════ */
describe('isSafeUrl', () => {
  it('accepts http URLs', () => {
    expect(isSafeUrl('http://example.com')).toBe(true);
  });

  it('accepts https URLs', () => {
    expect(isSafeUrl('https://example.com')).toBe(true);
  });

  it('rejects ftp URLs', () => {
    expect(isSafeUrl('ftp://files.example.com')).toBe(false);
  });

  it('rejects javascript: URLs', () => {
    expect(isSafeUrl('javascript:alert(1)')).toBe(false);
  });

  it('rejects random strings', () => {
    expect(isSafeUrl('not a url')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isSafeUrl('')).toBe(false);
  });

  it('accepts URLs with paths and params', () => {
    expect(isSafeUrl('https://example.com/page?q=1&r=2')).toBe(true);
  });
});

/* ═══════════════════ getWarrantyStatus ═══════════════════ */
describe('getWarrantyStatus', () => {
  it('returns null when no date is provided', () => {
    expect(getWarrantyStatus('')).toBeNull();
    expect(getWarrantyStatus(null)).toBeNull();
    expect(getWarrantyStatus(undefined)).toBeNull();
  });

  it('returns "Active" for a future date', () => {
    const future = new Date();
    future.setFullYear(future.getFullYear() + 1);
    expect(getWarrantyStatus(future.toISOString())).toBe('Active');
  });

  it('returns "Expired" for a past date', () => {
    expect(getWarrantyStatus('2020-01-01')).toBe('Expired');
  });

  it('returns "Active" for tomorrow\'s date', () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth()+1).padStart(2,'0')}-${String(tomorrow.getDate()).padStart(2,'0')}`;
    expect(getWarrantyStatus(dateStr)).toBe('Active');
  });

  it('returns "Expired" for yesterday', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth()+1).padStart(2,'0')}-${String(yesterday.getDate()).padStart(2,'0')}`;
    expect(getWarrantyStatus(dateStr)).toBe('Expired');
  });
});

/* ═══════════════════ splitCSVLine ═══════════════════ */
describe('splitCSVLine', () => {
  it('splits a simple comma-separated line', () => {
    expect(splitCSVLine('a,b,c')).toEqual(['a', 'b', 'c']);
  });

  it('handles quoted fields with commas inside', () => {
    expect(splitCSVLine('"hello, world",b,c')).toEqual(['hello, world', 'b', 'c']);
  });

  it('handles escaped quotes inside quoted fields', () => {
    expect(splitCSVLine('"say ""hi""",b')).toEqual(['say "hi"', 'b']);
  });

  it('trims whitespace around unquoted values', () => {
    expect(splitCSVLine(' a , b , c ')).toEqual(['a', 'b', 'c']);
  });

  it('handles empty fields', () => {
    expect(splitCSVLine('a,,c')).toEqual(['a', '', 'c']);
  });

  it('handles a single field', () => {
    expect(splitCSVLine('onlyone')).toEqual(['onlyone']);
  });
});

/* ═══════════════════ parseCSV ═══════════════════ */
describe('parseCSV', () => {
  const header = 'Name,Serial,Category,Location,Status';

  it('parses a basic CSV with required columns', () => {
    const csv = `${header}\nPrinter,SER-001,Printer,Lab A,Working`;
    const { rows, errors } = parseCSV(csv);
    expect(errors).toHaveLength(0);
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe('Printer');
    expect(rows[0].serial).toBe('SER-001');
    expect(rows[0].status).toBe('Working');
  });

  it('returns error when fewer than 2 lines', () => {
    const { rows, errors } = parseCSV('Name,Serial');
    expect(rows).toHaveLength(0);
    expect(errors[0]).toContain('header row and at least one data row');
  });

  it('returns error when Name column is missing', () => {
    const { rows, errors } = parseCSV('Serial,Category\nSER-001,Printer');
    expect(rows).toHaveLength(0);
    expect(errors[0]).toContain('Missing required columns: Name');
  });

  it('returns error when Serial column is missing', () => {
    const { rows, errors } = parseCSV('Name,Category\nPrinter,Stuff');
    expect(rows).toHaveLength(0);
    expect(errors[0]).toContain('Missing required columns: Serial');
  });

  it('skips blank rows silently', () => {
    const csv = `${header}\nPrinter,SER-001,Printer,Lab A,Working\n,,,,`;
    const { rows, errors } = parseCSV(csv);
    expect(rows).toHaveLength(1);
    expect(errors).toHaveLength(0);
  });

  it('reports error for row missing name', () => {
    const csv = `${header}\n,SER-001,Printer,Lab A,Working`;
    const { rows, errors } = parseCSV(csv);
    expect(rows).toHaveLength(0);
    expect(errors[0]).toContain('Missing equipment name');
  });

  it('reports error for row missing serial', () => {
    const csv = `${header}\nPrinter,,Printer,Lab A,Working`;
    const { rows, errors } = parseCSV(csv);
    expect(rows).toHaveLength(0);
    expect(errors[0]).toContain('Missing serial number');
  });

  it('defaults status to Working when invalid status given', () => {
    const csv = `${header}\nPrinter,SER-001,Printer,Lab A,BogusStatus`;
    const { rows } = parseCSV(csv);
    expect(rows[0].status).toBe('Working');
  });

  it('accepts status case-insensitively', () => {
    const csv = `${header}\nPrinter,SER-001,Printer,Lab A,needs maintenance`;
    const { rows } = parseCSV(csv);
    expect(rows[0].status).toBe('Needs Maintenance');
  });

  it('handles headers case-insensitively', () => {
    const csv = `name,serial,category\nPrinter,SER-001,Printer`;
    const { rows, errors } = parseCSV(csv);
    expect(errors).toHaveLength(0);
    expect(rows[0].name).toBe('Printer');
  });

  it('parses multiple valid rows', () => {
    const csv = `${header}\nItem A,SER-A,Cat,,Working\nItem B,SER-B,Cat,,Under Repair`;
    const { rows } = parseCSV(csv);
    expect(rows).toHaveLength(2);
    expect(rows[1].status).toBe('Under Repair');
  });

  it('parses optional columns like Notes and WarrantyExpiration', () => {
    const csv = 'Name,Serial,Notes,WarrantyExpiration\nPrinter,SER-001,My note,2027-06-15';
    const { rows } = parseCSV(csv);
    expect(rows[0].notes).toBe('My note');
    expect(rows[0].warrantyExpiration).toBe('2027-06-15');
  });

  it('handles Windows-style line endings (\\r\\n)', () => {
    const csv = `${header}\r\nPrinter,SER-001,Printer,Lab A,Working`;
    const { rows } = parseCSV(csv);
    expect(rows).toHaveLength(1);
  });
});

/* ═══════════════════ escapeCSVField ═══════════════════ */
describe('escapeCSVField', () => {
  it('returns plain text unchanged', () => {
    expect(escapeCSVField('hello')).toBe('hello');
  });

  it('wraps values with commas in quotes', () => {
    expect(escapeCSVField('a,b')).toBe('"a,b"');
  });

  it('escapes double quotes inside values', () => {
    expect(escapeCSVField('say "hi"')).toBe('"say ""hi"""');
  });

  it('wraps values with newlines in quotes', () => {
    expect(escapeCSVField('line1\nline2')).toBe('"line1\nline2"');
  });

  it('converts null/undefined to empty string', () => {
    expect(escapeCSVField(null)).toBe('');
    expect(escapeCSVField(undefined)).toBe('');
  });
});

/* ═══════════════════ buildExportCSV ═══════════════════ */
describe('buildExportCSV', () => {
  const items = [
    {
      name: 'HP Printer', serial: 'HP-001', category: 'Printer',
      location: 'Lab A', status: 'Working', warrantyExpiration: '2027-01-01',
      contactId: 'c1', mfrId: 'm1', notes: 'Floor 2',
    },
  ];
  const contacts = [{ id: 'c1', name: 'Jane', email: 'j@x.com', phone: '555', slack: '@jane' }];
  const mfrs = [{ id: 'm1', name: 'HP', phone: '800', email: 's@hp.com', website: 'https://hp.com' }];

  it('includes header row', () => {
    const csv = buildExportCSV(items, contacts, mfrs);
    const firstLine = csv.split('\n')[0];
    expect(firstLine).toContain('Name');
    expect(firstLine).toContain('Serial');
  });

  it('includes item data in the output', () => {
    const csv = buildExportCSV(items, contacts, mfrs);
    expect(csv).toContain('HP Printer');
    expect(csv).toContain('HP-001');
    expect(csv).toContain('Jane');
  });

  it('handles items without contact or manufacturer', () => {
    const bareItems = [{ name: 'Solo', serial: 'S-1', category: '', location: '', status: 'Working', notes: '' }];
    const csv = buildExportCSV(bareItems, [], []);
    expect(csv).toContain('Solo');
    expect(csv.split('\n')).toHaveLength(2);
  });

  it('returns only header for empty items array', () => {
    const csv = buildExportCSV([], [], []);
    expect(csv.split('\n')).toHaveLength(1);
  });
});

/* ═══════════════════ validateMaintenance ═══════════════════ */
describe('validateMaintenance', () => {
  it('returns no errors for valid input', () => {
    expect(validateMaintenance({ date: '2025-04-01', description: 'Fixed motor' })).toEqual({});
  });

  it('requires date', () => {
    const errs = validateMaintenance({ date: '', description: 'Fixed it' });
    expect(errs).toHaveProperty('date', 'Required');
  });

  it('requires description', () => {
    const errs = validateMaintenance({ date: '2025-04-01', description: '' });
    expect(errs).toHaveProperty('description', 'Required');
  });

  it('rejects whitespace-only description', () => {
    const errs = validateMaintenance({ date: '2025-04-01', description: '   ' });
    expect(errs).toHaveProperty('description', 'Required');
  });

  it('returns both errors when both fields missing', () => {
    const errs = validateMaintenance({ date: '', description: '' });
    expect(Object.keys(errs)).toHaveLength(2);
  });
});

/* ═══════════════════ filterStatusLogs ═══════════════════ */
describe('filterStatusLogs', () => {
  const LOGS = [
    { itemName: 'HP Printer', itemSerial: 'HP-001', from: 'Working', to: 'Under Repair' },
    { itemName: 'Dell Laptop', itemSerial: 'DL-001', from: 'Working', to: 'Needs Maintenance' },
    { itemName: 'Cisco Router', itemSerial: 'CR-001', from: 'Under Repair', to: 'Working' },
  ];

  it('returns all logs for empty query', () => {
    expect(filterStatusLogs(LOGS, '')).toHaveLength(3);
    expect(filterStatusLogs(LOGS, null)).toHaveLength(3);
  });

  it('filters by item name', () => {
    expect(filterStatusLogs(LOGS, 'Dell')).toHaveLength(1);
  });

  it('filters by serial', () => {
    expect(filterStatusLogs(LOGS, 'CR-001')).toHaveLength(1);
  });

  it('filters by status value', () => {
    expect(filterStatusLogs(LOGS, 'Under Repair')).toHaveLength(2);
  });

  it('is case-insensitive', () => {
    expect(filterStatusLogs(LOGS, 'hp printer')).toHaveLength(1);
  });

  it('returns empty when nothing matches', () => {
    expect(filterStatusLogs(LOGS, 'zzzzz')).toHaveLength(0);
  });
});

/* ═══════════════════ deduplicateCSVRows ═══════════════════ */
describe('deduplicateCSVRows', () => {
  const existing = [
    { serial: 'EXIST-001' },
    { serial: 'EXIST-002' },
  ];

  it('passes through unique rows', () => {
    const rows = [{ serial: 'NEW-001' }, { serial: 'NEW-002' }];
    const { deduped, errors } = deduplicateCSVRows(rows, existing);
    expect(deduped).toHaveLength(2);
    expect(errors).toHaveLength(0);
  });

  it('removes rows with serials already in inventory', () => {
    const rows = [{ serial: 'EXIST-001' }, { serial: 'NEW-001' }];
    const { deduped, errors } = deduplicateCSVRows(rows, existing);
    expect(deduped).toHaveLength(1);
    expect(errors[0]).toContain('already registered');
  });

  it('removes duplicate serials within the CSV itself', () => {
    const rows = [{ serial: 'ABC-001' }, { serial: 'ABC-001' }];
    const { deduped, errors } = deduplicateCSVRows(rows, []);
    expect(deduped).toHaveLength(1);
    expect(errors[0]).toContain('Duplicate serial in CSV');
  });

  it('deduplication is case-insensitive', () => {
    const rows = [{ serial: 'abc-001' }, { serial: 'ABC-001' }];
    const { deduped } = deduplicateCSVRows(rows, []);
    expect(deduped).toHaveLength(1);
  });

  it('catches both internal dupes and inventory conflicts', () => {
    const rows = [{ serial: 'EXIST-001' }, { serial: 'NEW-001' }, { serial: 'NEW-001' }];
    const { deduped, errors } = deduplicateCSVRows(rows, existing);
    expect(deduped).toHaveLength(1);
    expect(errors).toHaveLength(2);
  });

  it('works with no existing items', () => {
    const rows = [{ serial: 'A' }, { serial: 'B' }];
    const { deduped, errors } = deduplicateCSVRows(rows);
    expect(deduped).toHaveLength(2);
    expect(errors).toHaveLength(0);
  });
});