'use client';

import { useState, useEffect } from 'react';

export function SplashScreen({ children }: { children: React.ReactNode }) {
  const [show, setShow] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    // Start fade-out after the animation completes
    const fadeTimer = setTimeout(() => setFadeOut(true), 1600);
    // Remove from DOM after fade transition
    const removeTimer = setTimeout(() => setShow(false), 2100);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(removeTimer);
    };
  }, []);

  if (!show) return <>{children}</>;

  return (
    <>
      {show && (
        <div
          className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background transition-opacity duration-500 ${
            fadeOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
          }`}
        >
          {/* Logo with pulse + scale animation */}
          <div className="splash-logo-wrapper">
            <img
              src="/logo.png"
              alt="Share Sathi"
              className="splash-logo-img"
            />
          </div>

          {/* Brand name fade in */}
          <div className="splash-text mt-6">
            <h1 className="text-2xl font-bold tracking-tight">Share Sathi</h1>
            <p className="text-sm text-muted-foreground mt-1">NEPSE Market Automation</p>
          </div>

          {/* Loading bar */}
          <div className="splash-bar-container mt-8">
            <div className="splash-bar" />
          </div>
        </div>
      )}
      {/* Render children behind splash so they load in background */}
      <div style={{ visibility: show ? 'hidden' : 'visible' }}>
        {children}
      </div>
    </>
  );
}