import { useEffect, useRef } from 'react';
import { useDetectCoarsePointer } from './useDetectCoarsePointer';
import BScroll from '@better-scroll/core';
//import MouseWheel from '@better-scroll/mouse-wheel';
import MouseWheel from '../better-scroll/mouse-wheel';
//import IScroll from './iScroll';
import IScroll from '../iscroll-org/iscroll';

BScroll.use(MouseWheel);

const SCROLLER_OPTIONS = {
  mouseWheel: true,
  bounce: false,
  scrollX: true,
  scrollY: false,
  freeScroll: false,
  probeType: 3,
  keyBindings: true,
  eventPassthrough: 'vertical',
  preventDefault: false,
  useTransition: false,
};

export const useVirtualScroll = () => {
  const hasCoarsePointer = useDetectCoarsePointer();
  const bodyRef = useRef();
  const headerRef = useRef();
  const verticalScrollerRef = useRef();
  const virutalScrollRef = useRef();

  useEffect(() => {
    /** html elements */
    const bodyEl = bodyRef.current;
    const headerEl = headerRef.current;
    const horizontalScrollerEl = verticalScrollerRef.current;

    /** create virtual scroller instance */
    const virtualScrollInstance = new IScroll(bodyEl, SCROLLER_OPTIONS);
    virutalScrollRef.current = virtualScrollInstance;

    if (virtualScrollInstance.version) {
      virtualScrollInstance.on('translate', (x, y) => {
        headerEl.scrollTo(x, y);
        bodyEl.scrollTo(x, y);

        horizontalScrollerEl.scrollLeft = x;
      });
    } else {
      virtualScrollInstance.scroller.translater.hooks.on(
        'translate',
        (point) => {
          const x = point.x * -1;
          const y = 0;
          headerEl.scrollTo(x, y);
          bodyEl.scrollTo(x, y);
          horizontalScrollerEl.scrollLeft = x;
        }
      );
    }

    /** vertical scroll on change */
    const onHorizontalScroll = () => {
      const x = horizontalScrollerEl.scrollLeft;

      if (x !== Math.floor(virtualScrollInstance.x * -1))
        virtualScrollInstance.scrollTo(x * -1, 0);
    };
    horizontalScrollerEl.addEventListener('scroll', onHorizontalScroll);

    return () => {
      virtualScrollInstance.destroy();
      horizontalScrollerEl.removeEventListener('scroll', onHorizontalScroll);
    };
  }, []);

  useEffect(() => {
    if (hasCoarsePointer) virutalScrollRef.current.enableMouseEvents();
    else virutalScrollRef.current.disableMouseEvents();
  }, [hasCoarsePointer]);

  return {
    bodyRef,
    headerRef,
    verticalScrollerRef,
  };
};
