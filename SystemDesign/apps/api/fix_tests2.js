const fs = require('fs');
const path = require('path');
const testDir = path.join('apps', 'api', 'test');
const files = fs.readdirSync(testDir).filter(f => f.endsWith('.test.ts'));

for (const file of files) {
  const filePath = path.join(testDir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  
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
  const mock = new Proxy({}, {
    get(target, prop) {
      if (prop === '$transaction') return vi.fn().mockImplementation(async (cb) => cb(mock));
      if (!target[prop]) target[prop] = createMock();
      return target[prop];
    }
  });
  return mock;
});`;

  content = content.replace(/const prismaMock = vi\.hoisted\(\(\) => \(\{[\s\S]*?\}\)\);/g, proxyCode);

  fs.writeFileSync(filePath, content);
}
console.log('Fixed proxy in all tests');
