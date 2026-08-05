/**
 * Tiny build marker in the corner of every page - lets a worker or dev
 * confirm they're looking at the deploy they think they are, by comparing
 * the commit shown here against a known commit hash.
 */
export default function VersionBadge() {
  return (
    <span className="pointer-events-none fixed bottom-1 right-1 z-50 rounded bg-slate-900/70 px-2 py-0.5 font-mono text-[10px] text-white/70">
      v{__APP_VERSION__}
    </span>
  );
}
