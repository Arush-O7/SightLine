import { useEffect, useState, type FormEvent } from 'react';
import { RATING_COMMENT_MAX, RATING_WORDS } from '../data/contact';
import { api, errorMessage, type SeatRating as Saved } from '../lib/api';

/** One question after booking: how easy choosing the seat was, 1 to 5, with an optional comment. */
export default function SeatRating({ bookingId }: { bookingId: string }) {
  // undefined while loading, null when this booking has no rating yet
  const [saved, setSaved] = useState<Saved | null | undefined>(undefined);
  const [value, setValue] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    api.rating(bookingId).then(
      (r) => {
        if (!live) return;
        setSaved(r);
        setValue(r?.rating ?? null);
        setComment(r?.comment ?? '');
      },
      () => live && setSaved(null),
    );
    return () => {
      live = false;
    };
  }, [bookingId]);

  if (saved === undefined) return null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!value) return;
    setBusy(true);
    setFailure(null);
    try {
      setSaved(await api.rate(bookingId, value, comment.trim()));
      setEditing(false);
    } catch (err) {
      setFailure(errorMessage(err));
    }
    setBusy(false);
  };

  const keep = () => {
    setEditing(false);
    setValue(saved?.rating ?? null);
    setComment(saved?.comment ?? '');
    setFailure(null);
  };

  if (saved && !editing) {
    return (
      <section className="card seat-rating" aria-labelledby="rating-title">
        <div className="seat-rating-done">
          <div>
            <h2 id="rating-title">Thanks for Your Rating</h2>
            <p className="muted">
              You rated choosing your seat {saved.rating} out of 5, {RATING_WORDS[saved.rating - 1].toLowerCase()}.
            </p>
          </div>
          <button type="button" className="btn btn-text btn-sm" onClick={() => setEditing(true)}>
            Change Rating
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="card seat-rating" aria-labelledby="rating-title">
      <form onSubmit={submit}>
        <h2 id="rating-title">How Easy Was Choosing Your Seat?</h2>
        <p className="muted small">Only the SightLine team sees your answer. It tells us whether the seat view is doing its job.</p>
        <div className="rating-scale" role="radiogroup" aria-labelledby="rating-title">
          {RATING_WORDS.map((word, i) => (
            <label key={word} className={`rating-option ${value === i + 1 ? 'on' : ''}`}>
              <input type="radio" name="seat-rating" value={i + 1} checked={value === i + 1} onChange={() => setValue(i + 1)} />
              <b>{i + 1}</b>
              <small>{word}</small>
            </label>
          ))}
        </div>
        {value ? (
          <label className="field">
            <span>Anything to add? (optional)</span>
            <textarea name="rating-comment" rows={3} maxLength={RATING_COMMENT_MAX} value={comment} onChange={(e) => setComment(e.target.value)} />
          </label>
        ) : null}
        {failure ? (
          <p className="form-error" role="alert">
            {failure}
          </p>
        ) : null}
        <div className="seat-rating-actions">
          <button type="submit" className="btn btn-primary" disabled={!value || busy}>
            {busy ? 'Sending…' : 'Send Rating'}
          </button>
          {editing ? (
            <button type="button" className="btn btn-text" onClick={keep}>
              Keep Rating
            </button>
          ) : null}
        </div>
      </form>
    </section>
  );
}
