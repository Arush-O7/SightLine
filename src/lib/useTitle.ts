import { useEffect } from 'react';

const SITE = 'SightLine';

/** Sets the browser tab title for a page and restores the default when it unmounts. */
export function useTitle(title?: string) {
  useEffect(() => {
    document.title = title ? `${title} · ${SITE}` : `${SITE} · See It Before You Seat It`;
    return () => {
      document.title = `${SITE} · See It Before You Seat It`;
    };
  }, [title]);
}
