// Currency and number formatting with comma thousand separators

export function formatCurrency(
  amount: number | string | null | undefined
): string {
  if (amount === null || amount === undefined || isNaN(Number(amount))) {
    return '0.00';
  }

  const num = Number(amount);

  return num.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// Cambodian Riel currency formatting
export function formatKHR(
  amount: number | string | null | undefined
): string {
  return `${formatCurrency(amount)} ៛`;
}

// Keep formatUSD only if some old pages still import it.
// It now displays Cambodian Riel instead of USD.
export function formatUSD(
  amount: number | string | null | undefined
): string {
  return formatKHR(amount);
}

// Date formatting
export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';

  try {
    const d = new Date(dateStr);

    if (isNaN(d.getTime())) return dateStr;

    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  } catch {
    return dateStr;
  }
}

export function formatDateTime(
  dateTimeStr: string | null | undefined
): string {
  if (!dateTimeStr) return '-';

  try {
    const d = new Date(dateTimeStr);

    if (isNaN(d.getTime())) return dateTimeStr;

    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');

    return `${year}-${month}-${day} ${hours}:${minutes}`;
  } catch {
    return dateTimeStr;
  }
}

// Khmer month names for reports
export const KHMER_MONTHS = [
  'មករា',
  'កុម្ភៈ',
  'មីនា',
  'មេសា',
  'ឧសភា',
  'មិថុនា',
  'កក្កដា',
  'សីហា',
  'កញ្ញា',
  'តុលា',
  'វិច្ឆិកា',
  'ធ្នូ',
];

export function formatKhmerDate(
  dateStr: string | null | undefined
): string {
  if (!dateStr) return '-';

  try {
    const d = new Date(dateStr);

    if (isNaN(d.getTime())) return dateStr;

    const day = d.getDate();
    const month = KHMER_MONTHS[d.getMonth()];
    const year = d.getFullYear();

    return `ថ្ងៃទី ${day} ខែ ${month} ឆ្នាំ ${year}`;
  } catch {
    return dateStr;
  }
}