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
    <h2><img class="weight-title-mascot" src="/assets/planner/hello.webp" alt="">${month.slice(0,4)}년 ${Number(month.slice(5))}월 체중<span class="weight-title-spark" aria-hidden="true">✦</span></h2>
    <div class="weight-body">
    <div class="weight-stats">
      <div class="weight-start"><div class="weight-stat-label"><span>첫 기록</span><i aria-hidden="true"><img src="/assets/weight.svg" alt=""></i></div><strong>${records.length?kg(first):'—'}</strong></div>
      <div class="weight-today"><div class="weight-stat-label"><span>오늘 기록</span><i aria-hidden="true"><img src="/assets/planner/hello.webp" alt=""></i></div><strong>${todayWeight===undefined?'미기록':kg(todayWeight)}</strong></div>
      <div class="weight-change"><div class="weight-stat-label"><span>이달의 변화</span><i aria-hidden="true"><img src="/assets/spark.svg" alt=""></i></div><strong>${change}</strong></div>
    </div>
    <section class="weight-chart"><div class="weight-chart-head"><div class="weight-chart-brand"><img src="/assets/planner/seal.webp" alt=""><h3>체중 변화</h3><span class="weight-chart-heart" aria-hidden="true">♡</span></div><span>kg</span></div>${records.length ? chart(records,month) : '<div class="weight-empty"><img src="/assets/planner/seal.webp" alt=""><p>기록 없음</p></div>'}</section>
    </div></section></main>`;
}
function chart(records,month) {
  return `<div class="weight-plot"><svg role="img" aria-label="${month} 일별 체중 변화">${chartContents(records,month,1000,400)}</svg><div class="weight-tooltip" id="weight-tooltip" role="tooltip" hidden><small></small><strong></strong></div></div>`;
}

function chartContents(records,month,width,height) {
  const compact=width<600;
  const left=compact?34:48,right=compact?14:24,top=24,bottom=compact?38:34;
  const values=records.map(([,value])=>value);
  const low=Math.max(0,Math.floor(Math.min(...values))-1);
  const high=Math.ceil(Math.max(...values))+1;
  const days=new Date(Number(month.slice(0,4)),Number(month.slice(5)),0).getDate();
  const x=day=>left+(day-1)/(days-1)*(width-left-right);
  const y=value=>top+(high-value)/(high-low)*(height-top-bottom);
  const positions=records.map(([date,value])=>[x(Number(date.slice(8))),y(value)]);
  const curve=positions.reduce((path,[px,py],i)=>{
    if(!i)return `M ${px} ${py}`;
    const [previousX,previousY]=positions[i-1],middle=(previousX+px)/2;
    return path+` C ${middle} ${previousY} ${middle} ${py} ${px} ${py}`;
  },'');
  const [lastX,lastY]=positions.at(-1);
  const stickerX=lastX+64<width-right ? lastX+18 : lastX-56;
  const stickerY=Math.max(top,Math.min(height-bottom-44,lastY-52));
  const base=height-bottom;
  const area=`${curve} L ${lastX} ${base} L ${positions[0][0]} ${base} Z`;
  const grid=Array.from({length:high-low+1},(_,i)=>{
    const value=low+i,cy=y(value);
    return `<line x1="${left}" y1="${cy}" x2="${width-right}" y2="${cy}" class="weight-grid"/><text class="weight-kg" x="${left-12}" y="${cy+4}" text-anchor="end">${value}</text>`;
  }).join('');
  const labels=Array.from({length:days},(_,i)=>i+1).map(day=>`<text class="weight-day" x="${x(day)}" y="${height-12}" text-anchor="${compact?'end':'middle'}" ${compact?`transform="rotate(-55 ${x(day)} ${height-12})"`:''}>${day}</text>`).join('');
  return `<defs><linearGradient id="weight-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#a07ad4" stop-opacity=".25"/><stop offset="100%" stop-color="#a07ad4" stop-opacity="0"/></linearGradient><linearGradient id="weight-stroke"><stop stop-color="#b18cd9"/><stop offset="100%" stop-color="#7950b5"/></linearGradient></defs>${grid}${labels}<path d="${area}" fill="url(#weight-fill)"/><line class="weight-guide" y1="${top}" y2="${base}" hidden/><path d="${curve}" class="weight-line"/><g class="weight-companion" aria-hidden="true" pointer-events="none"><circle cx="${stickerX+21}" cy="${stickerY+22}" r="25"/><image href="/assets/planner/hello.webp" x="${stickerX}" y="${stickerY}" width="42" height="42"/></g>${records.map(([date,value],i)=>`<g class="weight-marker" data-weight-date="${date}" data-weight-value="${value}" tabindex="0" role="button" aria-label="${date} ${kg(value)}"><circle cx="${positions[i][0]}" cy="${positions[i][1]}" r="14" class="weight-hit"/><circle cx="${positions[i][0]}" cy="${positions[i][1]}" r="${i===records.length-1?5.5:4.5}" class="weight-point"/></g>`).join('')}`;
}

let chartObserver;
export function bindWeightChart(state,month) {
  chartObserver?.disconnect();
  const plot=document.querySelector('.weight-plot');
  if(!plot)return;
  const records=weightRecords(state,month),svg=plot.querySelector('svg'),tooltip=plot.querySelector('.weight-tooltip');
  let active;
  const hide=()=>{
    tooltip.hidden=true;
    active?.classList.remove('is-active');
    active=null;
    svg.querySelector('.weight-guide')?.setAttribute('hidden','');
  };
  const show=marker=>{
    if(!marker)return;
    active?.classList.remove('is-active');active=marker;marker.classList.add('is-active');
    tooltip.querySelector('small').textContent=marker.dataset.weightDate.replaceAll('-','. ');
    tooltip.querySelector('strong').textContent=kg(Number(marker.dataset.weightValue));
    tooltip.hidden=false;
    const point=marker.querySelector('.weight-point'),rect=point.getBoundingClientRect(),box=plot.getBoundingClientRect();
    const px=rect.left+rect.width/2-box.left,py=rect.top+rect.height/2-box.top;
    tooltip.style.left=Math.max(8,Math.min(box.width-tooltip.offsetWidth-8,px-tooltip.offsetWidth/2))+'px';
    tooltip.style.top=Math.max(8,Math.min(box.height-tooltip.offsetHeight-8,py-tooltip.offsetHeight-14))+'px';
    const guide=svg.querySelector('.weight-guide');
    guide.setAttribute('x1',point.getAttribute('cx'));guide.setAttribute('x2',point.getAttribute('cx'));guide.removeAttribute('hidden');
  };
  svg.onpointermove=event=>{const marker=event.target.closest('.weight-marker');if(marker)show(marker);else hide();};
  svg.onpointerleave=()=>{if(!svg.contains(document.activeElement))hide();};
  svg.onclick=event=>show(event.target.closest('.weight-marker'));
  svg.addEventListener('focusin',event=>show(event.target.closest('.weight-marker')));
  svg.addEventListener('focusout',event=>{if(!svg.contains(event.relatedTarget))hide();});
  svg.onkeydown=event=>{
    if(event.key==='Escape'){hide();return;}
    const markers=[...svg.querySelectorAll('.weight-marker')],index=markers.indexOf(document.activeElement);
    if(index<0)return;
    if(['ArrowLeft','ArrowRight'].includes(event.key)){
      event.preventDefault();markers[Math.max(0,Math.min(markers.length-1,index+(event.key==='ArrowRight'?1:-1)))].focus();
    } else if(event.key==='Enter'||event.key===' '){event.preventDefault();show(markers[index]);}
  };
  chartObserver=new ResizeObserver(()=>{
    hide();
    const {width,height}=plot.getBoundingClientRect();
    if(width<1||height<1)return;
    svg.setAttribute('viewBox',`0 0 ${width} ${height}`);
    svg.innerHTML=chartContents(records,month,width,height);
  });
  chartObserver.observe(plot);
}
