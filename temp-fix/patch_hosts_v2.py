#!/usr/bin/env python3

# Read the file
with open('backend/routes/hosts.js', 'r') as f:
    lines = f.readlines()

# Find the line with "router.post('/:id/remoteDesktopToken'"
for i in range(len(lines)):
    if "router.post('/:id/remoteDesktopToken'" in lines[i]:
        # Found it at line i
        # Insert debug logs after "try {"
        for j in range(i, i+10):
            if "try {" in lines[j]:
                # Insert debug lines after this line
                insert_index = j + 1
                
                debug_lines = [
                    "    console.log('[HOSTS] /remoteDesktopToken called');\n",
                    "    console.log('[HOSTS] req.user:', req.user);\n",
                    "    console.log('[HOSTS] req.params:', req.params);\n",
                    "    console.log('[HOSTS] req.body:', req.body);\n",
                    "    \n"
                ]
                
                # Insert the debug lines
                for line in reversed(debug_lines):
                    lines.insert(insert_index, line)
                
                # Now find where to insert the req.user check
                # It should be after the performanceMode line
                for k in range(insert_index + len(debug_lines), insert_index + 20):
                    if "const { performanceMode" in lines[k]:
                        # Insert the check after this line
                        check_index = k + 1
                        
                        check_lines = [
                            "    \n",
                            "    // Check if req.user exists\n",
                            "    if (!req.user || !req.user.id) {\n",
                            "      console.error('[HOSTS] req.user is missing or incomplete:', req.user);\n",
                            "      return res.status(401).json({\n",
                            "        success: false,\n",
                            "        error: 'Authentication required'\n",
                            "      });\n",
                            "    }\n"
                        ]
                        
                        for line in reversed(check_lines):
                            lines.insert(check_index, line)
                        
                        break
                break
        break

# Write the modified file
with open('backend/routes/hosts.js', 'w') as f:
    f.writelines(lines)

print("File patched successfully")
