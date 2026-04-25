// equipmentService.js
// Pure business logic for equipment registration — separated for testability.

/**
 * Validates registration form data.
 * @param {object} form - { name, serial, notes, category, location }
 * @param {array} existingItems - current inventory
 * @returns {object} errors - empty object means valid
 */
export function validateRegistration(form, existingItems = []) {
  const errors = {};
  if (!form.name || !form.name.trim()) errors.name = 'Required';
  if (!form.serial || !form.serial.trim()) {
    errors.serial = 'Required';
  } else if (
    existingItems.some(
      (i) => i.serial.toLowerCase() === form.serial.trim().toLowerCase()
    )
  ) {
    errors.serial = 'Serial already registered';
  }
  return errors;
}

/**
 * Creates a new equipment item from valid form data.
 * @param {object} form - validated form data
 * @returns {object} new equipment item
 */
export function createEquipmentItem(form) {
  return {
    id: Math.random().toString(36).slice(2, 12),
    name: form.name.trim(),
    serial: form.serial.trim(),
    category: form.category || 'Other',
    location: form.location || 'Room 101',
    notes: (form.notes || '').trim(),
    status: 'Available',
    registeredAt: new Date().toLocaleString(),
  };
}

/**
 * Searches inventory by query string across name, serial, location, category.
 * @param {array} items
 * @param {string} query
 * @returns {array} filtered items
 */
export function searchEquipment(items, query) {
  if (!query || !query.trim()) return items;
  const q = query.toLowerCase();
  return items.filter((i) =>
    `${i.name} ${i.serial} ${i.location} ${i.category}`
      .toLowerCase()
      .includes(q)
  );
}

/**
 * Looks up an item by serial number (case-insensitive).
 * @param {array} items
 * @param {string} serial
 * @returns {object|null}
 */
export function lookupBySerial(items, serial) {
  if (!serial || !serial.trim()) return null;
  return (
    items.find(
      (i) => i.serial.toLowerCase() === serial.trim().toLowerCase()
    ) || null
  );
}

/**
 * Removes an item by id.
 * @param {array} items
 * @param {string} id
 * @returns {array} new array without the item
 */
export function removeEquipment(items, id) {
  return items.filter((i) => i.id !== id);
}
