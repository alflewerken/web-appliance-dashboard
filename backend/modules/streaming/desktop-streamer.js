const { desktopCapturer } = require('electron');
const SimplePeer = require('simple-peer');
const EventEmitter = require('events');

/**
 * Lightweight Desktop Streaming Server
 * Nutzt direkt WebRTC ohne externe Dependencies
 */
class DesktopStreamer extends EventEmitter {
  constructor() {
    super();
    this.peer = null;
    this.stream = null;
    this.captureOptions = {
      audio: false,
      video: {
        mandatory: {
          chromeMediaSource: 'desktop',
          minWidth: 1280,
          maxWidth: 1920,
          minHeight: 720,
          maxHeight: 1080,
          maxFrameRate: 60
        }
      }
    };
  }

  async startCapture() {
    try {
      // Get available screens/windows
      const sources = await desktopCapturer.getSources({
        types: ['window', 'screen']
      });

      // Use primary screen
      const primaryScreen = sources.find(source => 
        source.name === 'Entire Screen' || source.name.includes('Screen 1')
      );

      if (!primaryScreen) {
        throw new Error('No screen found');
      }

      // Start capturing
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: primaryScreen.id,
            ...this.captureOptions.video.mandatory
          }
        }
      });

      this.emit('capture-started', this.stream);
      return this.stream;
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async createPeerConnection(signalData) {
    this.peer = new SimplePeer({
      initiator: false,
      trickle: true,
      stream: this.stream,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      }
    });

    this.peer.on('signal', data => {
      this.emit('signal', data);
    });

    this.peer.on('connect', () => {
      this.emit('connected');
      this.startInputHandler();
    });

    this.peer.on('data', data => {
      this.handleRemoteInput(JSON.parse(data));
    });

    this.peer.on('error', err => {
      this.emit('error', err);
    });

    // Process initial signal
    if (signalData) {
      this.peer.signal(signalData);
    }

    return this.peer;
  }

  handleRemoteInput(input) {
    const robot = require('robotjs');
    
    switch (input.type) {
      case 'mouse-move':
        const screenSize = robot.getScreenSize();
        robot.moveMouse(
          input.x * screenSize.width,
          input.y * screenSize.height
        );
        break;
        
      case 'mouse-click':
        robot.mouseClick(input.button || 'left');
        break;
        
      case 'key-down':
        robot.keyToggle(input.key, 'down');
        break;
        
      case 'key-up':
        robot.keyToggle(input.key, 'up');
        break;
        
      case 'scroll':
        robot.scrollMouse(input.deltaX, input.deltaY);
        break;
    }
  }

  startInputHandler() {
    // Optional: Send periodic updates about system state
    setInterval(() => {
      if (this.peer && this.peer.connected) {
        this.peer.send(JSON.stringify({
          type: 'stats',
          timestamp: Date.now(),
          fps: this.getCurrentFPS(),
          bitrate: this.peer._pc.getStats() // Simplified
        }));
      }
    }, 1000);
  }

  getCurrentFPS() {
    // Simplified FPS calculation
    return 60; // Would implement actual FPS tracking
  }

  stop() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
    
    this.emit('stopped');
  }
}

module.exports = DesktopStreamer;
