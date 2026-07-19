'use client';
import { useState, useEffect } from 'react';

export type ScreenSize = 'mobile' | 'tablet' | 'laptop' | 'desktop';

export function useScreenSize(): { width: number; size: ScreenSize; isMobile: boolean; isTablet: boolean; isLaptop: boolean; isDesktop: boolean } {
  const [width, setWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1280);

  useEffect(() => {
    function handle() { setWidth(window.innerWidth); }
    window.addEventListener('resize', handle);
    handle();
    return () => window.removeEventListener('resize', handle);
  }, []);

  const size: ScreenSize = width < 640 ? 'mobile' : width < 1024 ? 'tablet' : width < 1440 ? 'laptop' : 'desktop';

  return {
    width,
    size,
    isMobile: width < 640,
    isTablet: width >= 640 && width < 1024,
    isLaptop: width >= 1024 && width < 1440,
    isDesktop: width >= 1440,
  };
}

// Responsive value helper - pick value based on screen size
export function rv<T>(mobile: T, tablet?: T, laptop?: T, desktop?: T) {
  return { mobile, tablet: tablet ?? mobile, laptop: laptop ?? tablet ?? mobile, desktop: desktop ?? laptop ?? tablet ?? mobile };
}
