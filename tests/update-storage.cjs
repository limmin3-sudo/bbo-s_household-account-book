const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');

// Capture an isolated demo profile before a release and reopen it on the same origin afterwards.
async function run() {
  const [phase, url, file] = process.argv.slice(2);
  assert.ok(['before','after'].includes(phase) && url && file);
  const browser = await chromium.launch({channel:'chrome',headless:true});
  try {
    const snapshot = phase==='after' ? JSON.parse(await fs.readFile(file,'utf8')) : null;
    const context = await browser.newContext({storageState:snapshot?.profile});
    const page = await context.newPage();
    await page.goto(url);
    await page.click('#demo');
    if (!snapshot) {
      await page.click('#open-plan');
      await page.fill('[name=memo]','배포 전 테스트 계획');
      await page.getByText('달·주 예산',{exact:true}).click();
      await page.fill('[name=budget]','50000');
      await page.click('#modal-save');
      await page.click('#detail-add');
      await page.fill('[name=amount]','3200');
      await page.fill('[name=use]','테스트 가게');
      await page.fill('[name=dayNote]','배포 전 테스트 메모');
      await page.click('#modal-save');
      await page.locator('#status').filter({hasText:'기기에 저장 완료'}).waitFor();
      const raw = await page.evaluate(()=>localStorage.getItem('bbo-demo-v1'));
      assert.equal(Object.values(JSON.parse(raw).entries)[0].amount,3200);
      await fs.writeFile(file,JSON.stringify({profile:await context.storageState(),raw}));
      console.log('Saved synthetic expense, plan, budget and memo in an isolated browser');
      return;
    }
    const read = ()=>page.evaluate(()=>localStorage.getItem('bbo-demo-v1'));
    assert.equal(await read(),snapshot.raw);
    assert.equal(await page.locator('.entry-note').innerText(),'테스트 가게');
    assert.equal(await page.locator('.day.selected .day-amount').innerText(),'3,200');
    assert.equal(await page.locator('.calendar-note').innerText(),'배포 전 테스트 메모');
    assert.equal(await page.locator('.saved-plan').innerText(),'배포 전 테스트 계획');
    assert.equal(await page.locator('.monthly .budget-top strong').innerText(),'50,000원');

    const second=await context.newPage();
    await second.goto(url);
    await second.click('#demo');
    await second.click('#detail-add');
    await second.fill('[name=amount]','1000');
    await second.click('#modal-save');
    await second.locator('#status').filter({hasText:'기기에 저장 완료'}).waitFor();
    const newer=await read();
    assert.notEqual(newer,snapshot.raw);
    await page.click('#detail-add');
    await page.fill('[name=amount]','2000');
    await page.click('#modal-save');
    await page.locator('#status').filter({hasText:'다른 창'}).waitFor();
    assert.equal(await read(),newer);

    const unknown=JSON.stringify({...JSON.parse(newer),schema:99});
    await second.evaluate(raw=>localStorage.setItem('bbo-demo-v1',raw),unknown);
    await second.reload();
    await second.click('#demo');
    await second.locator('#status').filter({hasText:'저장을 중단'}).waitFor();
    assert.ok(await second.locator('#detail-add').isDisabled());
    assert.equal(await read(),unknown);
    console.log('Original bytes and UI retained; stale write and unsupported-format overwrite blocked');
  } finally { await browser.close(); }
}
run().catch(e=>{console.error(e);process.exitCode=1;});
