// The quiz on the desk sheet: kop (biodata) -> 10 questions -> Peta Minat. Pages change with a page turn.
// Answers live in memory and in sessionStorage for this tab (FR-08..FR-11, FR-13, FR-16). Biodata is never stored.
// No backend yet (T-10/T-24): the prototype does not send anything.
import { QUESTIONS, TYPES, BOTH, REMINDER, scoreType } from './quiz-data.js';
import { createPageTurn } from './page-turn.js';
import { SHARE_UTM, PROMO } from './config.js';

const N = QUESTIONS.length;
const KEY = 'bjst.quiz.v1';
const LETTERS = ['A', 'B', 'C'];
const ICON_KOP = '<path d="M13 3h4l4 4v13H9v-5m8-12v4h4M13 11h5M13 15h5M10 12H3m0 0 3-3m-3 3 3 3"/>';
const ICON_PREV = '<path d="M20 12H5m0 0 5-5m-5 5 5 5"/>';
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const shuffledPair = () => (Math.random() < 0.5 ? ['st', 'sh'] : ['sh', 'st']);

export function createQuiz({ sheet, paper, reduced = false }) {
  const $ = (id) => document.getElementById(id);
  const page1 = $('page1'), page2 = $('page2'), page3 = $('page3');
  const kopForm = $('kopForm'), qOpts = $('qOpts'), qTitle = $('qTitle'), qIntro = $('qIntro');
  const pages = { kop: page1, q: page2, result: page3 };
  const titles = { kop: $('sheetTitle'), q: qTitle, result: $('rTitle') };
  const pt = createPageTurn(sheet, { reduced });
  const INTRO = qIntro.textContent;
  const dbg = new URLSearchParams(location.search);
  const TURN = { dur: +dbg.get('turn') || 760, hold: dbg.has('turnhold') ? +dbg.get('turnhold') : null };   // review aids: ?turn=3000, ?turnhold=0.4

  // ---- state
  let view = 'kop', idx = 0, answers = Array(N).fill(null), order = Array.from({ length: N }, shuffledPair);
  let advanceTimer = 0, arrowNav = false;
  try {
    const s = JSON.parse(sessionStorage.getItem(KEY) || 'null');
    if (s && Array.isArray(s.answers) && s.answers.length === N && Array.isArray(s.order) && s.order.length === N) ({ answers, order } = s);
  } catch { /* storage blocked: memory only */ }
  const save = () => { try { sessionStorage.setItem(KEY, JSON.stringify({ answers, order })); } catch { /* ignore */ } };

  // ---- the stack under the top sheet thins as the test goes on (kop + 10 questions + the Peta Minat sheet)
  function setStack() {
    const left = view === 'kop' ? N + 1 : view === 'q' ? N - idx : 0;
    const s = ['0 1px 1px #38270e40'];
    for (let i = 1; i <= left; i++) s.push(`${(i * 0.3).toFixed(2)}px ${(i * 0.46).toFixed(2)}px 0 ${i % 2 ? '#ece6d6' : '#cbc1ab'}`);
    s.push(`${(left * 0.3 + 0.6).toFixed(2)}px ${(left * 0.46 + 1.6).toFixed(2)}px 3px #38270e38`);
    sheet.style.boxShadow = s.join(',');
  }

  // ---- question page
  function renderQuestion(i) {
    const item = QUESTIONS[i], ans = answers[i];
    $('qCount').textContent = `Soal ${i + 1} dari ${N}`;
    qTitle.innerHTML = `<span class="paper-number" aria-hidden="true">${i + 1}.</span> ${esc(item.q)}`;
    const opts = [...order[i], 'dd'];
    qOpts.innerHTML = opts.map((v, k) => `
      <label class="opt">
        <input type="radio" name="q" value="${v}"${ans === v ? ' checked' : ''}>
        <span class="opt-box">
          <span class="opt-letter" aria-hidden="true">${LETTERS[k]}.<svg class="pencil-x" viewBox="0 0 30 30" aria-hidden="true" focusable="false"><path pathLength="1" d="M5 4 Q12 11 25 25"/><path pathLength="1" d="M24 4 Q17 10 5 26"/></svg></span>
          <span class="opt-text">${esc(v === 'dd' ? BOTH : item[v])}</span>
        </span>
      </label>`).join('');
    qIntro.textContent = ans ? 'Ketuk jawabanmu lagi untuk lanjut, atau pilih yang lain.' : INTRO;
    $('qBackLabel').textContent = i === 0 ? 'Kembali ke kop' : 'Soal sebelumnya';
    $('qBack').querySelector('svg').innerHTML = i === 0 ? ICON_KOP : ICON_PREV;
    page2.classList.toggle('answered', !!ans);
  }

  // ---- Peta Minat page
  function renderResult() {
    const type = scoreType(answers), t = TYPES[type], data = new FormData(kopForm);
    $('rNama').textContent = (data.get('nama') || '').trim() || '–';
    $('rKelas').textContent = (data.get('kelas') || '').trim() || '–';
    $('rTanggal').textContent = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());
    $('rType').textContent = t.name;
    $('rStamp').dataset.type = type;
    $('rCore').textContent = t.core;
    $('rStrengths').textContent = t.strengths;
    $('rSubjects').innerHTML = t.subjects.map((s) => `<li>${esc(s)}</li>`).join('');
    $('rJobs').innerHTML = t.jobs.map((s) => `<li>${esc(s)}</li>`).join('');
    $('rNext').textContent = t.next;
    $('rNote').textContent = REMINDER;
    const promo = $('rPromo');
    promo.hidden = !(PROMO.on && PROMO.href);
    if (!promo.hidden) { promo.textContent = PROMO.label; promo.href = PROMO.href; }
    $('rToast').textContent = '';
    return type;
  }

  // ---- a page longer than the sheet fades out at the bottom edge until it is scrolled to the end
  const edge = (p = pages[view]) => p.classList.toggle('more', p.scrollHeight - p.clientHeight - p.scrollTop > 6);
  for (const p of Object.values(pages)) p.addEventListener('scroll', () => edge(p), { passive: true });
  new ResizeObserver(() => edge()).observe(sheet);

  // ---- page switching
  function setView(v, i = idx) {
    view = v; idx = i;
    if (v === 'q') renderQuestion(i);
    if (v === 'result') renderResult();
    if (v !== 'result') page3.classList.remove('stamped');
    paper.showPage(pages[v], titles[v]);
    setStack();
    edge();
  }
  const focusTitle = () => titles[view].focus({ preventScroll: true });
  async function go(v, i, dir) {
    clearTimeout(advanceTimer);
    const ok = await pt.turn(() => { setView(v, i); focusTitle(); }, dir, TURN);
    return ok;
  }
  const firstOpen = () => { const k = answers.findIndex((a) => !a); return k < 0 ? N : k; };

  async function next() {
    if (pt.busy) return;
    if (idx < N - 1) { await go('q', idx + 1, 1); return; }
    // last answer: a short "composing" beat, then the Peta Minat sheet is uncovered and stamped
    qIntro.textContent = 'Lagi menyusun Peta Minatmu…';
    page2.classList.add('composing');
    await wait(reduced ? 250 : 900);
    page2.classList.remove('composing');
    if (await go('result', idx, 1)) stamp();
  }
  function stamp() {
    page3.classList.remove('stamped');
    void page3.offsetWidth;
    page3.classList.add('stamped');
  }

  // ---- events
  kopForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (pt.busy) return;
    const k = firstOpen();
    if (k >= N) go('result', N - 1, 1).then((ok) => ok && stamp());
    else go('q', k, 1);
  });
  $('qBack').addEventListener('click', () => {
    if (pt.busy) return;
    if (idx === 0) go('kop', 0, -1); else go('q', idx - 1, -1);
  });
  qOpts.addEventListener('keydown', (e) => {
    if (e.key.startsWith('Arrow')) arrowNav = true;
    else if (e.key === 'Enter' && answers[idx]) { e.preventDefault(); next(); }
  });
  qOpts.addEventListener('click', (e) => {
    const input = e.target.closest('input[type="radio"]');
    if (!input || pt.busy) return;
    answers[idx] = input.value; save();
    page2.classList.add('answered');
    const byArrow = arrowNav; arrowNav = false;
    if (byArrow) { qIntro.textContent = 'Tekan Enter untuk lanjut.'; return; }   // moving through options with the keyboard
    clearTimeout(advanceTimer);
    advanceTimer = setTimeout(next, reduced ? 150 : 520);                     // let the pencil cross land first
  });
  $('qForm').addEventListener('submit', (e) => { e.preventDefault(); if (answers[idx]) next(); });

  $('rRetry').addEventListener('click', () => {
    if (pt.busy) return;
    answers = Array(N).fill(null); order = Array.from({ length: N }, shuffledPair); save();
    go('kop', 0, 1);                                                           // a fresh sheet; the biodata stays filled in
  });
  $('rShare').addEventListener('click', async () => {
    const t = TYPES[scoreType(answers)];
    const url = `${location.origin}${location.pathname}?${SHARE_UTM}`;
    const text = `Aku Penjelajah ${t.name}! Kamu tipe apa? Cek Peta Minatmu di ${url} #JurusanBukanUkuran`;
    const toast = $('rToast');
    if (navigator.share) {
      try { await navigator.share({ title: 'Peta Minat · Beda Jalan, Satu Tujuan', text }); return; }
      catch (err) { if (err && err.name === 'AbortError') return; }
    }
    try { await navigator.clipboard.writeText(text); toast.textContent = 'Tautan disalin. Tempel ke chat temanmu, ya!'; }
    catch { toast.textContent = text; }                                       // no clipboard: show the text to copy by hand
  });
  $('rPdf').addEventListener('click', () => {
    const root = $('printRoot');
    const copy = page3.cloneNode(true);
    copy.removeAttribute('id'); copy.hidden = false; copy.inert = false; copy.removeAttribute('aria-labelledby');
    copy.querySelectorAll('[id]').forEach((n) => n.removeAttribute('id'));
    copy.querySelectorAll('.r-actions, .r-toast').forEach((n) => n.remove());
    copy.classList.add('stamped');
    root.replaceChildren(copy);
    document.body.classList.add('print-result');
    addEventListener('afterprint', () => { document.body.classList.remove('print-result'); root.replaceChildren(); }, { once: true });
    print();
  });

  setView('kop', 0);

  return {
    // the sheet was just laid on the desk: show the page the reader left
    opened() { paper.showPage(pages[view], titles[view]); setStack(); edge(); focusTitle(); },
    get page() { return pages[view]; },
    // debug: ?state=q5 / ?state=result&type=st|sh|dd
    debug(v, arg) {
      if (v === 'q') setView('q', Math.max(0, Math.min(N - 1, arg | 0)));
      if (v === 'result') {
        const ty = ['st', 'sh', 'dd'].includes(arg) ? arg : 'dd';
        answers = QUESTIONS.map((_, i) => (ty === 'dd' ? (i % 2 ? 'st' : 'sh') : ty));
        if (!kopForm.elements.nama.value) { kopForm.elements.nama.value = 'Dinda'; kopForm.elements.kelas.value = '9B, SMP 1'; }
        setView('result', N - 1); page3.classList.add('stamped');
      }
      focusTitle();
    },
  };
}
