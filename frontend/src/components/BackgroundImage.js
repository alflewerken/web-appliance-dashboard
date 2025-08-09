import React, { useEffect, useState, useRef } from 'react';

const BackgroundImage = ({
  currentBackground,
  backgroundSettings,
  backgroundRef,
}) => {
  // Track if image has been loaded
  const [imageLoaded, setImageLoaded] = useState(false);
  const lastImageUrl = useRef(null);
  const [currentTheme, setCurrentTheme] = useState('dark');

  // Monitor theme changes
  useEffect(() => {
    const checkTheme = () => {
      const theme = document.body.classList.contains('theme-light')
        ? 'light'
        : 'dark';
      setCurrentTheme(theme);
    };

    checkTheme();

    // Observer für Theme-Änderungen
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => observer.disconnect();
  }, []);

  // Ensure backgroundSettings has valid defaults
  const settings = {
    enabled: backgroundSettings?.enabled ?? false,
    opacity: backgroundSettings?.opacity ?? 0.3,
    blur: backgroundSettings?.blur ?? 0,
    position: backgroundSettings?.position || 'center',
  };

  // Always render if we have a background image URL AND it's enabled
  const shouldRender = currentBackground && currentBackground.url && settings.enabled;

  // Load image only when URL changes
  useEffect(() => {
    if (!shouldRender || !currentBackground?.url) {
      return;
    }

    // Only load if URL has changed
    if (lastImageUrl.current === currentBackground.url) {
      return;
    }

    lastImageUrl.current = currentBackground.url;

    // Ensure URL is absolute
    const absoluteUrl = currentBackground.url.startsWith('http')
      ? currentBackground.url
      : `${window.location.origin}${currentBackground.url}`;

    const img = new Image();
    img.onload = () => {
      setImageLoaded(true);
    };
    img.onerror = e => {
      console.error('🎨 Background image failed to load:', e);
      setImageLoaded(false);
    };
    img.src = absoluteUrl;
  }, [currentBackground?.url, shouldRender]);

  // Apply blur effect
  useEffect(() => {
    if (shouldRender && backgroundRef.current) {
      const element = backgroundRef.current;
      element.style.filter = `blur(${settings.blur}px)`;
      element.style.webkitFilter = `blur(${settings.blur}px)`;
    }
  }, [settings.blur, shouldRender, backgroundRef]);

  if (!shouldRender) {
    return null;
  }

  // Ensure URL is absolute for background-image CSS
  const backgroundUrl = currentBackground.url.startsWith('http')
    ? currentBackground.url
    : `${window.location.origin}${currentBackground.url}`;

  return (
    <>
      {/* Background Image mit verbesserter Blur-Unterstützung */}
      <div
        ref={backgroundRef}
        className="background-image"
        data-background="true"
        data-blur={backgroundSettings.blur}
        style={{
          backgroundImage: `url("${backgroundUrl}")`,
          backgroundPosition: settings.position || 'center',
          backgroundSize: 'cover',
          backgroundRepeat: 'no-repeat',
          backgroundAttachment: 'fixed',
          filter: `blur(${settings.blur || 0}px)`,
          transform: `scale(${1 + (settings.blur || 0) / 100})`,
          '--blur-amount': `${settings.blur || 0}px`,
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          zIndex: -2,
          transition: 'filter 0.3s ease, transform 0.3s ease',
          opacity: imageLoaded ? 1 : 0,
        }}
      />

      {/* Background Overlay für Transparenz/Opacity */}
      <div
        className="background-overlay"
        data-theme={currentTheme}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: currentTheme === 'light' ? '#ffffff' : '#000000',
          opacity: Math.max(0, Math.min(1, 1 - (settings.opacity || 0.3))),
          zIndex: -1,
          pointerEvents: 'none',
          mixBlendMode: currentTheme === 'light' ? 'screen' : 'multiply',
          transition: 'opacity 0.3s ease, background-color 0.3s ease',
        }}
      />
    </>
  );
};

export default BackgroundImage;
