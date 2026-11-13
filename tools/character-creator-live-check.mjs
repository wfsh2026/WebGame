import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';
const apiOrigin = 'http://47.117.185.109:8080/online';
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const page = await browser.newPage({ viewport: { width: 1536, height: 960 } });
const errors = []; const failures = []; let closing = false;
page.on('pageerror', error => errors.push(error.message));
await page.route('**/api/**', async route => {
  const request = route.request(); const path = new URL(request.url()).pathname; const url = apiOrigin + path;
  try { const response = await route.fetch({ url }); await route.fulfill({ response }); } catch { if (!closing) throw new Error('测试接口转发失败'); }
});
try {
  await page.goto('http://127.0.0.1:5173/online.html');
  const stamp = Date.now().toString(36); const accountName = 'creator_' + stamp; const password = 'Creator-check-' + stamp;
  await page.getByLabel('账号', { exact: true }).fill(accountName); await page.getByLabel('密码', { exact: true }).fill(password);
  await page.getByRole('button', { name: '创建账号', exact: true }).click();
  await page.getByRole('heading', { name: '创建角色', exact: true }).waitFor();
  await page.getByRole('button', { name: '法术专精', exact: true }).click();
  await page.getByLabel('角色名称', { exact: true }).fill('烬语验证');
  await page.getByRole('button', { name: '创建角色', exact: true }).click();
  await page.getByRole('heading', { name: '与同行者一起，穿过林地。', exact: true }).waitFor();
  const token = await page.evaluate(() => sessionStorage.getItem('web-game-world.online-token.v1'));
  const headers = { authorization: 'Bearer ' + token };
  const response = await page.request.get(apiOrigin + '/api/me', { headers });
  assert.equal(response.status(), 200); const profile = await response.json();
  assert.equal(profile.character.name, '烬语验证'); assert.equal(profile.character.points.magic, 7);
  assert.deepEqual(profile.character.talents, ['arcane', 'casting', 'frail']);
  await page.reload(); await page.getByRole('heading', { name: '烬语验证', exact: true }).waitFor();
  const report = { account: accountName, creationSaved: true, survivesReload: true, errors };
  assert.deepEqual(errors, []);
  await writeFile('.cache/character-creator-check/live-api-report.json', JSON.stringify(report, null, 2));
  await page.request.post(apiOrigin + '/api/logout', { headers });
  console.log('通过：独立测试账号注册、新版界面创建角色、真实数据库保存及刷新恢复');
} catch (error) { failures.push(error.message); console.log(JSON.stringify({ errors, failures })); throw error; }
finally { closing = true; await page.goto('about:blank'); await page.unrouteAll({ behavior: 'wait' }); await browser.close(); }

