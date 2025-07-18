// Utility function to open URL in the default browser
export const openInDefaultBrowser = url => {
  // Für macOS: Verwende einen speziellen URL-Schema Handler
  // Dies funktioniert nur, wenn ein entsprechender Handler installiert ist

  // Option 1: Versuche mit einem speziellen Protokoll
  // Das würde einen installierten URL-Handler benötigen
  const defaultBrowserUrl = `default-browser://${encodeURIComponent(url)}`;

  // Option 2: Für Electron-Apps - check if we're in Electron
  if (window.electron && window.electron.shell) {
    window.electron.shell.openExternal(url);
    return true;
  }

  // Option 3: Standard Web-Ansatz - öffnet im aktuellen Browser
  // Mit speziellen Features für maximale Kompatibilität
  const width = window.screen.availWidth * 0.8;
  const height = window.screen.availHeight * 0.8;
  const left = (window.screen.availWidth - width) / 2;
  const top = (window.screen.availHeight - height) / 2;

  const features = [
    `width=${Math.round(width)}`,
    `height=${Math.round(height)}`,
    `left=${Math.round(left)}`,
    `top=${Math.round(top)}`,
    'toolbar=yes',
    'location=yes',
    'directories=no',
    'status=yes',
    'menubar=yes',
    'scrollbars=yes',
    'resizable=yes',
  ].join(',');

  // Öffne in neuem Fenster
  const newWindow = window.open(url, '_blank', features);

  if (newWindow) {
    newWindow.focus();
    return true;
  }

  // Fallback
  window.open(url, '_blank');
  return false;
};

// Alternative: Erstelle einen Download-Link, der vom System geöffnet wird
export const openViaDownload = url => {
  // Erstelle eine .url Datei (Internet Shortcut)
  const urlContent = `[InternetShortcut]\nURL=${url}\n`;
  const blob = new Blob([urlContent], {
    type: 'application/internet-shortcut',
  });
  const downloadUrl = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = downloadUrl;
  a.download = 'open-link.url';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(downloadUrl);
};
