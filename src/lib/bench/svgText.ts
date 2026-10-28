export function wrapCaption(
  text: string,
  maxChars = 50,
  maxLines = 2,
): string[] {
  const width = Math.max(1, Math.floor(maxChars));
  const lineLimit = Math.max(1, Math.floor(maxLines));
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [""];

  const wrapped: string[] = [];
  let line = "";
  for (let word of words) {
    while (word.length > width) {
      if (line) {
        wrapped.push(line);
        line = "";
      }
      wrapped.push(word.slice(0, width));
      word = word.slice(width);
    }
    if (!word) continue;
    const next = line ? `${line} ${word}` : word;
    if (next.length <= width) {
      line = next;
    } else {
      wrapped.push(line);
      line = word;
    }
  }
  if (line) wrapped.push(line);

  const truncated = wrapped.length > lineLimit;
  const lines = wrapped.slice(0, lineLimit);
  if (truncated) {
    let last = lines[lineLimit - 1];
    while (`${last}…`.length > width && last.includes(" ")) {
      last = last.replace(/\s+\S+$/, "");
    }
    if (`${last}…`.length > width) last = last.slice(0, width - 1);
    lines[lineLimit - 1] = `${last.trimEnd()}…`;
  }
  return lines;
}
