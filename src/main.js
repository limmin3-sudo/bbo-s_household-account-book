import {expenseDetails,bindCategories,manageCategories,categoryName} from './categories.js';
import {merchantRanking,merchantRule,merchantCategoryKey} from './merchants.js';
import {planEditor, bindPlanRows, readPlan, fixedPage} from './plan.js';
import {reportPage} from './report.js';
let activePage = 'calendar';
import './style.css';
import './planner.css';
import {initializeApp} from 'firebase/app';
import {getAuth,GoogleAuthProvider,signInWithPopup,onAuthStateChanged,signOut} from 'firebase/auth';
import {getFirestore,doc,onSnapshot,runTransaction} from 'firebase/firestore';
import {firebaseConfig} from './config.js';
import {today,money,amount,empty,weekStart,weekLabel,weeks,monthData,totals,carryover,settlementBalance,dayTotal,stamped,validate,revise} from './model.js';
const app=initializeApp(firebaseConfig),auth=getAuth(app),db=getFirestore(app);
const $=s=>document.querySelector(s),esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const artwork = new Set(["add","edit","trash","restore","wallet","calendar","cloud","purse","prev","next","seal"]);
const icon = name => {
  const asset = name === "stamp" ? "seal" : name;
  const src = artwork.has(asset) ? "/assets/planner/" + asset + ".webp" : "/assets/" + asset + ".svg";
  return `<img class="icon" src="${src}" alt="">`;
};
const btn=(id,label,n='',cls='')=>`<button ${id?`id="${id}"`:''} class="${cls}">${n?icon(n):''}${label}</button>`;
let state=empty(),month=today().slice(0,7),selected=today(),user=null,demo=false,ready=false,unsub=null,version=0,pending=false,busy=false,failed=false,status='Google 로그인 또는 체험 모드를 선택해주세요.',undo=null;
function statusText(s){status=s;const e=$('#status');if(e)e.textContent=s;}
function error(e){statusText('저장 실패 · '+(e.message||e));failed=true;busy=false;render();}
function canEdit(){return ready&&!busy&&!failed;}
const demoKey='bbo-demo-v1';
let demoSource=null;
function startDemo(){
 try {
   const raw=localStorage.getItem(demoKey);
   const loaded=raw===null ? empty() : validate(JSON.parse(raw));
   if(unsub)unsub();
   state=loaded;demoSource=raw;demo=true;user=null;ready=true;pending=false;failed=false;
   status='체험 모드 · 실제 계정과 분리된 테스트 데이터';render();
 } catch {
   ready=false;
   status='기존 체험 기록을 읽을 수 없어 저장을 중단했습니다. 이 브라우저의 원본은 보존되어 있습니다.';render();
 }
}
async function saveDemo(next){
 const write=()=>{
   if(localStorage.getItem(demoKey)!==demoSource)throw Error('다른 창에서 체험 기록이 변경되었습니다. 현재 입력을 내보낸 뒤 최신 기록을 불러와주세요.');
   const raw=JSON.stringify(next);
   localStorage.setItem(demoKey,raw);
   demoSource=raw;
 };
 if(navigator.locks)await navigator.locks.request(demoKey,write);
 else write();
}
async function persist(next, keepEditor=false){
 if(!canEdit())return;try{validate(next);}catch(e){statusText(e.message);return;}
 const refresh=()=>keepEditor && $('#dialog')?.open ? statusText(status) : render();
 state=next;pending=true;busy=true;status='저장 중…';refresh();
 try{if(demo){await saveDemo(next);}else{const uid=user.uid,base=version;await runTransaction(db,async tx=>{const r=doc(db,'users',uid,'ledgers','main'),snap=await tx.get(r);const current=snap.exists()?snap.data().version:0;if(current!==base)throw Error('다른 기기에서 변경되었습니다. 내보내기로 현재 입력을 보관한 뒤 최신 데이터 불러오기를 눌러주세요.');tx.set(r,{version:base+1,data:next,updatedAt:new Date().toISOString()});});version=base+1;}
 pending=false;busy=false;failed=false;status=demo?'기기에 저장 완료 · 체험 데이터':'서버 저장 완료';refresh();return true;
 }catch(e){error(e);}
}
function change(fn){const n=structuredClone(state);fn(n);return persist(n);}
async function hideMerchant(id,name) {
 const next=structuredClone(state);
 const category=next.categories[merchantCategoryKey(id)] ??= {name:'미분류',merchant:'',archived:false};
 const item=merchantRanking(next,id).find(item=>item.name===name);
 if (!item || !canEdit()) throw Error('저장 가능한 상태에서 다시 시도해주세요.');
 category.merchants=[...(category.merchants || []).filter(rule=>rule.name!==name),merchantRule(item,name,true)];
 validate(next);
 if (!await persist(next,true)) throw Error(status);
 return next.categories;
}
function connect(u){if(unsub)unsub();ready=false;state=empty();version=0;pending=false;failed=false;undo=null;user=u;demo=false;status=u?'서버에서 불러오는 중…':'Google 로그인 또는 체험 모드를 선택해주세요.';render();if(!u)return;
 unsub=onSnapshot(doc(db,'users',u.uid,'ledgers','main'),{includeMetadataChanges:true},snap=>{if(user?.uid!==u.uid||pending||busy)return;try{state=snap.exists()?validate(snap.data().data):empty();version=snap.exists()?snap.data().version:0;ready=!snap.metadata.fromCache;failed=false;status=ready?'서버 동기화 완료':'서버 연결 대기 중';render();}catch(e){error(e);}},e=>error(e));
}
function budgetCard(title,kind,used,remaining,value){return `<section class="card budget ${kind}"><h2>${icon(kind==='monthly'?'wallet':'heart')}${title}</h2><div class="budget-top"><span>예산</span><strong>${money(value)}원</strong></div><div class="pair"><span>사용액</span><b>${money(used)}원</b></div><div class="balance ${remaining<0?'negative':''}"><span>${kind==='monthly'?'이번 달':'이번 주'} 남음</span><strong>${money(remaining)}원</strong></div></section>`;}
function settlementCard(rows,used) {
 const opening=carryover(state,month);
 const balance=opening+settlementBalance(rows,used);
 const items=rows.map(r=>`<div class="pair"><span>${esc(r.name)}</span><b>${money(r.value)}원</b></div>`);
 const incomeIndex=rows.findIndex(r=>r.name.trim()==='수입');
 items.splice(incomeIndex+1,0,`<div class="pair carryover" title="${state.months[month]?.carryover!==undefined?'직접 설정한 이월':'지난달 정산잔액'}"><span>이월</span><b>${money(opening)}원</b></div>`);
 return `<section class="card settlement"><h2>${icon('spark')}이번 달 정산</h2>
   <div class="settlement-items">${items.join('')}</div>
   <div class="pair"><span>사용액</span><b>${money(used)}원</b></div>
   <div class="balance ${balance<0?'negative':''}"><span>정산 잔액</span><strong>${money(balance)}원</strong></div></section>`;
}
const pageFooter='<div class="bottom"><span>외부 백업: 내보낸 파일을 별도 보관해주세요.</span></div>';
function render(){
 const c=monthData(state,month),ws=weeks(month),current=selected.startsWith(month)?weekStart(selected):ws[0],t=totals(state,month,current),isCurrent=month===today().slice(0,7)&&current===weekStart(today());
 $('#app').innerHTML=`<header><div class="brand"><img src="/assets/planner/hello.webp" alt="쿠로미"/><div><h1>뽀 가계부</h1></div></div><div class="month-switch"><button id="prev" aria-label="이전 달">${icon('prev')}</button><button type="button" id="pick-month" popovertarget="month-menu" aria-label="${month.slice(0,4)}년 ${+month.slice(5)}월, 월 선택">${month.slice(0,4)}년 ${+month.slice(5)}월</button><div id="month-menu" popover aria-label="월 선택"></div><button id="next" aria-label="다음 달">${icon('next')}</button></div><div class="account">${demo?'<span class="demo-label">체험 모드 · 이 기기에만 저장</span>':user?`<span>${esc(user.displayName||'Google 계정')}</span>`:''}${btn('login',user?'로그아웃':'Google 로그인','heart',user?'':'primary')}${!user?btn('demo',demo?'체험 종료':'테스트 데이터로 체험','spark'):''}</div></header>
 <div class="topline"><nav class="page-switch" aria-label="가계부 페이지"><button id="page-calendar" aria-pressed="${activePage === 'calendar'}">${icon('calendar')}달력</button><button id="page-report" aria-pressed="${activePage === 'report'}">${icon('report')}월간 리포트</button><button id="page-fixed" aria-pressed="${activePage === 'fixed'}">${icon('wallet')}고정지출</button><button id="open-plan" ${canEdit()?'':'disabled'}>${icon('memo')}이달의 계획</button></nav><p role="status" aria-live="polite" id="status">${esc(status)}</p><nav aria-label="데이터 관리"><button id="category-manage" ${canEdit()?'':'disabled'}>${icon('edit')}카테고리 관리</button>${btn('export','내보내기','download')}${btn('import','가져오기','restore')}${btn('trash','휴지통','trash')}${failed?btn('retry','다시 저장')+btn('reload','최신 데이터 불러오기'):''}</nav></div>
 ${activePage === 'report' ? reportPage(state,month) : activePage === 'fixed' ? fixedPage(c,month) : `<main><aside class="left">${settlementCard(c.settlement,t.used)}${budgetCard('이번 달 예산','monthly',t.used,t.remaining,c.budget)}${budgetCard(isCurrent?'이번 주 예산':'선택한 주 예산','weekly',t.weekUsed,t.weekRemaining,c.weeks[current]||0)}<p class="week-range">${weekLabel(current,month)}<br>월요일~일요일 · 현재 월 날짜만 합산</p></aside>
 <section class="card calendar-card" aria-label="월간 달력"><div class="calendar-title"><h2>${icon('calendar')}${month.slice(0,4)}년 ${+month.slice(5)}월</h2>${btn('today','오늘','','quiet')}</div><div class="calendar"><div class="weekdays">${['월','화','수','목','금','토','일'].map(x=>`<span>${x}</span>`).join('')}</div><div class="days" style="--calendar-weeks:${ws.length}">${calendar()}</div></div></section>
 <aside class="right"><section class="card memo"><h2>${icon('memo')}월별 계획·메모</h2><button type="button" id="edit-plan-memo" class="saved-plan" aria-label="월별 계획·메모 편집">${esc(c.memo || '눌러서 이번 달 계획을 적어보세요.')}</button></section><section class="card detail"><div class="detail-title"><h2>${icon('calendar')}${+selected.slice(5,7)}월 ${+selected.slice(8)}일</h2><span>${['일','월','화','수','목','금','토'][new Date(selected+'T12:00:00').getDay()]}요일</span></div><div class="day-summary"><span>선택일 합계</span><strong>${money(dayTotal(state,selected))}원</strong></div><div id="entries">${entryRows()}</div>${c.dayNotes?.[selected] ? `<p class="saved-day-note"><b>날짜 메모</b>${esc(c.dayNotes[selected])}</p>` : ''}${selected<=today()?`<button id="detail-add" class="primary wide">${icon('add')} 지출·메모 입력</button><div class="zero-control">${btn('zero',stamped(state,selected)?'무지출 확인 취소':'무지출로 확인','stamp','quiet wide')}<small>기록하지 않은 날은 도장을 찍지 않아요.</small></div>`:'<button id="detail-add" class="primary wide">날짜 메모 입력</button>'}</section></aside>${pageFooter}</main>`}
 ${activePage === 'calendar' ? '' : pageFooter}${undo?`<div class="toast" role="status">휴지통으로 이동했어요. ${btn('undo','되돌리기','restore')}</div>`:''}<dialog id="dialog"></dialog><input id="file" type="file" accept="application/json,.json" hidden>`;
 bind();if(!canEdit())document.querySelectorAll('main:not(.report-layout) input,main:not(.report-layout) textarea,main:not(.report-layout) button:not(#prev):not(#next):not(#today):not(.day)').forEach(e=>e.disabled=true);
}
function calendar() {
  const first = month + '-01';
  const offset = (new Date(first + 'T12:00:00').getDay() + 6) % 7;
  const count = new Date(+month.slice(0,4), +month.slice(5), 0).getDate();
  const notes = monthData(state, month).dayNotes || {};
  const blank = '<div class="blank" aria-hidden="true"></div>';
  const cells = [];
  for (let day = 1; day <= count; day++) {
    const date = month + '-' + String(day).padStart(2, '0');
    const total = dayTotal(state, date);
    const note = notes[date] || '';
    const zero = stamped(state, date);
    const label = [date, total ? money(total)+'원' : '', zero ? '무지출 성공' : '', note].filter(Boolean).join(', ');
    cells.push(`<button class="day ${date===selected?'selected':''} ${date===today()?'is-today':''}" data-date="${date}" aria-label="${esc(label)}" aria-pressed="${date===selected}">
      <span class="day-number">${day}</span>
      ${note ? `<span class="calendar-note" title="${esc(note)}">${esc(note)}</span>` : ''}
      ${total ? `<span class="day-amount">${money(total).replaceAll(',',',<wbr>')}</span>` : ''}
      ${zero ? '<span class="stamp"><img src="/assets/planner/no-spend.svg" alt="무지출성공!"></span>' : ''}
    </button>`);
  }
  return blank.repeat(offset) + cells.join('') + blank.repeat((7-(offset+count)%7)%7);
}
function entryRows(){const rows=Object.entries(state.entries).filter(([,e])=>e.date===selected&&!e.deleted);return rows.length?rows.map(([id,e])=>`<div class="entry"><section><span class="entry-category">${esc(categoryName(state,e))}</span>${e.note||e.purchase?`<p class="entry-note">${[e.note,e.purchase].filter(Boolean).map(esc).join(' · ')}</p>`:''}<strong>${money(e.amount)}원</strong></section><div><button data-edit="${id}" aria-label="${money(e.amount)}원 수정">${icon('edit')}</button><button data-delete="${id}" aria-label="${money(e.amount)}원 삭제">${icon('trash')}</button><button data-history="${id}" aria-label="${money(e.amount)}원 수정 이력">${icon('history')}</button></div></div>`).join(''):`<div class="empty-day">${icon(stamped(state,selected)?'stamp':'purse')}<p>${stamped(state,selected)?'무지출성공!':'아직 기록이 없어요.'}</p></div>`;}
function on(id,fn){const e=$('#'+id);if(e)e.onclick=fn;}
function modal(title,content,submit){const d=$('#dialog');d.innerHTML=`<form id="modal-form"><div class="modal-head"><h2>${title}</h2><button type="button" id="close-dialog" aria-label="닫기">×</button></div>${content}<p id="modal-error" role="alert"></p>${submit?btn('modal-save','저장','heart','primary wide'):''}</form>`;d.showModal();on('close-dialog',()=>d.close());if(submit)$('#modal-form').onsubmit=async e=>{e.preventDefault();try{await submit(new FormData(e.target));d.close();}catch(e){$('#modal-error').textContent=e.message;}};}
function numberField(label,name,value){return `<label>${esc(label)}<input name="${name}" inputmode="numeric" value="${value}" required></label>`;}
function openMonthlyPlan() {
  const key = month;
  modal(key + ' · 이달의 계획', planEditor(monthData(state,key),key,activePage==='fixed'?'fixed':'memo',carryover(state,key,false)), form => {
    const next = readPlan(form,state,key);
    const updated = structuredClone(state);
    updated.months[key] = next;
    validate(updated);
    return persist(updated);
  });
  bindPlanRows($('#modal-form'),key);
}

