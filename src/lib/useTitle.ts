import { useEffect } from 'react';

const SITE = 'SightLine';
const HOME = `${SITE} · See it before you seat it`;

/** Sets the browser tab title for a page and restores the default when it unmounts. */
export function useTitle(title?: string) {
  useEffect(() => {
    document.title = title ? `${title} · ${SITE}` : HOME;
    return () => {
      document.title = HOME;
    };
  }, [title]);
}
