import { useState, useEffect } from 'react';

/**
 * Hook to detect device orientation
 * @returns {Object} { isPortrait: boolean, isLandscape: boolean }
 */
export function useOrientation() {
  const [orientation, setOrientation] = useState({
    isPortrait: window.innerHeight > window.innerWidth,
    isLandscape: window.innerWidth > window.innerHeight,
  });

  useEffect(() => {
    const handleResize = () => {
      setOrientation({
        isPortrait: window.innerHeight > window.innerWidth,
        isLandscape: window.innerWidth > window.innerHeight,
      });
    };

    // Use orientationchange event if available (mobile devices)
    if (window.screen?.orientation) {
      window.screen.orientation.addEventListener('change', handleResize);
    }
    
    // Fallback to resize event
    window.addEventListener('resize', handleResize);
    
    // Initial check
    handleResize();

    return () => {
      if (window.screen?.orientation) {
        window.screen.orientation.removeEventListener('change', handleResize);
      }
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return orientation;
}

