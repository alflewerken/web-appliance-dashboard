# Light Mode CSS Architecture

## Overview
The light mode styling has been completely refactored and unified into a single CSS file: `light-mode-unified.css`

## File Structure

### Primary CSS Files
- **`light-mode-unified.css`** - The ONLY light mode CSS file needed
  - Contains all light mode styles using CSS variables
  - Properly structured with clear sections
  - No `!important` flags except where absolutely necessary
  - Maintains visual parity with dark mode

- **`theme.css`** - Contains only dark mode and auto theme base styles
  - Light mode styles have been removed
  - Auto theme inherits from light-mode-unified.css

### CSS Variable System
Light mode uses a comprehensive CSS variable system:
```css
--bg-primary: #f2f2f7;
--bg-secondary: #ffffff;
--bg-tertiary: #f8f8f8;
--text-primary: #000000;
--text-secondary: #666666;
--color-blue: #007aff;
--color-green: #34c759;
/* etc... */
```

## Key Principles

1. **Service Cards Keep Their Colors**
   - Cards maintain their colorful backgrounds in light mode
   - Icons on colored backgrounds stay white for contrast
   - Action buttons adapt based on their background

2. **Consistent Styling**
   - Light mode mirrors dark mode structure
   - Only colors change, not layout or functionality
   - All components properly styled

3. **No CSS Conflicts**
   - Single source of truth for light mode
   - No overlapping or conflicting styles
   - Clean cascade without excessive overrides
## Migration Guide

### Old Files to Remove
The following CSS files are now obsolete and should be removed:
- `light-mode-minimal.css`
- `light-mode-override-final.css`
- `light-mode-fix.css`
- `light-mode-comprehensive-fix.css`
- `light-mode-critical-fix.css`
- `light-mode-background-fix.css`

### Files That Need Cleanup
These files contain light mode styles that should be removed:
- `glassmorphism.css` - Remove all `body.theme-light` rules
- `background-final.css` - Remove all `body.theme-light` rules
- `background-image.css` - Remove all `body.theme-light` rules
- `SSHDiagnosticPanel.css` - Remove all `body.theme-light` rules

### Import Order in App.js
```javascript
import './App.css';
import './theme.css';
import './styles/light-mode-unified.css'; // The ONLY light mode CSS
import './mobile.css';
// ... other imports
```

## Testing Checklist

### Service Cards
- [ ] Cards maintain their colorful backgrounds
- [ ] Icons are visible on colored backgrounds
- [ ] Action buttons have proper colors
- [ ] Terminal button shows correct icon

### Audit Log
- [ ] Text is readable (proper contrast)
- [ ] Table styling is correct
- [ ] Icons are visible
- [ ] Filters and search work visually

### Settings Modal / SSH Hosts
- [ ] Dialog elements are clearly visible
- [ ] SSH host buttons show correct icons
- [ ] Form inputs have proper styling
- [ ] Contrast ratios are good

### General
- [ ] No visual differences from dark mode (except colors)
- [ ] All icons are visible
- [ ] Proper hover states
- [ ] Smooth transitions

## Maintenance

When adding new components or styles:
1. Add light mode styles ONLY to `light-mode-unified.css`
2. Use the established CSS variables
3. Test in both light and dark modes
4. Avoid using `!important` unless absolutely necessary
5. Keep the same structure as dark mode