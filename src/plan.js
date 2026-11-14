import {amount, monthData, money, weeks} from './model.js';

const escape = value => String(value).replace(/[&<>"']/g, char =>
  ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[char]);

export function fixedItems(config) {
  if (config.fixedExpenses) return config.fixedExpenses;
  const old = config.settlement.filter(row => row.name === '고정지출' && row.value > 0);
  return old.map(row => ({name:'기존 고정지출', value:row.value}));
}

export function fixedPage(config, month) {
  const rows = fixedItems(config);
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  return `<main class="report-layout"><section class="card report-page"><h2><img class="icon" src="/assets/planner/wallet.webp" alt="">${month.slice(0,4)}년 ${Number(month.slice(5))}월 고정지출</h2>
    <div class="report-body"><div class="day-summary"><span>월 고정지출 합계</span><strong>${money(total)}원</strong></div>
    ${rows.length ? '<dl class="fixed-list">'+rows.map(r=>`<div><dt>${escape(r.name)}</dt><dd>${money(r.value)}원</dd></div>`).join('')+'</dl>' : '<p>등록된 고정지출이 없어요.</p>'}
    <p class="muted">‘이달의 계획’에서 고정지출 항목을 편집할 수 있어요.</p></div></section></main>`;
}

function editableRow(row, kind) {
  return `<div class="settlement-row"><input aria-label="항목 이름" name="${kind}Name" value="${escape(row.name)}" maxlength="40" required>
    <input aria-label="항목 금액" name="${kind}Value" inputmode="numeric" value="${row.value}" required>
    <button type="button" data-remove-row aria-label="항목 삭제"><img class="icon" src="/assets/planner/trash.webp" alt=""></button></div>`;
}

export function planEditor(config, month, endDate, initial = 'memo') {
  const parts = [
    ['memo','월별 계획',`<label>계획·메모<textarea name="memo" rows="6" maxlength="10000">${escape(config.memo)}</textarea></label>`],
    ['settle','월 정산',config.settlement.filter(r=>r.name!=='고정지출').map(r=>editableRow(r,'settle')).join('')+'<button type="button" data-add-row="settle">정산 항목 추가</button><p class="muted">고정지출은 아래 항목의 합계로 표시해요.</p>'],
    ['fixed','고정지출',fixedItems(config).map(r=>editableRow(r,'fixed')).join('')+'<button type="button" data-add-row="fixed">고정지출 추가</button>'],
    ['budgets','달·주 예산',`<label>달 예산 (원)<input name="budget" inputmode="numeric" value="${config.budget}" required></label>`+
      weeks(month).map((w,i)=>`<label>${i+1}주 · ${w < month+'-01' ? month+'-01' : w} ~ ${endDate(w,month)}<input name="${w}" inputmode="numeric" value="${config.weeks[w]||0}" required></label>`).join('')],
  ];
  return parts.map(([key,name,html])=>`<details class="plan-group" ${key===initial?'open':''}><summary>${name}</summary>${html}</details>`).join('');
}

export function bindPlanRows(form) {
  form.addEventListener('invalid', event => {const group=event.target.closest('details');if(group)group.open=true;},true);
  form.addEventListener('click', event => {
    const button=event.target.closest('button');
    if(button?.hasAttribute('data-remove-row')) button.closest('.settlement-row').remove();
    if(button?.dataset.addRow){
      button.insertAdjacentHTML('beforebegin',editableRow({name:'',value:0},button.dataset.addRow));
      button.previousElementSibling.querySelector('input').focus();
    }
  });
}

export function readPlan(form, state, month) {
  function rows(kind) {
    const values=form.getAll(kind+'Value');
    const result=form.getAll(kind+'Name').map((name,index)=>({name:name.trim(),value:amount(values[index])}));
    if(result.some(row=>!row.name))throw Error('항목 이름을 입력해주세요.');
    return result;
  }
  const fixedExpenses=rows('fixed'), settlement=rows('settle');
  if(settlement.some(r=>r.name==='고정지출'))throw Error('고정지출은 고정지출 영역에서 입력해주세요.');
  const fixedTotal=amount(fixedExpenses.reduce((sum,row)=>sum+row.value,0));
  const original=monthData(state,month);
  const index=original.settlement.findIndex(row=>row.name==='고정지출');
  settlement.splice(index<0?settlement.length:index,0,{name:'고정지출',value:fixedTotal});
  return {...original,memo:form.get('memo'),budget:amount(form.get('budget')),settlement,fixedExpenses,
    weeks:Object.fromEntries(weeks(month).map(w=>[w,amount(form.get(w))]))};
}
