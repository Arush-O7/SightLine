import { useEffect, useId, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { BOOKING_REF, MESSAGE_MAX, MESSAGE_MIN, MESSAGE_TOPICS, isMessageTopic, type MessageTopic } from '../data/contact';
import { api, errorMessage, inboxShows } from '../lib/api';
import { useStore } from '../lib/store';
import { useTitle } from '../lib/useTitle';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default function ContactPage() {
  useTitle('Contact Us');
  const user = useStore((s) => s.user);
  const config = useStore((s) => s.config);
  const [params] = useSearchParams();
  const [topic, setTopic] = useState<MessageTopic>(() => (isMessageTopic(params.get('topic')) ? (params.get('topic') as MessageTopic) : 'feedback'));
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [bookingRef, setBookingRef] = useState(() => params.get('ref') ?? '');
  const [message, setMessage] = useState('');
  const [website, setWebsite] = useState('');
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [sent, setSent] = useState<{ id: string; receipt: boolean; email: string } | null>(null);
  const topicHeading = useId();

  // a signed-in visitor starts with their own name and address, which they can still change
  useEffect(() => {
    if (!user) return;
    setName((n) => n || user.name);
    setEmail((e) => e || user.email);
  }, [user]);

  // a link that names a topic or booking (as the ticket's does) sets them, even when this page is already open
  const linkTopic = params.get('topic');
  const linkRef = params.get('ref');
  useEffect(() => {
    if (isMessageTopic(linkTopic)) setTopic(linkTopic);
    if (linkRef) setBookingRef(linkRef);
  }, [linkTopic, linkRef]);

  const text = message.trim();
  const errors = {
    name: name.trim().length < 2 ? 'Enter your name.' : null,
    email: EMAIL.test(email.trim()) ? null : 'Enter an email like name@example.com.',
    bookingRef: bookingRef.trim() && !BOOKING_REF.test(bookingRef.trim().toUpperCase()) ? 'A booking reference looks like SL-AB12CD.' : null,
    message: text.length < MESSAGE_MIN ? `Write at least ${MESSAGE_MIN} characters.` : null,
  };
  const valid = !Object.values(errors).some(Boolean);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    setFailure(null);
    if (!valid) return;
    setBusy(true);
    try {
      const out = await api.sendMessage({
        name: name.trim(),
        email: email.trim(),
        topic,
        bookingRef: topic === 'booking' ? bookingRef.trim() : '',
        message: text,
        website,
      });
      setSent({ ...out, email: email.trim() });
    } catch (err) {
      setFailure(errorMessage(err));
    }
    setBusy(false);
  };

  const startOver = () => {
    setSent(null);
    setTouched(false);
    setMessage('');
    setBookingRef('');
  };

  const show = (field: keyof typeof errors) => (touched ? errors[field] : null);

  return (
    <div className="container section contact-page">
      <header className="contact-head">
        <h1>Contact Us</h1>
        <p className="muted">A problem with a booking, an idea for SightLine, or a cinema that wants it for its own halls: send a message and we’ll reply by email.</p>
      </header>

      <div className="contact-layout">
        {sent ? (
          <div className="card contact-card contact-sent" role="status">
            <CheckCircle2 size={28} aria-hidden="true" />
            <h2>Message Sent</h2>
            <p className="muted">
              Your reference is <b className="strong">{sent.id}</b>. We’ll reply to <b className="strong">{sent.email}</b>.
              {sent.receipt ? ' A copy of the reference is on its way to the same address.' : ''}
            </p>
            <div className="contact-sent-actions">
              {sent.receipt && inboxShows(config, sent.email) ? (
                <Link to="/demo/inbox" className="btn btn-secondary">
                  Open the Demo Inbox
                </Link>
              ) : null}
              <button type="button" className="btn btn-primary" onClick={startOver}>
                Send Another Message
              </button>
            </div>
          </div>
        ) : (
          <form className="card contact-card" onSubmit={submit} noValidate>
            {failure ? (
              <p className="form-error" role="alert">
                {failure}
              </p>
            ) : null}

            <div className="field">
              <span id={topicHeading}>What is it about?</span>
              <div className="topic-options" role="radiogroup" aria-labelledby={topicHeading}>
                {MESSAGE_TOPICS.map((t) => (
                  <label key={t.id} className={`topic-option ${topic === t.id ? 'on' : ''}`}>
                    <input type="radio" name="topic" value={t.id} checked={topic === t.id} onChange={() => setTopic(t.id)} />
                    {t.label}
                  </label>
                ))}
              </div>
            </div>

            <div className="contact-pair">
              <label className={`field ${show('name') ? 'bad' : ''}`}>
                <span>Your name</span>
                <input name="name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={60} aria-invalid={!!show('name')} />
                {show('name') ? <em role="alert">{show('name')}</em> : null}
              </label>
              <label className={`field ${show('email') ? 'bad' : ''}`}>
                <span>Email for our reply</span>
                <input
                  name="email"
                  type="email"
                  inputMode="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  spellCheck={false}
                  aria-invalid={!!show('email')}
                />
                {show('email') ? <em role="alert">{show('email')}</em> : null}
              </label>
            </div>

            {topic === 'booking' ? (
              <label className={`field ${show('bookingRef') ? 'bad' : ''}`}>
                <span>Booking reference (optional)</span>
                <input
                  name="bookingRef"
                  value={bookingRef}
                  onChange={(e) => setBookingRef(e.target.value)}
                  placeholder="SL-AB12CD"
                  autoComplete="off"
                  spellCheck={false}
                  maxLength={9}
                  aria-invalid={!!show('bookingRef')}
                />
                {show('bookingRef') ? <em role="alert">{show('bookingRef')}</em> : <small>It’s on your ticket and in My Tickets.</small>}
              </label>
            ) : null}

            <label className={`field ${show('message') ? 'bad' : ''}`}>
              <span>Message</span>
              <textarea
                name="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={6}
                maxLength={MESSAGE_MAX}
                aria-invalid={!!show('message')}
                aria-describedby="message-count"
              />
              <small id="message-count" className="contact-count">
                {show('message') ? <em role="alert">{show('message')}</em> : <span />}
                <span>
                  {message.length.toLocaleString('en-IN')} / {MESSAGE_MAX.toLocaleString('en-IN')}
                </span>
              </small>
            </label>

            {/* left empty by people, who never see it; a bot that fills it in is quietly ignored */}
            <label className="contact-trap" aria-hidden="true">
              Website
              <input name="website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
            </label>

            <button type="submit" className="btn btn-primary btn-lg" disabled={busy}>
              {busy ? 'Sending…' : 'Send Message'}
            </button>
            {!user ? (
              <p className="muted small">
                Writing about a booking? <Link to="/login?next=%2Fcontact%3Ftopic%3Dbooking">Sign in</Link> first and we’ll know which account it is.
              </p>
            ) : null}
          </form>
        )}

        <aside className="contact-aside" aria-labelledby="quick-answers">
          <h2 id="quick-answers">Quicker Answers</h2>
          <ul>
            <li>
              <Link to="/bookings">Cancel a booking</Link>
              <span className="muted">From My Tickets, any time before the show starts. Paid bookings are refunded.</span>
            </li>
            <li>
              <Link to="/help#booking">Seat holds, payments and refunds</Link>
              <span className="muted">Seats are held for 7 minutes while you pay.</span>
            </li>
            <li>
              <Link to="/help#seats">How the view score works</Link>
              <span className="muted">What the number out of 100 measures.</span>
            </li>
            <li>
              <Link to="/help#account">Signing in and your account</Link>
              <span className="muted">Google sign-in, passwords and your devices.</span>
            </li>
          </ul>
        </aside>
      </div>
    </div>
  );
}
