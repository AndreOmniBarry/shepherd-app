// Shared date utilities — always use Lagos time (UTC+1)
// Use these instead of new Date() to avoid UTC timezone drift

export function lagosNow(): Date {
  return new Date(Date.now() + 60 * 60 * 1000);
}

export function lagosTodayStr(): string {
  return lagosNow().toISOString().split('T')[0];
}

export function lagosDateLabel(dateStr: string, opts?: Intl.DateTimeFormatOptions): string {
  const [yr, mo, dy] = dateStr.split('-').map(Number);
  return new Date(yr, mo - 1, dy).toLocaleDateString('en-GB', opts || {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });
}
