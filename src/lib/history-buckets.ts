// Calendar-accurate bucket boundaries for week/month/year history views.
// Month/year used to be approximated as 30*86400000ms / 365*86400000ms,
// which drifts against real calendar months/years the further back you
// page — a "By Month" pager could show non-sequential months (e.g. May
// then August) once the drift accumulated. This computes real calendar
// month/year boundaries instead, so there's no drift no matter how many
// buckets or how far back you go. Weeks are exact multiples of a day, so
// millisecond math there is already exact.
export type Granularity = 'week' | 'month' | 'year';

export function bucketBounds(granularity: Granularity, offset: number, count: number, now: Date = new Date()): { start: Date; end: Date; label: string }[] {
  const bounds: { start: Date; end: Date; label: string }[] = [];

  if (granularity === 'week') {
    const periodMs = 7 * 86400000;
    for (let i = 0; i < count; i++) {
      const stepsBack = offset * count + (count - 1 - i);
      const end = new Date(now.getTime() - stepsBack * periodMs);
      const start = new Date(end.getTime() - periodMs);
      bounds.push({ start, end, label: start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) });
    }
    return bounds;
  }

  if (granularity === 'month') {
    const anchor = now.getFullYear() * 12 + now.getMonth();
    for (let i = 0; i < count; i++) {
      const absMonth = anchor - offset * count - (count - 1 - i);
      const y = Math.floor(absMonth / 12);
      const m = ((absMonth % 12) + 12) % 12;
      const start = new Date(y, m, 1);
      const end = new Date(y, m + 1, 1);
      bounds.push({ start, end, label: start.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }) });
    }
    return bounds;
  }

  // year
  const anchorYear = now.getFullYear();
  for (let i = 0; i < count; i++) {
    const y = anchorYear - offset * count - (count - 1 - i);
    const start = new Date(y, 0, 1);
    const end = new Date(y + 1, 0, 1);
    bounds.push({ start, end, label: String(y) });
  }
  return bounds;
}
