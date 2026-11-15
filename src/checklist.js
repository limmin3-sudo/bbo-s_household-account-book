const esc = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function planItems(config) {
  return config.planItems ?? (config.memo ? [{id:'legacy',text:config.memo,done:false}] : []);
}

function row(item = {id:crypto.randomUUID(),text:'',done:false}) {
  return `<div class="plan-item-editor" data-plan-id="${esc(item.id)}">
    <input type="hidden" name="planId" value="${esc(item.id)}">
    <label class="plan-complete"><input type="checkbox" name="planDone-${esc(item.id)}" ${item.done?'checked':''}> 완료</label>
    <label>계획·메모<textarea name="planText" rows="2" maxlength="10000">${esc(item.text)}</textarea></label>
    <button type="button" data-remove-plan aria-label="계획 항목 삭제">삭제</button></div>`;
}

export function checklistEditor(config) {
  const items=planItems(config);
  return `<div id="plan-items">${(items.length?items:[undefined]).map(item=>row(item)).join('')}</div>
    <button type="button" id="add-plan-item">항목 추가</button>`;
}

export function bindChecklist(form) {
  form.querySelector('#add-plan-item').onclick=()=>{
    form.querySelector('#plan-items').insertAdjacentHTML('beforeend',row());
    form.querySelector('#plan-items').lastElementChild.querySelector('textarea').focus();
  };
  form.querySelector('#plan-items').onclick=event=>{
    event.target.closest('[data-remove-plan]')?.closest('.plan-item-editor').remove();
  };
}

export function readChecklist(form) {
  const texts=form.getAll('planText');
  const items=form.getAll('planId').map((id,i)=>({id,text:texts[i].trim(),done:form.has('planDone-'+id)})).filter(item=>item.text);
  if(items.length>100)throw Error('계획은 한 달에 100개까지 저장할 수 있어요.');
  const memo=items.map(item=>item.text).join('\n');
  if(memo.length>10000)throw Error('계획·메모는 전체 10,000자까지 저장할 수 있어요.');
  return {planItems:items,memo};
}

export function checklistPanel(config,enabled) {
  const rows=planItems(config).map(item=>`<div class="plan-item ${item.done?'completed':''}">
    <input type="checkbox" data-check-plan="${esc(item.id)}" aria-label="${esc(item.text)} 완료" ${item.done?'checked':''} ${enabled?'':'disabled'}>
    <button type="button" class="plan-text" data-edit-plan ${enabled?'':'disabled'}>${esc(item.text)}</button></div>`).join('');
  return `<div class="saved-plan">${rows}</div><button type="button" id="edit-plan-memo" class="wide" ${enabled?'':'disabled'}>${rows?'항목 추가':'눌러서 이번 달 계획을 적어보세요.'}</button>`;
}
