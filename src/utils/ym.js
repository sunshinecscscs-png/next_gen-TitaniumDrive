const COUNTER_ID = 107696163;

export function reachGoal(name, params) {
  if (typeof window === 'undefined' || typeof window.ym !== 'function') return;
  try {
    if (params && typeof params === 'object') {
      window.ym(COUNTER_ID, 'reachGoal', name, params);
    } else {
      window.ym(COUNTER_ID, 'reachGoal', name);
    }
  } catch {
    /* metrika unavailable — silently ignore */
  }
}

export function hit(url, params) {
  if (typeof window === 'undefined' || typeof window.ym !== 'function') return;
  try {
    window.ym(COUNTER_ID, 'hit', url, params || {});
  } catch {
    /* metrika unavailable — silently ignore */
  }
}
