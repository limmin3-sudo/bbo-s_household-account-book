import {test} from 'node:test';import assert from 'node:assert/strict';
import {empty,amount,totals,monthData,weekStart,weeks,stamped,revise,validate,today,dayTotal} from '../src/model.js';
test('금액 입력 검증: 12자리·쉼표 허용, 음수/소수/과대/잘못된 값 거부',()=>{assert.equal(amount('999,999,999,999'),999999999999);assert.equal(amount('0'),0);for(const v of ['-1','1.5','','1e3','1000000000000','가'])assert.throws(()=>amount(v));});
test('월요일 기준, 연도와 월 경계 및 윤년',()=>{assert.equal(weekStart('2026-11-01'),'2026-10-26');assert.equal(weekStart('2027-01-01'),'2026-12-28');assert.equal(weeks('2024-02').length,5);assert.equal(weeks('2026-11').length,6);});
test('주 초과 음수, 월 중복 차감 없음, 월 경계 지출 제외',()=>{const s=empty();s.months['2026-11']={...monthData(s,'2026-11'),budget:600000,weeks:{'2026-11-09':150000,'2026-10-26':50000}};s.entries={a:{date:'2026-11-09',amount:100000,deleted:false},b:{date:'2026-11-14',amount:62000,deleted:false},c:{date:'2026-10-31',amount:30000,deleted:false},d:{date:'2026-11-01',amount:10000,deleted:false}};assert.deepEqual(totals(s,'2026-11','2026-11-09'),{used:172000,remaining:428000,weekUsed:162000,weekRemaining:-12000});assert.equal(totals(s,'2026-11','2026-10-26').weekUsed,10000);});
test('추가·수정·삭제·되돌리기·금액 이력 복원 재계산',()=>{const s=empty();revise(s,'a',{date:today(),amount:1000,deleted:false},'추가');revise(s,'b',{date:today(),amount:2000,deleted:false},'추가');assert.equal(dayTotal(s,today()),3000);revise(s,'a',{amount:4000},'수정');assert.equal(dayTotal(s,today()),6000);revise(s,'a',{deleted:true},'삭제');assert.equal(dayTotal(s,today()),2000);revise(s,'a',{deleted:false},'복원');assert.equal(dayTotal(s,today()),6000);const h=Object.values(s.history).find(h=>h.reason==='수정');revise(s,'a',h.before,'이력 복원');assert.equal(dayTotal(s,today()),3000);assert.equal(Object.keys(s.history).length,4);});
test('미기록/확인 무지출 구분 및 미래 도장 금지, 지출 추가 제거',()=>{const s=empty(),d=today();assert.equal(stamped(s,d),false);s.closed[d]=true;assert.equal(stamped(s,d),true);s.closed['2099-01-01']=true;assert.equal(stamped(s,'2099-01-01'),false);delete s.closed['2099-01-01'];revise(s,'a',{date:d,amount:1,deleted:false},'추가');assert.equal(stamped(s,d),false);revise(s,'a',{deleted:true},'삭제');assert.equal(stamped(s,d),false);});
test('내보내기 roundtrip 및 가져오기 무결성 검사',()=>{const s=empty();s.months['2026-11']={...monthData(s,'2026-11'),memo:'<script>악성</script>'};revise(s,'a',{date:today(),amount:999999999999,deleted:false},'추가');assert.deepEqual(validate(JSON.parse(JSON.stringify(s))),s);for(const f of [null,{schema:2}, {...s,entries:{a:{date:'2026-02-30',amount:1,deleted:false}}},{...s,entries:{a:{date:'2099-01-01',amount:1,deleted:false}}},{...s,entries:{a:{date:today(),amount:-1,deleted:false}}},{...s,months:{'2026-11':{...s.months['2026-11'],budget:NaN}}}])assert.throws(()=>validate(f));});
import {merchantRanking, suggestedMerchants, merchantRule} from '../src/merchants.js';
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
