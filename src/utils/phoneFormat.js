/**
 * Форматирование российского номера телефона: +7 (XXX) XXX-XX-XX
 */
export function formatPhone(value) {
  const digits = value.replace(/\D/g, '');
  if (digits.length === 0) return '';
  let result = '+7';
  if (digits.length > 1) result += ' (' + digits.slice(1, 4);
  if (digits.length >= 4) result += ')';
  if (digits.length > 4) result += ' ' + digits.slice(4, 7);
  if (digits.length > 7) result += '-' + digits.slice(7, 9);
  if (digits.length > 9) result += '-' + digits.slice(9, 11);
  return result;
}

/**
 * onChange-обработчик для инпута телефона.
 * Использование: onChange={handlePhoneInput(setPhone)}
 */
export function handlePhoneInput(setter) {
  return (e) => {
    let raw = e.target.value.replace(/\D/g, '');
    if (!raw.startsWith('7')) raw = '7' + raw;
    if (raw.length <= 11) {
      setter(formatPhone(raw));
    }
  };
}
