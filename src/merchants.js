const key = name => name.trim().normalize('NFC').toLocaleLowerCase('ko');
export const unclassifiedKey = '_unclassified_merchants';
export const merchantCategoryKey = id => id || unclassifiedKey;

export function validMerchantRules(rules) {
  if (!Array.isArray(rules)) return false;
  const names = new Set();
  return rules.every(rule => rule && typeof rule.hidden === 'boolean' && Array.isArray(rule.aliases)
    && [rule.name,...rule.aliases].every(name => {
      if (typeof name !== 'string' || !name.trim() || name.length>80 || names.has(key(name))) return false;
      names.add(key(name));
      return true;
    }));
}

export function merchantRanking(state, id) {
  const category = state.categories[merchantCategoryKey(id)] || {};
  const groups = new Map();
  function group(name) {
    const normalized = key(name);
    if (!groups.has(normalized)) groups.set(normalized,{name:name.trim(),aliases:[],count:0,hidden:false,preferred:false});
    return groups.get(normalized);
  }
  for (const rule of category.merchants || []) {
    const item = group(rule.name);
    Object.assign(item,rule);
    for (const alias of rule.aliases) groups.set(key(alias),item);
  }
  if (category.merchant) group(category.merchant).preferred = true;
  for (const entry of Object.values(state.entries)) {
    if (!entry.deleted && (entry.categoryId || '')===id && entry.note?.trim()) group(entry.note).count++;
  }
  return [...new Set(groups.values())].sort((a,b)=>b.count-a.count || a.name.localeCompare(b.name,'ko'));
}

export function suggestedMerchants(ranking) {
  const eligible = ranking.filter(item=>!item.hidden && (item.count>=2 || item.preferred));
  const best = eligible.filter(item=>!item.preferred).slice(0,6);
  return eligible.filter(item=>item.preferred || best.includes(item));
}

export function merchantRule(item, name, hidden) {
  const aliases = new Map([item.name,...item.aliases].map(alias=>[key(alias),alias]));
  aliases.delete(key(name));
  return {name,aliases:[...aliases.values()],hidden};
}
