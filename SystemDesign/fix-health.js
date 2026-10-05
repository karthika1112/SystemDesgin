const fs = require('fs');

function replaceQueryRaw(file) {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/\$queryRaw\`SELECT 1\`/g, '\$runCommandRaw({ ping: 1 })');
  fs.writeFileSync(file, content);
  console.log('Fixed', file);
}

replaceQueryRaw('apps/api/src/modules/health/health.routes.ts');
replaceQueryRaw('apps/api/src/modules/admin/observability.controller.ts');
