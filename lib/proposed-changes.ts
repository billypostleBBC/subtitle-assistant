type ProposedSegment = { text: string; changed: boolean };

const WORD = /^[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*$/u;

function tokenize(text: string) {
  return text.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*|[^\p{L}\p{N}]+/gu) ?? [];
}

export function changedProposedSegments(original: string, proposed: string): ProposedSegment[] {
  const before = tokenize(original);
  const after = tokenize(proposed);
  const table = Array.from({ length: before.length + 1 }, () => Array<number>(after.length + 1).fill(0));

  for (let beforeIndex = before.length - 1; beforeIndex >= 0; beforeIndex -= 1) {
    for (let afterIndex = after.length - 1; afterIndex >= 0; afterIndex -= 1) {
      table[beforeIndex][afterIndex] = before[beforeIndex] === after[afterIndex]
        ? table[beforeIndex + 1][afterIndex + 1] + 1
        : Math.max(table[beforeIndex + 1][afterIndex], table[beforeIndex][afterIndex + 1]);
    }
  }

  const unchanged = new Set<number>();
  let beforeIndex = 0;
  let afterIndex = 0;
  while (beforeIndex < before.length && afterIndex < after.length) {
    if (before[beforeIndex] === after[afterIndex]) {
      unchanged.add(afterIndex);
      beforeIndex += 1;
      afterIndex += 1;
    } else if (table[beforeIndex + 1][afterIndex] >= table[beforeIndex][afterIndex + 1]) {
      beforeIndex += 1;
    } else {
      afterIndex += 1;
    }
  }

  return after.map((text, index) => ({ text, changed: WORD.test(text) && !unchanged.has(index) }));
}
