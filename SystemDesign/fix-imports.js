const fs = require('fs');
const path = require('path');
function walk(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      walk(fullPath);
    } else if (fullPath.endsWith('.ts')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      const originalContent = content;
      // Also match variable depth imports just in case
      content = content.replace(/['"](\.\.\/)+packages\/database\/node_modules\/@prisma\/client['"]/g, "'@prisma/client'");
      if (content !== originalContent) {
        fs.writeFileSync(fullPath, content);
        console.log('Updated', fullPath);
      }
    }
  }
}
walk('apps/api/src');
walk('apps/api/test');
walk('apps/web/src');
