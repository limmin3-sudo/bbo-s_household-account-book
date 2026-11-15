// Source: https://github.com/hyunbinseo/holidays-kr, version 5.2027.2 (MIT).
// Includes announced lunar, substitute, election and temporary holidays for 2018–2027.
import holidays from './data/holidays-kr.json' with {type:'json'};

export function holidayName(date) {
  return holidays[date]?.join(' · ') || '';
}
