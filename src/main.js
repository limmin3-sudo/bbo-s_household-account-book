import {reportPage} from './report.js';
let activePage = 'calendar';
import './style.css';
import './planner.css';
import {initializeApp} from 'firebase/app';
import {getAuth,GoogleAuthProvider,signInWithPopup,onAuthStateChanged,signOut} from 'firebase/auth';
import {getFirestore,doc,onSnapshot,runTransaction} from 'firebase/firestore';
import {firebaseConfig} from './config.js';
import {today,money,amount,empty,weekStart,weeks,monthData,totals,dayTotal,stamped,validate,revise} from './model.js';
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
async function persist(next){
 if(!canEdit())return;try{validate(next);}catch(e){statusText(e.message);return;}
 state=next;pending=true;busy=true;status='저장 중…';render();
 try{if(demo){localStorage.setItem('bbo-demo-v1',JSON.stringify(next));}else{const uid=user.uid,base=version;await runTransaction(db,async tx=>{const r=doc(db,'users',uid,'ledgers','main'),snap=await tx.get(r);const current=snap.exists()?snap.data().version:0;if(current!==base)throw Error('다른 기기에서 변경되었습니다. 내보내기로 현재 입력을 보관한 뒤 최신 데이터 불러오기를 눌러주세요.');tx.set(r,{version:base+1,data:next,updatedAt:new Date().toISOString()});});version=base+1;}
 pending=false;busy=false;failed=false;status=demo?'기기에 저장 완료 · 체험 데이터':'서버 저장 완료';render();
 }catch(e){error(e);}
}
function change(fn){const n=structuredClone(state);fn(n);return persist(n);}
function connect(u){if(unsub)unsub();ready=false;state=empty();version=0;pending=false;failed=false;undo=null;user=u;demo=false;status=u?'서버에서 불러오는 중…':'Google 로그인 또는 체험 모드를 선택해주세요.';render();if(!u)return;
 unsub=onSnapshot(doc(db,'users',u.uid,'ledgers','main'),{includeMetadataChanges:true},snap=>{if(user?.uid!==u.uid||pending||busy)return;try{state=snap.exists()?validate(snap.data().data):empty();version=snap.exists()?snap.data().version:0;ready=!snap.metadata.fromCache;failed=false;status=ready?'서버 동기화 완료':'서버 연결 대기 중';render();}catch(e){error(e);}},e=>error(e));
}
function budgetCard(title,kind,used,remaining,value){return `<section class="card budget ${kind}"><h2>${icon(kind==='monthly'?'wallet':'heart')}${title}</h2><div class="budget-top"><span>예산</span><strong>${money(value)}<small>원</small></strong></div><div class="pair"><span>사용액</span><b>${money(used)}원</b></div><div class="balance ${remaining<0?'negative':''}"><span>${kind==='monthly'?'이번 달':'이번 주'} 남음</span><strong>${money(remaining)}<small>원</small></strong></div>${btn(kind==='monthly'?'month-budget':'week-budget','예산 수정','edit','quiet wide')}</section>`;}
function render(){
 const c=monthData(state,month),ws=weeks(month),current=selected.startsWith(month)?weekStart(selected):ws[0],t=totals(state,month,current),isCurrent=current===weekStart(today());
 $('#app').innerHTML=`<header><div class="brand"><img src="/assets/planner/hello.webp" alt="쿠로미"/><div><h1>뽀 가계부</h1></div></div><div class="month-switch"><button id="prev" aria-label="이전 달">${icon('prev')}</button><strong>${month.slice(0,4)}년 ${+month.slice(5)}월</strong><button id="next" aria-label="다음 달">${icon('next')}</button></div><div class="account">${demo?'<span class="demo-label">체험 모드 · 이 기기에만 저장</span>':user?`<span>${esc(user.displayName||'Google 계정')}</span>`:''}${btn('login',user?'로그아웃':'Google 로그인','heart',user?'':'primary')}${!user?btn('demo',demo?'체험 종료':'테스트 데이터로 체험','spark'):''}</div></header>
 <div class="topline"><nav class="page-switch" aria-label="가계부 페이지"><button id="page-calendar" aria-pressed="${activePage === 'calendar'}">${icon('calendar')}달력</button><button id="page-report" aria-pressed="${activePage === 'report'}">${icon('report')}월간 리포트</button></nav><p role="status" aria-live="polite" id="status">${esc(status)}</p><nav aria-label="데이터 관리">${btn('export','내보내기','download')}${btn('import','가져오기','restore')}${btn('trash','휴지통','trash')}${failed?btn('retry','다시 저장')+btn('reload','최신 데이터 불러오기'):''}</nav></div>
 ${activePage === 'report' ? reportPage(state,month) : `<main><aside class="left"><section class="card settlement"><h2>${icon('spark')}이번 달 정산</h2>${c.settlement.map(r=>`<div class="pair"><span>${esc(r.name)}</span><b>${money(r.value)}원</b></div>`).join('')}${btn('settlement','정산 항목 편집','edit','quiet wide')}</section>${budgetCard('이번 달 예산','monthly',t.used,t.remaining,c.budget)}${budgetCard(isCurrent?'이번 주 예산':'선택한 주 예산','weekly',t.weekUsed,t.weekRemaining,c.weeks[current]||0)}<p class="week-range">${esc(current)} ~ ${weekEnd(current,month)}<br>월요일~일요일 · 현재 월 날짜만 합산</p></aside>
 <section class="card calendar-card" aria-label="월간 달력"><div class="calendar-title"><h2>${icon('calendar')}${month.slice(0,4)}년 ${+month.slice(5)}월</h2>${btn('today','오늘','','quiet')}</div><div class="calendar"><div class="weekdays">${['월','화','수','목','금','토','일'].map(x=>`<span>${x}</span>`).join('')}</div><div class="days">${calendar()}</div></div></section>
 <aside class="right"><section class="card memo"><h2>${icon('memo')}월별 계획·메모</h2><textarea id="memo" maxlength="10000" aria-label="월별 계획·메모" placeholder="이달의 목표와 메모를 적어보세요." ${!canEdit()?'disabled':''}>${esc(c.memo)}</textarea>${btn('memo-save','메모 저장','heart','quiet wide')}</section><section class="card detail"><div class="detail-title"><h2>${icon('calendar')}${+selected.slice(5,7)}월 ${+selected.slice(8)}일</h2><span>${['일','월','화','수','목','금','토'][new Date(selected+'T12:00:00').getDay()]}요일</span></div><div class="day-summary"><span>선택일 합계</span><strong>${money(dayTotal(state,selected))}<small>원</small></strong></div><div id="entries">${entryRows()}</div>${selected<=today()?`<form id="add-form"><label class="use-label" for="use">사용처 <small>선택</small></label><input id="use" maxlength="80" placeholder="예: 점심, 장보기" autocomplete="off"><label for="amount">금액</label><div class="amount-input"><input id="amount" name="amount" inputmode="numeric" autocomplete="off" placeholder="0" aria-label="지출 금액" required><span>원</span></div>${btn('add','금액 추가','add','primary wide')}</form><div class="zero-control">${btn('zero',stamped(state,selected)?'무지출 확인 취소':'무지출로 확인','stamp','quiet wide')}<small>기록하지 않은 날은 도장을 찍지 않아요.</small></div>`:'<p class="muted">미래 날짜는 아직 기록할 수 없어요.</p>'}</section></aside></main>`}
 <div class="bottom"><span>외부 백업: 내보낸 파일을 별도 보관해주세요.</span></div>${undo?`<div class="toast" role="status">휴지통으로 이동했어요. ${btn('undo','되돌리기','restore')}</div>`:''}<dialog id="dialog"></dialog><input id="file" type="file" accept="application/json,.json" hidden>`;
 bind();if(!canEdit())document.querySelectorAll('main:not(.report-layout) input,main:not(.report-layout) textarea,main:not(.report-layout) button:not(#prev):not(#next):not(#today):not(.day)').forEach(e=>e.disabled=true);
}
function weekEnd(w,m){const d=new Date(w+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+6);const end=d.toISOString().slice(0,10);const last=`${m}-${new Date(+m.slice(0,4),+m.slice(5),0).getDate()}`;return end>last?last:end;}
function calendar(){const first=month+'-01',offset=(new Date(first+'T12:00:00').getDay()+6)%7,n=new Date(+month.slice(0,4),+month.slice(5),0).getDate();let html='<div class="blank" aria-hidden="true"></div>'.repeat(offset);for(let d=1;d<=n;d++){const date=month+'-'+String(d).padStart(2,'0'),v=dayTotal(state,date);html+=`<button class="day ${date===selected?'selected':''} ${date===today()?'is-today':''}" data-date="${date}" aria-label="${date}, ${money(v)}원${stamped(state,date)?', 무지출 성공':''}" aria-pressed="${date===selected}"><span class="day-number">${d}</span>${v?`<span class="day-amount">${money(v).replaceAll(',',',<wbr>')}</span>`:stamped(state,date)?'<span class="stamp"><img src="/assets/planner/no-spend.svg" alt="무지출성공!"></span>':''}</button>`;}return html+'<div class="blank" aria-hidden="true"></div>'.repeat((7-(offset+n)%7)%7);}
function entryRows(){const rows=Object.entries(state.entries).filter(([,e])=>e.date===selected&&!e.deleted);return rows.length?rows.map(([id,e])=>`<div class="entry"><section><strong>${money(e.amount)}<small>원</small></strong>${e.note?`<p class="entry-note">${esc(e.note)}</p>`:''}</section><div><button data-edit="${id}" aria-label="${money(e.amount)}원 수정">${icon('edit')}</button><button data-delete="${id}" aria-label="${money(e.amount)}원 삭제">${icon('trash')}</button><button data-history="${id}" aria-label="${money(e.amount)}원 수정 이력">${icon('history')}</button></div></div>`).join(''):`<div class="empty-day">${icon(stamped(state,selected)?'stamp':'purse')}<p>${stamped(state,selected)?'무지출성공!':'아직 기록이 없어요.'}</p></div>`;}
function on(id,fn){const e=$('#'+id);if(e)e.onclick=fn;}
function modal(title,content,submit){const d=$('#dialog');d.innerHTML=`<form id="modal-form"><div class="modal-head"><h2>${title}</h2><button type="button" id="close-dialog" aria-label="닫기">×</button></div>${content}<p id="modal-error" role="alert"></p>${submit?btn('modal-save','저장','heart','primary wide'):''}</form>`;d.showModal();on('close-dialog',()=>d.close());if(submit)$('#modal-form').onsubmit=async e=>{e.preventDefault();try{await submit(new FormData(e.target));d.close();}catch(e){$('#modal-error').textContent=e.message;}};}
function numberField(label,name,value){return `<label>${esc(label)}<input name="${name}" inputmode="numeric" value="${value}" required></label>`;}
function bind(){
 for (const page of ['calendar','report']) {
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
 on('demo',()=>{if(busy)return;if(demo){demo=false;connect(null);return;}if(unsub)unsub();demo=true;user=null;state=empty();try{state=validate(JSON.parse(localStorage.getItem('bbo-demo-v1')));}catch{}ready=true;pending=false;failed=false;status='체험 모드 · 실제 계정과 분리된 테스트 데이터';render();});
 on('prev',()=>moveMonth(-1));on('next',()=>moveMonth(1));on('today',()=>{month=today().slice(0,7);selected=today();render();});
 document.querySelectorAll('[data-date]').forEach(e=>e.onclick=()=>{selected=e.dataset.date;render();});
 const form=$('#add-form');if(form)form.onsubmit=e=>{e.preventDefault();try{const v=amount($('#amount').value);if(v===0)throw Error('무지출은 아래 확인 버튼을 사용해주세요.');const note=$('#use').value.trim();change(s=>revise(s,crypto.randomUUID(),{date:selected,amount:v,note,deleted:false},'추가'));}catch(e){statusText(e.message);}};
 document.querySelectorAll('[data-edit]').forEach(e=>e.onclick=()=>{const id=e.dataset.edit;modal('지출 수정',numberField('금액','amount',state.entries[id].amount)+`<label>사용처 (선택)<input name="note" maxlength="80" value="${esc(state.entries[id].note||'')}"></label>`,async f=>{const v=amount(f.get('amount'));if(!v)throw Error('0원은 지출 삭제 후 무지출 확인을 사용해주세요.');await change(s=>revise(s,id,{amount:v,note:String(f.get('note')||'').trim()},'지출 수정'));});});
 document.querySelectorAll('[data-delete]').forEach(e=>e.onclick=()=>{const id=e.dataset.delete;undo=id;change(s=>revise(s,id,{deleted:true},'삭제'));});
 document.querySelectorAll('[data-history]').forEach(e=>e.onclick=()=>history(e.dataset.history));
 on('undo',()=>{const id=undo;undo=null;change(s=>revise(s,id,{deleted:false},'삭제 되돌리기'));});
 on('zero',()=>{if(dayTotal(state,selected)>0){statusText('지출이 있는 날짜는 무지출로 확인할 수 없어요.');return;}change(s=>{s.closed[selected]=!s.closed[selected];});});
 on('month-budget',()=>modal('이번 달 예산',numberField('달 예산','budget',monthData(state,month).budget),f=>{const v=amount(f.get('budget'));return change(s=>{s.months[month]={...monthData(s,month),budget:v};});}));
 on('week-budget',()=>modal('월별 주 예산 설정',`<p class="muted">월요일~일요일, 월 경계에서는 현재 월의 날짜만 합산합니다.</p>${weeks(month).map((w,i)=>numberField(`${i+1}주 · ${w<month+'-01'?month+'-01':w} ~ ${weekEnd(w,month)}`,w,monthData(state,month).weeks[w]||0)).join('')}`,f=>{const w=Object.fromEntries([...f].map(([k,v])=>[k,amount(v)]));return change(s=>{s.months[month]={...monthData(s,month),weeks:w};});}));
 on('settlement',()=>{const rows=monthData(state,month).settlement;modal('이번 달 정산 편집',`<div id="settlement-rows">${rows.map((r,i)=>settlementRow(r,i)).join('')}</div><button type="button" id="new-row">항목 추가</button><p class="muted">정산은 참고 항목입니다. 달 예산 사용액에는 실제 지출만 합산됩니다.</p>`,f=>{const names=[...f].filter(([k])=>k.startsWith('name'));const settlement=names.map(([k,v])=>({name:String(v).trim(),value:amount(f.get(k.replace('name','value')))}));if(settlement.some(r=>!r.name||r.name.length>40))throw Error('항목 이름은 1~40자로 입력해주세요.');return change(s=>{s.months[month]={...monthData(s,month),settlement};});});let idx=rows.length;on('new-row',()=>{if(idx>=30)return;$('#settlement-rows').insertAdjacentHTML('beforeend',settlementRow({name:'',value:0},idx++));});$('#settlement-rows').onclick=e=>{if(e.target.dataset.remove)e.target.closest('.settlement-row').remove();};});
 on('memo-save',()=>{const memo=$('#memo').value;change(s=>{s.months[month]={...monthData(s,month),memo};});});
 on('trash',trash);on('export',()=>download(state));on('import',()=>{if(!canEdit()){statusText('체험 모드 또는 로그인 후 저장 가능한 상태에서 가져와주세요.');return;}$('#file').click();});$('#file').onchange=importFile;
 on('retry',()=>{if(!failed)return;if(!pending){connect(user);return;}failed=false;ready=true;persist(structuredClone(state));});on('reload',()=>{modal('최신 데이터 불러오기','<p>현재 입력을 파일로 내보낸 뒤 서버의 최신 기록을 불러옵니다.</p><button type="button" id="reload-confirm">파일 보관 후 불러오기</button>');on('reload-confirm',()=>{download(state);pending=false;busy=false;failed=false;connect(user);});});
}
function settlementRow(r,i){return `<div class="settlement-row"><input name="name${i}" value="${esc(r.name)}" aria-label="정산 항목 이름" maxlength="40" required><input name="value${i}" value="${r.value}" aria-label="정산 금액" inputmode="numeric" required><button type="button" data-remove="${i+1}" aria-label="항목 삭제">×</button></div>`;}
function moveMonth(n){const d=new Date(+month.slice(0,4),+month.slice(5)-1+n,1);month=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;selected=month===today().slice(0,7)?today():month+'-01';render();}
function trash(){const rows=Object.entries(state.entries).filter(([,e])=>e.deleted);modal('휴지통',rows.length?rows.map(([id,e])=>`<div class="restore-row"><span>${esc(e.date)} · ${money(e.amount)}원</span><button type="button" data-restore="${id}" ${!canEdit()?'disabled':''}>복원</button></div>`).join(''):'<p>휴지통이 비어 있어요.</p>');document.querySelectorAll('[data-restore]').forEach(e=>e.onclick=()=>{const id=e.dataset.restore;$('#dialog').close();change(s=>revise(s,id,{deleted:false},'휴지통 복원'));});}
function history(id){const h=Object.entries(state.history).filter(([,h])=>h.entryId===id).reverse();modal('금액 수정 이력',h.length?h.map(([key,h])=>`<div class="restore-row"><span>${esc(h.at.slice(0,19).replace('T',' '))} UTC<br>${esc(h.reason)} 전 · ${money(h.before.amount)}원</span><button type="button" data-revision="${key}" ${!canEdit()?'disabled':''}>이 금액 복원</button></div>`).join(''):'<p>수정 이력이 없어요.</p>');document.querySelectorAll('[data-revision]').forEach(e=>e.onclick=()=>{const h=state.history[e.dataset.revision];$('#dialog').close();change(s=>revise(s,id,{...h.before,deleted:false},'이전 금액 복원'));});}
function download(s,prefix='bbo-export'){const body=JSON.stringify({format:'bbo-household',version:1,exportedAt:new Date().toISOString(),data:validate(s)},null,2);validate(JSON.parse(body).data);const url=URL.createObjectURL(new Blob([body],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=`${prefix}-${today()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);statusText('내보내기 파일 생성 · 다운로드 파일을 별도 위치에 보관해주세요.');}
async function importFile(e){try{const file=e.target.files[0];if(!file)return;if(file.size>1500000)throw Error('가져오기 파일이 너무 큽니다.');const f=JSON.parse(await file.text());if(f.format!=='bbo-household'||f.version!==1)throw Error('뽀 가계부 내보내기 파일이 아닙니다.');const imported=validate(f.data);modal('파일 검증 완료',`<p>지출 ${Object.keys(imported.entries).length}건 · 월 설정 ${Object.keys(imported.months).length}개</p><p>현재 기록을 파일로 먼저 내보내고, 선택한 파일로 전체 복원합니다. 다운로드를 보관해주세요.</p><button type="button" id="import-confirm" class="primary">현재 기록 내보내기 후 전체 복원</button>`);on('import-confirm',async()=>{download(state,'bbo-before-restore');$('#dialog').close();await persist(imported);});}catch(e){statusText('가져오기 실패 · '+e.message);}}
window.addEventListener('beforeunload',e=>{if(pending||busy){e.preventDefault();e.returnValue='';}});
render();onAuthStateChanged(auth,u=>{if(!u&&demo)return;connect(u);});






