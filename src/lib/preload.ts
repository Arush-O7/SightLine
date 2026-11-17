/** Shared loader so links can warm the 3D booking bundle on hover or focus, before the click. */
export const loadBooking = () => import('../pages/BookingPage');

export const warmBooking = () => {
  void loadBooking();
};
