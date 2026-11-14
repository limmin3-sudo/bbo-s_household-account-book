import {money} from './model.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c =>
  ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);

export function categoryName(state, entry) {
  return state.categories?.[entry.categoryId]?.name || '미분류';
}

export function categoryButtons(state, selected = '') {
  const categories = Object.entries(state.categories || {}).filter(([id,c]) => !c.archived || id === selected);
  return `<div class="category-picker" role="group" aria-label="지출 카테고리">
    <input type="hidden" name="categoryId" value="${esc(selected)}">
    ${[['',{name:'미분류'}], ...categories].map(([id,c]) =>
      `<button type="button" data-category="${esc(id)}" aria-pressed="${id === selected}">${esc(c.name)}</button>`).join('')}</div>`;
}

export function bindCategories(container, merchant, state) {
  container?.querySelectorAll('[data-category]').forEach(button => {
    button.onclick = () => {
      const id = button.dataset.category;
      container.querySelector('[name=categoryId]').value = id;
      container.querySelectorAll('[data-category]').forEach(b => b.setAttribute('aria-pressed',String(b===button)));
      if (merchant && state.categories?.[id]?.merchant) merchant.value = state.categories[id].merchant;
    };
  });
}

function categoryRow(id, category) {
  return `<div class="category-row" data-id="${esc(id)}"><label>카테고리 이름<input name="categoryName" maxlength="40" value="${esc(category.name)}" required></label>
    <label>기본 사용처 (선택)<input name="merchant" maxlength="80" value="${esc(category.merchant)}" placeholder="예: 쿠팡"></label>
    <button type="button" data-hide>목록에서 제외</button></div>`;
}

export function manageCategories(state, modal, save) {
  const categories = state.categories || {};
  const rows = Object.entries(categories).filter(([,c])=>!c.archived).map(([id,c])=>categoryRow(id,c)).join('');
  modal('카테고리 관리',`<div id="category-list">${rows}</div><button type="button" id="new-category">카테고리 추가</button>`,()=>{
    const next = Object.fromEntries(Object.entries(categories).map(([id,c])=>[id,{...c,archived:true}]));
    const names = new Set();
    for(const row of document.querySelectorAll('.category-row')) {
      const name=row.querySelector('[name=categoryName]').value.trim();
      if(!name || names.has(name)) throw Error('서로 다른 카테고리 이름을 입력해주세요.');
      names.add(name);
      next[row.dataset.id]={name,merchant:row.querySelector('[name=merchant]').value.trim(),archived:false};
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
