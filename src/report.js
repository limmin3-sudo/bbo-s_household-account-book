import {categoryReport} from './categories.js';
import {money, monthData, today} from './model.js';

function previousMonth(month) {
  const [year, number] = month.split('-').map(Number);
  return number === 1 ? `${year - 1}-12` : `${year}-${String(number - 1).padStart(2, '0')}`;
}

function summarize(state, month) {
  const [year, number] = month.split('-').map(Number);
  const days = Array(new Date(year, number, 0).getDate()).fill(0);
  let count = 0;
  for (const entry of Object.values(state.entries)) {
    if (entry.deleted || !entry.date.startsWith(month + '-')) continue;
    days[Number(entry.date.slice(8)) - 1] += entry.amount;
    count++;
  }
  const total = days.reduce((sum, value) => sum + value, 0);
  const confirmed = days.filter((value, index) => {
    const date = month + '-' + String(index + 1).padStart(2, '0');
    return value === 0 && state.closed[date] && date <= today();
  }).length;
  return {month, days, total, count, confirmed};
}

export function reportPage(state, month) {
  const current = summarize(state, month);
  const previous = summarize(state, previousMonth(month));
  const largestDay = Math.max(...current.days, 1);
  const largestMonth = Math.max(current.total, previous.total, 1);
  const calendarBars = current.days.map((value, index) => {
    const day = index + 1;
    const date = month + '-' + String(day).padStart(2, '0');
    const label = day + '일 · ' + money(value) + '원';
    return `<button class="plot-day" data-report-date="${date}" aria-label="${label}, 달력에서 보기" title="${label}">
      <i style="height:${100 * value / largestDay}%" class="${value ? 'has-spending' : ''}"></i>
      <span>${day === 1 || day % 5 === 0 || day === current.days.length ? day : ''}</span></button>`;
  }).join('');
  const comparison = [previous, current].map(item => `<div class="compare-row">
    <div><b>${item.month.replace('-', '. ')}</b><strong>${item.count || item.confirmed ? money(item.total) + '원' : '기록 없음'}</strong></div>
    <div class="compare-track"><i style="width:${100 * item.total / largestMonth}%"></i></div></div>`).join('');
  return `<main class="report-layout"><section class="card report-page" aria-label="월간 리포트">
    <h2><img class="icon" src="/assets/report.svg" alt="">${month.slice(0,4)}년 ${Number(month.slice(5))}월 리포트</h2>
    <div class="report-body"><div class="report-totals">
      <div><span>기록한 지출</span><strong id="report-total">${money(current.total)}원</strong><small>${current.count}건</small></div>
      <div><span>월 예산</span><strong>${money(monthData(state, month).budget)}원</strong></div>
      <div><span>확인한 무지출</span><strong>${current.confirmed}일</strong></div>
    </div>
    <section class="report-chart"><h3>날짜별 지출</h3>
      <p>${current.count ? '날짜를 누르면 달력에서 내역을 볼 수 있어요.' : '이 달에 기록한 지출이 없어요.'}</p>
      <div class="daily-plot" aria-label="날짜별 지출 그래프">${calendarBars}</div>
    </section>
    <section class="report-chart"><h3>지난달과 지출 비교</h3>
      <p>각 달에 입력한 지출 합계${month === today().slice(0,7) ? ' · 이번 달은 오늘까지' : ''}</p>${comparison}
    </section>${categoryReport(state,month)}</div></section></main>`;
}
