import { execFileSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { setTimeout as sleep } from 'timers/promises';
import { fileURLToPath } from 'url';
import { JSDOM } from 'jsdom';
import { vi } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '../..');
const buildIndexPath = resolve(rootDir, '.build/index.html');
const buildScriptPath = resolve(rootDir, 'scripts/build.js');
const fixturePath = resolve(rootDir, 'test-data/testing-data.json');

function ensureBuiltHtml() {
  if (existsSync(buildIndexPath)) {
    return;
  }

  execFileSync(process.execPath, [buildScriptPath], {
    cwd: rootDir,
    stdio: 'pipe',
  });
}

ensureBuiltHtml();

const fixture = JSON.parse(readFileSync(fixturePath, 'utf8'));
const invoicerState = JSON.parse(
  fixture.data.pluginUserData.find((entry) => entry.id === 'invoicer').data,
);
const projectEntities = fixture.data.project.entities;
const taskEntities = fixture.data.task.entities;
const archivedTaskEntities = fixture.data.archiveYoung.task.entities;

function readBuiltHtml() {
  return readFileSync(buildIndexPath, 'utf8');
}

function createWindow() {
  const dom = new JSDOM(readBuiltHtml(), {
    runScripts: 'outside-only',
    url: 'http://localhost',
  });

  const window = dom.window;

  Object.defineProperty(window, 'matchMedia', {
    value: vi.fn((query) => ({
      matches: false,
      media: query,
      addListener: vi.fn(),
      addEventListener: vi.fn(),
      removeListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
    configurable: true,
  });

  Object.defineProperty(window, 'crypto', {
    value: {
      getRandomValues: (array) => {
        for (let index = 0; index < array.length; index += 1) {
          array[index] = 12345;
        }
        return array;
      },
    },
    configurable: true,
  });

  const storage = {
    data: {},
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(this.data, key) ? this.data[key] : null;
    },
    setItem(key, value) {
      this.data[key] = String(value);
    },
    removeItem(key) {
      delete this.data[key];
    },
    clear() {
      this.data = {};
    },
  };

  Object.defineProperty(window, 'localStorage', {
    value: storage,
    configurable: true,
  });

  window.scrollTo = vi.fn();
  window.confirm = vi.fn(() => true);

  return { dom, window };
}

function installPluginApi(window, overrides = {}) {
  const pluginApi = {
    loadSyncedData: vi.fn(async () => overrides.syncedData ?? JSON.stringify(invoicerState)),
    persistDataSynced: vi.fn(async () => undefined),
    getAllProjects: vi.fn(async () => overrides.projects ?? Object.values(projectEntities)),
    getTasks: vi.fn(async () => overrides.tasks ?? Object.values(taskEntities)),
    getArchivedTasks: vi.fn(async () => overrides.archivedTasks ?? Object.values(archivedTaskEntities)),
    openDialog: vi.fn(async () => true),
    showSnack: vi.fn(),
  };

  window.PluginAPI = pluginApi;
  return pluginApi;
}

function loadAppScript(window) {
  const scriptElement = Array.from(window.document.querySelectorAll('script')).find(
    (script) => !script.src && script.textContent.includes('function parseDateKeyAsLocalDate'),
  );

  if (!scriptElement) {
    throw new Error('Could not find the app script in the built HTML');
  }

  window.eval(scriptElement.textContent);
  window.dispatchEvent(new window.Event('DOMContentLoaded'));
}

async function waitFor(check, { timeoutMs = 2000, intervalMs = 10 } = {}) {
  const start = Date.now();

  while (true) {
    const result = check();
    if (result) {
      return result;
    }

    if (Date.now() - start > timeoutMs) {
      throw new Error('Timed out waiting for app state');
    }

    await sleep(intervalMs);
  }
}

async function bootApp(overrides = {}) {
  const { dom, window } = createWindow();
  const pluginApi = installPluginApi(window, overrides);

  loadAppScript(window);

  const expectedState = JSON.parse(overrides.syncedData ?? JSON.stringify(invoicerState));
  const expectedClientCount = expectedState.clients ? expectedState.clients.length : 0;

  await waitFor(
    () =>
      window.document.getElementById('gen-client-select').options.length === expectedClientCount + 1 &&
      window.document.getElementById('my-name').value === (expectedState.myDetails?.name || ''),
  );

  return {
    dom,
    window,
    pluginApi,
    state: expectedState,
    cleanup() {
      dom.window.close();
      vi.restoreAllMocks();
    },
    waitFor: (check, options) => waitFor(check, options),
  };
}

export {
  archivedTaskEntities,
  bootApp,
  createWindow,
  fixture,
  installPluginApi,
  invoicerState,
  loadAppScript,
  projectEntities,
  taskEntities,
  waitFor,
};