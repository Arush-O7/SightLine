import type { MessageStatus, MessageTopic } from '../data/contact';
import type { ScheduleChange, TitleRecord } from '../data/movies';
import type { PriceOverride } from './hall';
/** Thin client for the SightLine API. Every failure becomes an ApiFailure with a message fit to show. */

export interface User {
  id: number;
  email: string;
  name: string;
  emailVerified: boolean;
  /** false for an account that only signs in with Google */
  hasPassword: boolean;
  google: boolean;
  createdAt: number;
  role: 'user' | 'admin';
}

export interface DeviceSession {
  id: string;
  device: string;
  current: boolean;
  createdAt: number | null;
  lastSeenAt: number | null;
}

export interface Booking {
  id: string;
  showId: string;
  movieId: string;
  hallId: string;
  seats: string[];
  subtotal: number;
  fees: number;
  total: number;
  payment: string;
  paymentStatus: 'paid' | 'due';
  paymentRef: string | null;
  instrument: string | null;
  viewSeat: string | null;
  snapshot: string | null;
  createdAt: number;
}

export interface AdminBooking {
  id: string;
  showId: string;
  title: string;
  kind: string;
  cinema: string;
  cinemaId: string | null;
  screen: string;
  start: number | null;
  seats: number;
  total: number;
  paymentStatus: 'paid' | 'due';
  instrument: string | null;
  customer: { name: string; email: string };
  createdAt: number;
}

export interface SeatRating {
  rating: number;
  comment: string;
  updatedAt: number;
}

export interface MessageInput {
  name: string;
  email: string;
  topic: MessageTopic;
  bookingRef: string;
  message: string;
  /** never shown to people; only a bot fills it in */
  website: string;
}

export interface AdminMessage {
  id: string;
  name: string;
  email: string;
  topic: MessageTopic;
  bookingRef: string | null;
  message: string;
  status: MessageStatus;
  /** sent while signed in to an account */
  fromAccount: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface AdminRatings {
  count: number;
  average: number | null;
  /** how many gave 1, 2, 3, 4 and 5 */
  distribution: number[];
  comments: { bookingId: string; title: string; rating: number; comment: string; name: string; at: number }[];
}

export interface AdminOverview {
  totals: {
    revenue: number;
    due: number;
    bookings: number;
    tickets: number;
    upcoming: number;
    refunds: number;
    refunded: number;
    users: number;
    newMessages: number;
    ratings: number;
    ratingAverage: number | null;
  };
  daily: { date: string; revenue: number; bookings: number; tickets: number }[];
  byTitle: { key: string; bookings: number; tickets: number; revenue: number }[];
  byCinema: { key: string; bookings: number; tickets: number; revenue: number }[];
  recent: AdminBooking[];
}

export interface AdminShow {
  id: string;
  movieId: string;
  title: string;
  kind: string;
  time: string;
  runtime: number;
  start: number;
  cancelled: boolean;
  added: boolean;
  started: boolean;
  sold: number;
}

export interface AdminScreenDay {
  id: string;
  name: string;
  format: string;
  capacity: number;
  shows: AdminShow[];
}

export interface AdminTitle {
  id: string;
  title: string;
  kind: string;
  runtime: number;
  language: string;
  custom: boolean;
}

export interface AdminHallPrices {
  hallId: string;
  format: string;
  zones: { id: string; name: string; price: number; defaultPrice: number }[];
}

export interface AdminUser extends User {
  bookings: number;
  spent: number;
}

export type PaymentInput =
  | { method: 'upi'; upiId: string }
  | { method: 'card'; number: string; expiry: string; cvv: string }
  | { method: 'counter' };

export interface SiteConfig {
  demo: boolean;
  realEmail: boolean;
  demoEmail: string | null;
  /** 'all' on the presenter's own machine; elsewhere only mail to reserved addresses such as name@example.com */
  inbox: 'all' | 'reserved';
  google: boolean;
  database: 'sqlite' | 'postgres';
}

export interface DemoEmail {
  id: number;
  to: string;
  subject: string;
  html: string;
  kind: string;
  createdAt: number;
}

export interface MovieMedia {
  poster: string | null;
  backdrop: string | null;
}

export interface Hold {
  seats: string[];
  expiresAt: number;
}

export class ApiFailure extends Error {
  constructor(
    public code: string,
    public status: number,
    message: string,
    public seats?: string[],
  ) {
    super(message);
  }
}

/** Called when the server says the session is gone (expired, signed out elsewhere, password reset). */
let onSignedOut: (() => void) | null = null;
export const setSignedOutHandler = (fn: () => void) => {
  onSignedOut = fn;
};

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      credentials: 'same-origin',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiFailure('offline', 0, 'Can’t reach the server. Check your connection and try again.');
  }
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    /* non-JSON response handled below */
  }
  if (!res.ok) {
    const err = (data as { error?: { code?: string; message?: string; seats?: string[] } } | null)?.error;
    if (err?.code === 'not_signed_in') onSignedOut?.();
    throw new ApiFailure(err?.code ?? 'server_error', res.status, err?.message ?? 'Something went wrong. Try again.', err?.seats);
  }
  return data as T;
}

