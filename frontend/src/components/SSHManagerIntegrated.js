import React from 'react';
import SSHHostManagerResponsive from './SSHHostManagerResponsive';

const SSHManagerIntegrated = ({ onTerminalOpen, embedded }) => {
  // Die SSHHostManagerResponsive-Komponente übernimmt jetzt die gesamte Logik
  // und passt sich automatisch an die Bildschirmgröße an
  return (
    <SSHHostManagerResponsive 
      onTerminalOpen={onTerminalOpen}
      embedded={embedded}
    />
  );
};

export default SSHManagerIntegrated;
