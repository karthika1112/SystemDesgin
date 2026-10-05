const fs = require('fs');

let content = fs.readFileSync('apps/api/src/app.ts', 'utf8');
content = content.replace('details: { body: request.body }', 'details: { body: request.body as any }');
fs.writeFileSync('apps/api/src/app.ts', content);

let obs = fs.readFileSync('apps/api/src/modules/admin/observability.controller.ts', 'utf8');
obs = obs.replace(/\$queryRaw\`SELECT 1\`/g, '$runCommandRaw({ ping: 1 })');
fs.writeFileSync('apps/api/src/modules/admin/observability.controller.ts', obs);

let aip = fs.readFileSync('apps/api/src/modules/ai/ai.provider.ts', 'utf8');
aip = aip.replace(/let evidence = \[\];/g, 'let evidence: string[] = [];');
fs.writeFileSync('apps/api/src/modules/ai/ai.provider.ts', aip);

let aic = fs.readFileSync('apps/api/src/modules/ai/ai.controller.ts', 'utf8');
aic = aic.replace(/, AIRiskService/g, '');
fs.writeFileSync('apps/api/src/modules/ai/ai.controller.ts', aic);

let evc = fs.readFileSync('apps/api/src/modules/event/consumer.base.ts', 'utf8');
evc = evc.replace(/['"]\.\.\/plugins\/rabbitmq['"]/g, "'../../plugins/rabbitmq'");
evc = evc.replace(/['"]\.\.\/plugins\/redis['"]/g, "'../../plugins/redis'");
fs.writeFileSync('apps/api/src/modules/event/consumer.base.ts', evc);
