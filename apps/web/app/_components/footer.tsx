// Static Modernist footer — the phone lines and legal row from the design.
export function Footer() {
  return (
    <footer
      className="pad"
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 28,
        alignItems: "center",
        padding: "28px var(--pad-x)",
        borderTop: "2px solid var(--color-divider)",
        fontSize: 12,
        color: "color-mix(in srgb, var(--color-text) 72%, transparent)",
      }}
    >
      <span style={{ fontFamily: "var(--font-heading)", fontWeight: 800, color: "var(--color-text)", marginRight: "auto" }}>
        HARBOR&nbsp;STAYS
      </span>
      <span>Lisbon +351 21 000 0000</span>
      <span>Innsbruck +43 512 000 000</span>
      <span>Privacy</span>
      <span>Terms</span>
    </footer>
  );
}
