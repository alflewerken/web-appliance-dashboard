// Utility function to open URL in a new browser window
export const openInNewWindow = (url, windowName = null) => {
  // Ensure we have a unique window name
  const name = windowName || 'AppWindow_' + Date.now();

  // Check if we're in a PWA or can use special APIs
  if (
    window.navigator.standalone ||
    window.matchMedia('(display-mode: standalone)').matches
  ) {
    // In PWA mode, try to break out to the browser
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';

    // Add special attributes that might help
    a.setAttribute('data-external', 'true');
    a.setAttribute('data-new-window', 'true');

    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return true;
  }

  // Try different methods to force a new window

  // Method 1: Use window.open with specific features
  const features = [
    'width=' + Math.min(1200, window.screen.availWidth * 0.9),
    'height=' + Math.min(800, window.screen.availHeight * 0.9),
    'left=' + Math.floor((window.screen.availWidth - 1200) / 2),
    'top=' + Math.floor((window.screen.availHeight - 800) / 2),
    'toolbar=yes',
    'location=yes',
    'directories=no',
    'status=yes',
    'menubar=yes',
    'scrollbars=yes',
    'resizable=yes',
    'copyhistory=yes',
  ].join(',');

  // First attempt: Direct window.open
  let newWindow = window.open(url, name, features);

  if (newWindow && !newWindow.closed) {
    newWindow.focus();
    return true;
  }

  // Method 2: Create a form and submit it
  const form = document.createElement('form');
  form.method = 'GET';
  form.action = url;
  form.target = name;
  form.style.display = 'none';

  // Add form to body and submit
  document.body.appendChild(form);

  // Open window first, then submit form to it
  newWindow = window.open('about:blank', name, features);
  if (newWindow) {
    form.submit();
    newWindow.focus();
    document.body.removeChild(form);
    return true;
  }

  document.body.removeChild(form);

  // Method 3: Use window.location for external protocol
  if (url.startsWith('http://') || url.startsWith('https://')) {
    // For web URLs, try to use a different approach
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = url;
    document.body.appendChild(iframe);

    setTimeout(() => {
      document.body.removeChild(iframe);
    }, 100);
  }

  // Method 4: Fallback to simple window.open
  window.open(url, '_blank');
  return false;
};
