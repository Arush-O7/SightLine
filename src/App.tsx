import { lazy, Suspense, useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import Nav from './components/Nav';
import Footer from './components/Footer';
import ErrorBoundary from './components/ErrorBoundary';
import RequireAuth from './components/RequireAuth';
import VerifyBanner from './components/VerifyBanner';
import Home from './pages/Home';
import MoviePage from './pages/MoviePage';
import NotFound from './pages/NotFound';
import { loadBooking } from './lib/preload';
import { useStore } from './lib/store';

// three.js and the QR code only download when a page that needs them is opened
const BookingPage = lazy(loadBooking);
const CheckoutPage = lazy(() => import('./pages/CheckoutPage'));
const TicketPage = lazy(() => import('./pages/TicketPage'));
const BookingsPage = lazy(() => import('./pages/BookingsPage'));
const AuthPage = lazy(() => import('./pages/AuthPage'));
const AccountPage = lazy(() => import('./pages/AccountPage'));
const HelpPage = lazy(() => import('./pages/HelpPage'));
const ForgotPage = lazy(() => import('./pages/ForgotPage'));
const ResetPage = lazy(() => import('./pages/ResetPage'));
const VerifyPage = lazy(() => import('./pages/VerifyPage'));
const DemoInboxPage = lazy(() => import('./pages/DemoInboxPage'));

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export default function App() {
  const { pathname } = useLocation();
  const initAuth = useStore((s) => s.initAuth);
  const immersive = pathname.startsWith('/book/');

  useEffect(() => {
    void initAuth();
  }, [initAuth]);

  return (
    <div className={`app ${immersive ? 'app-immersive' : ''}`}>
      <a
        className="skip-link"
        href="#main"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById('main')?.focus();
        }}
      >
        Skip to Content
      </a>
      <ScrollToTop />
      <Nav />
      {!immersive && !pathname.startsWith('/verify') ? <VerifyBanner /> : null}
      <main id="main" tabIndex={-1}>
        <ErrorBoundary resetKey={pathname}>
          <Suspense
            fallback={
              <div className="route-loading" role="status">
                Loading…
              </div>
            }
          >
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/movie/:movieId" element={<MoviePage />} />
              <Route path="/book/:showId" element={<BookingPage />} />
              <Route path="/login" element={<AuthPage mode="login" />} />
              <Route path="/signup" element={<AuthPage mode="signup" />} />
              <Route path="/help" element={<HelpPage />} />
              <Route path="/forgot" element={<ForgotPage />} />
              <Route path="/reset" element={<ResetPage />} />
              <Route path="/verify" element={<VerifyPage />} />
              <Route path="/demo/inbox" element={<DemoInboxPage />} />
              <Route
                path="/checkout/:showId"
                element={
                  <RequireAuth>
                    <CheckoutPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/ticket/:bookingId"
                element={
                  <RequireAuth>
                    <TicketPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/bookings"
                element={
                  <RequireAuth>
                    <BookingsPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/account"
                element={
                  <RequireAuth>
                    <AccountPage />
                  </RequireAuth>
                }
              />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </main>
      {!immersive ? <Footer /> : null}
    </div>
  );
}
