import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { ArrowLeft, CalendarPlus, CheckCircle2, Navigation, Printer } from 'lucide-react';
import { Poster } from '../components/Art';
import NotFound from './NotFound';
import { directionsUrl } from '../data/cinemas';
import { formatDate, formatRuntime, formatTime, getMovie, isLive, money, parseShow, type Movie, type Show, venueOf } from '../data/movies';
import { getHall, type HallConfig } from '../lib/hall';
import { api, errorMessage, type Booking } from '../lib/api';
import { sortSeatIds, useStore } from '../lib/store';
import { TIME_ZONE } from '../lib/time';
import { useTitle } from '../lib/useTitle';
import { TicketSkeleton } from '../components/Skeleton';
import SeatRating from '../components/SeatRating';

function downloadCalendar(booking: Booking, movie: Movie, show: Show, hall: HallConfig) {
  const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  // commas, semicolons and backslashes are separators in calendar text
  const text = (s: string) => s.replace(/[\\;,]/g, (c) => `\\${c}`);
  const venue = venueOf(show);
  const end = new Date(show.start.getTime() + movie.runtime * 60000);
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//SightLine//Booking//EN',
    'BEGIN:VEVENT',
    `UID:${booking.id}@sightline`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(show.start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${text(movie.title)} — SightLine`,
    `LOCATION:${text(`${venue?.cinema.name ?? 'Cinema'} (${venue?.screen.name ?? hall.format}), ${venue?.cinema.area ?? ''}, Delhi`)}`,
    `DESCRIPTION:Booking ${booking.id}\\nSeats: ${text(sortSeatIds(booking.seats).join(', '))}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
  const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `${movie.id}-${booking.id}.ics`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const paise = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Indian prices include GST. Cinema tickets above ₹100 and the convenience fee are taxed at 18% (9% CGST + 9% SGST). */
const GST_RATE = 0.18;
const gstIn = (inclusive: number) => inclusive - inclusive / (1 + GST_RATE);

function PriceBreakdown({ booking }: { booking: Booking }) {
  const n = booking.seats.length;
  const ticketTax = gstIn(booking.subtotal);
  const feeTax = gstIn(booking.fees);
  return (
    <section className="card price-breakdown" aria-labelledby="price-heading">
      <h2 id="price-heading">Price Breakdown</h2>
      <dl>
        <div>
          <dt>
            {n} {n === 1 ? 'ticket' : 'tickets'}
          </dt>
          <dd>{money(booking.subtotal)}</dd>
        </div>
        <div className="sub">
          <dt>Includes GST at 18% (CGST {paise.format(ticketTax / 2)} + SGST {paise.format(ticketTax / 2)})</dt>
          <dd>{paise.format(ticketTax)}</dd>
        </div>
        <div>
          <dt>Convenience fee</dt>
          <dd>{money(booking.fees)}</dd>
        </div>
        <div className="sub">
          <dt>Includes GST at 18%</dt>
          <dd>{paise.format(feeTax)}</dd>
        </div>
        <div className="total">
          <dt>{booking.paymentStatus === 'due' ? 'To pay at the cinema' : 'Total paid'}</dt>
          <dd>{money(booking.total)}</dd>
        </div>
      </dl>
      <p className="muted small">
        Booked {new Date(booking.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short', timeZone: TIME_ZONE })} · Booking {booking.id}
        {booking.paymentRef && booking.paymentStatus === 'paid' ? ` · Payment ${booking.paymentRef}` : ''}
      </p>
    </section>
  );
}

export default function TicketPage() {
  const { bookingId } = useParams();
  // the "you're booked" welcome is for the moment of booking; later visits show the ticket plainly
  const fresh = !!(useLocation().state as { fresh?: boolean } | null)?.fresh;
  const user = useStore((s) => s.user)!;
  const config = useStore((s) => s.config);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  useTitle(booking ? `Ticket ${booking.id}` : 'Ticket');

  useEffect(() => {
    if (!bookingId) return;
    let cancelled = false;
    setBooking(null);
    setFailure(null);
    api
      .booking(bookingId)
      .then((b) => !cancelled && setBooking(b))
      .catch((err) => !cancelled && setFailure(errorMessage(err)));
    return () => {
      cancelled = true;
    };
  }, [bookingId]);

  if (failure) return <NotFound title="We Couldn’t Find That Ticket" />;
  if (!booking) {
    return <TicketSkeleton />;
  }
  const movie = getMovie(booking.movieId);
  const show = parseShow(booking.showId);
  if (!movie || !show) return <NotFound title="We Couldn’t Find That Ticket" />;
  const hall = getHall(booking.hallId);
  const venue = venueOf(show);
  const seats = sortSeatIds(booking.seats);
  const started = show.start.getTime() < Date.now();

  return (
    <div className="container ticket-page">
      {fresh ? (
      <div className="ticket-banner">
        <CheckCircle2 size={28} />
        <div>
          <h1>You’re Booked, {user.name.split(' ')[0]}.</h1>
          <p className="muted">
            Show this code at the door. It is saved to your account under <Link to="/bookings">My Tickets</Link>, and a confirmation
            was emailed to {user.email}
            {config?.demo ? (
              <>
                {' '}
                (see it in the <Link to="/demo/inbox">Demo Inbox</Link>)
              </>
            ) : null}
            .
          </p>
        </div>
      </div>
      ) : (
        <div className="ticket-head">
          <Link to="/bookings" className="back-link">
            <ArrowLeft size={16} /> My tickets
          </Link>
          <h1>Your Ticket</h1>
          <p className="muted">
            {started
              ? 'This show has started.'
              : `${formatDate(show.start)} at ${formatTime(show.start)}. Show the QR code at the door.`}
          </p>
        </div>
      )}

      <article className="ticket">
        <div className="ticket-main">
          <Poster movie={movie} eager />
          <div className="ticket-info">
            <span className="badge">{hall.badge}</span>
            <h2>{movie.title}</h2>
            <p className="muted small">
              {movie.language} · {movie.genres.join(', ')} · {formatRuntime(movie.runtime)}
              {movie.cert ? ` · ${movie.cert}` : ''}
            </p>
            <dl className="ticket-grid">
              <div>
                <dt>Date</dt>
                <dd>{formatDate(show.start)}</dd>
              </div>
              <div>
                <dt>Time</dt>
                <dd>{formatTime(show.start)}</dd>
              </div>
              <div className="wide">
                <dt>Cinema</dt>
                <dd>
                  {venue?.cinema.name}, {venue?.cinema.area} · {venue?.screen.name} ({hall.format})
                  {venue ? (
                    <a className="ticket-directions" href={directionsUrl(venue.cinema)} target="_blank" rel="noopener noreferrer">
                      <Navigation size={14} /> Get directions
                    </a>
                  ) : null}
                </dd>
              </div>
              <div>
                <dt>{booking.paymentStatus === 'due' ? 'To Pay' : 'Paid'}</dt>
                <dd>{money(booking.total)}</dd>
              </div>
              <div className="wide">
                <dt>Payment</dt>
                <dd className="ticket-pay">
                  {booking.paymentStatus === 'due' ? 'Pay at the box office' : (booking.instrument ?? 'Paid')}
                </dd>
              </div>
              <div className="wide">
                <dt>{seats.length === 1 ? 'Seat' : 'Seats'}</dt>
                <dd className="ticket-seats">
                  {seats.map((s) => (
                    <span key={s}>{s}</span>
                  ))}
                </dd>
              </div>
            </dl>
          </div>
        </div>
        <div className="ticket-stub">
          <div className="qr">
            <QRCodeSVG value={`SIGHTLINE|${booking.id}|${booking.showId}|${seats.join(',')}`} size={132} bgColor="#ffffff" fgColor="#0b0a10" level="M" />
          </div>
          <span className="muted small">Booking reference</span>
          <b className="ticket-code">{booking.id}</b>
        </div>
      </article>

      {booking.snapshot ? (
        <figure className="ticket-view">
          <img src={booking.snapshot} width={720} height={405} alt={`View of the screen from seat ${booking.viewSeat}`} />
          <figcaption>
            <b>Your view from seat {booking.viewSeat}</b>
            <span className="muted small">Rendered from the 3D model of {venue?.screen.name ?? 'the auditorium'} when you booked.</span>
          </figcaption>
        </figure>
      ) : null}

      <PriceBreakdown booking={booking} />

      <div className="ticket-actions">
        <button type="button" className="btn btn-secondary" onClick={() => window.print()}>
          <Printer size={16} /> Print Ticket
        </button>
        <button type="button" className="btn btn-secondary" onClick={() => downloadCalendar(booking, movie, show, hall)}>
          <CalendarPlus size={16} /> Add to Calendar
        </button>
        <Link to={isLive(movie) ? '/events' : '/?section=movies'} className="btn btn-primary">
          {isLive(movie) ? 'Browse Live Shows' : 'Browse Movies'}
        </Link>
      </div>

      <SeatRating bookingId={booking.id} />

      <p className="ticket-help muted small">
        Something wrong with this booking?{' '}
        <Link to={`/contact?topic=booking&ref=${encodeURIComponent(booking.id)}`}>Contact us</Link> and mention {booking.id}.
      </p>
    </div>
  );
}
