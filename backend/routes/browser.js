const express = require('express');
const { exec } = require('child_process');
const { promisify } = require('util');
const os = require('os');

const router = express.Router();
const execAsync = promisify(exec);

// Route zum Öffnen einer URL im Standard-Browser
router.post('/open-in-browser', async (req, res) => {
  try {
    const { url } = req.body;

    console.log('[Browser Route] Request received for URL:', url);

    if (!url) {
      console.log('[Browser Route] No URL provided');
      return res.status(400).json({ error: 'URL is required' });
    }

    // Validiere die URL
    try {
      new URL(url);
    } catch (e) {
      console.log('[Browser Route] Invalid URL:', url);
      return res.status(400).json({ error: 'Invalid URL' });
    }

    // Betriebssystem-spezifische Befehle
    const { platform } = process;
    console.log('[Browser Route] Detected platform:', platform);
    console.log(
      '[Browser Route] process.platform raw value:',
      process.platform
    );
    let command;

    switch (platform) {
      case 'darwin': // macOS
        // Öffnet im Standard-Browser (Firefox wenn es der Standard ist)
        command = `open "${url}"`;
        console.log('[Browser Route] macOS detected, using command:', command);
        break;
      case 'win32': // Windows
        command = `start "" "${url}"`;
        console.log(
          '[Browser Route] Windows detected, using command:',
          command
        );
        break;
      case 'linux':
        command = `xdg-open "${url}"`;
        console.log('[Browser Route] Linux detected, using command:', command);
        break;
      default:
        console.log('[Browser Route] Unknown platform:', platform);
        // Fallback für macOS wenn Platform nicht erkannt wird
        if (platform.includes('darwin') || require('os').type() === 'Darwin') {
          command = `open "${url}"`;
          console.log('[Browser Route] Fallback to macOS command');
        } else {
          return res
            .status(400)
            .json({ error: 'Unsupported platform: ' + platform });
        }
    }

    // Führe den Befehl aus
    console.log('[Browser Route] Executing command...');
    const result = await execAsync(command);
    console.log('[Browser Route] Command executed successfully:', result);

    res.json({ success: true, message: 'URL opened in default browser' });
  } catch (error) {
    console.error('[Browser Route] Error opening URL:', error);
    res
      .status(500)
      .json({ error: 'Failed to open URL', details: error.message });
  }
});

module.exports = router;
