import {test} from 'node:test';
import assert from 'node:assert/strict';
import {empty,monthData,validate,totals,stamped} from '../src/model.js';
import {weight,weightRecords,weightPage} from '../src/weight.js';

test('체중 입력은 kg 소수 첫째 자리까지 허용하고 잘못된 값은 거부한다',()=>{
  assert.equal(weight(' 65.2 '),65.2);
  assert.equal(weight('70'),70);
  for(const value of ['',0,-1,'NaN','Infinity','1e2','65.25',501,'65kg']) assert.throws(()=>weight(value));
});
test('체중은 지출과 무지출 확인에 영향을 주지 않고 내보내기·복원에 보존된다',()=>{
  const s=empty(),month='2026-01';
  s.months[month]={...monthData(s,month),weights:{'2026-01-05':70.1,'2026-01-02':72.5}};
  assert.deepEqual(weightRecords(s,month),[['2026-01-02',72.5],['2026-01-05',70.1]]);
  assert.deepEqual(validate(JSON.parse(JSON.stringify(s))),s);
  assert.equal(totals(s,month,'2026-01-05').used,0);
  assert.equal(stamped(s,'2026-01-05'),false);
  assert.match(weightPage(s,month,true),/2.4kg 감량/);
  assert.equal(weightRecords(s,'2026-02').length,0);
  assert.doesNotThrow(()=>validate(empty()));
});
test('체중 저장 데이터는 유효한 같은 달의 과거 날짜와 숫자만 허용한다',()=>{
  for(const weights of [null,[],{'2026-02-01':60},{'2026-01-32':60},{'2026-01-01':'60'},{'2026-01-01':0},{'2026-01-01':NaN},{'2026-01-01':60.25}]) {
    const s=empty();s.months['2026-01']={...monthData(s,'2026-01'),weights};
    assert.throws(()=>validate(s));
  }
  const s=empty();s.months['2099-01']={...monthData(s,'2099-01'),weights:{'2099-01-01':60}};
  assert.throws(()=>validate(s));
});
test('체중 그래프는 빈 기록과 한 점·동일 체중·증가를 올바르게 표시한다',()=>{
  const s=empty(),m='2026-01';
  assert.match(weightPage(s,m,true),/아직 몸무게 기록이 없어요/);
  for(const values of [[60],[60,60],[60,61]]) {
    s.months[m]={...monthData(s,m),weights:Object.fromEntries(values.map((v,i)=>['2026-01-0'+(i+1),v]))};
    const html=weightPage(s,m,true);
    assert.doesNotMatch(html,/NaN|Infinity/);
    assert.match(html,values.length===1?/기록 2개부터 표시/:values[1]===60?/변화 없음/:/1.0kg 증가/);
  }
});
