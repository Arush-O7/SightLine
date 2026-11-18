# SightLine

SightLine is a booking site for movies and live shows in Delhi’s cinemas. You can sit in any seat of a true-to-scale 3D auditorium and see the screen or stage from there before you book it.

![The home page: the headline over a live 3D auditorium, with the movie's real poster on the screen](docs/screenshots/home.jpg)

## How it works

You pick a movie or a live show, then a cinema and a showtime, then a seat. The movies are current releases and the cinemas are real ones across Delhi, from Saket to Connaught Place and Dwarka.

![Now showing in Delhi: seven current releases with their official posters](docs/screenshots/movies.jpg)

![A movie's cinemas and showtimes for the day, grouped by cinema and auditorium, each time marked by how full it is](docs/screenshots/showtimes.jpg)

The booking screen opens on the view from the best free seat. Every seat has a view score, and the seats people book most are marked with a dot:

![The view from seat M11 in a large-screen auditorium, with the most booked seats dotted on the seat map and listed below it](docs/screenshots/seat-view.jpg)

The measurements behind the score stay out of the way until you press **Details**:

![The Details pop-up for seat M11: distance to the screen, field of view, offset from centre and head tilt](docs/screenshots/seat-details.jpg)

Comedy nights, concerts, live cricket and plays run in the same auditoriums:

![Live shows: comedy, music, cricket screenings and theatre, each with a photo and its next show](docs/screenshots/live-shows.jpg)

| A cinema and its auditoriums | Whole hall view |
|---|---|
| ![A cinema page with its three auditoriums and today's movies](docs/screenshots/cinema.jpg) | ![The hall from above, with a live preview of the chosen seat's view](docs/screenshots/whole-hall.jpg) |
| **Checkout** | **Ticket with the booked view** |
| ![Checkout with UPI, card and pay-at-the-cinema options](docs/screenshots/checkout.jpg) | ![Ticket with QR code, the picture of the seat view and the price breakdown](docs/screenshots/ticket.jpg) |

Cinema staff get their own admin pages for sales, shows, bookings and customers:

| Admin overview | Managing a cinema’s shows |
|---|---|
| ![Admin overview with sales totals, a 14-day sales chart, top titles and cinemas](docs/screenshots/admin.jpg) | ![Admin shows page: add a show, or cancel and restore shows per auditorium](docs/screenshots/admin-shows.jpg) |

On a phone the 3D view sits above the seat map:

<p>
  <img src="docs/screenshots/phone-home.jpg" width="250" alt="Home page on a phone" />
  <img src="docs/screenshots/phone-showtimes.jpg" width="250" alt="Showtimes on a phone" />
  <img src="docs/screenshots/phone-booking.jpg" width="250" alt="Booking page on a phone, with the 3D view above the seat map" />
</p>

## Features

- **Seat preview in 3D:** a camera at seated eye level in every seat, a whole-hall view, a view-quality heatmap and a best-seats-together pick for groups of up to 8.
- **Compare and share:** two seats side by side, or a link that opens the hall at one exact seat.
- **Most booked seats:** marked on the map, with the ones still free listed for one-tap picking.
- **Live shows:** stand-up comedy, concerts, live cricket screenings and plays, booked the same way as movies.
- **Cinema pages:** a photo of each cinema, its lobby and snack counter, and a picture of every auditorium rendered from its 3D model.
- **Real posters:** every movie shows its official theatrical poster.
- **Admin:** a sales overview; adding, cancelling and restoring shows (cancelling refunds and emails every customer); adding new movies and live shows; setting seat prices for each auditorium type; all bookings; and customer roles.
- **Accounts:** email and password or Google sign-in, email confirmation, password reset, a signed-in devices list and account deletion.
- **Payments:** UPI, card and pay at the cinema, through a built-in test gateway. Tickets show the GST included.
- **Email:** confirmation, ticket, cancellation and refund, and password reset emails.

## Tech stack

React, TypeScript and Vite for the site, Three.js for the halls, and a Node server with no framework on PostgreSQL or SQLite. It runs as a plain Node server, in Docker or on Vercel.

## Run it

You need Node 22.13 or newer.

```bash
npm install
npm run dev
```

Open [localhost:5173](http://localhost:5173). With no settings the data lives in a local SQLite file; `.env.example` lists the optional settings. To see the admin pages, choose **Sign in as the demo admin** on the sign-in page, or list your email in `ADMIN_EMAILS`.

## Tests

```bash
npm run test:api   # 152 API checks, against a server started on port 8799
npm run test:e2e   # 31 browser checks in Chrome, with npm run dev running
```

## Project structure

- `src/three/HallScene.ts`: the 3D hall, with seat view, whole-hall view and snapshot capture.
- `src/lib/hall.ts`: halls defined in metres, the seat layout and each seat’s view score.
- `src/data/`: the movies and live shows, the Delhi cinemas, their photos and the generated showtimes.
- `src/pages/`: home, movie or show, live shows, cinemas, booking, checkout, ticket, account, help and `admin/`.
- `server/`: the API (including the admin routes), the database layer, Google sign-in, the test payment gateway and email.

## How booking stays correct

The database, not the browser, decides who gets a seat:

- **No double-booking.** Confirmed and held seats each have a unique `(show, seat)` constraint, and every write runs in a transaction.
- **Hold, then pay.** Continuing to payment holds your seats for 7 minutes, and the server only charges for seats you still hold.
- **Safe retries.** Each payment carries a one-time key, so a double click returns the first booking instead of booking twice.
- **Server-side prices.** The total comes from the hall definition, never from the browser.
- **Secure accounts.** Passwords are hashed with scrypt, sessions are HttpOnly cookies stored only as hashes, and sign-in attempts are rate limited.

## Limitations

- The movies and cinemas are real, but SightLine isn’t connected to any cinema. Showtimes, live shows, prices, seat layouts and the background crowd are illustrative.
- Photos of cinemas and live shows are freely licensed from Wikimedia Commons (see the site’s Photo Credits page). No Delhi cinema has a freely licensed lobby photo, so every lobby and snack-counter photo is a representative one from another cinema, labelled as such; so are the building photos for two cinemas.
- Movie posters are the films’ official theatrical posters, shown from Wikipedia (or from TMDB when a TMDB key is set). They belong to their studios and are only linked, not stored in this repository.
- Payments run in test mode; a real launch would swap `server/gateway.ts` for a provider such as Razorpay.
