#!/usr/bin/env python3

# Read the file
with open('backend/routes/hosts.js', 'r') as f:
    lines = f.readlines()

# Find the line with "router.post('/:id/remoteDesktopToken'"
for i in range(len(lines)):
    if "router.post('/:id/remoteDesktopToken', verifyToken" in lines[i]:
        # Replace the line to add a middleware before verifyToken
        lines[i] = """router.post('/:id/remoteDesktopToken', (req, res, next) => {
  console.log('[HOSTS] /remoteDesktopToken endpoint hit!');
  console.log('[HOSTS] Request headers:', req.headers);
  console.log('[HOSTS] Request params:', req.params);
  next();
}, verifyToken, async (req, res) => {
"""
        break

# Write the modified file
with open('backend/routes/hosts.js', 'w') as f:
    f.writelines(lines)

print("File patched successfully")
