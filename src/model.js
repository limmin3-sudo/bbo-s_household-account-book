import {validMerchantRules} from './merchants.js';
export const MAX=999999999999;
export const today=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul'}).format(new Date());
export function money(v){return (v<0?'−':'')+Math.abs(v).toLocaleString('ko-KR');}
export function amount(v){const s=String(v).replaceAll(',','').trim();if(!/^\d{1,12}$/.test(s)||Number(s)>MAX)throw Error('0~999,999,999,999원의 정수를 입력해주세요.');return Number(s);}
const initialCategories = [
  ['food','식비'],['cafe','카페'],['drinks','술'],['living','생활'],
  ['online','온라인쇼핑'],['beauty','뷰티'],['medical','의료'],['culture','문화'],
  ['travel','여행'],['education','교육'],['occasions','경조'],
];
function defaultCategories() {
  return Object.fromEntries(initialCategories.map(([key,name])=>[key,{name,merchant:'',archived:false}]));
}
export const empty=()=>({schema:1,entries:{},months:{},closed:{},history:{},categories:defaultCategories()});
export function weekStart(date){const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()-(d.getUTCDay()+6)%7);return d.toISOString().slice(0,10);}
export function weeks(month){const n=new Date(+month.slice(0,4),+month.slice(5),0).getDate();return [...new Set(Array.from({length:n},(_,i)=>weekStart(`${month}-${String(i+1).padStart(2,'0')}`)))];}
export function weekRange(start,month) {
 const first = month+'-01';
 const last = month+'-'+new Date(+month.slice(0,4),+month.slice(5),0).getDate();
 const sunday = new Date(start+'T12:00:00Z');
 sunday.setUTCDate(sunday.getUTCDate()+6);
 const from = start<first ? first : start;
 const end = sunday.toISOString().slice(0,10);
 const to = end>last ? last : end;
 return {from,to,days:Number(to.slice(8))-Number(from.slice(8))+1};
}
export function weekLabel(start,month) {
 const {from,to,days}=weekRange(start,month);
 return from===to ? from+' (1일)' : from+' ~ '+to+' ('+days+'일)';
}
export function proratedWeeks(month,base) {
 const value=amount(base);
 return Object.fromEntries(weeks(month).map(start=>[start,Math.round(value*weekRange(start,month).days/7)]));
}
export const monthData=(s,m)=>s.months[m]||{budget:0,weeks:{},settlement:[{name:'수입',value:0},{name:'고정지출',value:0},{name:'저축',value:0}],memo:''};
export function totals(s,m,w){const rows=Object.values(s.entries).filter(e=>!e.deleted&&e.date.startsWith(m));const used=rows.reduce((a,e)=>a+e.amount,0);const wu=rows.filter(e=>weekStart(e.date)===w).reduce((a,e)=>a+e.amount,0);const c=monthData(s,m);return {used,remaining:c.budget-used,weekUsed:wu,weekRemaining:(c.weeks[w]||0)-wu};}
export function dayTotal(s,d){return Object.values(s.entries).filter(e=>e.date===d&&!e.deleted).reduce((a,e)=>a+e.amount,0);}
export const stamped=(s,d,now=today())=>d<=now&&s.closed[d]===true&&dayTotal(s,d)===0;
export function validate(s){
 const isMap = value => value !== null && typeof value === 'object' && !Array.isArray(value);
 if(!isMap(s)||s.schema!==1||!['entries','months','closed','history'].every(key=>isMap(s[key]))||Object.keys(s).some(k=>!['schema','entries','months','closed','history','categories'].includes(k)))throw Error('지원하지 않는 가계부 파일입니다.');
 if(s.categories===undefined)s.categories=defaultCategories();
 if(!isMap(s.categories)||Object.entries(s.categories).some(([id,c])=>!/^[-\w]+$/.test(id)||!isMap(c)||typeof c.name!=='string'||!c.name.trim()||c.name.length>40||typeof c.merchant!=='string'||c.merchant.length>80||typeof c.archived!=='boolean'||(c.merchants!==undefined&&!validMerchantRules(c.merchants))))throw Error('카테고리가 올바르지 않습니다.');
 const validNote = entry => (entry.note === undefined || (typeof entry.note === 'string' && entry.note.length <= 80))
   && (entry.purchase===undefined || (typeof entry.purchase==='string' && entry.purchase.length<=200))
   && (!entry.categoryId || (typeof entry.categoryId==='string' && Object.hasOwn(s.categories||{},entry.categoryId)));
 const date=d=>/^\d{4}-\d{2}-\d{2}$/.test(d)&&!isNaN(Date.parse(d))&&new Date(d).toISOString().slice(0,10)===d;
 const val=v=>Number.isSafeInteger(v)&&v>=0&&v<=MAX;
 if(Object.keys(s.entries).length>20000)throw Error('기록 수가 너무 많습니다.');
 for(const [id,e] of Object.entries(s.entries))if(!/^[\w-]+$/.test(id)||!validNote(e)||!date(e.date)||e.date>today()||!val(e.amount)||typeof e.deleted!=='boolean')throw Error('지출 데이터가 올바르지 않습니다.');
 for(const [m,c] of Object.entries(s.months)){if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(m)||!val(c.budget)||typeof c.memo!=='string'||c.memo.length>10000||!c.weeks||!Array.isArray(c.settlement)||c.settlement.length>30)throw Error('월 설정이 올바르지 않습니다.');for(const [w,v] of Object.entries(c.weeks))if(!weeks(m).includes(w)||!val(v))throw Error('주 예산이 올바르지 않습니다.');for(const r of c.settlement)if(typeof r.name!=='string'||r.name.length>40||!val(r.value))throw Error('정산이 올바르지 않습니다.');}
 for(const [month,config] of Object.entries(s.months)){
   if(config.weeklyBase!==undefined && !val(config.weeklyBase))throw Error('기준 주 예산이 올바르지 않습니다.');
   if(config.dayNotes!==undefined && (!isMap(config.dayNotes) || Object.entries(config.dayNotes).some(([day,note])=>!date(day)||day.slice(0,7)!==month||typeof note!=='string'||note.length>2000)))throw Error('날짜 메모가 올바르지 않습니다.');
   if(config.fixedExpenses!==undefined){
     const rows=config.fixedExpenses;
     if(!Array.isArray(rows)||rows.some(r=>!r||typeof r.name!=='string'||!r.name.trim()||r.name.length>40||!val(r.value)))throw Error('고정지출 항목이 올바르지 않습니다.');
     const sum=rows.reduce((n,r)=>n+r.value,0);
     if(!val(sum)||sum!==config.settlement.find(r=>r.name==='고정지출')?.value)throw Error('고정지출 합계가 정산과 다릅니다.');
   }
 }
 for(const [d,v] of Object.entries(s.closed))if(!date(d)||d>today()||typeof v!=='boolean')throw Error('무지출 확인이 올바르지 않습니다.');
 for(const [id,h] of Object.entries(s.history))if(!/^[\w-]+$/.test(id)||!h||typeof h.at!=='string'||typeof h.reason!=='string'||!h.before||!validNote(h.before)||!date(h.before.date)||!val(h.before.amount)||typeof h.before.deleted!=='boolean'||typeof h.entryId!=='string')throw Error('이력이 올바르지 않습니다.');
 if(new TextEncoder().encode(JSON.stringify(s)).length>750000)throw Error('파일이 너무 큽니다. 월별 보관 기능이 필요합니다.');return s;
}
export function revise(s,id,patch,reason){const before=s.entries[id];if(before)s.history[crypto.randomUUID()]={entryId:id,before:structuredClone(before),at:new Date().toISOString(),reason};s.entries[id]={...before,...patch};if(!s.entries[id].deleted)s.closed[s.entries[id].date]=false;return s;}

