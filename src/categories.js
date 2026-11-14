import {money} from './model.js';
import {merchantRanking, suggestedMerchants, merchantRule, validMerchantRules, unclassifiedKey, merchantCategoryKey} from './merchants.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c =>
  ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);

export function categoryName(state, entry) {
  return state.categories?.[entry.categoryId]?.name || '미분류';
}

export function categoryButtons(state, selected = '') {
  const categories = Object.entries(state.categories || {}).filter(([id,c]) => id!==unclassifiedKey && (!c.archived || id === selected));
  return `<div class="category-picker" role="group" aria-label="지출 카테고리">
    <input type="hidden" name="categoryId" value="${esc(selected)}">
    ${[['',{name:'미분류'}], ...categories].map(([id,c]) =>
      `<button type="button" data-category="${esc(id)}" aria-pressed="${id === selected}">${esc(c.name)}</button>`).join('')}</div>`;
}

export function expenseDetails(state, entry = {}) {
  return `<fieldset class="expense-category"><legend>카테고리</legend>${categoryButtons(state,entry.categoryId)}</fieldset>
    <label>사용처 (선택)<input name="use" maxlength="80" value="${esc(entry.note)}" placeholder="예: 쿠팡"></label>
    <div class="merchant-picker" role="group" aria-label="사용처 선택"></div>
    <label>세부 내용 (선택)<input name="purchase" maxlength="200" value="${esc(entry.purchase)}" placeholder="예: 세탁세제"></label>`;
}

export function bindCategories(form, state, hideMerchant) {
  const container = form.querySelector('.category-picker');
  if (!container) return;
  const category = container.querySelector('[name=categoryId]');
  const merchant = form.elements.use;
  const picker = form.querySelector('.merchant-picker');
  function highlightMerchant() {
    for (const button of picker.querySelectorAll('[data-merchant]')) {
      button.setAttribute('aria-pressed',String(button.dataset.merchant === merchant.value.trim()));
    }
  }
  function showMerchants() {
    const items = suggestedMerchants(merchantRanking(state,category.value));
    picker.innerHTML = items.map(({name,count})=>`<span class="merchant-choice"><button type="button" data-merchant="${esc(name)}" title="${count}회 사용">${esc(name)}</button><button type="button" class="merchant-hide" data-hide-merchant="${esc(name)}" aria-label="${esc(name)} 추천에서 숨기기">×</button></span>`).join('');
    highlightMerchant();
  }
  picker.onclick = async event => {
    const hide = event.target.closest('[data-hide-merchant]');
    if (hide) {
      const id = category.value;
      form.inert=true;
      form.setAttribute('aria-busy','true');
      try {
        const categories = await hideMerchant(id,hide.dataset.hideMerchant);
        state = {...state,categories};
        showMerchants();
      } catch (error) {form.querySelector('#modal-error').textContent=error.message;}
      finally {
        form.inert=false;
        form.removeAttribute('aria-busy');
        merchant.focus();
      }
      return;
    }
    const button = event.target.closest('[data-merchant]');
    if (button) {
      merchant.value = button.dataset.merchant;
      highlightMerchant();
    }
  };
  merchant.addEventListener('input',highlightMerchant);
  showMerchants();
  container.querySelectorAll('[data-category]').forEach(button => {
    button.onclick = () => {
      const id = button.dataset.category;
      if (id === category.value) return;
      const previousDefault = merchantRanking(state,category.value).find(item=>item.preferred && !item.hidden)?.name || '';
      category.value = id;
      container.querySelectorAll('[data-category]').forEach(b => b.setAttribute('aria-pressed',String(b===button)));
      if (!merchant.value || merchant.value === previousDefault || picker.querySelector('[aria-pressed=true]')) {
        merchant.value = merchantRanking(state,id).find(item=>item.preferred && !item.hidden)?.name || '';
      }
      showMerchants();
    };
  });
}

