const fs = require('fs');
const path = require('path');

// Helper function to generate Swagger documentation based on route pattern
function generateSwaggerDoc(method, path, routeContent) {
  const hasAuth = routeContent.includes('verifyToken');
  const hasParams = path.includes(':');
  const isGet = method === 'get';
  const isPost = method === 'post';
  const isPut = method === 'put';
  const isDelete = method === 'delete';
  
  // Extract route name from path
  const routeName = path.split('/').filter(p => p && !p.startsWith(':')).pop() || 'resource';
  const resourceName = routeName.charAt(0).toUpperCase() + routeName.slice(1);
  
  let swagger = `/**\n * @swagger\n * ${path}:\n *   ${method}:\n`;
  
  // Add summary
  if (isGet && !hasParams) {
    swagger += `     summary: Get all ${routeName}\n`;
  } else if (isGet && hasParams) {
    swagger += `     summary: Get a single ${routeName.replace(/s$/, '')}\n`;
  } else if (isPost) {
    swagger += `     summary: Create a new ${routeName.replace(/s$/, '')}\n`;
  } else if (isPut) {
    swagger += `     summary: Update ${routeName.replace(/s$/, '')}\n`;
  } else if (isDelete) {
    swagger += `     summary: Delete ${routeName.replace(/s$/, '')}\n`;
  }
  
  // Add tags
  swagger += `     tags: [${resourceName}]\n`;
  
  // Add security if needed
  if (hasAuth) {
    swagger += `     security:\n       - bearerAuth: []\n`;
  }
  
  // Add parameters for routes with params
  if (hasParams) {
    const paramName = path.match(/:(\w+)/)?.[1] || 'id';
    swagger += `     parameters:\n`;
    swagger += `       - in: path\n`;
    swagger += `         name: ${paramName}\n`;
    swagger += `         schema:\n`;
    swagger += `           type: string\n`;
    swagger += `         required: true\n`;
    swagger += `         description: The ${paramName}\n`;
  }
  
  // Add request body for POST/PUT
  if (isPost || isPut) {
    swagger += `     requestBody:\n`;
    swagger += `       required: true\n`;
    swagger += `       content:\n`;
    swagger += `         application/json:\n`;
    swagger += `           schema:\n`;
    swagger += `             type: object\n`;
    swagger += `             properties:\n`;
    swagger += `               # TODO: Add properties based on your data model\n`;
  }
  
  // Add responses
  swagger += `     responses:\n`;
  
  if (isGet) {
    swagger += `       200:\n`;
    swagger += `         description: Successful response\n`;
    swagger += `         content:\n`;
    swagger += `           application/json:\n`;
    swagger += `             schema:\n`;
    if (!hasParams) {
      swagger += `               type: array\n`;
      swagger += `               items:\n`;
      swagger += `                 type: object\n`;
    } else {
      swagger += `               type: object\n`;
    }
  } else if (isPost) {
    swagger += `       201:\n`;
    swagger += `         description: Created successfully\n`;
    swagger += `         content:\n`;
    swagger += `           application/json:\n`;
    swagger += `             schema:\n`;
    swagger += `               type: object\n`;
  } else if (isPut) {
    swagger += `       200:\n`;
    swagger += `         description: Updated successfully\n`;
    swagger += `         content:\n`;
    swagger += `           application/json:\n`;
    swagger += `             schema:\n`;
    swagger += `               type: object\n`;
  } else if (isDelete) {
    swagger += `       204:\n`;
    swagger += `         description: Deleted successfully\n`;
  }
  
  // Add error responses
  if (hasParams) {
    swagger += `       404:\n`;
    swagger += `         description: Not found\n`;
  }
  
  if (hasAuth) {
    swagger += `       401:\n`;
    swagger += `         description: Unauthorized\n`;
  }
  
  swagger += `       500:\n`;
  swagger += `         description: Server error\n`;
  swagger += ` */\n`;
  
  return swagger;
}

// Function to process a single file
function processFile(filePath) {
  console.log(`Processing: ${filePath}`);
  
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  // Regular expression to find router methods
  const routerRegex = /router\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/g;
  
  let match;
  const matches = [];
  
  while ((match = routerRegex.exec(content)) !== null) {
    matches.push({
      method: match[1],
      path: match[2],
      index: match.index,
      fullMatch: match[0]
    });
  }
  
  // Process matches in reverse order to avoid index shifting
  for (let i = matches.length - 1; i >= 0; i--) {
    const { method, path, index } = matches[i];
    
    // Check if there's already a swagger comment before this route
    const beforeRoute = content.substring(Math.max(0, index - 500), index);
    if (beforeRoute.includes('@swagger')) {
      console.log(`  Skipping ${method.toUpperCase()} ${path} - already documented`);
      continue;
    }
    
    // Find the start of the line
    let lineStart = index;
    while (lineStart > 0 && content[lineStart - 1] !== '\n') {
      lineStart--;
    }
    
    // Generate and insert swagger documentation
    const swaggerDoc = generateSwaggerDoc(method, path, content.substring(index, index + 200));
    content = content.substring(0, lineStart) + swaggerDoc + content.substring(lineStart);
    modified = true;
    console.log(`  Added documentation for ${method.toUpperCase()} ${path}`);
  }
  
  if (modified) {
    fs.writeFileSync(filePath, content);
    console.log(`  ✓ Updated ${filePath}`);
  } else {
    console.log(`  ✓ No changes needed for ${filePath}`);
  }
}

// Function to process all route files
function processRoutes(routesDir) {
  const files = fs.readdirSync(routesDir);
  
  files.forEach(file => {
    const filePath = path.join(routesDir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      // Recursively process subdirectories
      processRoutes(filePath);
    } else if (file.endsWith('.js') && !file.includes('.test.') && !file.includes('.spec.')) {
      processFile(filePath);
    }
  });
}

// Main execution
const routesPath = path.join(__dirname, 'routes');
console.log('Adding Swagger documentation to route files...\n');
processRoutes(routesPath);
console.log('\nSwagger documentation generation complete!');
console.log('\nIMPORTANT: Please review the generated documentation and:');
console.log('1. Update the TODO comments with actual property definitions');
console.log('2. Adjust response schemas to match your data models');
console.log('3. Add more detailed descriptions where needed');
