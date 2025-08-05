/**
 * Copy text to clipboard with fallback for browsers that don't support navigator.clipboard
 * @param {string} text - The text to copy
 * @returns {Promise<boolean>} - Returns true if successful, false otherwise
 */
export const copyToClipboard = async (text) => {
  // Try modern clipboard API first
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      console.warn('Clipboard API failed, trying fallback:', err);
    }
  }

  // Fallback for older browsers or non-HTTPS
  const textArea = document.createElement('textarea');
  textArea.value = text;
  
  // Make it invisible
  textArea.style.position = 'fixed';
  textArea.style.left = '-999999px';
  textArea.style.top = '-999999px';
  
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  
  try {
    const successful = document.execCommand('copy');
    textArea.remove();
    return successful;
  } catch (err) {
    console.error('Fallback copy failed:', err);
    textArea.remove();
    return false;
  }
};
