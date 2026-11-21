// End-to-end editing tests. Run with: npm test
// Uses the Chrome already installed on this machine (set CHROME_PATH if it lives somewhere unusual).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { chromium } from 'playwright-core';

let server, browser, base;

before(async () => {
  server = await createServer({ server: { port: 5199, strictPort: false }, logLevel: 'silent' });
  await server.listen();
  base = server.resolvedUrls.local[0];
  const opts = process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : { channel: 'chrome' };
  browser = await chromium.launch({ ...opts, args: ['--no-sandbox'] });
});
after(async () => {
  await browser?.close();
  await server?.close();
});

// Open the sample resume in the given template and return helpers bound to that page.
async function open(template = 'classic') {
  const page = await browser.newPage({ viewport: { width: 1400, height: 950 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(base);
  const id = await page.evaluate(async (tpl) => {
    const m = await import('/src/model.js');
    const r = m.cloneResume(m.sampleResume(), { name: 'Test', template: tpl });
    localStorage.setItem('rizzume:v1', JSON.stringify({ resumes: { [r.id]: r }, settings: { theme: 'light', marks: false } }));
    sessionStorage.setItem('rz-boot', '1');
    return r.id;
  }, template);
  await page.goto(`${base}#/edit/${id}`);
  await page.reload();
  await page.waitForSelector('.sheet.is-edit [data-path]');
  await page.waitForTimeout(400);

  const saved = async () => {
    await page.waitForTimeout(450); // saves are debounced by 350 ms
    return page.evaluate((rid) => JSON.parse(localStorage.getItem('rizzume:v1')).resumes[rid], id);
  };
  const projects = async () => (await saved()).sections.find((s) => s.type === 'projects');
  const points = async (ii = 0) => (await projects()).items[ii].bullets.map((b) => b.text);
  const pi = await page.evaluate((rid) => JSON.parse(localStorage.getItem('rizzume:v1')).resumes[rid].sections.findIndex((s) => s.type === 'projects'), id);
  const bp = (ii, bi) => `[data-path="sections.${pi}.items.${ii}.bullets.${bi}.text"]`;
  // Every editable on the page must show exactly what is saved.
  const consistent = async () => {
    const r = await saved();
    return page.evaluate((r) => {
      const bad = [];
      document.querySelectorAll('.sheet [data-path]').forEach((el) => {
        const v = el.dataset.path.split('.').reduce((o, k) => (o == null ? o : o[/^\d+$/.test(k) ? +k : k]), r);
        if ((v || '') !== el.textContent) bad.push(el.dataset.path);
      });
      return bad;
    }, r);
  };
  return { page, errors, saved, points, projects, bp, pi, consistent };
}

test('Enter at the end of a wrapped point adds a new point and keeps the old one whole', async () => {
  const t = await open();
  await t.page.click(t.bp(0, 0));
  await t.page.keyboard.press('Control+End');
  await t.page.keyboard.type(' and it keeps going long enough to wrap onto a second line of the page for sure');
  const before = await t.points(0);
  const lines = await t.page.evaluate((sel) => document.querySelector(sel).getClientRects().length, t.bp(0, 0));
  assert.ok(lines >= 2, 'the point should wrap');
  await t.page.keyboard.press('Control+Home');
  await t.page.keyboard.press('End'); // lands at the end of the first visual line, mid-point
  await t.page.keyboard.press('Enter');
  await t.page.keyboard.type('Added a brand new point');
  const after = await t.points(0);
  assert.equal(after[0], before[0], 'the original point must not be cut');
  assert.equal(after[1], 'Added a brand new point');
  assert.equal(after.length, before.length + 1);
  assert.deepEqual(await t.consistent(), []);
  assert.deepEqual(t.errors, []);
  await t.page.close();
});

test('Enter repeatedly builds a list of points, typed fast', async () => {
  const t = await open();
  await t.page.click(t.bp(1, 0));
  await t.page.keyboard.press('Control+End');
  for (const w of ['one', 'two', 'three']) {
    await t.page.keyboard.press('Enter');
    await t.page.keyboard.type(w, { delay: 0 });
  }
  const pts = await t.points(1);
  assert.deepEqual(pts.slice(-3), ['one', 'two', 'three']);
  assert.deepEqual(await t.consistent(), []);
  await t.page.close();
});

test('Enter on an empty point does not pile up empty points', async () => {
  const t = await open();
  const n = (await t.points(0)).length;
  await t.page.click(t.bp(0, 0));
  await t.page.keyboard.press('Enter');
  await t.page.keyboard.press('Enter');
  await t.page.keyboard.press('Enter');
  assert.equal((await t.points(0)).length, n + 1);
  await t.page.close();
});

test('Enter at the very start adds a point above', async () => {
  const t = await open();
  const before = await t.points(0);
  await t.page.click(t.bp(0, 0));
  await t.page.keyboard.press('Control+Home');
  await t.page.keyboard.press('Enter');
  await t.page.keyboard.type('Above');
  const after = await t.points(0);
  assert.deepEqual(after, ['Above', ...before]);
  await t.page.close();
});

test('Shift+Enter splits a point on purpose', async () => {
  const t = await open();
  await t.page.click(t.bp(1, 0));
  await t.page.keyboard.press('Control+Home');
  for (let i = 0; i < 10; i++) await t.page.keyboard.press('ArrowRight');
  const whole = (await t.points(1))[0];
  await t.page.keyboard.press('Shift+Enter');
  const pts = await t.points(1);
  assert.equal(pts[0] + ' ' + pts[1], whole.slice(0, 10).trimEnd() + ' ' + whole.slice(10).trimStart());
  await t.page.close();
});

test('Alt+Down and Alt+Up move a point', async () => {
  const t = await open();
  const [a, b] = await t.points(0);
  await t.page.click(t.bp(0, 0));
  await t.page.keyboard.press('Alt+ArrowDown');
  assert.deepEqual((await t.points(0)).slice(0, 2), [b, a]);
  await t.page.keyboard.press('Alt+ArrowUp');
  assert.deepEqual((await t.points(0)).slice(0, 2), [a, b]);
  await t.page.close();
});

test('Pasting several lines makes one point per line, with spaces kept', async () => {
  const t = await open();
  const first = (await t.points(0))[0];
  await t.page.click(t.bp(0, 0));
  await t.page.keyboard.press('Control+End');
  await t.page.evaluate(() => {
    const dt = new DataTransfer();
    dt.setData('text/plain', '• alpha\n• beta\n• gamma');
    document.activeElement.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  });
  const pts = await t.points(0);
  assert.equal(pts[0], `${first} alpha`);
  assert.deepEqual(pts.slice(1, 3), ['beta', 'gamma']);
  assert.deepEqual(await t.consistent(), []);
  await t.page.close();
});

test('Point tools in the margin: add below and delete', async () => {
  const t = await open();
  const before = await t.points(0);
  await t.page.hover(t.bp(0, 0));
  await t.page.click('.gutter.show [data-g="addPointBelow"]');
  await t.page.keyboard.type('From the margin');
  assert.deepEqual(await t.points(0), [before[0], 'From the margin', ...before.slice(1)]);
  await t.page.hover(t.bp(0, 1));
  await t.page.click('.gutter.show [data-g="delPoint"]');
  assert.deepEqual(await t.points(0), before);
  await t.page.close();
});

test('Adding a new project, then its points, from the keyboard', async () => {
  const t = await open();
  const n = (await t.projects()).items.length;
  await t.page.hover(`[data-sec="${t.pi}"] .r-h`);
  await t.page.click('.gutter.show [data-g="addItem"]');
  await t.page.keyboard.type('Brand New Project');
  await t.page.keyboard.press('Enter');
  await t.page.keyboard.type('first point');
  await t.page.keyboard.press('Enter');
  await t.page.keyboard.type('second point');
  const items = (await t.projects()).items;
  assert.equal(items.length, n + 1);
  const it = items[items.length - 1];
  assert.equal(it.title, 'Brand New Project');
  assert.deepEqual(it.bullets.map((b) => b.text), ['first point', 'second point']);
  assert.deepEqual(await t.consistent(), []);
  await t.page.close();
});

test('Undo brings back the list as it was before a new point', async () => {
  const t = await open();
  const before = await t.points(0);
  await t.page.click(t.bp(0, 0));
  await t.page.keyboard.press('Enter');
  await t.page.keyboard.type('temp');
  await t.page.waitForTimeout(700);
  await t.page.click('[data-undo]');
  await t.page.click('[data-undo]');
  assert.deepEqual(await t.points(0), before);
  await t.page.close();
});

for (const tpl of ['classic', 'modern', 'compact', 'pankaj']) {
  test(`Points can be added in the ${tpl} template and the PDF still builds`, async () => {
    const t = await open(tpl);
    await t.page.click(t.bp(1, 0));
    await t.page.keyboard.press('End');
    await t.page.keyboard.press('Enter');
    await t.page.keyboard.type(`point in ${tpl}`);
    assert.equal((await t.points(1)).at(-1), `point in ${tpl}`);
    assert.deepEqual(await t.consistent(), []);
    const size = await t.page.evaluate(async () => {
      const id = location.hash.split('/')[2];
      const r = JSON.parse(localStorage.getItem('rizzume:v1')).resumes[id];
      const m = await import('/src/pdf.js');
      return (await m.buildPdf(r)).length;
    });
    assert.ok(size > 5000, 'PDF should have content');
    assert.deepEqual(t.errors, []);
    await t.page.close();
  });
}

test('Placement template: two links via the link editor show as [GitHub | Live], and the .tex matches', async () => {
  const t = await open('pankaj');
  await t.page.hover(`[data-entry="${t.pi}.0"] .r-t`);
  await t.page.click('.gutter.show [data-g="link"]');
  const rows = t.page.locator('.link-pop .link-row');
  await rows.nth(0).locator('.lp-label').fill('GitHub');
  await rows.nth(0).locator('.lp-url').fill('github.com/x/y');
  await rows.nth(1).locator('.lp-label').fill('Live');
  await rows.nth(1).locator('.lp-url').fill('https://x.dev');
  await t.page.click('.link-pop button.primary');
  await t.page.waitForSelector('.sheet .r-links');
  assert.equal((await t.page.textContent(`[data-entry="${t.pi}.0"] .r-links`)).trim(), '[GitHub | Live]');
  const r = await t.saved();
  const it = r.sections[t.pi].items[0];
  assert.deepEqual(it.links, [{ label: 'GitHub', url: 'https://github.com/x/y' }, { label: 'Live', url: 'https://x.dev' }]);
  const tex = await t.page.evaluate(async (r) => (await import('/src/tex.js')).toTex(r), r);
  assert.match(tex, /\\project\{/);
  assert.match(tex, /\[\\href\{https:\/\/github.com\/x\/y\}\{GitHub\} \\textbar\\ \\href\{https:\/\/x.dev\}\{Live\}\]/);
  await t.page.close();
});
