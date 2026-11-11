// Executes the actual AuthProvider with synthetic hook state and browser stores.
// Passing confirms the observed bug; no browser or authentication request is sent.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { transformWithOxc } from '../../client/node_modules/vite/dist/node/index.js';

const require = createRequire(new URL('../../client/package.json', import.meta.url));
const moduleUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const fixtureUrl = moduleUrl('export const fixture = {};');
const { fixture } = await import(fixtureUrl);
const hooksUrl = moduleUrl(`import { fixture } from ${JSON.stringify(fixtureUrl)};
  export const createContext = () => ({ Provider: () => null });
  export const useContext = () => null;
  export const useState = initial => fixture.state(initial);
  export const useEffect = work => fixture.effect(work);
  export const useCallback = work => work;`);
const authUrl = moduleUrl(`import { fixture } from ${JSON.stringify(fixtureUrl)}; export const loginUser = async () => fixture.login();`);
const source = await fs.readFile(new URL('../../client/src/shared/hooks/AuthContext.jsx', import.meta.url), 'utf8');
const compiled = await transformWithOxc(source, 'AuthContext.jsx', { jsx: { runtime: 'automatic', development: false } });
let code = compiled.code;
for (const [name, url] of Object.entries({
  react: hooksUrl,
  'react/jsx-runtime': pathToFileURL(require.resolve('react/jsx-runtime')).href,
  '../../features/auth/api/authApi': authUrl,
  '../../features/bookstore/pendingOperation.js': new URL('../../client/src/features/bookstore/pendingOperation.js', import.meta.url).href,
  '../utils/safeDiagnostics.js': new URL('../../client/src/shared/utils/safeDiagnostics.js', import.meta.url).href,
})) code = code.replaceAll(JSON.stringify(name), JSON.stringify(url));
const { AuthProvider } = await import(moduleUrl(code));

function harness(t) {
  for (const name of ['localStorage', 'sessionStorage']) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, name), values = new Map();
    Object.defineProperty(globalThis, name, { configurable: true, value: {
      getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)),
      removeItem: key => values.delete(key), clear: () => values.clear(),
      get length() { return values.size; }, key: index => [...values.keys()][index] ?? null,
    } });
    t.after(() => { if (previous) Object.defineProperty(globalThis, name, previous); else delete globalThis[name]; });
  }
  let memory = [], effects = [], cursor = 0;
  Object.assign(fixture, {
    state(initial) { const index = cursor++; if (!(index in memory)) memory[index] = initial;
      return [memory[index], value => { memory[index] = value; }]; },
    effect(work) { const index = cursor++; if (!(index in memory)) { memory[index] = true; effects.push(work); } },
  });
  const render = () => { cursor = 0; return AuthProvider({ children: null }).props.value; };
  const mount = () => { memory = []; effects = []; render(); effects.splice(0).forEach(work => work()); return render(); };
  return { mount, render };
}

test('BUG: remembered account A token is restored with account B identity after a non-remembered login', async t => {
  const h = harness(t);
  localStorage.setItem('jwt', 'synthetic-account-A-token');
  localStorage.setItem('user', JSON.stringify({ _id: 'A', identifier: 'account-a', role: 'admin' }));
  const auth = h.mount();
  assert.equal(auth.user._id, 'A');
  fixture.login = () => ({ _id: 'B', identifier: 'account-b', role: 'cashier', confirmed: true, token: 'synthetic-account-B-token' });
  await auth.login({ identifier: 'account-b', password: 'synthetic', remember: false });
  assert.equal(h.render().jwt, 'synthetic-account-B-token');
  assert.equal(h.render().user._id, 'B');
  const reloaded = h.mount();
  assert.equal(reloaded.user._id, 'B');
  assert.equal(reloaded.jwt, 'synthetic-account-A-token');
  assert.equal(reloaded.isAuthenticated, true);
});

test('BUG: failed login clears current state but leaves a previous session authenticated after reload', async t => {
  const h = harness(t);
  sessionStorage.setItem('jwt', 'synthetic-account-A-token');
  sessionStorage.setItem('user', JSON.stringify({ _id: 'A', identifier: 'account-a', role: 'cashier' }));
  const auth = h.mount();
  fixture.login = () => { throw { response: { data: { message: 'Synthetic invalid credentials' } } }; };
  await assert.rejects(auth.login({ identifier: 'account-b', password: 'synthetic-invalid', remember: false }));
  assert.equal(h.render().isAuthenticated, false);
  const reloaded = h.mount();
  assert.equal(reloaded.user._id, 'A');
  assert.equal(reloaded.jwt, 'synthetic-account-A-token');
  assert.equal(reloaded.isAuthenticated, true);
});
