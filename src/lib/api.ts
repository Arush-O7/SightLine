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

  config: () => request<SiteConfig>('GET', '/config'),
  media: () => request<{ movies: Record<string, MovieMedia> }>('GET', '/media').then((r) => r.movies),
  demoLogin: () => request<{ user: User }>('POST', '/auth/demo', {}).then((r) => r.user),
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