function categoryRow(id, category, items = []) {
  const options = items.map((item,index)=>`<div class="merchant-rule" data-index="${index}"><label>사용처 이름 · ${item.count}회<input name="merchantName" maxlength="80" value="${esc(item.name)}" required></label>
    <label><input type="checkbox" name="hideMerchant" ${item.hidden?'checked':''}> 추천에서 숨김</label></div>`).join('');
  return `<div class="category-row" data-id="${esc(id)}">${id ? `<label>카테고리 이름<input name="categoryName" maxlength="40" value="${esc(category.name)}" required></label>` : '<b>미분류</b>'}
    <label>기본 사용처 (선택)<input name="merchant" maxlength="80" value="${esc(category.merchant)}" placeholder="예: 쿠팡"></label>
    ${options ? `<details class="merchant-rules"><summary>사용처 관리 (${items.length})</summary>${options}</details>` : ''}
    ${id?'<button type="button" data-hide>목록에서 제외</button>':''}</div>`;
}

export function manageCategories(state, modal, save) {
  const categories = state.categories || {};
  const visible = Object.entries(categories).filter(([id,c])=>id!==unclassifiedKey && !c.archived);
  const unclassified = merchantRanking(state,'');
  if (unclassified.length || categories[unclassifiedKey]) visible.push(['',categories[unclassifiedKey] || {name:'미분류',merchant:''}]);
  const rankings = new Map(visible.map(([id])=>[id,merchantRanking(state,id)]));
  const rows = visible.map(([id,c])=>categoryRow(id,c,rankings.get(id))).join('');
  modal('카테고리 관리',`<div id="category-list">${rows}</div><button type="button" id="new-category">카테고리 추가</button>`,()=>{
    const next = Object.fromEntries(Object.entries(categories).map(([id,c])=>[id,{...c,archived:true}]));
    const names = new Set();
    for(const row of document.querySelectorAll('.category-row')) {
      const id=row.dataset.id;
      const categoryKey=merchantCategoryKey(id);
      const name=id ? row.querySelector('[name=categoryName]').value.trim() : '미분류';
      if(!name || names.has(name)) throw Error('서로 다른 카테고리 이름을 입력해주세요.');
      names.add(name);
      let merchant=row.querySelector('[name=merchant]').value.trim();
      const rules=[];
      const all=[];
      for(const field of row.querySelectorAll('.merchant-rule')) {
        const item=rankings.get(id)[Number(field.dataset.index)];
        const label=field.querySelector('[name=merchantName]').value.trim();
        const hidden=field.querySelector('[name=hideMerchant]').checked;
        const rule=merchantRule(item,label,hidden);
        all.push(rule);
        if (hidden || item.name!==label || rule.aliases.length || categories[categoryKey]?.merchants?.some(r=>r.name===item.name)) rules.push(rule);
        if (item.preferred && merchant===categories[categoryKey]?.merchant) merchant=label;
      }
      if(!validMerchantRules(all)) throw Error('같은 카테고리 안에서 사용처 이름이 겹치거나 비어 있어요.');
      next[categoryKey]={name,merchant,archived:false,merchants:rules};
    }
    return save(next);
  });
  const list=document.querySelector('#category-list');
  document.querySelector('#new-category').onclick=()=>{
    list.insertAdjacentHTML('beforeend',categoryRow(crypto.randomUUID(),{}));
    list.lastElementChild.querySelector('input').focus();
  };
  list.onclick=e=>{if(e.target.closest('[data-hide]'))e.target.closest('.category-row').remove();};
}

export function categoryReport(state,month) {
  const groups=new Map();
  for(const e of Object.values(state.entries)){
    if(e.deleted || !e.date.startsWith(month+'-'))continue;
    const id=e.categoryId || '';
    if(!groups.has(id))groups.set(id,{name:categoryName(state,e),total:0,rows:[]});
    const group=groups.get(id);
    group.rows.push(e);
    group.total+=e.amount;
  }
  const sections=[...groups.values()].sort((a,b)=>b.total-a.total).map(group=>{
    const list=group.rows.sort((a,b)=>a.date.localeCompare(b.date)).map(e=>
      `<li><time>${esc(e.date.slice(5))}</time><span>${esc([e.note,e.purchase].filter(Boolean).join(' · ')||'지출')}</span><b>${money(e.amount)}원</b></li>`).join('');
    return `<details class="category-breakdown"><summary>${esc(group.name)} · ${group.rows.length}건 · ${money(group.total)}원</summary><ul>${list}</ul></details>`;
  });
  return `<section class="report-chart"><h3>카테고리별 지출</h3>${sections.join('') || '<p>이 달에 기록한 지출이 없어요.</p>'}</section>`;
}
