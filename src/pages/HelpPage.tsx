import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTitle } from '../lib/useTitle';

interface Topic {
  id: string;
  title: string;
  faq: { q: string; a: string }[];
}

const TOPICS: Topic[] = [
  {
    id: 'seats',
    title: 'Seats and the 3D View',
    faq: [
      {
        q: 'How accurate is the view from a seat?',
        a: 'Each auditorium is built to scale from its measurements: screen size and height, row spacing, the rise of each row and the aisles. The camera sits at a seated eye level, so the screen appears the size and angle it would from that seat. In this demo the cinemas’ auditoriums use three representative layouts (standard, large screen and recliner), not each cinema’s own plans.',
      },
      {
        q: 'What is the view score?',
        a: 'A number out of 100 for each seat. It combines how much of your vision the screen fills, how far you have to tilt your head, and how far off-centre you are. Around 50° of screen, a level head and a central seat score highest.',
      },
      {
        q: 'What are the most booked seats?',
        a: 'Seats with a dot on the map are the ones people booked most often in this kind of auditorium over the last four weeks, and the ones still free for your show are listed under the map. In this demo those bookings come from the same simulated audience as the rest of the hall.',
      },
      {
        q: 'Where are the distance and angle measurements?',
        a: 'Press Details on any seat. It shows the distance to the screen, how much of your vision the screen fills, how far you sit from the centre and how far you tilt your head.',
      },
      {
        q: 'How do I choose a seat?',
        a: 'Tap a seat on the map to see its view. Tap the same seat again, or press Select Seat, to choose it. On a keyboard, use the arrow keys to move between seats and Enter to select. Shift with the arrow keys looks around.',
      },
      {
        q: 'Can I compare two seats?',
        a: 'Yes. Open a seat, press Compare, then pick another seat. Both views appear side by side with their view score, how often each is booked, and price.',
      },
      {
        q: 'Can I show a seat to a friend before booking?',
        a: 'Yes. Press Share on any seat to copy a link. It opens the hall at that exact seat for anyone you send it to.',
      },
    ],
  },
  {
    id: 'shows',
    title: 'Movies and Live Shows',
    faq: [
      {
        q: 'What can I book besides movies?',
        a: 'Live shows staged in the same auditoriums: stand-up comedy, concerts, live cricket screenings and plays. Open Live Shows to see them, then pick a time and a seat the same way as for a movie. In this demo the live shows are illustrative: the formats are real, the titles and line-ups are not.',
      },
      {
        q: 'Where do the photos come from?',
        a: 'Photos of the cinemas and live shows are freely licensed photos from Wikimedia Commons, credited on the Photo Credits page. Where no free photo of a cinema exists, a representative photo is used and labelled as one. Pictures of auditoriums are rendered from SightLine’s own 3D models. No Delhi cinema has a freely licensed photo of its lobby, so the lobby and snack-counter photos are representative ones from other cinemas. Movie posters are the official theatrical posters.',
      },
      {
        q: 'Can a show be cancelled?',
        a: 'Yes. If the cinema cancels a show, every booking for it is cancelled straight away, paid tickets are refunded to the way you paid, and you get an email.',
      },
    ],
  },
  {
    id: 'booking',
    title: 'Booking and Payment',
    faq: [
      {
        q: 'How long are my seats held?',
        a: 'When you continue to payment your seats are held for 7 minutes. If the time runs out they are released and you can choose again.',
      },
      {
        q: 'Is payment real?',
        a: 'No. Payments run in test mode: the card and UPI screens work like the real thing, but no money moves. Card 4111 1111 1111 1111 is approved and 4000 0000 0000 0002 is declined; any UPI ID like name@bank is approved.',
      },
      {
        q: 'What does the price include?',
        a: 'Every price includes GST. Cinema tickets above ₹100 and the convenience fee are taxed at 18%, split equally between CGST and SGST. Your ticket shows the breakdown.',
      },
      {
        q: 'Can I cancel a booking?',
        a: 'Yes, from My Tickets, any time before the show starts. The seats are released straight away, and a paid booking is refunded to the way you paid (in test mode, no money moves).',
      },
      {
        q: 'Do I get my ticket by email?',
        a: 'Yes. A confirmation with your seats and booking reference is emailed when you book, and another when you cancel.',
      },
    ],
  },
  {
    id: 'account',
    title: 'Your Account',
    faq: [
      {
        q: 'Can I sign in with Google?',
        a: 'Yes. Choose Continue with Google on the sign-in page. We receive your name, your email address and an ID for your Google account, never your Google password. If you already have an account with the same email, Google is added to it.',
      },
      {
        q: 'Why do you ask me to confirm my email?',
        a: 'So your tickets and password-reset emails reach the right person. Open the link we email you; it works for 24 hours. You can send a new one from your Account page.',
      },
      {
        q: 'I forgot my password. What now?',
        a: 'Choose Forgot your password on the sign-in page and we will email you a link to set a new one. The link works once and expires after 30 minutes.',
      },
      {
        q: 'How do I see where I’m signed in?',
        a: 'Your Account page lists every device signed in to your account and when each was last active. You can sign out any of them, or all of them except the one you are using.',
      },
      {
        q: 'How do I delete my account?',
        a: 'From the bottom of your Account page. Type your email to confirm. Your account, tickets and payment records are removed, upcoming bookings are cancelled and paid ones refunded. It can’t be undone.',
      },
    ],
  },
];

