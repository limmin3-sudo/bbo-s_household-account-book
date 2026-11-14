const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
async function run() {
  const browser = await chromium.launch({channel:'chrome',headless:true});
  try {
    for (const [width,height] of [[1920,940],[2560,1300],[1440,810],[393,852]]) {
      const page = await browser.newPage({viewport:{width,height}});
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.goto(process.argv[2], {waitUntil:'domcontentloaded'});
      await page.click('#demo');
      await page.click('#zero');
      assert.equal(await page.locator('.day.selected .stamp').count(),1);
      await page.evaluate(()=>document.fonts.ready);
      if(width>=1440){
        const dimensions=await page.evaluate(()=>({
          height:document.documentElement.scrollHeight,width:document.documentElement.scrollWidth,
          viewport:innerHeight,broken:[...document.images].filter(i=>i.complete&&!i.naturalWidth).length
        }));
        assert.ok(dimensions.height<=height && dimensions.width<=width,JSON.stringify(dimensions));
        assert.equal(dimensions.broken,0);
      }
      await page.fill('#use','테스트 점심');
      await page.fill('#amount','999999999999');
      await page.click('#add');
      assert.equal(await page.locator('.day.selected .stamp').count(),0);
      assert.equal(await page.locator('.day.selected .day-amount').textContent(),'999,999,999,999');
      const fits = await page.locator('.day.selected').evaluate(cell=>{
        const range=document.createRange();range.selectNodeContents(cell.querySelector('.day-amount'));
        const bounds=cell.getBoundingClientRect();
        return document.documentElement.scrollWidth<=innerWidth && [...range.getClientRects()].every(r=>r.left>=bounds.left-1 && r.right<=bounds.right+1 && r.bottom<=bounds.bottom+1);
      });
      assert.ok(fits,'calendar amount overflow at '+width);
      await page.click('[data-edit]');
      assert.equal(await page.locator('[name=note]').inputValue(),'테스트 점심');
      await page.fill('[name=note]','수정한 사용처');
      await page.fill('#modal-form [name=amount]','162000');
      await page.click('#modal-save');
      assert.equal(await page.locator('.entry-note').textContent(),'수정한 사용처');
      await page.click('#week-budget');
      const w = await page.locator('.week-range').innerText();
      await page.fill('input[name="'+w.slice(0,10)+'"]','150000');
      await page.click('#modal-save');
      assert.match(await page.locator('.weekly .balance').innerText(),/−12,000/);
      await page.click('[data-delete]');
      await page.click('#undo');
      await page.click('[data-delete]');
      await page.click('#trash');
      await page.click('[data-restore]');
      await page.click('[data-history]');
      await page.locator('[data-revision]').last().click();
      assert.equal(await page.locator('.day.selected .day-amount').textContent(),'999,999,999,999');
      const downloaded=page.waitForEvent('download');
      await page.click('#export');
      const payload=await fs.readFile(await (await downloaded).path());
      await page.click('[data-delete]');
      await page.locator('#file').setInputFiles({name:'restore.json',mimeType:'application/json',buffer:payload});
      await page.click('#import-confirm');
      assert.equal(await page.locator('.entry-note').textContent(),'테스트 점심');
      const originalDay = await page.locator('.day.selected').getAttribute('data-date');
      await page.click('#page-report');
      assert.equal(await page.locator('#report-total').textContent(),'999,999,999,999원');
      assert.equal(await page.locator('.calendar').count(),0);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
      await page.click('#prev');
      assert.equal(await page.locator('#report-total').textContent(),'0원');
      await page.click('#prev');
      assert.equal(await page.locator('.report-page').count(),1);
      await page.click('#page-calendar');
      assert.equal(await page.locator('.day-amount').count(),0);
      await page.click('#next');
      await page.click('#next');
      await page.click('#page-report');
      await page.click('[data-report-date="' + originalDay + '"]');
      assert.equal(await page.locator('.day.selected').getAttribute('data-date'),originalDay);
      assert.equal(await page.locator('.entry').count(),1);
      await page.locator('#file').setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from('{}')});
      assert.match(await page.locator('#status').textContent(),/가져오기 실패/);
      assert.equal(await page.locator('.entry').count(),1);
      assert.deepEqual(errors,[]);
      await page.close();
      console.log(width+'px: CRUD, undo/trash/history, export/import, invalid restore, stamp, negative budget, amount bounds PASS');
    }
  } finally { await browser.close(); }
}
run().catch(e=>{console.error(e);process.exitCode=1});
