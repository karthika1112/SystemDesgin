const fs = require('fs');
const path = require('path');
const testDir = path.join('apps', 'api', 'test');
const files = fs.readdirSync(testDir).filter(f => f.endsWith('.test.ts'));

for (const file of files) {
  const filePath = path.join(testDir, file);
  let content = fs.readFileSync(filePath, 'utf8');

  // Fix Fastify JWT
  const jwtStart = content.indexOf("vi.mock('@fastify/jwt'");
  if (jwtStart !== -1) {
    const describeStart = content.indexOf('describe(', jwtStart);
    if (describeStart !== -1) {
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
});\n\n`;
      content = content.substring(0, jwtStart) + newJwtMock + content.substring(describeStart);
    }
  }

  // Also fix prismaMock if it's still missing 'findUnique'
  // I will just use regex to replace it globally since I know the exact boundaries
  const pmStart = content.indexOf('const prismaMock =');
  const pmEnd = content.indexOf("vi.mock('@prisma/client'");
  if (pmStart !== -1 && pmEnd !== -1) {
    const proxyCode = `const prismaMock = vi.hoisted(() => {
  const createMock = () => {
    const fn = vi.fn();
    return new Proxy(fn, {
      get(target, prop) {
        if (prop === 'mockResolvedValue') return target.mockResolvedValue.bind(target);
        if (prop === 'mockReturnValue') return target.mockReturnValue.bind(target);
        if (prop === 'mockImplementation') return target.mockImplementation.bind(target);
        if (prop === 'mockClear') return target.mockClear.bind(target);
        if (prop === 'mockReset') return target.mockReset.bind(target);
        if (prop === 'mockRestore') return target.mockRestore.bind(target);
        if (prop === 'mockName') return target.mockName.bind(target);
        if (prop === 'mock') return target.mock;
        
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
});\n\n`;
    content = content.substring(0, pmStart) + proxyCode + content.substring(pmEnd);
  }

  fs.writeFileSync(filePath, content);
}
console.log('Fixed using robust substring indexing');
