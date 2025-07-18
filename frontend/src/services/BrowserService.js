// Service to open URLs in the default system browser
class BrowserService {
  async openInDefaultBrowser(url) {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/browser/open-in-browser', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify({ url }),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('[BrowserService] Server error:', error);
        throw new Error(error.error || 'Failed to open URL');
      }

      const result = await response.json();
      return result.success;
    } catch (error) {
      console.error(
        '[BrowserService] Error opening URL in default browser:',
        error
      );
      // KEIN Fallback zu window.open - wir wollen explizit nur den Standard-Browser
      return false;
    }
  }
}

export default new BrowserService();
