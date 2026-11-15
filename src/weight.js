import {monthData,today} from './model.js';

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
export function weightPage(state,month,date=today()) {
  const records=weightRecords(state,month);
  const todayWeight=monthData(state,date.slice(0,7)).weights?.[date];
  const first=records[0]?.[1],last=records.at(-1)?.[1];
  const delta=records.length>1 ? Math.round((last-first)*10)/10 : null;
  const change=delta===null ? '—' : delta===0 ? '변화 없음' : kg(Math.abs(delta))+(delta<0?' 감량':' 증가');
  return `<main class="report-layout weight-layout"><section class="card weight-page" aria-label="체중 기록">
    <h2>${month.slice(0,4)}년 ${Number(month.slice(5))}월 체중</h2>
    <div class="weight-body">
    <div class="weight-stats">
      <div><span>첫 기록</span><strong>${records.length?kg(first):'—'}</strong><small>${records[0]?.[0] || '기록 없음'}</small></div>
      <div class="weight-today"><span>오늘 기록</span><strong>${todayWeight===undefined?'미기록':kg(todayWeight)}</strong><small>${date}</small></div>
      <div><span>이달의 변화</span><strong>${change}</strong></div>
    </div>
    <section class="weight-chart"><h3>체중 변화</h3>${records.length ? chart(records,month) : '<p class="weight-empty">기록 없음</p>'}</section>
    </div></section></main>`;
}
function chart(records,month) {
  const width=1080,left=60,right=24,top=24,bottom=42;
  const values=records.map(([,value])=>value);
  const low=Math.max(0,Math.floor(Math.min(...values))-1);
  const high=Math.ceil(Math.max(...values))+1;
  const height=Math.max(280,(high-low)*24+top+bottom);
  const days=new Date(Number(month.slice(0,4)),Number(month.slice(5)),0).getDate();
  const x=day=>left+(day-1)/(days-1)*(width-left-right);
  const y=value=>top+(high-value)/(high-low)*(height-top-bottom);
  const points=records.map(([date,value])=>`${x(Number(date.slice(8)))},${y(value)}`).join(' ');
  const grid=Array.from({length:high-low+1},(_,i)=>{
    const value=low+i,cy=y(value);
    return `<line x1="${left}" y1="${cy}" x2="${width-right}" y2="${cy}" class="weight-grid"/><text class="weight-kg" x="${left-10}" y="${cy+4}" text-anchor="end">${value}</text>`;
  }).join('');
  const labels=Array.from({length:days},(_,i)=>i+1).map(day=>`<text class="weight-day" x="${x(day)}" y="${height-14}" text-anchor="middle">${day}일</text>`).join('');
  return `<div class="weight-plot" tabindex="0" role="region" aria-label="일별 체중 그래프"><svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${month} 날짜별 체중 변화. 첫 기록 ${kg(values[0])}, 최근 기록 ${kg(values.at(-1))}">${grid}${labels}<polyline points="${points}" class="weight-line"/>${records.map(([date,value])=>`<circle cx="${x(Number(date.slice(8)))}" cy="${y(value)}" r="5" class="weight-point"><title>${date} · ${kg(value)}</title></circle>`).join('')}</svg></div>`;
}