function openDayEditor(date) {
  const key = date.slice(0,7);
  const previous = monthData(state,key).dayNotes?.[date] || '';
  const expenseFields = date <= today() ? `<label>사용 금액 (원)<input name="amount" inputmode="numeric" placeholder="0" autofocus></label>
    ${expenseDetails(state)}` : '';
  modal(date + ' 기록', expenseFields + `<label>날짜 메모<textarea name="dayNote" rows="3" maxlength="2000" placeholder="금액 없이 메모만 저장할 수도 있어요.">${esc(previous)}</textarea></label>`, form => {
    const raw = String(form.get('amount') || '').trim();
    const note = String(form.get('use') || '').trim();
    const memo = form.get('dayNote').trim();
    if (!raw && (note || form.get('purchase')?.trim() || form.get('categoryId'))) throw Error('사용처와 함께 기록할 금액을 입력해주세요.');
    if (!raw && !memo && !previous) throw Error('금액 또는 날짜 메모를 입력해주세요.');
    const next = structuredClone(state);
    if (raw) {
      const value = amount(raw);
      if (!value || date > today()) throw Error('오늘까지의 날짜에 1원 이상 입력해주세요.');
      revise(next,crypto.randomUUID(),{date,amount:value,note,purchase:String(form.get('purchase')||'').trim(),categoryId:form.get('categoryId')||'',deleted:false},'추가');
    }
    const config = monthData(next,key);
    const dayNotes = {...config.dayNotes};
    if (memo) dayNotes[date] = memo;
    else delete dayNotes[date];
    next.months[key] = {...config,dayNotes};
    validate(next);
    return persist(next);
  });
  bindCategories($('#modal-form'),state,hideMerchant);
  $('#dialog [name=amount], #dialog textarea')?.focus();
}

