// Beispiel Integration für RustDesk in ApplianceCard.js
// Diese Änderungen würden in ApplianceCard.js eingefügt werden

// 1. Import hinzufügen (nach anderen Imports)
import RustDeskButton from './RustDeskButton';

// 2. In der Button-Leiste (nach dem Terminal Button, vor FileTransfer)
{appliance.rustdeskEnabled && (
  <RustDeskButton
    applianceId={appliance.id}
    applianceName={appliance.name}
    disabled={appliance.status !== 'running'}
  />
)}

// 3. Oder als Alternative zu RemoteDesktopButton basierend auf Konfiguration
{appliance.remoteDesktopEnabled && (
  appliance.remoteDesktopType === 'rustdesk' ? (
    <RustDeskButton
      applianceId={appliance.id}
      applianceName={appliance.name}
      disabled={appliance.status !== 'running'}
    />
  ) : (
    <RemoteDesktopButton
      appliance={enhancedAppliance}
    />
  )
)}

// 4. Erweiterte Appliance Daten für RustDesk
const enhancedAppliance = {
  ...appliance,
  vncEnabled: appliance.vncEnabled ?? (appliance.remoteDesktopEnabled && appliance.remoteProtocol === 'vnc'),
  rdpEnabled: appliance.rdpEnabled ?? (appliance.remoteDesktopEnabled && appliance.remoteProtocol === 'rdp'),
  rustdeskEnabled: appliance.rustdeskEnabled ?? (appliance.remoteDesktopEnabled && appliance.remoteProtocol === 'rustdesk')
};

// 5. Optional: Smart Detection - Automatisch beste Option wählen
const getRemoteDesktopButton = () => {
  if (!appliance.remoteDesktopEnabled) return null;
  
  // Priorität: RustDesk > RDP > VNC
  if (appliance.platform === 'darwin' || appliance.preferRustDesk) {
    return (
      <RustDeskButton
        applianceId={appliance.id}
        applianceName={appliance.name}
        disabled={appliance.status !== 'running'}
      />
    );
  }
  
  // Fallback zu bestehendem RemoteDesktopButton
  return <RemoteDesktopButton appliance={enhancedAppliance} />;
};

// Dann in der Render-Funktion:
{getRemoteDesktopButton()}
