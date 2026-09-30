/**
 * The Midnight Glass background: deep navy with bright violet, cyan and pink
 * light. Rendered once behind every page; pages keep their own backgrounds
 * transparent (or frosted) so it shows through.
 */
export function MidnightBackdrop() {
  return (
    <div aria-hidden className="mg-backdrop">
      <div className="mg-blob mg-blob-violet" />
      <div className="mg-blob mg-blob-cyan" />
      <div className="mg-blob mg-blob-pink" />
    </div>
  );
}
