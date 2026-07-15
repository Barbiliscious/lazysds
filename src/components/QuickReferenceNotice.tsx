/**
 * The mandatory notice from the standard. Shown above the register and on
 * the approval/detail screen - every surface that displays extracted values.
 */
export default function QuickReferenceNotice({ className = "" }: { className?: string }) {
  return (
    <div
      role="note"
      className={`rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 ${className}`}
    >
      <p className="font-bold">QUICK REFERENCE ONLY</p>
      <p className="mt-1">
        This summary does not replace the manufacturer's Safety Data Sheet or a workplace risk assessment. Open the
        linked SDS for complete instructions. If any information differs, follow the source SDS and report the
        discrepancy for review.
      </p>
    </div>
  );
}
