import React, { useState, useEffect } from 'react';
import SSHHostManager from './SSHHostManager';
import MobileSSHHostManager from './Mobile/MobileSSHHostManager';

const SSHHostManagerResponsive = ({ onBack, onTerminalOpen, embedded }) => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    // Initial check
    checkMobile();

    // Add resize listener
    window.addEventListener('resize', checkMobile);

    return () => {
      window.removeEventListener('resize', checkMobile);
    };
  }, []);

  if (isMobile) {
    return <MobileSSHHostManager onBack={onBack} onTerminalOpen={onTerminalOpen} embedded={embedded} />;
  }

  return <SSHHostManager onTerminalOpen={onTerminalOpen} embedded={embedded} />;
};

export default SSHHostManagerResponsive;
