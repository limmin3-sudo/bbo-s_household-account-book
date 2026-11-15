import {monthData} from './model.js';

export function weight(value) {
  const text=String(value).trim();
  if(!/^\d{1,3}(?:\.\d)?$/.test(text) || Number(text)<1 || Number(text)>500) {
    throw Error('몸무게는 1~500kg 사이, 소수 첫째 자리까지 입력해주세요.');
  }
  return Number(text);
}
export function weightRecords(state,month) {
  return Object.entries(monthData(state,month).weights || {}).sort(([a],[b])=>a.localeCompare(b));
}
const kg=value=>value.toFixed(1)+'kg';
export function weightPage(state,month) {
  const records=weightRecords(state,month);
  const first=records[0]?.[1],last=records.at(-1)?.[1];
  const delta=records.length>1 ? Math.round((last-first)*10)/10 : null;
  const change=delta===null ? '기록 2개부터 표시' : delta===0 ? '변화 없음' : kg(Math.abs(delta))+(delta<0?' 감량':' 증가');
  return `<main class="report-layout weight-layout"><section class="card weight-page" aria-label="체중 기록">
    <h2>${month.slice(0,4)}년 ${Number(month.slice(5))}월 체중</h2>
    <div class="weight-body"><p class="muted">아침 몸무게를 기록하고 변화를 확인하세요. 몸무게는 달력에 표시되지 않아요.</p>
    <div class="weight-stats">
      <div><span>첫 기록</span><strong>${records.length?kg(first):'—'}</strong><small>${records[0]?.[0] || '기록 없음'}</small></div>
      <div><span>최근 기록</span><strong>${records.length?kg(last):'—'}</strong><small>${records.at(-1)?.[0] || '기록 없음'}</small></div>
      <div><span>이달의 변화</span><strong>${change}</strong><small>${records.length}일 기록 · 첫 기록 대비</small></div>
    </div>
    <section class="weight-chart"><h3>체중 변화</h3>${records.length ? chart(records,month) : '<p class="weight-empty">아직 몸무게 기록이 없어요.<br>달력에서 날짜를 선택한 뒤 지출·메모 입력에서 몸무게를 기록해주세요.</p>'}</section>
    </div></section></main>`;
}
function chart(records,month) {
  const width=720,height=280,left=60,right=24,top=24,bottom=42;
  const values=records.map(([,value])=>value);
  const low=Math.max(0,Math.floor((Math.min(...values)-.5)*2)/2);
  const high=Math.ceil((Math.max(...values)+.5)*2)/2;
  const days=new Date(Number(month.slice(0,4)),Number(month.slice(5)),0).getDate();
  const x=day=>left+(day-1)/(days-1)*(width-left-right);
  const y=value=>top+(high-value)/(high-low)*(height-top-bottom);
  const points=records.map(([date,value])=>`${x(Number(date.slice(8)))},${y(value)}`).join(' ');
  const grid=Array.from({length:5},(_,i)=>{
    const value=low+(high-low)*i/4,cy=y(value);
    return `<line x1="${left}" y1="${cy}" x2="${width-right}" y2="${cy}" class="weight-grid"/><text x="${left-10}" y="${cy+4}" text-anchor="end">${value.toFixed(1)}</text>`;
  }).join('');
  const labels=[1,5,10,15,20,25,days].map(day=>`<text x="${x(day)}" y="${height-14}" text-anchor="middle">${day}일</text>`).join('');
  return `<p class="muted">단위 kg · 기록한 날짜 사이를 이은 그래프예요. 점에 마우스를 올리면 기록을 볼 수 있어요.</p><svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${month} 날짜별 체중 변화. 첫 기록 ${kg(values[0])}, 최근 기록 ${kg(values.at(-1))}">${grid}${labels}<polyline points="${points}" class="weight-line"/>${records.map(([date,value])=>`<circle cx="${x(Number(date.slice(8)))}" cy="${y(value)}" r="5" class="weight-point"><title>${date} · ${kg(value)}</title></circle>`).join('')}</svg>`;
}
