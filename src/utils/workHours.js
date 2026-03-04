/**
 * Проверяет, рабочее ли сейчас время по МСК (09:00–18:00)
 */
export function isMoscowWorkingHours() {
  const now = new Date();
  const mskHour = (now.getUTCHours() + 3) % 24;
  return mskHour >= 9 && mskHour < 18;
}
