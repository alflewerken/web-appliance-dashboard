// Utility to wrap commands with color-forcing options
const forceColorInCommand = (command) => {
  // Common patterns for forcing colors in various tools
  const colorPatterns = [
    // ls commands
    { pattern: /^ls(\s|$)/, replacement: 'ls --color=always' },
    { pattern: /^ll(\s|$)/, replacement: 'll --color=always' },
    
    // grep commands
    { pattern: /^grep(\s)/, replacement: 'grep --color=always ' },
    { pattern: /^egrep(\s)/, replacement: 'egrep --color=always ' },
    { pattern: /^fgrep(\s)/, replacement: 'fgrep --color=always ' },
    
    // git commands
    { pattern: /^git(\s)/, replacement: 'git -c color.ui=always ' },
    
    // systemctl commands
    { pattern: /^systemctl(\s)/, replacement: 'SYSTEMD_COLORS=1 systemctl ' },
    
    // journalctl commands
    { pattern: /^journalctl(\s)/, replacement: 'SYSTEMD_COLORS=1 journalctl ' },
    
    // diff commands
    { pattern: /^diff(\s)/, replacement: 'diff --color=always ' },
    
    // tree commands
    { pattern: /^tree(\s|$)/, replacement: 'tree -C' },
    
    // ip commands
    { pattern: /^ip(\s)/, replacement: 'ip -c ' },
  ];

  let modifiedCommand = command;
  
  // Apply color forcing patterns
  for (const { pattern, replacement } of colorPatterns) {
    if (pattern.test(command)) {
      modifiedCommand = command.replace(pattern, replacement);
      break;
    }
  }
  
  // For commands that don't match specific patterns, try to add generic color flags
  if (modifiedCommand === command) {
    // Check if command supports --color flag
    const colorSupportingCommands = ['cat', 'less', 'more', 'tail', 'head'];
    const cmdName = command.split(' ')[0];
    
    if (colorSupportingCommands.includes(cmdName)) {
      // These don't typically have color, but we can try
      modifiedCommand = command;
    }
  }
  
  return modifiedCommand;
};

module.exports = {
  forceColorInCommand,
};
