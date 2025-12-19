"use client";

import { useEffect } from "react";

// Fix for iOS Safari viewport height issues
export default function ViewportFix() {
  useEffect(() => {
    // Set CSS custom property for dynamic viewport height
    const setViewportHeight = () => {
      const vh = window.innerHeight * 0.01;
      const vw = window.innerWidth * 0.01;
      document.documentElement.style.setProperty("--vh", `${vh}px`);
      document.documentElement.style.setProperty("--vw", `${vw}px`);
    };

    // Set initial values
    setViewportHeight();

    // Update on resize and orientation change
    window.addEventListener("resize", setViewportHeight);
    window.addEventListener("orientationchange", setViewportHeight);

    // iOS Safari specific: handle address bar show/hide
    let lastHeight = window.innerHeight;
    const checkHeight = () => {
      const currentHeight = window.innerHeight;
      if (Math.abs(currentHeight - lastHeight) > 50) {
        // Significant height change (likely address bar)
        setViewportHeight();
        lastHeight = currentHeight;
      }
    };

    // Check periodically for iOS Safari address bar changes
    const interval = setInterval(checkHeight, 100);

    return () => {
      window.removeEventListener("resize", setViewportHeight);
      window.removeEventListener("orientationchange", setViewportHeight);
      clearInterval(interval);
    };
  }, []);

  return null;
}

