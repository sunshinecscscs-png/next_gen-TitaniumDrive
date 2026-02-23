const STORAGE_KEY = 'autosite_viewed_cars';
const MAX_VIEWED = 50;

/**
 * Get viewed car IDs (most recent first)
 * @returns {number[]}
 */
export function getViewedCarIds() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Add a car ID to the viewed list
 * @param {number} carId
 */
export function addViewedCar(carId) {
  const id = Number(carId);
  if (!id) return;
  const ids = getViewedCarIds().filter(x => x !== id);
  ids.unshift(id); // most recent first
  if (ids.length > MAX_VIEWED) ids.length = MAX_VIEWED;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
}

/**
 * Remove a car ID from the viewed list
 * @param {number} carId
 */
export function removeViewedCar(carId) {
  const id = Number(carId);
  const ids = getViewedCarIds().filter(x => x !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
}

/**
 * Clear all viewed cars
 */
export function clearViewedCars() {
  localStorage.removeItem(STORAGE_KEY);
}
