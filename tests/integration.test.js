import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setTimeout as sleep } from 'timers/promises';
import { bootApp, fixture, projectEntities } from './helpers/appHarness.js';

async function withTimeout(promise, timeoutMs, label) {
  const timeout = sleep(timeoutMs).then(() => {
    throw new Error(`${label} timed out after ${timeoutMs}ms`);
  });

  return Promise.race([promise, timeout]);
}

function getInvoicerState() {
  return JSON.parse(fixture.data.pluginUserData.find((entry) => entry.id === 'invoicer').data);
}

function triggerPrintShortcut(window) {
  window.dispatchEvent(
    new window.KeyboardEvent('keydown', {
      key: 'p',
      ctrlKey: true,
      bubbles: true,
    }),
  );
}

describe('App integration', () => {
  let app;
  let state;

  beforeEach(async () => {
    state = getInvoicerState();
    app = await withTimeout(
      bootApp({ syncedData: JSON.stringify(state) }),
      8000,
      'bootApp in integration beforeEach',
    );
  });

  afterEach(() => {
    app.cleanup();
  });

  it('hydrates saved data into the UI and invoice list', () => {
    expect(app.window.document.getElementById('my-name').value).toBe(state.myDetails.name);
    expect(app.window.document.getElementById('my-email').value).toBe(state.myDetails.email);
    expect(app.window.document.querySelectorAll('#gen-client-select option')).toHaveLength(
      state.clients.length + 1,
    );
    expect(app.window.document.querySelectorAll('#invoices-list tbody tr')).toHaveLength(
      state.generatedInvoices.length,
    );
  });

  it('generates a real invoice preview for an assigned client', async () => {
    const client = state.clients.find((entry) => entry.id === 'client-3');
    expect(client).toBeDefined();

    const assignedProjectIds = Object.entries(state.projectAssignments)
      .filter(([, clientId]) => clientId === client.id)
      .map(([projectId]) => projectId);
    const assignedProjectTitles = assignedProjectIds.map((projectId) => projectEntities[projectId].title);

    app.window.document.getElementById('gen-client-select').value = client.id;
    app.window.document.getElementById('gen-period-select').value = 'custom-range';
    app.window.document.getElementById('gen-period-select').dispatchEvent(
      new app.window.Event('change', { bubbles: true }),
    );
    app.window.document.getElementById('gen-start-date').value = '2026-03-01';
    app.window.document.getElementById('gen-end-date').value = '2026-03-31';
    app.window.document.getElementById('gen-invoice-date').value = '2026-04-06';
    app.window.document.getElementById('gen-itemization-select').value = '2';

    app.window.document.getElementById('generate-invoice-form').dispatchEvent(
      new app.window.Event('submit', { bubbles: true, cancelable: true }),
    );

    await app.waitFor(
      () => app.window.document.getElementById('invoice-preview').style.display === 'block',
    );

    const iframe = app.window.document.querySelector('#invoice-iframe-container iframe');
    expect(iframe).not.toBeNull();

    if (typeof iframe.onload === 'function') {
      iframe.onload();
    }

    await app.waitFor(() => iframe.contentDocument && iframe.contentDocument.body.textContent.length > 0);

    const previewText = iframe.contentDocument.body.textContent;
    expect(previewText).toContain(client.name);
    expect(previewText).toContain(state.myDetails.name);
    assignedProjectTitles.forEach((title) => {
      expect(previewText).toContain(title);
    });

    expect(app.pluginApi.showSnack).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'SUCCESS',
        msg: expect.stringContaining('Preview ready'),
      }),
    );
    expect(app.pluginApi.persistDataSynced).not.toHaveBeenCalled();
  });

  it('saves a generated invoice once when the print shortcut is used', async () => {
    const client = state.clients.find((entry) => entry.id === 'client-3');
    const assignedProjectIds = Object.entries(state.projectAssignments)
      .filter(([, clientId]) => clientId === client.id)
      .map(([projectId]) => projectId);
    const assignedProjectTitles = assignedProjectIds.map((projectId) => projectEntities[projectId].title);

    app.window.document.getElementById('gen-client-select').value = client.id;
    app.window.document.getElementById('gen-period-select').value = 'custom-range';
    app.window.document.getElementById('gen-period-select').dispatchEvent(
      new app.window.Event('change', { bubbles: true }),
    );
    app.window.document.getElementById('gen-start-date').value = '2026-03-01';
    app.window.document.getElementById('gen-end-date').value = '2026-03-31';
    app.window.document.getElementById('gen-invoice-date').value = '2026-04-06';
    app.window.document.getElementById('gen-itemization-select').value = '2';

    app.window.document.getElementById('generate-invoice-form').dispatchEvent(
      new app.window.Event('submit', { bubbles: true, cancelable: true }),
    );

    await app.waitFor(() => app.window.document.querySelector('#invoice-iframe-container iframe'));

    const iframe = app.window.document.querySelector('#invoice-iframe-container iframe');
    const printSpy = vi.fn();
    const focusSpy = vi.fn();

    Object.defineProperty(iframe.contentWindow, 'print', {
      value: printSpy,
      configurable: true,
    });
    Object.defineProperty(iframe.contentWindow, 'focus', {
      value: focusSpy,
      configurable: true,
    });

    if (typeof iframe.onload === 'function') {
      iframe.onload();
    }

    await app.waitFor(() => iframe.contentDocument && iframe.contentDocument.body.textContent.length > 0);

    const initialInvoiceCount = state.generatedInvoices.length;

    triggerPrintShortcut(app.window);
    await app.waitFor(() => app.pluginApi.persistDataSynced.mock.calls.length === 1);

    triggerPrintShortcut(app.window);
    await app.waitFor(() => printSpy.mock.calls.length === 2);

    expect(printSpy).toHaveBeenCalledTimes(2);
    expect(focusSpy).toHaveBeenCalledTimes(2);
    expect(app.pluginApi.persistDataSynced).toHaveBeenCalledTimes(1);

    const persistedPayload = JSON.parse(app.pluginApi.persistDataSynced.mock.calls[0][0]);
    expect(persistedPayload.generatedInvoices).toHaveLength(initialInvoiceCount + 1);

    const newInvoice = persistedPayload.generatedInvoices.at(-1);
    expect(newInvoice.clientId).toBe(client.id);
    expect(newInvoice.clientName).toBe(client.name);
    expect(newInvoice.period).toBe('2026-03-01 to 2026-03-31');
    expect(newInvoice.number).toMatch(/^INV-\d{6}-\d{5}$/);

    await app.waitFor(
      () => app.window.document.querySelectorAll('#invoices-list tbody tr').length === initialInvoiceCount + 1,
    );

    const rows = Array.from(app.window.document.querySelectorAll('#invoices-list tbody tr'));
    expect(rows.at(-1).textContent).toContain(newInvoice.number);
    expect(rows.at(-1).textContent).toContain(client.name);

    assignedProjectTitles.forEach((title) => {
      expect(iframe.contentDocument.body.textContent).toContain(title);
    });
  });
});