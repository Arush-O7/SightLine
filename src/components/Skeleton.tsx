/**
 * Loading placeholders shaped like the content that is on its way, so the page
 * keeps its layout while it loads. Screen readers hear the label instead.
 */

export function BookingListSkeleton({ count = 2, label = 'Loading your tickets…' }: { count?: number; label?: string }) {
  return (
    <div className="booking-list" role="status" aria-label={label}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="card skeleton-item" aria-hidden="true">
          <span className="skeleton skeleton-poster" />
          <div className="skeleton-stack">
            <span className="skeleton skeleton-line" style={{ width: '42%', height: 16 }} />
            <span className="skeleton skeleton-line" style={{ width: '60%' }} />
            <span className="skeleton skeleton-line" style={{ width: '30%' }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function TicketSkeleton() {
  return (
    <div className="container ticket-page" role="status" aria-label="Loading your ticket…">
      <div className="skeleton-stack" aria-hidden="true" style={{ marginBottom: 28 }}>
        <span className="skeleton skeleton-line" style={{ width: 90 }} />
        <span className="skeleton skeleton-line" style={{ width: 220, height: 26 }} />
      </div>
      <span className="skeleton skeleton-ticket" aria-hidden="true" />
    </div>
  );
}

export function LinesSkeleton({ lines = 3, label }: { lines?: number; label: string }) {
  return (
    <div className="skeleton-stack" role="status" aria-label={label} style={{ width: '100%' }}>
      {Array.from({ length: lines }, (_, i) => (
        <span key={i} className="skeleton skeleton-line" aria-hidden="true" style={{ width: `${90 - i * 18}%`, height: 14 }} />
      ))}
    </div>
  );
}
