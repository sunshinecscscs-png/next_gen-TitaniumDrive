/**
 * Форматирование номера телефона:
 *   РФ:      +7 (XXX) XXX-XX-XX      (11 цифр, начинается с 7)
 *   Беларусь: +375 (XX) XXX-XX-XX     (12 цифр, начинается с 375)
 */
export function formatPhone(value) {
  const digits = value.replace(/\D/g, '');
  if (digits.length === 0) return '';

  // Беларусь: 375...
  if (digits.startsWith('375')) {
    let result = '+375';
    if (digits.length > 3) result += ' (' + digits.slice(3, 5);
    if (digits.length >= 5) result += ')';
    if (digits.length > 5) result += ' ' + digits.slice(5, 8);
    if (digits.length > 8) result += '-' + digits.slice(8, 10);
    if (digits.length > 10) result += '-' + digits.slice(10, 12);
    return result;
  }

  // Россия: 7...
  let result = '+7';
  if (digits.length > 1) result += ' (' + digits.slice(1, 4);
  if (digits.length >= 4) result += ')';
  if (digits.length > 4) result += ' ' + digits.slice(4, 7);
  if (digits.length > 7) result += '-' + digits.slice(7, 9);
  if (digits.length > 9) result += '-' + digits.slice(9, 11);
  return result;
}

/** Максимальная длина номера в цифрах */
export function phoneMaxDigits(digits) {
  return digits.startsWith('375') ? 12 : 11;
}

/** Проверка что номер полный (RU или BY) */
export function isPhoneComplete(value) {
  const digits = value.replace(/\D/g, '');
  if (digits.startsWith('375')) return digits.length === 12;
  return digits.length === 11;
}

/**
 * onChange-обработчик для инпута телефона.
 * Поддерживает +7 (РФ) и +375 (Беларусь).
 * Использование: onChange={handlePhoneInput(setPhone)}
 */
export function handlePhoneInput(setter) {
  return (e) => {
    let raw = e.target.value.replace(/\D/g, '');
    if (raw.startsWith('375')) {
      if (raw.length <= 12) setter(formatPhone(raw));
    } else {
      if (!raw.startsWith('7')) raw = '7' + raw;
      if (raw.length <= 11) setter(formatPhone(raw));
    }
  };
}
