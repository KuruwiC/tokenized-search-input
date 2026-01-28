import { useCallback, useEffect, useState } from 'react';

interface VisualViewportState {
  height: number;
  offsetTop: number;
}

/**
 * Hook to track visual viewport dimensions.
 * Useful for adjusting UI when software keyboard appears on mobile.
 *
 * The visual viewport represents the actual visible area of the page,
 * excluding on-screen keyboards. This differs from the layout viewport
 * (window.innerHeight) which doesn't change when the keyboard appears.
 *
 * @returns Object with height and offsetTop of the visual viewport
 */
export function useVisualViewport(): VisualViewportState {
  const [state, setState] = useState<VisualViewportState>(() => ({
    height:
      typeof window !== 'undefined' ? (window.visualViewport?.height ?? window.innerHeight) : 0,
    offsetTop: typeof window !== 'undefined' ? (window.visualViewport?.offsetTop ?? 0) : 0,
  }));

  const updateState = useCallback(() => {
    const vv = window.visualViewport;
    if (vv) {
      setState({
        height: vv.height,
        offsetTop: vv.offsetTop,
      });
    } else {
      setState({
        height: window.innerHeight,
        offsetTop: 0,
      });
    }
  }, []);

  useEffect(() => {
    const vv = window.visualViewport;

    if (vv) {
      vv.addEventListener('resize', updateState);
      vv.addEventListener('scroll', updateState);

      return () => {
        vv.removeEventListener('resize', updateState);
        vv.removeEventListener('scroll', updateState);
      };
    }

    window.addEventListener('resize', updateState);
    return () => {
      window.removeEventListener('resize', updateState);
    };
  }, [updateState]);

  return state;
}
