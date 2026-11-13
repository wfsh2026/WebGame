import webConfig from '../../../../apps/web/vite.config';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const rootUrl = new URL('.', import.meta.url);
const root = fileURLToPath(rootUrl);
const inputUrl = new URL('./online.html', import.meta.url);
const input = fileURLToPath(inputUrl);
const packageUrl = new URL('../../../../apps/web/package.json', import.meta.url);
const requireWeb = createRequire(packageUrl);
const alias = ['react', 'react/jsx-runtime', 'react/jsx-dev-runtime', 'react-dom/client', '@web-game-world/contracts'].map(name => {
  const replacement = requireWeb.resolve(name);
  return { find: name, replacement };
});
alias.reverse();
export default { ...webConfig, root, resolve: { alias, dedupe: ['react', 'react-dom'] }, build: { rollupOptions: { input } } };
