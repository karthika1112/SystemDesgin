const fs = require('fs');
const path = require('path');
const testDir = path.join('apps', 'api', 'test');
const files = fs.readdirSync(testDir).filter(f => f.endsWith('.test.ts'));
for (const file of files) {
  const filePath = path.join(testDir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Fix next() in fastify/jwt mock
  content = content.replace(/function \(fastify: any, opts: any\)/g, 'function (fastify: any, opts: any, next: any)');
  content = content.replace(/actual\.default\(fastify, opts\)/g, 'actual.default(fastify, opts, next)');

  // Fix prismaMock with a proxy
  const proxyCode = `const prismaMock = vi.hoisted(() => {
  const createMock = () => {
    const fn = vi.fn();
    return new Proxy(fn, {
      get(target, prop) {
        if (prop in target) return target[prop];
        if (prop === 'then') return undefined;
        if (!target[prop]) target[prop] = createMock();
        return target[prop];
      }
    });
  };
  return new Proxy({}, {
    get(target, prop) {
      if (prop === '$transaction') return vi.fn().mockImplementation(async (cb) => cb(target));
      if (!target[prop]) target[prop] = createMock();
      return target[prop];
    }
  });
});`;

  content = content.replace(/const prismaMock = vi\.hoisted\(\(\) => \(\{\r?\n\r?\n\}\)\);/, proxyCode);
  
  fs.writeFileSync(filePath, content);
}
console.log('Fixed tests with Proxy and next');
