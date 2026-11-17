import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ChevronRight, CreditCard, FlaskConical, Smartphone, Store, Timer } from 'lucide-react';
import { Poster } from '../components/Art';
import NotFound from './NotFound';
import { BOOKING_FEE, formatDate, formatTime, getMovie, money, parseShow, venueOf } from '../data/movies';
import { getLayout, type Seat } from '../lib/hall';
import { api, ApiFailure, errorMessage, type Hold, type PaymentInput } from '../lib/api';
import { sortSeatIds, useStore } from '../lib/store';
import { useTitle } from '../lib/useTitle';

type Method = PaymentInput['method'];

const METHODS: { id: Method; label: string; note: string; icon: typeof Smartphone }[] = [
  { id: 'upi', label: 'UPI', note: 'Any UPI app', icon: Smartphone },
  { id: 'card', label: 'Card', note: 'Credit or debit', icon: CreditCard },
  { id: 'counter', label: 'Pay at the Cinema', note: 'At the box office', icon: Store },
];

const UPI = /^[a-z0-9._-]{2,64}@[a-z][a-z0-9]{1,31}$/i;
const groupCard = (v: string) => v.replace(/\D/g, '').slice(0, 19).replace(/(.{4})/g, '$1 ').trim();
const shapeExpiry = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function CheckoutPage() {
  useTitle('Payment');
  const { showId } = useParams();
  const show = useMemo(() => parseShow(showId), [showId]);
  const navigate = useNavigate();
  const user = useStore((s) => s.user)!;
  const selectedIds = useStore((s) => (showId ? s.selections[showId] : undefined));
  const snapshot = useStore((s) => (showId ? s.snapshots[showId] : undefined));
  const addBooking = useStore((s) => s.addBooking);
  const clearSelection = useStore((s) => s.clearSelection);
  const setSnapshot = useStore((s) => s.setSnapshot);

  const [method, setMethod] = useState<Method>('upi');
  const [upiId, setUpiId] = useState('');
  const [card, setCard] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');
  const [touched, setTouched] = useState(false);
  const [hold, setHold] = useState<Hold | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [lost, setLost] = useState<string | null>(null);
  const done = useRef(false);
  const sending = useRef(false);
  const upiRef = useRef<HTMLInputElement>(null);
  const cardRef = useRef<HTMLInputElement>(null);
  const expiryRef = useRef<HTMLInputElement>(null);
  const cvvRef = useRef<HTMLInputElement>(null);
  // one key per visit to this page: a double click or a retry can never create two bookings
  const idemKey = useRef(crypto.randomUUID());

  // make sure the seats are held for this account (covers a refresh or arriving by link)
  useEffect(() => {
    if (!show || !selectedIds?.length) return;
    let cancelled = false;
    api
      .hold(show.id, selectedIds)
      .then((h) => !cancelled && setHold(h))
      .catch((err) => !cancelled && setLost(errorMessage(err)));
    return () => {
      cancelled = true;
    };
    // the selection is fixed while this page is open
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show?.id]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  if (!show) return <NotFound title="That Showtime Doesn’t Exist" />;
  const movie = getMovie(show.movieId)!;
  const layout = getLayout(show.hallId);
  const hall = layout.config;

  if (done.current) return null;
  if (!selectedIds?.length) return <Navigate to={`/book/${show.id}`} replace />;

  const seats = sortSeatIds(selectedIds)
    .map((id) => layout.byId.get(id))
    .filter((s): s is Seat => !!s);
  const subtotal = seats.reduce((sum, s) => sum + s.zone.price, 0);
  const fees = seats.length * BOOKING_FEE;
  const total = subtotal + fees;

  const left = hold ? Math.max(0, Math.ceil((hold.expiresAt - now) / 1000)) : null;
  const expired = left === 0;

  if (lost || expired) {
    return (
      <div className="container empty-state" role="alert">
        <h1>{expired ? 'Your Hold Ran Out' : 'Those Seats Are Gone'}</h1>
        <p className="muted">{expired ? 'The seats were released after 7 minutes. Choose them again to continue.' : lost}</p>
        <Link className="btn btn-primary" to={`/book/${show.id}`}>
          Choose Seats Again
        </Link>
      </div>
    );
  }

  const digits = card.replace(/\D/g, '');
  const upiOk = UPI.test(upiId.trim());
  const cardOk = digits.length >= 13;
  const expiryOk = /^\d{2}\/\d{2}$/.test(expiry);
  const cvvOk = /^\d{3,4}$/.test(cvv);

  const fillTest = () => {
    setFailure(null);
    if (method === 'upi') setUpiId('demo@okbank');
    if (method === 'card') {
      setCard('4111 1111 1111 1111');
      setExpiry('12/34');
      setCvv('123');
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    setFailure(null);
    // a ref, not state: two clicks in the same frame must not both get through
    if (sending.current || !hold) return;

    let payment: PaymentInput;
    if (method === 'upi') {
      if (!upiOk) return upiRef.current?.focus();
      payment = { method, upiId: upiId.trim() };
    } else if (method === 'card') {
      if (!cardOk) return cardRef.current?.focus();
      if (!expiryOk) return expiryRef.current?.focus();
      if (!cvvOk) return cvvRef.current?.focus();
      payment = { method, number: digits, expiry, cvv };
    } else {
      payment = { method: 'counter' };
    }

    sending.current = true;
    setBusy(true);
    try {
      // hold the "processing" state long enough to read, as a real gateway round-trip would,
      // whether the payment is approved or declined
      const [result] = await Promise.allSettled([
        api.createBooking({
          showId: show.id,
          seats: seats.map((s) => s.id),
          payment,
          viewSeat: snapshot?.seat ?? null,
          snapshot: snapshot?.url ?? null,
          idempotencyKey: idemKey.current,
        }),
        sleep(method === 'counter' ? 0 : 1100),
      ]);
      if (result.status === 'rejected') throw result.reason;
      const booking = result.value;
      done.current = true;
      addBooking(booking);
      clearSelection(show.id);
      setSnapshot(show.id, null);
      navigate(`/ticket/${booking.id}`, { replace: true, state: { fresh: true } });
    } catch (err) {
      sending.current = false;
      setBusy(false);
      if (err instanceof ApiFailure && (err.code === 'seats_taken' || err.code === 'hold_expired' || err.code === 'show_started')) {
        setLost(err.message);
      } else {
        setFailure(errorMessage(err));
      }
    }
  };

  const mm = left === null ? '--' : String(Math.floor(left / 60)).padStart(2, '0');
  const ss = left === null ? '--' : String(left % 60).padStart(2, '0');
  const cta = busy
    ? method === 'counter'
      ? 'Confirming…'
      : 'Processing Payment…'
    : !hold
      ? 'Holding Your Seats…'
      : method === 'counter'
        ? 'Confirm Booking'
        : `Pay ${money(total)}`;

  return (
    <div className="container checkout">
      <div className="checkout-top">
        <Link to={`/book/${show.id}`} className="back-link">
          <ArrowLeft size={16} /> Change Seats
        </Link>
        <ol className="steps" aria-label="Booking progress">
          <li className="done">Seats</li>
          <ChevronRight size={14} />
          <li className="on">Payment</li>
          <ChevronRight size={14} />
          <li>Ticket</li>
        </ol>
        <span className={`hold ${left !== null && left < 60 ? 'low' : ''}`} role="timer" aria-live="off">
          <Timer size={15} /> Seats held for {mm}:{ss}
        </span>
      </div>

      <div className="checkout-grid">
        <form className="card checkout-form" onSubmit={submit} noValidate>
          <h1>Review and Pay</h1>
          <p className="muted">
            Booking as <b className="strong">{user.name}</b> · {user.email}
          </p>

          <h2>Payment Method</h2>
          <div className="methods" role="radiogroup" aria-label="Payment method">
            {METHODS.map((m) => (
              <label key={m.id} className={`method ${method === m.id ? 'on' : ''}`}>
                <input
                  type="radio"
                  name="method"
                  value={m.id}
                  checked={method === m.id}
                  disabled={busy}
                  onChange={() => {
                    setMethod(m.id);
                    setTouched(false);
                    setFailure(null);
                  }}
                />
                <m.icon size={20} />
                <b>{m.label}</b>
                <small>{m.note}</small>
              </label>
            ))}
          </div>

          <div className="pay-fields">
            {method === 'upi' ? (
              <label className={`field ${touched && !upiOk ? 'bad' : ''}`}>
                <span>UPI ID</span>
                <input
                  ref={upiRef}
                  name="upi"
                  value={upiId}
                  onChange={(e) => setUpiId(e.target.value)}
                  placeholder="name@bank…"
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  inputMode="email"
                  disabled={busy}
                  aria-invalid={touched && !upiOk}
                />
                {touched && !upiOk ? <em role="alert">Enter a UPI ID like name@bank.</em> : null}
              </label>
            ) : null}

            {method === 'card' ? (
              <div className="card-fields">
                <label className={`field wide ${touched && !cardOk ? 'bad' : ''}`}>
                  <span>Card number</span>
                  <input
                    ref={cardRef}
                    name="cardnumber"
                    value={card}
                    onChange={(e) => setCard(groupCard(e.target.value))}
                    placeholder="1234 5678 9012 3456…"
                    autoComplete="cc-number"
                    inputMode="numeric"
                    disabled={busy}
                    aria-invalid={touched && !cardOk}
                  />
                  {touched && !cardOk ? <em role="alert">Enter the full card number.</em> : null}
                </label>
                <label className={`field ${touched && !expiryOk ? 'bad' : ''}`}>
                  <span>Expiry</span>
                  <input
                    ref={expiryRef}
                    name="cc-exp"
                    value={expiry}
                    onChange={(e) => setExpiry(shapeExpiry(e.target.value))}
                    placeholder="MM/YY…"
                    autoComplete="cc-exp"
                    inputMode="numeric"
                    disabled={busy}
                    aria-invalid={touched && !expiryOk}
                  />
                  {touched && !expiryOk ? <em role="alert">Use MM/YY.</em> : null}
                </label>
                <label className={`field ${touched && !cvvOk ? 'bad' : ''}`}>
                  <span>Security code</span>
                  <input
                    ref={cvvRef}
                    name="cvc"
                    type="password"
                    value={cvv}
                    onChange={(e) => setCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    placeholder="CVV…"
                    autoComplete="cc-csc"
                    inputMode="numeric"
                    disabled={busy}
                    aria-invalid={touched && !cvvOk}
                  />
                  {touched && !cvvOk ? <em role="alert">3 or 4 digits.</em> : null}
                </label>
              </div>
            ) : null}

            {method === 'counter' ? (
              <p className="muted">Nothing to pay now. Pay {money(total)} at the box office when you arrive and show your ticket code.</p>
            ) : null}
          </div>

          {method !== 'counter' ? (
            <div className="test-mode">
              <FlaskConical size={16} />
              <div>
                <b>Test mode</b>
                <p>
                  No money moves.{' '}
                  {method === 'upi'
                    ? 'Any ID like name@bank is approved; an ID starting with “fail” is declined.'
                    : 'Card 4111 1111 1111 1111 is approved; 4000 0000 0000 0002 is declined. Use any future expiry and any 3 digits.'}
                </p>
              </div>
              <button type="button" className="btn btn-secondary" onClick={fillTest} disabled={busy}>
                Fill Test Details
              </button>
            </div>
          ) : null}

          {failure ? (
            <p className="form-error" role="alert">
              {failure}
            </p>
          ) : null}

          <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={busy || !hold}>
            {busy ? <span className="spinner" aria-hidden="true" /> : null}
            {cta}
          </button>
        </form>

        <aside className="card order">
          <div className="order-head">
            <Poster movie={movie} eager />
            <div>
              <span className="badge">{hall.badge}</span>
              <h2>{movie.title}</h2>
              <p className="muted small">
                {formatDate(show.start)} · {formatTime(show.start)}
                <br />
                {venueOf(show)?.cinema.name}, {venueOf(show)?.cinema.area}
                <br />
                {venueOf(show)?.screen.name} · {hall.format}
              </p>
            </div>
          </div>
          {snapshot ? (
            <figure className="order-view">
              <img src={snapshot.url} width={720} height={405} alt={`View of the screen from seat ${snapshot.seat}`} />
              <figcaption>Your view from seat {snapshot.seat}</figcaption>
            </figure>
          ) : null}
          <ul className="order-lines">
            {seats.map((s) => (
              <li key={s.id}>
                <span>
                  Seat <b>{s.id}</b> <em>{s.zone.name}</em>
                </span>
                <span>{money(s.zone.price)}</span>
              </li>
            ))}
            <li className="fee">
              <span>Convenience fee × {seats.length}</span>
              <span>{money(fees)}</span>
            </li>
          </ul>
          <div className="order-total">
            <span>Total</span>
            <b>{money(total)}</b>
          </div>
          <p className="order-note">Prices include GST. Seats are released if the hold runs out.</p>
        </aside>
      </div>
    </div>
  );
}
