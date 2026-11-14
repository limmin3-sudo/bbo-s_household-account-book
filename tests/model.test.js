import {test} from 'node:test';import assert from 'node:assert/strict';
import {empty,amount,totals,monthData,weekStart,weeks,stamped,revise,validate,today,dayTotal} from '../src/model.js';
test('금액 입력 검증: 12자리·쉼표 허용, 음수/소수/과대/잘못된 값 거부',()=>{assert.equal(amount('999,999,999,999'),999999999999);assert.equal(amount('0'),0);for(const v of ['-1','1.5','','1e3','1000000000000','가'])assert.throws(()=>amount(v));});
test('월요일 기준, 연도와 월 경계 및 윤년',()=>{assert.equal(weekStart('2026-11-01'),'2026-10-26');assert.equal(weekStart('2027-01-01'),'2026-12-28');assert.equal(weeks('2024-02').length,5);assert.equal(weeks('2026-11').length,6);});
test('주 초과 음수, 월 중복 차감 없음, 월 경계 지출 제외',()=>{const s=empty();s.months['2026-11']={...monthData(s,'2026-11'),budget:600000,weeks:{'2026-11-09':150000,'2026-10-26':50000}};s.entries={a:{date:'2026-11-09',amount:100000,deleted:false},b:{date:'2026-11-14',amount:62000,deleted:false},c:{date:'2026-10-31',amount:30000,deleted:false},d:{date:'2026-11-01',amount:10000,deleted:false}};assert.deepEqual(totals(s,'2026-11','2026-11-09'),{used:172000,remaining:428000,weekUsed:162000,weekRemaining:-12000});assert.equal(totals(s,'2026-11','2026-10-26').weekUsed,10000);});
test('추가·수정·삭제·되돌리기·금액 이력 복원 재계산',()=>{const s=empty();revise(s,'a',{date:today(),amount:1000,deleted:false},'추가');revise(s,'b',{date:today(),amount:2000,deleted:false},'추가');assert.equal(dayTotal(s,today()),3000);revise(s,'a',{amount:4000},'수정');assert.equal(dayTotal(s,today()),6000);revise(s,'a',{deleted:true},'삭제');assert.equal(dayTotal(s,today()),2000);revise(s,'a',{deleted:false},'복원');assert.equal(dayTotal(s,today()),6000);const h=Object.values(s.history).find(h=>h.reason==='수정');revise(s,'a',h.before,'이력 복원');assert.equal(dayTotal(s,today()),3000);assert.equal(Object.keys(s.history).length,4);});
test('미기록/확인 무지출 구분 및 미래 도장 금지, 지출 추가 제거',()=>{const s=empty(),d=today();assert.equal(stamped(s,d),false);s.closed[d]=true;assert.equal(stamped(s,d),true);s.closed['2099-01-01']=true;assert.equal(stamped(s,'2099-01-01'),false);delete s.closed['2099-01-01'];revise(s,'a',{date:d,amount:1,deleted:false},'추가');assert.equal(stamped(s,d),false);revise(s,'a',{deleted:true},'삭제');assert.equal(stamped(s,d),false);});
test('내보내기 roundtrip 및 가져오기 무결성 검사',()=>{const s=empty();s.months['2026-11']={...monthData(s,'2026-11'),memo:'<script>악성</script>'};revise(s,'a',{date:today(),amount:999999999999,deleted:false},'추가');assert.deepEqual(validate(JSON.parse(JSON.stringify(s))),s);for(const f of [null,{schema:2}, {...s,entries:{a:{date:'2026-02-30',amount:1,deleted:false}}},{...s,entries:{a:{date:'2099-01-01',amount:1,deleted:false}}},{...s,entries:{a:{date:today(),amount:-1,deleted:false}}},{...s,months:{'2026-11':{...s.months['2026-11'],budget:NaN}}}])assert.throws(()=>validate(f));});
import {merchantRanking, suggestedMerchants, merchantRule} from '../src/merchants.js';
import {weekLabel,proratedWeeks} from '../src/model.js';
import {carryover,settlementBalance} from '../src/model.js';
test('전월 정산잔액은 연도와 빈 달을 넘어 이월되며 과거 수정·삭제·복원을 반영한다',()=>{
  const s=empty();
  s.months['2025-12']={...monthData(s,'2025-12'),settlement:[
    {name:'수입',value:100000},{name:'고정지출',value:20000},{name:'저축',value:10000}
  ]};
  revise(s,'dec',{date:'2025-12-31',amount:50000,deleted:false},'추가');
  revise(s,'jan',{date:'2026-01-01',amount:30000,deleted:false},'추가');
  assert.equal(carryover(s,'2025-12'),0);
  assert.equal(carryover(s,'2026-01'),20000);
  assert.equal(carryover(s,'2026-03'),-10000);
  revise(s,'dec',{amount:40000},'수정');
  assert.equal(carryover(s,'2026-03'),0);
  revise(s,'jan',{deleted:true},'삭제');
  assert.equal(carryover(s,'2026-03'),30000);
  revise(s,'jan',{deleted:false},'복원');
  assert.equal(carryover(s,'2026-02'),carryover(s,'2026-01')+settlementBalance(monthData(s,'2026-01').settlement,30000));
});
test('기준 주 예산을 해당 월 일수에 따라 원 단위로 반올림한다',()=>{
  const jan=proratedWeeks('2027-01','150,000');
  assert.equal(jan['2026-12-28'],64286);
  assert.equal(jan['2027-01-04'],150000);
  const november=proratedWeeks('2026-11',150000);
  assert.equal(november['2026-10-26'],21429);
  assert.equal(november['2026-11-30'],21429);
  assert.equal(proratedWeeks('2024-02',70000)['2024-02-26'],40000);
  assert.ok(Object.values(proratedWeeks('2027-01',0)).every(n=>n===0));
  assert.throws(()=>proratedWeeks('2027-01',-1));
});
test('짧은 주는 해당 월 부분만 표시하고 각 달의 예산과 사용액을 분리한다',()=>{
  const start='2026-11-30';
  assert.equal(weekLabel('2026-10-26','2026-11'),'2026-11-01 (1일)');
  assert.equal(weekLabel(start,'2026-11'),'2026-11-30 (1일)');
  assert.equal(weekLabel(start,'2026-12'),'2026-12-01 ~ 2026-12-06 (6일)');
  const s=empty();
  s.months['2026-11']={...monthData(s,'2026-11'),budget:100000,weeks:{[start]:10000}};
  s.months['2026-12']={...monthData(s,'2026-12'),budget:200000,weeks:{[start]:60000}};
  s.entries={a:{date:start,amount:11000},b:{date:'2026-12-01',amount:3000}};
  assert.deepEqual(totals(s,'2026-11',start),{used:11000,remaining:89000,weekUsed:11000,weekRemaining:-1000});
  assert.deepEqual(totals(s,'2026-12',start),{used:3000,remaining:197000,weekUsed:3000,weekRemaining:57000});
});
test('사용처 추천은 카테고리별 유효 지출 횟수를 따르고 이름 수정과 숨김을 보존한다',()=>{
  const s=empty();
  function add(id,categoryId,note,deleted=false){
    s.entries[id]={date:today(),amount:10,note,categoryId,deleted};
  }
  add('a','food','가게');add('b','food','가게');add('c','food','커피');
  add('d','cafe','커피');add('e','food','커피',true);
  const suggestions=()=>suggestedMerchants(merchantRanking(s,'food'));
  assert.deepEqual(suggestions().map(x=>[x.name,x.count]),[['가게',2]]);
  s.categories.food.merchants=[merchantRule(suggestions()[0],'밥집',false)];
  add('f','food','밥집');add('g','food','커피');
  assert.deepEqual(suggestions().map(x=>[x.name,x.count]),[['밥집',3],['커피',2]]);
  s.categories.food.merchants[0].hidden=true;
  assert.deepEqual(suggestions().map(x=>x.name),['커피']);
  assert.equal(s.entries.a.note,'가게');
  assert.deepEqual(validate(JSON.parse(JSON.stringify(s))),s);
  s.categories.food.merchants.push({name:'가게',aliases:[],hidden:false});
  assert.throws(()=>validate(s));
});
