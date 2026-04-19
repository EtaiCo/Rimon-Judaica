const HEBREW_TO_LATIN: Record<string, string> = {
  א: "a", ב: "b", ג: "g", ד: "d", ה: "h", ו: "v",
  ז: "z", ח: "ch", ט: "t", י: "y", כ: "k", ך: "k",
  ל: "l", מ: "m", ם: "m", נ: "n", ן: "n", ס: "s",
  ע: "a", פ: "p", ף: "f", צ: "ts", ץ: "ts", ק: "k",
  ר: "r", ש: "sh", ת: "t",
};

const NIQQUD_RANGE = /[\u0591-\u05C7]/g;

export function toSlug(text: string): string {
  return text
    .replace(NIQQUD_RANGE, "")
    .split("")
    .map((ch) => HEBREW_TO_LATIN[ch] ?? ch)
    .join("")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
