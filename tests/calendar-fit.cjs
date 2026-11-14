const assert = require('node:assert/strict');
const {chromium} = require('playwright');

async function run() {
  const browser = await chromium.launch({channel:'chrome'});
  try {
    const page = await browser.newPage();
    await page.goto(process.argv[2]);
    const year = Number((await page.locator('#pick-month').innerText()).split('년')[0])-1;
    await page.evaluate(year=>{
      const data={schema:1,entries:{},months:{},history:{},closed:{}};
      for(let m=1;m<=12;m++){
        const month=year+'-'+String(m).padStart(2,'0');
        const date=month+'-'+new Date(year,m,0).getDate();
        data.entries[month]={date,amount:999999999999,deleted:false};
        data.months[month]={budget:0,weeks:{},settlement:[],memo:'',dayNotes:{[date]:'월말 정산 메모'}};
      }
      localStorage.setItem('bbo-demo-v1',JSON.stringify(data));
    },year);
    await page.click('#demo');
    await page.click('#pick-month');
    await page.getByRole('button',{name:'이전 연도'}).click();
    await page.locator('[data-month="'+year+'-01"]').click();
    for (const [width,height] of [[1920,940],[1536,730],[1366,640],[1280,550],[1024,600],[393,852]]) {
      await page.setViewportSize({width,height});
      const seen = new Set();
      for (let month=1;month<=12;month++) {
        const offset=(new Date(year,month-1,1).getDay()+6)%7;
        const count=new Date(year,month,0).getDate();
        const weeks=Math.ceil((offset+count)/7);
        if(seen.has(weeks))continue;
        seen.add(weeks);
        await page.click('#pick-month');
        await page.locator('[data-month="'+year+'-'+String(month).padStart(2,'0')+'"]').click();
        await page.evaluate(()=>document.fonts.ready);
        const actual=await page.locator('.days').evaluate(grid=>{
          const box=grid.getBoundingClientRect();
          const card=grid.closest('.calendar-card').getBoundingClientRect();
          const cells=[...grid.children].map(el=>el.getBoundingClientRect());
          const last=grid.querySelector('.day:last-of-type');
          const r=last.getBoundingClientRect();
          const memo=last.querySelector('.calendar-note').getBoundingClientRect();
          const amount=last.querySelector('.day-amount').getBoundingClientRect();
          return {rows:new Set(cells.map(c=>c.y)).size, last:last.querySelector('.day-number').textContent.trim(),
            memoHeight:memo.height,amountFits:amount.bottom<=r.bottom+1 && memo.bottom<=amount.top+1,
            pageHeight:document.documentElement.scrollHeight, gridHeight:Math.round(box.height),
            lastBottom:Math.round(cells.at(-1).bottom), cardBottom:Math.round(card.bottom),
            hit:last.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)),
            clipped:grid.scrollHeight>grid.clientHeight+1, top:box.top,
            uneven:Math.max(...cells.map(c=>c.height))-Math.min(...cells.map(c=>c.height))>1};
        });
        const info=JSON.stringify({width,height,month,weeks,...actual});
        assert.equal(actual.rows,weeks,info);
        assert.equal(actual.last,String(count),info);
        assert.ok(actual.memoHeight>=9 && actual.amountFits,info);
        assert.ok(actual.top>=0 && actual.lastBottom<=height && actual.lastBottom<=actual.cardBottom && actual.hit && !actual.clipped && !actual.uneven,info);
        if(width>900)assert.ok(actual.pageHeight<=height,info);
      }
      console.log(width+'×'+height+' calendar fits '+[...seen].join('/')+' rows at 100%');
    }
  } finally {await browser.close();}
}
run().catch(e=>{console.error(e.message);process.exitCode=1;});