const enc = encodeURIComponent;

export const api = {
  me: () => request<{ user: User | null }>('GET', '/auth/me').then((r) => r.user),
  signup: (name: string, email: string, password: string) =>
    request<{ user: User }>('POST', '/auth/signup', { name, email, password }).then((r) => r.user),
  login: (email: string, password: string) => request<{ user: User }>('POST', '/auth/login', { email, password }).then((r) => r.user),
  logout: () => request<{ ok: true }>('POST', '/auth/logout', {}),
  updateName: (name: string) => request<{ user: User }>('PATCH', '/auth/me', { name }).then((r) => r.user),
  changePassword: (currentPassword: string, newPassword: string) =>
    request<{ ok: true }>('POST', '/auth/password', { currentPassword, newPassword }),
  verifyEmail: (token: string) => request<{ ok: true }>('POST', '/auth/verify', { token }),
  resendVerification: () => request<{ ok: true; alreadyVerified: boolean }>('POST', '/auth/verify/resend', {}),
  sessions: () => request<{ sessions: DeviceSession[] }>('GET', '/auth/sessions').then((r) => r.sessions),
  signOutDevice: (id: string) => request<{ ok: true; current: boolean }>('DELETE', `/auth/sessions/${enc(id)}`),
  signOutOtherDevices: () => request<{ ok: true; removed: number }>('DELETE', '/auth/sessions'),
  disconnectGoogle: () => request<{ user: User }>('DELETE', '/auth/google').then((r) => r.user),
  deleteAccount: (confirm: string) => request<{ ok: true; cancelled: number }>('DELETE', '/auth/me', { confirm }),
  /** Full-page navigation: Google's sign-in cannot run inside a fetch. */
  googleSignInUrl: (next: string) => `/api/auth/google/start?next=${enc(next)}`,

  seats: (showId: string) => request<{ taken: string[]; hold: Hold | null }>('GET', `/shows/${enc(showId)}/seats`),
  /** seats booked or held on the site, by show; the simulated audience is not included */
  availability: (showIds: string[]) =>
    request<{ seats: Record<string, string[]> }>('GET', `/availability?shows=${showIds.map(enc).join(',')}`).then((r) => r.seats),
  hold: (showId: string, seats: string[]) => request<{ hold: Hold }>('POST', `/shows/${enc(showId)}/hold`, { seats }).then((r) => r.hold),
  releaseHold: (showId: string) => request<{ ok: true }>('DELETE', `/shows/${enc(showId)}/hold`),

  bookings: () => request<{ bookings: Booking[] }>('GET', '/bookings').then((r) => r.bookings),
  booking: (id: string) => request<{ booking: Booking }>('GET', `/bookings/${enc(id)}`).then((r) => r.booking),
  createBooking: (payload: {
    showId: string;
    seats: string[];
    payment: PaymentInput;
    viewSeat: string | null;
    snapshot: string | null;
    idempotencyKey: string;
  }) => request<{ booking: Booking }>('POST', '/bookings', payload).then((r) => r.booking),
  cancelBooking: (id: string) => request<{ ok: true; refunded: boolean }>('DELETE', `/bookings/${enc(id)}`),
  rating: (bookingId: string) => request<{ rating: SeatRating | null }>('GET', `/bookings/${enc(bookingId)}/rating`).then((r) => r.rating),
  rate: (bookingId: string, rating: number, comment: string) =>
    request<{ rating: SeatRating }>('PUT', `/bookings/${enc(bookingId)}/rating`, { rating, comment }).then((r) => r.rating),
  sendMessage: (input: MessageInput) => request<{ id: string; receipt: boolean }>('POST', '/messages', input),

  config: () => request<SiteConfig>('GET', '/config'),
  media: () => request<{ movies: Record<string, MovieMedia> }>('GET', '/media').then((r) => r.movies),
  demoLogin: (as: 'user' | 'admin' = 'user') => request<{ user: User }>('POST', '/auth/demo', { as }).then((r) => r.user),
  catalog: () => request<{ changes: ScheduleChange[]; titles: TitleRecord[]; prices: PriceOverride[] }>('GET', '/schedule'),

  admin: {
    overview: () => request<AdminOverview>('GET', '/admin/overview'),
    bookings: (when: 'upcoming' | 'past' | 'all', q: string) =>
      request<{ bookings: AdminBooking[] }>('GET', `/admin/bookings?when=${when}&q=${enc(q)}`).then((r) => r.bookings),
    cancelBooking: (id: string) => request<{ ok: true; refunded: boolean }>('POST', `/admin/bookings/${enc(id)}/cancel`, {}),
    shows: (cinema: string, date: string) =>
      request<{ cinema: { id: string; name: string }; date: string; screens: AdminScreenDay[] }>('GET', `/admin/shows?cinema=${enc(cinema)}&date=${date}`),
    addShow: (input: { movieId: string; cinemaId: string; screenId: string; date: string; time: string }) =>
      request<{ ok: true; showId: string }>('POST', '/admin/shows', input),
    cancelShow: (showId: string) => request<{ ok: true; cancelledBookings: number }>('POST', '/admin/shows/cancel', { showId }),
    restoreShow: (showId: string) => request<{ ok: true }>('POST', '/admin/shows/restore', { showId }),
    users: () => request<{ users: AdminUser[] }>('GET', '/admin/users').then((r) => r.users),
    setRole: (id: number, role: 'user' | 'admin') => request<{ user: User }>('PATCH', `/admin/users/${id}`, { role }).then((r) => r.user),
    titles: () => request<{ titles: AdminTitle[] }>('GET', '/admin/titles').then((r) => r.titles),
    addTitle: (input: Record<string, string | number>) => request<{ title: TitleRecord }>('POST', '/admin/titles', input).then((r) => r.title),
    removeTitle: (id: string) => request<{ ok: true }>('DELETE', `/admin/titles/${enc(id)}`),
    prices: () => request<{ halls: AdminHallPrices[] }>('GET', '/admin/prices').then((r) => r.halls),
    savePrices: (prices: PriceOverride[]) => request<{ ok: true }>('PUT', '/admin/prices', { prices }),
    messages: (status: MessageStatus | 'all') =>
      request<{ messages: AdminMessage[]; counts: Record<MessageStatus, number> }>('GET', `/admin/messages?status=${status}`),
    setMessageStatus: (id: string, status: MessageStatus) => request<{ ok: true }>('PATCH', `/admin/messages/${enc(id)}`, { status }),
    ratings: () => request<AdminRatings>('GET', '/admin/ratings'),
  },
  forgot: (email: string) => request<{ ok: true }>('POST', '/auth/forgot', { email }),
  resetPassword: (token: string, password: string) => request<{ ok: true }>('POST', '/auth/reset', { token, password }),
  outbox: () => request<{ emails: DemoEmail[] }>('GET', '/demo/outbox').then((r) => r.emails),
  resetDemo: () => request<{ ok: true }>('POST', '/demo/reset', {}),
};

/** Mirrors the server: addresses that can never belong to a real person. */
const RESERVED_EMAIL = /@(?:[\w-]+\.)*(?:example\.(?:com|net|org)|[\w-]+\.(?:test|example|invalid|localhost))$/i;

/** Whether mail sent to `email` will show in the Demo Inbox for this visitor. */
export const inboxShows = (config: SiteConfig | null, email: string) =>
  !!config?.demo && (config.inbox === 'all' || RESERVED_EMAIL.test(email));

export const errorMessage = (err: unknown) => (err instanceof ApiFailure ? err.message : 'Something went wrong. Try again.');
