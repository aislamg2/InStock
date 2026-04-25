// Unit Tests — equipmentService
// Tests pure business logic independent of UI.

import { describe, it, expect } from 'vitest';
import {
  validateRegistration,
  createEquipmentItem,
  searchEquipment,
  lookupBySerial,
  removeEquipment,
} from '../src/equipmentService.js';

/* ─── sample data ─── */
const ITEMS = [
  { id: '1', name: 'HP LaserJet', serial: 'HP-LJ-90214', category: 'Printer', location: 'Lab A', status: 'Available' },
  { id: '2', name: 'Epson Projector', serial: 'EPS-EB-44821', category: 'AV', location: 'Lab B', status: 'In Use' },
  { id: '3', name: 'Dell Laptop', serial: 'DL-LAT-77193', category: 'Computer', location: 'Lab C', status: 'Available' },
];

/* ═══════════════════ validateRegistration ═══════════════════ */
describe('validateRegistration', () => {
  it('returns no errors for valid input', () => {
    const form = { name: 'New Device', serial: 'NEW-001' };
    expect(validateRegistration(form, ITEMS)).toEqual({});
  });

  it('requires name', () => {
    const form = { name: '', serial: 'NEW-001' };
    expect(validateRegistration(form, ITEMS)).toHaveProperty('name', 'Required');
  });

  it('requires serial', () => {
    const form = { name: 'Device', serial: '' };
    expect(validateRegistration(form, ITEMS)).toHaveProperty('serial', 'Required');
  });

  it('rejects whitespace-only name', () => {
    const form = { name: '   ', serial: 'NEW-001' };
    expect(validateRegistration(form, ITEMS)).toHaveProperty('name', 'Required');
  });

  it('rejects duplicate serial (case-insensitive)', () => {
    const form = { name: 'Dup', serial: 'hp-lj-90214' };
    expect(validateRegistration(form, ITEMS)).toHaveProperty('serial', 'Serial already registered');
  });

  it('allows a serial that does not exist yet', () => {
    const form = { name: 'New', serial: 'UNIQUE-999' };
    expect(validateRegistration(form, ITEMS)).toEqual({});
  });

  it('returns multiple errors when both fields missing', () => {
    const errors = validateRegistration({ name: '', serial: '' }, []);
    expect(Object.keys(errors)).toHaveLength(2);
  });
});

/* ═══════════════════ createEquipmentItem ═══════════════════ */
describe('createEquipmentItem', () => {
  it('creates item with correct fields and trims whitespace', () => {
    const item = createEquipmentItem({ name: ' Test ', serial: ' SER-1 ', category: 'Computer', location: 'Lab A', notes: ' note ' });
    expect(item.name).toBe('Test');
    expect(item.serial).toBe('SER-1');
    expect(item.notes).toBe('note');
    expect(item.status).toBe('Available');
    expect(item.category).toBe('Computer');
    expect(item.location).toBe('Lab A');
    expect(item.id).toBeTruthy();
    expect(item.registeredAt).toBeTruthy();
  });

  it('falls back to defaults when category and location are missing', () => {
    const item = createEquipmentItem({ name: 'X', serial: 'Y' });
    expect(item.category).toBe('Other');
    expect(item.location).toBe('Room 101');
  });
});

/* ═══════════════════ searchEquipment ═══════════════════ */
describe('searchEquipment', () => {
  it('returns all items for empty query', () => {
    expect(searchEquipment(ITEMS, '')).toHaveLength(3);
  });

  it('filters by name', () => {
    expect(searchEquipment(ITEMS, 'laser')).toHaveLength(1);
  });

  it('filters by serial', () => {
    expect(searchEquipment(ITEMS, 'EPS-EB')).toHaveLength(1);
  });

  it('filters by location', () => {
    expect(searchEquipment(ITEMS, 'Lab B')).toHaveLength(1);
  });

  it('filters by category', () => {
    expect(searchEquipment(ITEMS, 'Computer')).toHaveLength(1);
  });

  it('is case-insensitive', () => {
    expect(searchEquipment(ITEMS, 'LASER')).toHaveLength(1);
  });

  it('returns empty array when nothing matches', () => {
    expect(searchEquipment(ITEMS, 'zzzzz')).toHaveLength(0);
  });
});

/* ═══════════════════ lookupBySerial ═══════════════════ */
describe('lookupBySerial', () => {
  it('finds existing item', () => {
    expect(lookupBySerial(ITEMS, 'HP-LJ-90214')).toHaveProperty('id', '1');
  });

  it('is case-insensitive', () => {
    expect(lookupBySerial(ITEMS, 'hp-lj-90214')).toHaveProperty('id', '1');
  });

  it('returns null when not found', () => {
    expect(lookupBySerial(ITEMS, 'NOPE')).toBeNull();
  });

  it('returns null for empty input', () => {
    expect(lookupBySerial(ITEMS, '')).toBeNull();
    expect(lookupBySerial(ITEMS, null)).toBeNull();
  });
});

/* ═══════════════════ removeEquipment ═══════════════════ */
describe('removeEquipment', () => {
  it('removes the item with given id', () => {
    const result = removeEquipment(ITEMS, '2');
    expect(result).toHaveLength(2);
    expect(result.find(i => i.id === '2')).toBeUndefined();
  });

  it('does nothing when id not found', () => {
    expect(removeEquipment(ITEMS, 'nope')).toHaveLength(3);
  });

  it('does not mutate original array', () => {
    const copy = [...ITEMS];
    removeEquipment(ITEMS, '1');
    expect(ITEMS).toEqual(copy);
  });
});
