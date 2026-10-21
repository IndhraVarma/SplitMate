import { useEffect } from 'react';

/** Keeps the browser tab title in step with the current screen. */
export function useDocumentTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} - SplitMate` : 'SplitMate';
  }, [title]);
}

export default useDocumentTitle;
