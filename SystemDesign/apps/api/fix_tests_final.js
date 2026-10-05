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

  // Safe replacement for prismaMock
  const pmStart = content.indexOf('const prismaMock =');
  const pmEnd = content.indexOf("vi.mock('@prisma/client'");
  if (pmStart !== -1 && pmEnd !== -1) {
    content = content.substring(0, pmStart) + proxyCode + '\n\n' + content.substring(pmEnd);
  }

  // Safe replacement for fastify/jwt
  const jwtMockRegex = /vi\.mock\('@fastify\/jwt'[\s\S]*?\}\);\n/g;
  const newJwtMock = `vi.mock('@fastify/jwt', async (importOriginal) => {
  const fp = require('fastify-plugin');
  return {
    default: fp(async function (fastify: any, opts: any) {
      fastify.decorate('jwtVerify', async function () { 
        this.user = { id: 'user1', role: 'CUSTOMER', name: 'Test User' };
      });
      fastify.decorateRequest('jwtVerify', async function () { 
        this.user = { id: 'user1', role: 'CUSTOMER', name: 'Test User' };
      });
    })
  };
});\n`;
  content = content.replace(jwtMockRegex, newJwtMock);

  fs.writeFileSync(filePath, content);
}
console.log('Fixed test mocks');
