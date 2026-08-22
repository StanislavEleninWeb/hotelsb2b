// Portable, dependency-free helpers. NO DOM sanitizer here — this package is
// consumed by NestJS (CJS), Next (ESM), and React Native, where a jsdom/DOMPurify
// dependency is the wrong shape. The rule (CLAUDE.md section 5.2) is: never render
// guest-provided text with dangerouslySetInnerHTML. React's default escaping is
// the sanitizer; this only normalizes whitespace/control characters.

// Strip C0 control characters except tab (\x09) and newline (\x0A).
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\x00-\x08\x0B\x0C\x0E-\x1F]/g;

export function normalizeText(input: string): string {
  return input
    .replace(/\r\n?/g, "\n")
    .replace(CONTROL_CHARS, "")
    .replace(/[ \t]+/g, " ")
    .trim();
}

// Format an integer minor-unit amount + ISO currency for display.
export function formatMoney(amountMinor: number, currency: string, locale = "en"): string {
  const fmt = new Intl.NumberFormat(locale, { style: "currency", currency });
  const exponent = fmt.resolvedOptions().maximumFractionDigits ?? 2;
  return fmt.format(amountMinor / 10 ** exponent);
}
