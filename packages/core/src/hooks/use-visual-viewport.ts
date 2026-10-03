import { useCallback, useEffect, useState } from 'react';

interface VisualViewportState {
  height: number;
  offsetTop: number;
}

/**
 * The height and top offset of the visual viewport, the part of the page actually
 * visible. Unlike the layout viewport (`window.innerHeight`) it shrinks when an
 * on-screen keyboard appears.
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
