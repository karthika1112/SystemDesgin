const fs = require('fs');
const path = require('path');

const dirs = [
  'apps/web/src',
  'apps/api/src/modules/auth',
  'apps/api/src/modules/product',
  'apps/api/src/modules/cart',
  'apps/api/src/modules/inventory',
  'apps/api/src/modules/reservation',
  'apps/api/src/modules/checkout',
  'apps/api/src/modules/payment',
  'apps/api/src/modules/order',
  'apps/api/src/modules/shipment',
  'apps/api/src/modules/notification',
  'packages/database/src',
  'packages/shared/src',
  'packages/config/src',
  'packages/types/src',
  'infrastructure',
  'docs/architecture',
  'docs/api',
  'docs/adr'
];

dirs.forEach(dir => fs.mkdirSync(dir, { recursive: true }));

const pkgJson = (name) => JSON.stringify({
  name,
  version: '1.0.0',
  main: 'index.js',
  scripts: {
    test: 'echo "No tests yet"',
    build: 'tsc',
    lint: 'eslint .',
    typecheck: 'tsc --noEmit'
  },
  dependencies: {},
  devDependencies: {
    typescript: '^5.4.5'
  }
}, null, 2);

fs.writeFileSync('apps/web/package.json', pkgJson('@salestorm/web'));
fs.writeFileSync('apps/api/package.json', pkgJson('@salestorm/api'));
fs.writeFileSync('packages/database/package.json', pkgJson('@salestorm/database'));
fs.writeFileSync('packages/shared/package.json', pkgJson('@salestorm/shared'));
fs.writeFileSync('packages/config/package.json', pkgJson('@salestorm/config'));
fs.writeFileSync('packages/types/package.json', pkgJson('@salestorm/types'));

fs.writeFileSync('tsconfig.base.json', JSON.stringify({
  compilerOptions: {
    target: 'es2022',
    module: 'commonjs',
    strict: true,
    esModuleInterop: true,
    skipLibCheck: true,
    forceConsistentCasingInFileNames: true
  }
}, null, 2));

const tsconfig = (deps) => JSON.stringify({
  extends: '../../tsconfig.base.json',
  compilerOptions: {
    outDir: './dist',
    rootDir: './src'
  },
  include: ['src/**/*']
}, null, 2);

['apps/web', 'apps/api', 'packages/database', 'packages/shared', 'packages/config', 'packages/types'].forEach(pkg => {
  fs.writeFileSync(path.join(pkg, 'tsconfig.json'), tsconfig());
  fs.writeFileSync(path.join(pkg, 'src/index.ts'), '// Entry point\n');
});