function bind(){
 bindMonthPicker();
 on('category-manage',()=>manageCategories(state,modal,categories=>{
   const next=structuredClone(state);next.categories=categories;validate(next);return persist(next);
 }));
 for (const page of ['calendar','report','fixed']) {
   on('page-' + page, () => {
     activePage = page;
     render();
     $('#page-' + page).focus();
   });
 }
 document.querySelectorAll('[data-report-date]').forEach(button => {
   button.onclick = () => {
     selected = button.dataset.reportDate;
     activePage = 'calendar';
     render();
     $('.day.selected')?.focus();
   };
 });
 on('login',async()=>{if(busy||pending){statusText('저장되지 않은 변경사항을 먼저 내보내거나 다시 저장해주세요.');return;}try{if(user)await signOut(auth);else{await signInWithPopup(auth,new GoogleAuthProvider());}}catch(e){statusText('로그인 실패 · '+e.code);}});
 on('demo',()=>{if(busy)return;if(demo){demo=false;connect(null);return;}startDemo();});
 on('prev',()=>moveMonth(-1));on('next',()=>moveMonth(1));on('today',()=>{month=today().slice(0,7);selected=today();render();});
 document.querySelectorAll('[data-date]').forEach(button => {
   button.onclick = () => {
     selected = button.dataset.date;
     render();
     $('.day.selected').focus({preventScroll:true});
   };
 });
 document.querySelectorAll('[data-edit]').forEach(e=>e.onclick=()=>{const id=e.dataset.edit;modal('지출 수정',numberField('금액','amount',state.entries[id].amount)+`${expenseDetails(state,state.entries[id])}`,async f=>{const v=amount(f.get('amount'));if(!v)throw Error('0원은 지출 삭제 후 무지출 확인을 사용해주세요.');await change(s=>revise(s,id,{amount:v,note:String(f.get('use')||'').trim(),purchase:f.get('purchase').trim(),categoryId:f.get('categoryId')||''},'지출 수정'));});bindCategories($('#modal-form'),state,hideMerchant);});
 document.querySelectorAll('[data-delete]').forEach(e=>e.onclick=()=>{const id=e.dataset.delete;undo=id;change(s=>revise(s,id,{deleted:true},'삭제'));});
 document.querySelectorAll('[data-history]').forEach(e=>e.onclick=()=>history(e.dataset.history));
 on('undo',()=>{const id=undo;undo=null;change(s=>revise(s,id,{deleted:false},'삭제 되돌리기'));});
 on('zero',()=>{if(dayTotal(state,selected)>0){statusText('지출이 있는 날짜는 무지출로 확인할 수 없어요.');return;}change(s=>{s.closed[selected]=!s.closed[selected];});});
 on('open-plan', openMonthlyPlan);
 on('edit-plan-memo',()=>{
   const key=month;
   modal(key+' 월별 계획·메모',`<label>계획·메모<textarea name="memo" rows="6" maxlength="10000">${esc(monthData(state,key).memo)}</textarea></label>`,form=>{
     return change(next=>{next.months[key]={...monthData(next,key),memo:form.get('memo')};});
   });
   $('#dialog textarea').focus();
 });
 on('detail-add',()=>openDayEditor(selected));
 on('trash',trash);on('export',()=>download(state));on('import',()=>{if(!canEdit()){statusText('체험 모드 또는 로그인 후 저장 가능한 상태에서 가져와주세요.');return;}$('#file').click();});$('#file').onchange=importFile;
 on('retry',()=>{if(!failed)return;if(!pending){connect(user);return;}failed=false;ready=true;persist(structuredClone(state));});on('reload',()=>{modal('최신 데이터 불러오기','<p>현재 입력을 파일로 내보낸 뒤 서버의 최신 기록을 불러옵니다.</p><button type="button" id="reload-confirm">파일 보관 후 불러오기</button>');on('reload-confirm',()=>{download(state);pending=false;busy=false;failed=false;if(demo)startDemo();else connect(user);});});
}
function settlementRow(r,i){return `<div class="settlement-row"><input name="name${i}" value="${esc(r.name)}" aria-label="정산 항목 이름" maxlength="40" required><input name="value${i}" value="${r.value}" aria-label="정산 금액" inputmode="numeric" required><button type="button" data-remove="${i+1}" aria-label="항목 삭제">×</button></div>`;}
function selectMonth(key) {
 if (key !== month) {
   month = key;
   selected = key === today().slice(0,7) ? today() : key + '-01';
 }
 render();
}
function moveMonth(n) {
 const date = new Date(+month.slice(0,4), +month.slice(5)-1+n, 1);
 selectMonth(`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`);
}
function bindMonthPicker() {
 const menu = $('#month-menu');
 const trigger = $('#pick-month');
 let year = Number(month.slice(0,4));
 function draw() {
   const months = Array.from({length:12}, (_, i) => {
     const key = year + '-' + String(i+1).padStart(2,'0');
     return `<button type="button" data-month="${key}" aria-pressed="${key===month}">${i+1}월</button>`;
   });
   menu.innerHTML = `<div class="picker-year"><button type="button" data-step="-1" aria-label="이전 연도">${icon('prev')}</button><b aria-live="polite">${year}년</b><button type="button" data-step="1" aria-label="다음 연도">${icon('next')}</button></div><div class="picker-months">${months.join('')}</div>`;
 }
 menu.onbeforetoggle = event => {
   if (event.newState !== 'open') return;
   year = Number(month.slice(0,4));
   draw();
   const rect = trigger.getBoundingClientRect();
   const width = Math.min(innerWidth-24, 300);
   menu.style.left = Math.max(12, Math.min(innerWidth-width-12, rect.left+(rect.width-width)/2)) + 'px';
   menu.style.top = rect.bottom+6 + 'px';
 };
 menu.onclick = event => {
   const button = event.target.closest('button');
   if (!button) return;
   if (button.dataset.step) {
     year += Number(button.dataset.step);
     draw();
     menu.querySelector(`[data-step="${button.dataset.step}"]`).focus();
   } else if (button.dataset.month) {
     menu.hidePopover();
     selectMonth(button.dataset.month);
     $('#pick-month').focus();
   }
 };
}
function trash(){const rows=Object.entries(state.entries).filter(([,e])=>e.deleted);modal('휴지통',rows.length?rows.map(([id,e])=>`<div class="restore-row"><span>${esc(e.date)} · ${money(e.amount)}원</span><button type="button" data-restore="${id}" ${!canEdit()?'disabled':''}>복원</button></div>`).join(''):'<p>휴지통이 비어 있어요.</p>');document.querySelectorAll('[data-restore]').forEach(e=>e.onclick=()=>{const id=e.dataset.restore;$('#dialog').close();change(s=>revise(s,id,{deleted:false},'휴지통 복원'));});}
function history(id){const h=Object.entries(state.history).filter(([,h])=>h.entryId===id).reverse();modal('금액 수정 이력',h.length?h.map(([key,h])=>`<div class="restore-row"><span>${esc(h.at.slice(0,19).replace('T',' '))} UTC<br>${esc(h.reason)} 전 · ${money(h.before.amount)}원</span><button type="button" data-revision="${key}" ${!canEdit()?'disabled':''}>이 금액 복원</button></div>`).join(''):'<p>수정 이력이 없어요.</p>');document.querySelectorAll('[data-revision]').forEach(e=>e.onclick=()=>{const h=state.history[e.dataset.revision];$('#dialog').close();change(s=>revise(s,id,{...h.before,deleted:false},'이전 금액 복원'));});}
function download(s,prefix='bbo-export'){const body=JSON.stringify({format:'bbo-household',version:1,exportedAt:new Date().toISOString(),data:validate(s)},null,2);validate(JSON.parse(body).data);const url=URL.createObjectURL(new Blob([body],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=`${prefix}-${today()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);statusText('내보내기 파일 생성 · 다운로드 파일을 별도 위치에 보관해주세요.');}
async function importFile(e){try{const file=e.target.files[0];if(!file)return;if(file.size>1500000)throw Error('가져오기 파일이 너무 큽니다.');const f=JSON.parse(await file.text());if(f.format!=='bbo-household'||f.version!==1)throw Error('뽀 가계부 내보내기 파일이 아닙니다.');const imported=validate(f.data);modal('파일 검증 완료',`<p>지출 ${Object.keys(imported.entries).length}건 · 월 설정 ${Object.keys(imported.months).length}개</p><p>현재 기록을 파일로 먼저 내보내고, 선택한 파일로 전체 복원합니다. 다운로드를 보관해주세요.</p><button type="button" id="import-confirm" class="primary">현재 기록 내보내기 후 전체 복원</button>`);on('import-confirm',async()=>{download(state,'bbo-before-restore');$('#dialog').close();await persist(imported);});}catch(e){statusText('가져오기 실패 · '+e.message);}}
window.addEventListener('beforeunload',e=>{if(pending||busy){e.preventDefault();e.returnValue='';}});
render();onAuthStateChanged(auth,u=>{if(!u&&demo)return;connect(u);});






