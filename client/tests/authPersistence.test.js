// Executes the actual AuthProvider with synthetic hook state and browser stores.
// Controlled authentication responses; no browser or authentication request is sent.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { Buffer } from 'node:buffer';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { transformWithOxc } from 'vite';

const require = createRequire(new URL('../package.json', import.meta.url));
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
const source = await fs.readFile(new URL('../src/shared/hooks/AuthContext.jsx', import.meta.url), 'utf8');
const compiled = await transformWithOxc(source, 'AuthContext.jsx', { jsx: { runtime: 'automatic', development: false } });
let code = compiled.code;
for (const [name, url] of Object.entries({
  react: hooksUrl,
  'react/jsx-runtime': pathToFileURL(require.resolve('react/jsx-runtime')).href,
  '../../features/auth/api/authApi': authUrl,
  '../../features/bookstore/pendingOperation.js': new URL('../src/features/bookstore/pendingOperation.js', import.meta.url).href,
  '../utils/safeDiagnostics.js': new URL('../src/shared/utils/safeDiagnostics.js', import.meta.url).href,
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

const account = name => ({ _id: name, identifier: `account-${name}`, role: 'cashier', confirmed: true, token: `Token-${name}` });
async function signIn(h, name, remember) {
  fixture.login = () => account(name);
  await h.render().login({ identifier: name, password: 'controlled', remember });
}
for (const remember of [true, false]) {
  test(`account replacement from remember=${remember} restores only B and Token B`, async t => {
    const h = harness(t); h.mount();
    await signIn(h, 'A', remember); await signIn(h, 'B', !remember);
    const inactive = remember ? localStorage : sessionStorage;
    assert.equal(inactive.getItem('user'), null); assert.equal(inactive.getItem('jwt'), null);
    const restored = h.mount(); assert.equal(restored.user._id, 'B'); assert.equal(restored.jwt, 'Token-B');
  });
  test(`failed login after remember=${remember} clears both stores`, async t => {
    const h = harness(t); h.mount(); await signIn(h, 'A', remember);
    fixture.login = () => { throw { response: { data: { message: 'Invalid credentials' } } }; };
    await assert.rejects(h.render().login({ identifier: 'B', password: 'invalid', remember: !remember }), /Invalid credentials/);
    assert.equal(h.render().isAuthenticated, false); assert.equal(h.mount().isAuthenticated, false);
    for (const storage of [localStorage, sessionStorage]) for (const key of ['user', 'jwt']) assert.equal(storage.getItem(key), null);
  });
  test(`normal remember=${remember} login and profile edits retain a matching pair after reload`, async t => {
    const h = harness(t); h.mount(); await signIn(h, 'A', remember);
    h.render().setUser({ ...h.render().user, name: 'Updated' });
    const restored = h.mount(); assert.equal(restored.user._id, 'A'); assert.equal(restored.user.name, 'Updated'); assert.equal(restored.jwt, 'Token-A');
    const storage = remember ? localStorage : sessionStorage;
    assert.equal(JSON.parse(storage.getItem('user'))._id, 'A'); assert.equal(storage.getItem('jwt'), 'Token-A');
    if (!remember) { sessionStorage.clear(); assert.equal(h.mount().isAuthenticated, false); }
  });
}
test('logout clears conflicting credentials in both stores and preserves uncertain operation barriers', async t => {
  const h = harness(t); h.mount(); await signIn(h, 'A', true);
  sessionStorage.setItem('user', JSON.stringify(account('B'))); sessionStorage.setItem('jwt', 'Token-B');
  sessionStorage.setItem('bookstore.pending.' + 'a'.repeat(24), 'invalid-operation-metadata');
  h.render().logout();
  for (const storage of [localStorage, sessionStorage]) for (const key of ['user', 'jwt']) assert.equal(storage.getItem(key), null);
  assert.equal(h.mount().isAuthenticated, false);
  assert.equal(sessionStorage.getItem('bookstore.pending.' + 'a'.repeat(24)), 'invalid-operation-metadata');
});
test('restoration never combines incomplete pairs and prefers a complete session over legacy persistent credentials', t => {
  const h = harness(t);
  localStorage.setItem('user', JSON.stringify(account('A'))); sessionStorage.setItem('jwt', 'Token-B');
  assert.equal(h.mount().isAuthenticated, false);
  for (const [storage, name] of [[localStorage, 'A'], [sessionStorage, 'B']]) {
    storage.setItem('user', JSON.stringify(account(name))); storage.setItem('jwt', `Token-${name}`);
  }
  const auth = h.mount(); assert.equal(auth.user._id, 'B'); assert.equal(auth.jwt, 'Token-B'); assert.equal(localStorage.getItem('jwt'), null);
});
test('API client and useApi send the restored account token without a network request', async t => {
  const h = harness(t); h.mount(); await signIn(h, 'A', true); await signIn(h, 'B', false);
  fixture.auth = h.mount();
  const apiSource = await fs.readFile(new URL('../src/shared/utils/apiClient.js', import.meta.url), 'utf8');
  const apiUrl = moduleUrl(apiSource.replace('import.meta.env.VITE_API_URL', JSON.stringify('https://controlled.invalid'))
    .replaceAll('"axios"', JSON.stringify(pathToFileURL(require.resolve('axios')).href))
    .replaceAll('"./safeDiagnostics.js"', JSON.stringify(new URL('../src/shared/utils/safeDiagnostics.js', import.meta.url).href)));
  const useApiSource = await fs.readFile(new URL('../src/shared/utils/useApi.js', import.meta.url), 'utf8');
  const code = useApiSource.replaceAll('"react"', JSON.stringify(moduleUrl('export const useMemo = fn => fn();')))
    .replaceAll('"../hooks/AuthContext.jsx"', JSON.stringify(moduleUrl(`import { fixture } from ${JSON.stringify(fixtureUrl)}; export const useAuth = () => fixture.auth;`)))
    .replaceAll('"./apiClient"', JSON.stringify(apiUrl));
  const { useApi: getApi } = await import(moduleUrl(code));
  const api = getApi();
  api.defaults.adapter = async config => {
    assert.equal(config.headers.Authorization, 'Bearer Token-B');
    return { data: {}, status: 200, statusText: 'OK', headers: {}, config };
  };
  await api.get('/controlled');
});

