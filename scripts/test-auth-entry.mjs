import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { test } from 'node:test';

// Run against source, native www output, or assets extracted from the actual APK.
const root = path.resolve(process.env.VAZ_TEST_ASSETS || '.');
const source = file => readFileSync(path.join(root, file), 'utf8');
const tokenKey = 'vazFitness.authToken';
const stageKey = 'vazFitness.registrationStage.v8';
function storage() {
  const data = new Map();
  return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, String(value)), removeItem: key => data.delete(key) };
}
function boot({ authenticated = false, onboarded = false, stage = '' } = {}) {
  const nodes = new Map(), timers = [], microtasks = [];
  function node(id) {
    if (!nodes.has(id)) nodes.set(id, {
      innerHTML: '', open: false, style: {}, classList: { toggle() {} }, listeners: {},
      addEventListener(type, handler) { this.listeners[type] = handler; },
      showModal() { this.open = true; }, close() { this.open = false; },
      reset() {}, elements: { namedItem: () => null }, querySelector: () => null,
    });
    return nodes.get(id);
  }
  const context = vm.createContext({
    window: {}, localStorage: storage(), sessionStorage: storage(),
    document: { getElementById: node, querySelector: node, querySelectorAll: () => [], createElement: () => node(Symbol()), head: { appendChild() {} }, body: node('body') },
    state: { onboarded, profile: { name: '' }, plan: [], sessions: [], runSessions: [], skipped: [] },
    DB_KEY: 'test-state', render() {}, generatePlan() {}, save() {}, toast() {},
    defaultState: () => ({ onboarded: false, profile: {}, plan: [] }),
    escapeHtml: text => text,
    setTimeout: (fn, ms) => timers.push({ fn, ms }), queueMicrotask: fn => microtasks.push(fn),
  });
  if (authenticated) context.localStorage.setItem(tokenKey, 'test-token');
  if (stage) context.sessionStorage.setItem(stageKey, stage);
  vm.runInContext(source('app-ai.js'), context);
  const flush = () => { while (microtasks.length) microtasks.shift()(); while (timers.length) timers.shift().fn(); };
  const loadAuth = () => { vm.runInContext(source('app-auth-entry-v8.js'), context); flush(); };
  return { context, node, flush, loadAuth };
}

test('fresh install never opens onboarding while authentication loads', () => {
  const app = boot(); app.flush();
  assert.equal(app.node('onboardingDialog').open, false);
  app.loadAuth(); app.flush();
  assert.match(app.node('view').innerHTML, /Entre na sua conta/);
  assert.equal(app.node('onboardingDialog').open, false);
});
test('legacy onboarding calls cannot open a dialog for a guest', () => {
  const app = boot(); app.loadAuth(); app.context.openOnboarding();
  assert.equal(app.node('onboardingDialog').open, false);
});
test('Novo usuário opens assessment and background renders keep it open', () => {
  const app = boot(); app.loadAuth();
  app.node('vfEntryNewUser').listeners.click();
  assert.equal(app.node('onboardingDialog').open, true);
  app.context.render(); app.flush();
  assert.equal(app.node('onboardingDialog').open, true);
  assert.equal(app.context.sessionStorage.getItem(stageKey), 'onboarding');
});
test('cancel assessment returns to login without reopening it', () => {
  const app = boot(); app.loadAuth(); app.node('vfEntryNewUser').listeners.click();
  app.node('onboardingDialog').listeners.cancel(); app.node('onboardingDialog').close(); app.flush();
  assert.match(app.node('view').innerHTML, /Entre na sua conta/);
  assert.equal(app.node('onboardingDialog').open, false);
});
test('completed assessment advances to account creation', () => {
  const app = boot(); app.loadAuth(); app.node('vfEntryNewUser').listeners.click();
  app.context.state.onboarded = true; app.node('onboardingDialog').close(); app.context.render();
  assert.match(app.node('view').innerHTML, /Agora crie seu acesso/);
});
test('restored local profile without a token still starts on login', () => {
  const app = boot({ onboarded: true }); app.loadAuth();
  assert.match(app.node('view').innerHTML, /Entre na sua conta/);
  assert.equal(app.node('onboardingDialog').open, false);
});
test('reload with an incomplete registration stage falls back to login', () => {
  const app = boot({ stage: 'onboarding' }); app.loadAuth();
  assert.match(app.node('view').innerHTML, /Entre na sua conta/);
  assert.equal(app.context.sessionStorage.getItem(stageKey), null);
});
test('authenticated users can explicitly reopen their assessment', () => {
  const app = boot({ authenticated: true, onboarded: true }); app.loadAuth();
  app.context.openOnboarding(); assert.equal(app.node('onboardingDialog').open, true);
});
test('legacy membership gate defaults to login, never registration', () => {
  assert.match(source('app-membership.js'), /let authMode='login'/);
});
