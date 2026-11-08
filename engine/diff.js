export function unifiedDiff(before, after, label = "arquivo") {
  const a = before.replace(/\r\n/g, "\n").split("\n");
  const b = after.replace(/\r\n/g, "\n").split("\n");
  let first = 0;
  while (first < a.length && first < b.length && a[first] === b[first]) first++;
  let ai = a.length - 1,
  bi = b.length - 1;
  while (ai >= first && bi >= first && a[ai] === b[bi]) {
    ai--;
    bi--;
  }
  const start = Math.max(0, first - 2),
  aEnd = Math.min(a.length - 1, ai + 2),
  bEnd = Math.min(b.length - 1, bi + 2);
  const out = [`--- ${label}`, `+++ ${label} (formatado)`, `@@ linha ${first + 1} @@`];
  for (let i = start; i < first; i++) out.push(` ${a[i]}`);
  for (let i = first; i <= ai; i++) out.push(`-${a[i]}`);
  for (let i = first; i <= bi; i++) out.push(`+${b[i]}`);
  const tail = Math.max(ai, bi) + 1;
  for (let i = tail; i <= Math.max(aEnd,
    bEnd); i++) if (a[i] === b[i] && a[i] !== undefined) out.push(` ${a[i]}`);
  return out.join("\n");
}
