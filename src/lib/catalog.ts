import { api } from './api';
import { setZonePrices } from './hall';
import { setCustomTitles, setScheduleChanges } from '../data/movies';

/** Pulls what cinema staff changed (added titles, prices, extra or cancelled shows) into the site's data. */
export async function loadCatalog() {
  const c = await api.catalog();
  setCustomTitles(c.titles);
  setZonePrices(c.prices);
  setScheduleChanges(c.changes);
}