const STORED: [string, string][] = [
  ['Your account', 'Your name, your email and a scrambled (hashed) form of your password. The password itself is never stored.'],
  ['Google sign-in', 'Your name, email and Google account ID, and nothing else from your Google account.'],
  ['Your devices', 'A short description such as “Chrome on Android” and when each was last active. No IP addresses.'],
  ['Your bookings', 'The seats, the showtime and the picture of your seat view.'],
  ['Payments', 'A masked reference such as “Card •••• 1111”. Full card numbers and security codes are never stored.'],
];

const SECTIONS = [...TOPICS.map((t) => ({ id: t.id, title: t.title })), { id: 'terms', title: 'Terms' }, { id: 'privacy', title: 'Privacy' }];

const jump = (id: string) => document.getElementById(id)?.scrollIntoView({ block: 'start' });

export default function HelpPage() {
  useTitle('Help');
  const { hash } = useLocation();

  useEffect(() => {
    if (!hash) return;
    requestAnimationFrame(() => jump(hash.slice(1)));
  }, [hash]);

  return (
    <div className="container section help">
      <header className="help-head">
        <h1>Help &amp; FAQ</h1>
        <p className="muted">How seat previews, booking and your account work.</p>
      </header>

      <div className="help-layout">
        <nav className="help-nav" aria-label="Help topics">
          {SECTIONS.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              onClick={(e) => {
                // the site uses hash routing, so in-page links scroll instead of changing the route
                e.preventDefault();
                jump(s.id);
              }}
            >
              {s.title}
            </a>
          ))}
        </nav>

        <div className="help-body">
          {TOPICS.map((t) => (
            <section key={t.id} id={t.id} className="help-topic" aria-labelledby={`${t.id}-title`}>
              <h2 id={`${t.id}-title`}>{t.title}</h2>
              <div className="faq">
                {t.faq.map((item) => (
                  <details key={item.q}>
                    <summary>{item.q}</summary>
                    <p>{item.a}</p>
                  </details>
                ))}
              </div>
            </section>
          ))}

          <section id="terms" className="legal">
            <h2>Terms</h2>
            <p>
              SightLine is a demonstration product. The movies and cinemas are real, but SightLine is not affiliated with any of them:
              showtimes, prices, seat layouts and availability are illustrative. A booking made here does not reserve a seat at any
              real cinema, and no money changes hands. Movie details come from TMDB; this product uses the TMDB API but is not
              endorsed or certified by TMDB.
            </p>
          </section>

          <section id="privacy" className="legal">
            <h2>Privacy</h2>
            <p>We keep only what the site needs to work:</p>
            <dl className="legal-list">
              {STORED.map(([term, text]) => (
                <div key={term}>
                  <dt>{term}</dt>
                  <dd>{text}</dd>
                </div>
              ))}
            </dl>
            <p>
              One essential cookie keeps you signed in (plus a short-lived one while you sign in with Google), so there is no cookie banner.
              Your in-progress seat choice stays in this browser. Emails pass through the site’s mail provider when one is set up. Nothing
              else is shared, and there is no advertising or analytics tracking.
            </p>
            <p>
              You can delete your account and everything in it at any time from your <Link to="/account">Account</Link> page.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
