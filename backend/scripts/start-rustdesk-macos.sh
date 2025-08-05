#!/bin/bash
# Start RustDesk on macOS

# Check if RustDesk is installed
if [ ! -d "/Applications/RustDesk.app" ]; then
    echo "RustDesk is not installed"
    exit 1
fi

# Check if already running
if pgrep -x "RustDesk" > /dev/null; then
    echo "RustDesk is already running"
else
    echo "Starting RustDesk..."
    # Start RustDesk
    open -a RustDesk
    sleep 3
fi

# Get the ID
RUSTDESK_ID=$(/Applications/RustDesk.app/Contents/MacOS/RustDesk --get-id 2>&1 | grep -E '^[0-9]{9}$' | head -1)

if [ -n "$RUSTDESK_ID" ]; then
    echo "RustDesk ID: $RUSTDESK_ID"
    
    # Open System Preferences if needed
    echo "Opening System Preferences for permissions..."
    osascript << EOF
tell application "System Preferences"
    activate
    reveal anchor "Privacy" of pane id "com.apple.preference.security"
end tell

tell application "System Events"
    tell process "System Preferences"
        delay 1
        -- Try to select Screen Recording
        try
            click radio button "Screen Recording" of tab group 1 of window "Security & Privacy"
        end try
    end tell
end tell
EOF
else
    echo "Could not get RustDesk ID"
fi
