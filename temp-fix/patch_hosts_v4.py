#!/usr/bin/env python3

# Read the file
with open('backend/routes/hosts.js', 'r') as f:
    content = f.read()

# Replace the complex route definition with a simpler one
old_route = """router.post('/:id/remoteDesktopToken', (req, res, next) => {
  console.log('[HOSTS] /remoteDesktopToken endpoint hit!');
  console.log('[HOSTS] Request headers:', req.headers);
  console.log('[HOSTS] Request params:', req.params);
  next();
}, verifyToken, async (req, res) => {"""

new_route = """router.post('/:id/remoteDesktopToken', async (req, res) => {
  console.log('[HOSTS] /remoteDesktopToken endpoint hit DIRECTLY!');
  console.log('[HOSTS] Request params:', req.params);
  console.log('[HOSTS] Request headers authorization:', req.headers.authorization);
  
  // Manual token verification for debugging
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    console.log('[HOSTS] No token provided');
    return res.status(401).json({ error: 'No token provided' });
  }
  
  console.log('[HOSTS] Token found, attempting to verify...');
  
  // For now, just return an error to see if we get here
  return res.status(500).json({ error: 'Debug: Route reached successfully, token verification disabled for testing' });
  
  // Original try block follows after testing"""

content = content.replace(old_route, new_route)

# Write the modified file
with open('backend/routes/hosts.js', 'w') as f:
    f.write(content)

print("File patched successfully")
