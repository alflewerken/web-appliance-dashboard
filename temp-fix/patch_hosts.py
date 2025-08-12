#!/usr/bin/env python3

with open('backend/routes/hosts.js', 'r') as f:
    lines = f.readlines()

# Inject the debug code at line 625 (index 624)
new_lines = lines[:625]
new_lines.append("    console.log('[HOSTS] /remoteDesktopToken called');\n")
new_lines.append("    console.log('[HOSTS] req.user:', req.user);\n")
new_lines.append("    console.log('[HOSTS] req.params:', req.params);\n")
new_lines.append("    console.log('[HOSTS] req.body:', req.body);\n")
new_lines.append("    \n")

# Add the check for req.user
insert_point = 627  # after const hostId and performanceMode
for i in range(625, len(lines)):
    if "const { performanceMode" in lines[i]:
        insert_point = i + 1
        break

new_lines.extend(lines[625:insert_point])
new_lines.append("    \n")
new_lines.append("    // Check if req.user exists\n")
new_lines.append("    if (!req.user || !req.user.id) {\n")
new_lines.append("      console.error('[HOSTS] req.user is missing or incomplete:', req.user);\n")
new_lines.append("      return res.status(401).json({\n")
new_lines.append("        success: false,\n")
new_lines.append("        error: 'Authentication required'\n")
new_lines.append("      });\n")
new_lines.append("    }\n")
new_lines.append("    \n")

# Add the rest
new_lines.extend(lines[insert_point:])

with open('backend/routes/hosts.js', 'w') as f:
    f.writelines(new_lines)

print("File patched successfully")
