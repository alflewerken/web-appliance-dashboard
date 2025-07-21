// Fallback-Lösung für Guacamole URL-Generierung
// Falls die automatische Erkennung nicht funktioniert

const getGuacamoleUrl = (req) => {
  // Option 1: Verwende EXTERNAL_URL aus Environment
  if (process.env.EXTERNAL_URL) {
    const baseUrl = process.env.EXTERNAL_URL.replace(/\/$/, '');
    return baseUrl;
  }
  
  // Option 2: Verwende X-Forwarded Headers
  const protocol = req.get('x-forwarded-proto') || req.protocol;
  const host = req.get('x-forwarded-host') || req.get('host');
  
  // Option 3: Erkenne bekannte Hosts und korrigiere sie
  if (host === 'localhost:3001' || host === 'backend:3001') {
    // Wenn vom iPhone, nutze die IP aus EXTERNAL_URL
    if (req.get('user-agent')?.includes('iPhone')) {
      return 'http://192.168.178.70:9080';
    }
    // Sonst nutze localhost mit richtigem Port
    return 'http://localhost:9080';
  }
  
  return `${protocol}://${host}`;
};

module.exports = { getGuacamoleUrl };
