/** Парсит номера коек из текста (строка или через запятую). */
export function parseBedNumbers(raw: string): string[] {
  return raw
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function normalizeBedNumbers(numbers: string[]): string[] {
  return numbers.map((n) => n.trim()).filter(Boolean);
}

/** Следующий номер после самого большого числового номера в отеле (койки и номера). */
export function nextFreeBedStart(taken: readonly string[]): number {
  let max = 0;
  for (const t of taken) {
    const n = Number(t.trim());
    if (Number.isInteger(n) && n > max) max = n;
  }
  return max + 1;
}

/** `count` подряд идущих номеров начиная со `start`, пропуская занятые. */
export function suggestBedNumbers(count: number, start: number, taken: readonly string[]): string[] {
  const busy = new Set(taken.map((t) => t.trim().toLowerCase()));
  const out: string[] = [];
  for (let n = Math.max(1, Math.floor(start)); out.length < count; n++) {
    const label = String(n);
    if (!busy.has(label)) out.push(label);
  }
  return out;
}

export function findDuplicateBedNumbers(numbers: string[]): string | null {
  const seen = new Set<string>();
  for (const n of numbers) {
    const key = n.toLowerCase();
    if (seen.has(key)) return n;
    seen.add(key);
  }
  return null;
}
