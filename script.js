/**
 * Code Golf Comparison, Custom Leaderboard & Solutions Query Script
 */

// --- Global Constants & State ---
const DEFAULT_GOLFERS_LIST = "zzh1996, Steffan153, codereport, ovs-code, pardouin, sean-niemann, rucin93, emplv, edsrzf, scpchicken, blaztoma, MeWhenI, Seek64, kg583, emgordon154, stefangimmillaro, lyphyser, saito-ta, SirBogman, snoozingnewt, lynn, nwellnhof, CaedenHarper, KasperKivimaeki, vang1ong7ang, 5cw, canissimia, sisyphus-gpt, duckyluuk, GrayJoKing, hallvabo, Natanaelel, GolfingSuccess, bitsandbeyond, bizy-coder, CornerMercury, ryyyn, AlephSquirrel, AdrienHache, antimon2, DialFrost, plcc0, jared-hughes, JayXon, Shanethegamer, namelessiw, bricknellj, sisyphus-ppcg, KatieLG, albanian-laundromat, JOrE20, primo-ppcg, anter69, rkg-huwdu, m-tkach, oaiqjuy, btnlq, ndren, annaproxy, aksyristos, inventshah, Yax42, Flekay, dokutan, 2bular, IanUtley, acotis, lukegustafson, vlpx, RainVniaR, Kacarott, Lydxn, CLOStrophobic, StefanHabel, error256, lifthrasiir, BREMAUCY, targrik, commandz0, voytxt, FortuiteMan, madex, retrohun, xsot, tomtheisen, HPWiz, qpwoeirut, UnderKoen, prestosilver, helbling, ahmetdemirag, Yewzir, LostSyntax21, dmrichwa, prplz, iczelia, CatsAreFluffy, InigoK, kumavale, ZakkkkAttackkkk";

let lastCompareResults = null;
let lastLeaderboardResults = [];
let lastQueryResults = [];

// Compare Sort State
let currentCompareSortField = 'u1';
let currentCompareSortDir = 'desc';

// Leaderboard Sort State
let currentLbSortField = 'points';
let currentLbSortDir = 'desc';

// Query Sort State
let currentQuerySortField = 'bytes';
let currentQuerySortDir = 'desc';

// --- Unicode & Visual Alignment Helpers ---
function getVisualWidth(str) {
  return [...String(str || '')].length;
}

function padVisualEnd(str, targetWidth) {
  const s = String(str || '');
  const vWidth = getVisualWidth(s);
  const padLen = Math.max(0, targetWidth - vWidth);
  return s + ' '.repeat(padLen);
}

function padVisualStart(str, targetWidth) {
  const s = String(str || '');
  const vWidth = getVisualWidth(s);
  const padLen = Math.max(0, targetWidth - vWidth);
  return ' '.repeat(padLen) + s;
}

// --- Mathematical Helpers ---
function calculateHolePowerMean(holeScores, totalHoles, chi) {
  if (totalHoles === 0) return 0;

  if (chi === 1) {
    return holeScores.reduce((acc, score) => acc + score, 0);
  }

  if (chi >= 100) {
    return Math.max(...holeScores, 0) * totalHoles;
  }

  const sumPow = holeScores.reduce((acc, score) => acc + Math.pow(score, chi), 0);
  const mean = Math.pow(sumPow / totalHoles, 1 / chi);
  return mean * totalHoles;
}

/**
 * Generalized Power Mean across Languages for a Hole (M_lambda).
 * Max-scaled to ensure numerical stability up to lambda = 1000.
 */
function calculateLangPowerMean(langScores, totalLangs, lambda) {
  if (totalLangs === 0) return 0;
  if (lambda >= 1000) {
    return Math.max(...langScores, 0);
  }
  const maxScore = Math.max(...langScores, 0);
  if (maxScore === 0) return 0;

  if (lambda === 1) {
    return langScores.reduce((acc, score) => acc + score, 0) / totalLangs;
  }

  const sumScaledPow = langScores.reduce((acc, score) => {
    return acc + Math.pow(score / maxScore, lambda);
  }, 0);

  return maxScore * Math.pow(sumScaledPow / totalLangs, 1 / lambda);
}

// --- General UI Helper Functions ---
function showLoading() {
  document.getElementById('loadingOverlay')?.classList.remove('hidden');
}

function hideLoading() {
  document.getElementById('loadingOverlay')?.classList.add('hidden');
}

function escapeHtml(str) {
  if (typeof str !== 'string') return str || '';
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getGolferLink(username) {
  if (!username) return '';
  const url = `https://code.golf/golfers/${encodeURIComponent(username)}`;
  return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="golf-link">${escapeHtml(username)}</a>`;
}

function getScoringMode() {
  const el = document.getElementById('scoringSelect');
  return el && el.value ? el.value.toLowerCase() : 'bytes';
}

// --- File Reading Helpers ---
function readJsonFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        resolve(JSON.parse(e.target.result));
      } catch (err) {
        reject(new Error(`Failed to parse JSON in file: ${file.name}`));
      }
    };
    reader.onerror = () => reject(new Error(`Error reading file: ${file.name}`));
    reader.readAsText(file);
  });
}

async function getSubmissionsData(fileInput) {
  const file = fileInput?.files?.[0];
  if (file) {
    return await readJsonFile(file);
  }
  return null;
}

async function getOrFetchJson(fileInput, fetchUrl, fileName) {
  if (fileInput && fileInput.files && fileInput.files[0]) {
    return await readJsonFile(fileInput.files[0]);
  }

  try {
    const resp = await fetch(fetchUrl);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return await resp.json();
  } catch (err) {
    console.warn(`Could not auto-fetch ${fileName} from ${fetchUrl}.`);
    return null;
  }
}

function downloadMarkdownFile(filename, text) {
  const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function compareMedalCandidates(a, b) {
  const medalRank = { '💎': 1, '🥇': 2, '🥈': 3, '🥉': 4, '': 5 };
  const rankA = medalRank[a.medal] || 5;
  const rankB = medalRank[b.medal] || 5;

  if (rankA !== rankB) return rankA - rankB;

  const ptA = a.point || 0;
  const ptB = b.point || 0;
  if (ptA !== ptB) return ptB - ptA;

  return (a.loginByte || 0) - (b.loginByte || 0);
}

function formatLangDisplay(hole, lang) {
  if (!lang || lang === "N/A" || lang === "-") return "-";
  const langUrl = `https://code.golf/${encodeURIComponent(hole)}#${encodeURIComponent(lang)}`;
  return `<a href="${langUrl}" target="_blank" rel="noopener noreferrer" class="golf-link-clean">${escapeHtml(lang)}</a>`;
}

function formatScoreDisplay(hole, lang, point, mode, medal, golferName, allMedals = []) {
  if (!point || point <= 0 || !lang || lang === "N/A" || lang === "-") {
    const valStr = (point || 0).toLocaleString();
    return `
      <div class="score-cell-container">
        <div class="medal-badge-wrapper"></div>
        <div class="score-value-box"><strong>${valStr}</strong></div>
      </div>
    `;
  }

  const scoreUrl = `https://code.golf/rankings/holes/${encodeURIComponent(hole)}/${encodeURIComponent(lang)}/${mode}`;
  const scoreLink = `<a href="${scoreUrl}" target="_blank" rel="noopener noreferrer" class="golf-link-clean"><strong>${point.toLocaleString()}</strong></a>`;

  let extraHtml = '';
  if (allMedals && allMedals.length > 1) {
    const medalsJson = escapeHtml(JSON.stringify(allMedals));
    extraHtml = `<button type="button" class="extra-medals-btn" data-hole="${escapeHtml(hole)}" data-golfer="${escapeHtml(golferName)}" data-medals="${medalsJson}">(${allMedals.length})</button>`;
  }

  const medalSpan = medal ? `<span class="medal">${medal}</span>` : '';

  return `
    <div class="score-cell-container">
      <div class="medal-badge-wrapper">
        ${medalSpan}
        ${extraHtml}
      </div>
      <div class="score-value-box">
        ${scoreLink}
      </div>
    </div>
  `;
}

// --- Modals ---
const solutionsModal = document.getElementById('solutionsModal');

function handleSolutionsDownload() {
  solutionsModal?.classList.remove('hidden');
}

document.getElementById('modalGithubBtn')?.addEventListener('click', () => {
  const currentYear = new Date().getFullYear();
  const githubUrl = `https://github.com/scpchicken/code-golf-history/tree/main/${currentYear}`;
  window.open(githubUrl, '_blank');
  solutionsModal?.classList.add('hidden');
});

document.getElementById('modalCurlBtn')?.addEventListener('click', () => {
  const curlCmd = 'curl -k -L https://code.golf/scores/all-holes/all-langs/all -o solutions.json';
  navigator.clipboard.writeText(curlCmd)
    .then(() => alert("Copied curl command to clipboard!\n\nCommand:\n" + curlCmd))
    .catch(() => prompt("Copy this curl command manually:", curlCmd));
  solutionsModal?.classList.add('hidden');
});

document.getElementById('modalCloseBtn')?.addEventListener('click', () => {
  solutionsModal?.classList.add('hidden');
});

function showExtraMedalsModal(hole, golfer, allMedals) {
  let modal = document.getElementById('extraMedalsModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'extraMedalsModal';
    modal.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0, 0, 0, 0.75); display: flex; align-items: center;
      justify-content: center; z-index: 9999;
    `;
    document.body.appendChild(modal);
  }

  const rowsHtml = allMedals.map(m => {
    const langUrl = `https://code.golf/${encodeURIComponent(hole)}#${encodeURIComponent(m.lang)}`;
    const ptDisplay = m.point ? ` (${m.point.toLocaleString()} pt)` : '';
    return `
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.1);">
        <a href="${langUrl}" target="_blank" rel="noopener noreferrer" class="golf-link-clean" style="font-weight: bold; color: #4ade80;">${escapeHtml(m.lang)}</a>
        <span style="font-size: 1.1em; margin-left: 12px;">${m.medal}${ptDisplay}</span>
      </div>
    `;
  }).join('');

  modal.innerHTML = `
    <div style="background: var(--card-bg, #1e293b); color: #fff; padding: 20px 24px; border-radius: 8px; min-width: 280px; max-width: 420px; box-shadow: 0 4px 20px rgba(0,0,0,0.5); border: 1px solid var(--border, #334155);">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,0.2); padding-bottom: 8px;">
        <strong style="font-size: 1.1em; color: var(--accent, #22c55e);">${escapeHtml(hole)} (${escapeHtml(golfer)})</strong>
        <button id="closeExtraMedalsBtn" style="background: none; border: none; color: #aaa; font-size: 1.4em; cursor: pointer; line-height: 1;">&times;</button>
      </div>
      <div style="max-height: 300px; overflow-y: auto;">
        ${rowsHtml}
      </div>
    </div>
  `;

  modal.classList.remove('hidden');
  modal.querySelector('#closeExtraMedalsBtn')?.addEventListener('click', () => modal.classList.add('hidden'));
  modal.onclick = (e) => { if (e.target === modal) modal.classList.add('hidden'); };
}

function showDiffModal(hole, u1Point, u2Point, u1Langs, u2Langs) {
  let modal = document.getElementById('diffBreakdownModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'diffBreakdownModal';
    modal.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0, 0, 0, 0.75); display: flex; align-items: center;
      justify-content: center; z-index: 9999;
    `;
    document.body.appendChild(modal);
  }

  const u1Name = lastCompareResults?.u1Name || 'User 1';
  const u2Name = lastCompareResults?.u2Name || 'User 2';

  const u1LangMap = new Map(u1Langs.map(item => [item.lang, item]));
  const u2LangMap = new Map(u2Langs.map(item => [item.lang, item]));
  const allLangNames = Array.from(new Set([...u1LangMap.keys(), ...u2LangMap.keys()]));

  let currentSortField = 'u2';
  let currentSortDir = 'desc';

  function renderModalContent() {
    allLangNames.sort((a, b) => {
      const item1A = u1LangMap.get(a);
      const item2A = u2LangMap.get(a);
      const u1PtsA = item1A ? item1A.point : 0;
      const u2PtsA = item2A ? item2A.point : 0;
      const diffA = u1PtsA - u2PtsA;
      const diffBestA = item1A ? (u1PtsA - u2Point) : (u2Point > 0 ? -u2Point : 0);

      const item1B = u1LangMap.get(b);
      const item2B = u2LangMap.get(b);
      const u1PtsB = item1B ? item1B.point : 0;
      const u2PtsB = item2B ? item2B.point : 0;
      const diffB = u1PtsB - u2PtsB;
      const diffBestB = item1B ? (u1PtsB - u2Point) : (u2Point > 0 ? -u2Point : 0);

      let valA = 0, valB = 0;
      if (currentSortField === 'u1') { valA = u1PtsA; valB = u1PtsB; }
      else if (currentSortField === 'u2') { valA = u2PtsA; valB = u2PtsB; }
      else if (currentSortField === 'diff') { valA = diffA; valB = diffB; }
      else if (currentSortField === 'diffBest') { valA = diffBestA; valB = diffBestB; }

      if (valA !== valB) {
        return currentSortDir === 'desc' ? valB - valA : valA - valB;
      }
      return u2PtsB - u2PtsA || u1PtsB - u1PtsA;
    });

    const rowsHtml = allLangNames.map(lang => {
      const item1 = u1LangMap.get(lang);
      const item2 = u2LangMap.get(lang);

      const u1Pts = item1 ? item1.point : 0;
      const u2Pts = item2 ? item2.point : 0;

      const u1MedalStr = item1?.medal ? `<span class="medal">${item1.medal}</span>` : '';
      const u1PtsStr = item1 ? u1Pts.toLocaleString() : '-';
      const u1CellContent = `
        <div style="display: flex; justify-content: flex-end; align-items: center; width: 100%; gap: 6px;">
          <span style="display: inline-block; text-align: center;">${u1MedalStr}</span>
          <span style="min-width: 5ch; text-align: right; display: inline-block; font-variant-numeric: tabular-nums;">${u1PtsStr}</span>
        </div>
      `;

      const u2MedalStr = item2?.medal ? `<span class="medal">${item2.medal}</span>` : '';
      let u2PtsStr = item2 ? u2Pts.toLocaleString() : '-';

      if (item2 && u2Pts > u1Point) {
        u2PtsStr = `<span style="color: #facc15; font-weight: bold;">${u2PtsStr}</span>`;
      }

      const u2CellContent = `
        <div style="display: flex; justify-content: flex-end; align-items: center; width: 100%; gap: 6px;">
          <span style="display: inline-block; text-align: center;">${u2MedalStr}</span>
          <span style="min-width: 5ch; text-align: right; display: inline-block; font-variant-numeric: tabular-nums;">${u2PtsStr}</span>
        </div>
      `;

      const diffVal = u1Pts - u2Pts;
      const diffSign = diffVal > 0 ? `+${diffVal.toLocaleString()}` : diffVal.toLocaleString();
      const diffClass = diffVal > 0 ? 'diff-pos' : diffVal < 0 ? 'diff-neg' : 'diff-zero';

      let diffBestStr = '-';
      let diffBestClass = 'diff-zero';
      if (item1 || u2Point > 0) {
        const diffBestVal = item1 ? (u1Pts - u2Point) : -u2Point;
        diffBestStr = diffBestVal > 0 ? `+${diffBestVal.toLocaleString()}` : diffBestVal.toLocaleString();
        diffBestClass = diffBestVal > 0 ? 'diff-pos' : diffBestVal < 0 ? 'diff-neg' : 'diff-zero';
      }

      const langUrl = `https://code.golf/${encodeURIComponent(hole)}#${encodeURIComponent(lang)}`;

      return `
        <tr style="border-bottom: 1px solid rgba(255,255,255,0.1);">
          <td style="padding: 8px 12px;"><a href="${langUrl}" target="_blank" rel="noopener noreferrer" class="golf-link-clean" style="font-weight: bold; color: #4da6ff;">${escapeHtml(lang)}</a></td>
          <td style="padding: 8px 12px; text-align: right;">${u1CellContent}</td>
          <td style="padding: 8px 12px; text-align: right;">${u2CellContent}</td>
          <td style="padding: 8px 12px; text-align: right;" class="${diffClass}">${diffSign}</td>
          <td style="padding: 8px 12px; text-align: right;" class="${diffBestClass}">${diffBestStr}</td>
        </tr>
      `;
    }).join('');

    const u1Arrow = currentSortField === 'u1' ? (currentSortDir === 'desc' ? ' ▼' : ' ▲') : '';
    const u2Arrow = currentSortField === 'u2' ? (currentSortDir === 'desc' ? ' ▼' : ' ▲') : '';
    const diffArrow = currentSortField === 'diff' ? (currentSortDir === 'desc' ? ' ▼' : ' ▲') : '';
    const diffBestArrow = currentSortField === 'diffBest' ? (currentSortDir === 'desc' ? ' ▼' : ' ▲') : '';

    modal.innerHTML = `
      <div style="background: var(--card-bg, #1e293b); color: #fff; padding: 20px 24px; border-radius: 8px; min-width: 320px; max-width: 680px; width: 90%; box-shadow: 0 4px 20px rgba(0,0,0,0.5); border: 1px solid var(--border, #334155);">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,0.2); padding-bottom: 10px;">
          <div>
            <h3 style="margin: 0; color: var(--accent, #22c55e); font-size: 1.2em;">${escapeHtml(hole)}</h3>
            <div style="font-size: 0.85em; color: var(--text-dim, #94a3b8); margin-top: 4px;">
              ${escapeHtml(u1Name)} Best: <strong>${u1Point.toLocaleString()} pt</strong> &nbsp;|&nbsp;
              ${escapeHtml(u2Name)} Best: <strong>${u2Point.toLocaleString()} pt</strong>
            </div>
          </div>
          <button id="closeDiffModalBtn" style="background: none; border: none; color: #aaa; font-size: 1.5em; cursor: pointer; line-height: 1; padding: 0 4px;">&times;</button>
        </div>
        <div style="max-height: 350px; overflow-y: auto;">
          <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
            <thead>
              <tr style="border-bottom: 1px solid var(--border, #334155); color: var(--text-dim, #94a3b8);">
                <th style="padding: 6px 12px; text-align: left;">Language</th>
                <th id="thSortU1" style="padding: 6px 12px; text-align: right; cursor: pointer; user-select: none; color: ${currentSortField === 'u1' ? '#38bdf8' : 'inherit'};">
                  ${escapeHtml(u1Name)}${u1Arrow}
                </th>
                <th id="thSortU2" style="padding: 6px 12px; text-align: right; cursor: pointer; user-select: none; color: ${currentSortField === 'u2' ? '#38bdf8' : 'inherit'};">
                  ${escapeHtml(u2Name)}${u2Arrow}
                </th>
                <th id="thSortDiff" style="padding: 6px 12px; text-align: right; cursor: pointer; user-select: none; color: ${currentSortField === 'diff' ? '#38bdf8' : 'inherit'};">
                  Diff${diffArrow}
                </th>
                <th id="thSortDiffBest" style="padding: 6px 12px; text-align: right; cursor: pointer; user-select: none; color: ${currentSortField === 'diffBest' ? '#38bdf8' : 'inherit'};">
                  Diff from Best${diffBestArrow}
                </th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        </div>
      </div>
    `;

    modal.querySelector('#closeDiffModalBtn')?.addEventListener('click', () => modal.classList.add('hidden'));

    const bindHeaderSort = (id, fieldName) => {
      const el = modal.querySelector(id);
      el?.addEventListener('click', () => {
        if (currentSortField === fieldName) {
          currentSortDir = currentSortDir === 'desc' ? 'asc' : 'desc';
        } else {
          currentSortField = fieldName;
          currentSortDir = 'desc';
        }
        renderModalContent();
      });
    };

    bindHeaderSort('#thSortU1', 'u1');
    bindHeaderSort('#thSortU2', 'u2');
    bindHeaderSort('#thSortDiff', 'diff');
    bindHeaderSort('#thSortDiffBest', 'diffBest');
  }

  renderModalContent();
  modal.classList.remove('hidden');
  modal.onclick = (e) => { if (e.target === modal) modal.classList.add('hidden'); };
}

// --- Event Delegation ---
document.getElementById('resultsBody')?.addEventListener('click', (e) => {
  const diffBtn = e.target.closest('.diff-clickable');
  if (diffBtn) {
    e.preventDefault();
    e.stopPropagation();
    const hole = diffBtn.getAttribute('data-hole');
    const u1Point = parseFloat(diffBtn.getAttribute('data-u1-point') || '0');
    const u2Point = parseFloat(diffBtn.getAttribute('data-u2-point') || '0');
    const u1Langs = JSON.parse(diffBtn.getAttribute('data-u1-langs') || '[]');
    const u2Langs = JSON.parse(diffBtn.getAttribute('data-u2-langs') || '[]');
    showDiffModal(hole, u1Point, u2Point, u1Langs, u2Langs);
    return;
  }

  const btn = e.target.closest('.extra-medals-btn');
  if (btn) {
    e.preventDefault();
    e.stopPropagation();
    const hole = btn.getAttribute('data-hole');
    const golfer = btn.getAttribute('data-golfer');
    const medals = JSON.parse(btn.getAttribute('data-medals') || '[]');
    showExtraMedalsModal(hole, golfer, medals);
  }
});

// Navigation Switcher
const navCompareBtn = document.getElementById('navCompareBtn');
const navLeaderboardBtn = document.getElementById('navLeaderboardBtn');
const navQueryBtn = document.getElementById('navQueryBtn');
const comparePage = document.getElementById('comparePage');
const leaderboardPage = document.getElementById('leaderboardPage');
const queryPage = document.getElementById('queryPage');

navCompareBtn?.addEventListener('click', () => {
  navCompareBtn.classList.add('active');
  navLeaderboardBtn.classList.remove('active');
  navQueryBtn?.classList.remove('active');
  comparePage.classList.remove('hidden');
  leaderboardPage.classList.add('hidden');
  queryPage?.classList.add('hidden');
});

navLeaderboardBtn?.addEventListener('click', () => {
  navLeaderboardBtn.classList.add('active');
  navCompareBtn.classList.remove('active');
  navQueryBtn?.classList.remove('active');
  leaderboardPage.classList.remove('hidden');
  comparePage.classList.add('hidden');
  queryPage?.classList.add('hidden');
});

navQueryBtn?.addEventListener('click', () => {
  navQueryBtn.classList.add('active');
  navCompareBtn.classList.remove('active');
  navLeaderboardBtn.classList.remove('active');
  queryPage?.classList.remove('hidden');
  comparePage.classList.add('hidden');
  leaderboardPage.classList.add('hidden');
});

// Shortcuts
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    if (queryPage && !queryPage.classList.contains('hidden')) {
      document.getElementById('queryGoBtn')?.click();
    } else if (leaderboardPage && !leaderboardPage.classList.contains('hidden')) {
      document.getElementById('lbGoBtn')?.click();
    } else if (comparePage && !comparePage.classList.contains('hidden')) {
      document.getElementById('goBtn')?.click();
    }
  }
});

document.getElementById('leaderboardUsersLabel')?.addEventListener('click', (e) => {
  e.preventDefault();
  const input = document.getElementById('leaderboardUsersInput');
  if (input) {
    input.value = DEFAULT_GOLFERS_LIST;
    input.focus();
  }
});

document.getElementById('dlSolutionsBtn')?.addEventListener('click', handleSolutionsDownload);
document.getElementById('dlHolesBtn')?.addEventListener('click', () => window.open('https://code.golf/api/holes', '_blank'));
document.getElementById('dlLangsBtn')?.addEventListener('click', () => window.open('https://code.golf/api/langs', '_blank'));

// ==========================================
// PAGE 1: Golfer Comparison Logic
// ==========================================
document.getElementById('goBtn')?.addEventListener('click', async () => {
  const u1Name = document.getElementById('user1Input')?.value.trim() || '';
  const u2Name = document.getElementById('user2Input')?.value.trim() || '';
  const scoringMode = getScoringMode();
  const minScore = parseFloat(document.getElementById('formulaValue')?.textContent || 750);
  const chiExponent = parseFloat(document.getElementById('chiValue')?.textContent || 1);
  const lambdaExponent = parseFloat(document.getElementById('lambdaSlider')?.value || 1000);
  const diamondBonus = parseFloat(document.getElementById('diamondValue')?.textContent || 0);
  const langFilter = (document.getElementById('langFilterInput')?.value || '').trim().toLowerCase();

  if (u2Name) {
    currentCompareSortField = 'diff';
    currentCompareSortDir = 'asc';
  } else {
    currentCompareSortField = 'u1';
    currentCompareSortDir = 'desc';
  }

  const subFileInput = document.getElementById('submissionsFile');
  const holesFileInput = document.getElementById('holesFile');
  const langsFileInput = document.getElementById('langsFile');
  const includeExperimental = document.getElementById('experimentalCheck')?.checked ?? false;

  if (!u1Name) {
    alert("Please specify Username 1.");
    return;
  }

  showLoading();
  await new Promise(r => setTimeout(r, 50));

  try {
    const submissionsData = await getSubmissionsData(subFileInput);
    
    if (!submissionsData) {
      hideLoading();
      handleSolutionsDownload();
      return;
    }

    const [holesData, langsData] = await Promise.all([
      getOrFetchJson(holesFileInput, 'https://code.golf/api/holes', 'holes.json'),
      getOrFetchJson(langsFileInput, 'https://code.golf/api/langs', 'langs.json')
    ]);

    lastCompareResults = processCompareData({
      jsonData: submissionsData,
      u1Name,
      u2Name,
      scoringMode,
      minScore,
      chiExponent,
      lambdaExponent,
      diamondBonus,
      langFilter,
      holesJson: holesData,
      langsJson: langsData,
      includeExperimental
    });

    renderCompareResults(lastCompareResults);
    document.getElementById('dlResultsBtn')?.classList.remove('hidden');
    document.getElementById('dlResultsTxtBtn')?.classList.remove('hidden');
  } catch (err) {
    alert(err.message);
  } finally {
    hideLoading();
  }
});

function processCompareData({ 
  jsonData, 
  u1Name, 
  u2Name, 
  scoringMode, 
  minScore = 750, 
  chiExponent = 1,
  lambdaExponent = 1000,
  diamondBonus = 0,
  langFilter, 
  holesJson, 
  langsJson, 
  includeExperimental 
}) {
  const u1Lower = u1Name.toLowerCase();
  const u2Lower = u2Name ? u2Name.toLowerCase() : null;
  const hasUser2 = Boolean(u2Lower);

  const isFlat1000 = minScore >= 1000;
  const offset2 = isFlat1000 ? 0 : minScore / (1000 - minScore);
  const offset1 = isFlat1000 ? 0 : offset2 - 1;

  let validHoles = null;
  if (holesJson && Array.isArray(holesJson)) {
    validHoles = new Set(
      holesJson
        .filter(h => includeExperimental || h.experiment === null || h.experiment === undefined)
        .map(h => h.id)
    );
  }

  let validLangs = null;
  if (langsJson && Array.isArray(langsJson)) {
    validLangs = new Set(
      langsJson
        .filter(l => includeExperimental || l.experiment === null || l.experiment === undefined)
        .map(l => l.id)
    );
  }

  const globalHoleMin = new Map();
  const globalLangStats = new Map();
  const userBestSubmissions = new Map();

  for (const x of jsonData) {
    if (x.scoring !== scoringMode) continue;

    const lang = x.lang;
    const hole = x.hole;
    const login = x.login;
    const loginLower = login.toLowerCase();
    const byte = Number(scoringMode === 'chars' ? (x.chars ?? x.bytes) : x.bytes);

    if (langFilter && lang.toLowerCase() !== langFilter) continue;
    if (validHoles && !validHoles.has(hole)) continue;
    if (validLangs && !validLangs.has(lang)) continue;

    if (!globalHoleMin.has(hole) || byte < globalHoleMin.get(hole)) {
      globalHoleMin.set(hole, byte);
    }

    const langKey = `${hole}::${lang}`;
    if (!globalLangStats.has(langKey)) {
      globalLangStats.set(langKey, { min_bytes: byte, logins: new Set() });
    }
    const langStat = globalLangStats.get(langKey);
    if (byte < langStat.min_bytes) {
      langStat.min_bytes = byte;
    }
    langStat.logins.add(loginLower);

    const userLangKey = `${hole}::${lang}::${loginLower}`;
    if (!userBestSubmissions.has(userLangKey) || byte < userBestSubmissions.get(userLangKey)) {
      userBestSubmissions.set(userLangKey, byte);
    }
  }

  const allLangsSet = new Set();
  for (const langKey of globalLangStats.keys()) {
    allLangsSet.add(langKey.split("::")[1]);
  }
  const totalLangsCount = validLangs ? validLangs.size : (allLangsSet.size || 1);

  const holeLangUsers = new Map();
  for (const [userLangKey, byte] of userBestSubmissions.entries()) {
    const parts = userLangKey.split("::");
    const key = `${parts[0]}::${parts[1]}`;
    const loginLower = parts[2];

    if (!holeLangUsers.has(key)) holeLangUsers.set(key, []);
    holeLangUsers.get(key).push({ login: loginLower, byte });
  }

  const medalsMap = new Map();
  for (const [key, users] of holeLangUsers.entries()) {
    users.sort((a, b) => a.byte - b.byte);
    if (users.length === 0) continue;

    const minByte = users[0].byte;
    const tiedForFirst = users.filter(u => u.byte === minByte).length;

    for (let i = 0; i < users.length; i++) {
      const current = users[i];
      const strictlyFewer = users.filter(u => u.byte < current.byte).length;
      const place = strictlyFewer + 1;

      let medal = "";
      if (place === 1) medal = (tiedForFirst === 1) ? "💎" : "🥇";
      else if (place === 2) medal = "🥈";
      else if (place === 3) medal = "🥉";

      medalsMap.set(`${key}::${current.login}`, medal);
    }
  }

  let u1Golds = 0, u1Diamonds = 0;
  let u2Golds = 0, u2Diamonds = 0;

  for (const [userLangKey] of userBestSubmissions.entries()) {
    const parts = userLangKey.split("::");
    const loginLower = parts[2];
    const medal = medalsMap.get(userLangKey) || "";

    if (loginLower === u1Lower) {
      if (medal === "💎") { u1Diamonds++; u1Golds++; }
      else if (medal === "🥇") u1Golds++;
    } else if (hasUser2 && loginLower === u2Lower) {
      if (medal === "💎") { u2Diamonds++; u2Golds++; }
      else if (medal === "🥇") u2Golds++;
    }
  }

  function getUserHoleResult(hole, targetLoginLower) {
    if (!targetLoginLower) return { lang: "-", point: 0, medal: "", allMedals: [], medalsAscii: "-", allLangScores: [] };

    const candidates = [];
    const holeByteMin = globalHoleMin.get(hole) || 1;

    for (const [langKey, langStat] of globalLangStats.entries()) {
      if (!langKey.startsWith(`${hole}::`)) continue;
      const lang = langKey.split("::")[1];
      const userLangKey = `${hole}::${lang}::${targetLoginLower}`;

      if (userBestSubmissions.has(userLangKey)) {
        const loginByte = userBestSubmissions.get(userLangKey);
        const solCount = langStat.logins ? langStat.logins.size : 1;
        const langByteMin = langStat.min_bytes || loginByte;
        const sqrtN = Math.sqrt(solCount);

        let point = 0;
        if (langFilter) {
          point = (holeByteMin / loginByte) * 1000.0;
        } else if (isFlat1000) {
          point = (langByteMin / loginByte) * 1000.0;
        } else {
          const sb = ((sqrtN + offset1) / (sqrtN + offset2)) * langByteMin + (1.0 / (sqrtN + offset2)) * holeByteMin;
          point = (sb / loginByte) * 1000.0;
        }

        const medal = medalsMap.get(userLangKey) || "";
        candidates.push({ lang, point: Math.round(point), medal, loginByte });
      }
    }

    if (candidates.length === 0) return { lang: "-", point: 0, medal: "", allMedals: [], medalsAscii: "-", allLangScores: [] };

    candidates.sort((a, b) => {
      if (a.point !== b.point) return a.point - b.point;
      const medalRank = { '💎': 1, '🥇': 2, '🥈': 3, '🥉': 4, '': 5 };
      const rankA = medalRank[a.medal] || 5;
      const rankB = medalRank[b.medal] || 5;
      if (rankA !== rankB) return rankB - rankA;
      if (a.loginByte !== b.loginByte) return b.loginByte - a.loginByte;
      return b.lang.localeCompare(a.lang);
    });

    const best = candidates[candidates.length - 1];

    let finalPoint = 0;
    if (lambdaExponent >= 1000) {
      finalPoint = Math.round(best.point);
    } else {
      const langScores = candidates.map(c => c.point);
      finalPoint = Math.round(calculateLangPowerMean(langScores, totalLangsCount, lambdaExponent));
    }

    if (finalPoint === 0) return { lang: "-", point: 0, medal: "", allMedals: [], medalsAscii: "-", allLangScores: [] };

    const allMedals = candidates.filter(c => c.medal !== "").sort(compareMedalCandidates);

    let dCount = 0, gCount = 0, sCount = 0, bCount = 0;
    allMedals.forEach(m => {
      if (m.medal === '💎') { dCount++; gCount++; }
      else if (m.medal === '🥇') gCount++;
      else if (m.medal === '🥈') sCount++;
      else if (m.medal === '🥉') bCount++;
    });

    const asciiParts = [];
    if (dCount > 0) asciiParts.push(`${dCount}D`);
    if (gCount > 0) asciiParts.push(`${gCount}G`);
    if (sCount > 0) asciiParts.push(`${sCount}S`);
    if (bCount > 0) asciiParts.push(`${bCount}B`);
    const medalsAscii = asciiParts.join(' ') || '-';

    return {
      lang: best.lang,
      point: finalPoint,
      medal: best.medal,
      allMedals,
      medalsAscii,
      allLangScores: candidates
    };
  }

  const allHoles = Array.from(globalHoleMin.keys()).sort();
  const totalHolesCount = allHoles.length;
  const rows = [];
  
  const u1Scores = [];
  const u2Scores = [];
  let u1SolvedCount = 0;
  let u2SolvedCount = 0;

  for (const hole of allHoles) {
    const u1Res = getUserHoleResult(hole, u1Lower);
    const u2Res = hasUser2 ? getUserHoleResult(hole, u2Lower) : null;

    u1Scores.push(u1Res.point);
    if (u1Res.point > 0) u1SolvedCount++;

    if (hasUser2) {
      u2Scores.push(u2Res.point);
      if (u2Res.point > 0) u2SolvedCount++;
    }

    const diff = u1Res.point - (u2Res ? u2Res.point : 0);

    rows.push({
      hole,
      u1Lang: u1Res.lang,
      u1Point: u1Res.point,
      u1Medal: u1Res.medal,
      u1AllMedals: u1Res.allMedals,
      u1MedalsAscii: u1Res.medalsAscii,
      u1AllLangs: u1Res.allLangScores || [],
      u2Lang: u2Res ? u2Res.lang : "-",
      u2Point: u2Res ? u2Res.point : 0,
      u2Medal: u2Res ? u2Res.medal : "",
      u2AllMedals: u2Res ? u2Res.allMedals : [],
      u2MedalsAscii: u2Res ? u2Res.medalsAscii : "-",
      u2AllLangs: u2Res ? u2Res.allLangScores || [] : [],
      diff
    });
  }

  const u1BaseScore = Math.round(calculateHolePowerMean(u1Scores, totalHolesCount, chiExponent));
  const u2BaseScore = hasUser2 ? Math.round(calculateHolePowerMean(u2Scores, totalHolesCount, chiExponent)) : 0;

  const u1RawBaseScore = Math.round(calculateHolePowerMean(u1Scores, totalHolesCount, 1));
  const u2RawBaseScore = hasUser2 ? Math.round(calculateHolePowerMean(u2Scores, totalHolesCount, 1)) : 0;

  const u1TotalScore = u1BaseScore + Math.round(u1Diamonds * diamondBonus);
  const u1RawTotalScore = u1RawBaseScore + Math.round(u1Diamonds * diamondBonus);
  const u2TotalScore = hasUser2 ? (u2BaseScore + Math.round(u2Diamonds * diamondBonus)) : 0;
  const u2RawTotalScore = hasUser2 ? (u2RawBaseScore + Math.round(u2Diamonds * diamondBonus)) : 0;

  return {
    rows,
    u1Name,
    u1TotalScore,
    u1RawTotalScore,
    u1SolvedCount,
    u1Golds,
    u1Diamonds,
    u2Name,
    u2TotalScore,
    u2RawTotalScore,
    u2SolvedCount,
    u2Golds,
    u2Diamonds,
    hasUser2,
    scoringMode,
    chiExponent,
    lambdaExponent,
    diamondBonus,
    totalLangsCount
  };
}

function updateCompareScores() {
  if (!lastCompareResults) return;
  const diamondBonus = parseFloat(document.getElementById('diamondValue')?.textContent || '0');
  const chiExponent = parseFloat(document.getElementById('chiValue')?.textContent || '1');
  const lambdaExponent = parseFloat(document.getElementById('lambdaSlider')?.value || '1000');

  const totalHoles = lastCompareResults.rows.length;
  const totalLangsCount = lastCompareResults.totalLangsCount || 1;

  lastCompareResults.rows.forEach(r => {
    if (r.u1AllLangs && r.u1AllLangs.length > 0) {
      const u1LangScores = r.u1AllLangs.map(c => c.point);
      if (lambdaExponent >= 1000) {
        r.u1Point = Math.round(Math.max(...u1LangScores, 0));
      } else {
        r.u1Point = Math.round(calculateLangPowerMean(u1LangScores, totalLangsCount, lambdaExponent));
      }
    } else {
      r.u1Point = 0;
    }

    if (lastCompareResults.hasUser2) {
      if (r.u2AllLangs && r.u2AllLangs.length > 0) {
        const u2LangScores = r.u2AllLangs.map(c => c.point);
        if (lambdaExponent >= 1000) {
          r.u2Point = Math.round(Math.max(...u2LangScores, 0));
        } else {
          r.u2Point = Math.round(calculateLangPowerMean(u2LangScores, totalLangsCount, lambdaExponent));
        }
      } else {
        r.u2Point = 0;
      }
      r.diff = r.u1Point - r.u2Point;
    }
  });

  const u1Scores = lastCompareResults.rows.map(r => r.u1Point);
  const u2Scores = lastCompareResults.rows.map(r => r.u2Point);

  const u1BaseScore = Math.round(calculateHolePowerMean(u1Scores, totalHoles, chiExponent));
  const u2BaseScore = lastCompareResults.hasUser2 ? Math.round(calculateHolePowerMean(u2Scores, totalHoles, chiExponent)) : 0;

  const u1RawBaseScore = Math.round(calculateHolePowerMean(u1Scores, totalHoles, 1));
  const u2RawBaseScore = lastCompareResults.hasUser2 ? Math.round(calculateHolePowerMean(u2Scores, totalHoles, 1)) : 0;

  lastCompareResults.u1TotalScore = u1BaseScore + Math.round(lastCompareResults.u1Diamonds * diamondBonus);
  lastCompareResults.u1RawTotalScore = u1RawBaseScore + Math.round(lastCompareResults.u1Diamonds * diamondBonus);
  if (lastCompareResults.hasUser2) {
    lastCompareResults.u2TotalScore = u2BaseScore + Math.round(lastCompareResults.u2Diamonds * diamondBonus);
    lastCompareResults.u2RawTotalScore = u2RawBaseScore + Math.round(lastCompareResults.u2Diamonds * diamondBonus);
  }
}

function getSortedCompareRows(rows, sortField, sortDir, filterText = '') {
  const sorted = [...rows].sort((a, b) => {
    let valA, valB;
    if (sortField === 'hole') {
      return sortDir === 'asc' ? a.hole.localeCompare(b.hole) : b.hole.localeCompare(a.hole);
    }
    if (sortField === 'u1Lang') {
      return sortDir === 'asc' ? a.u1Lang.localeCompare(b.u1Lang) : b.u1Lang.localeCompare(a.u1Lang);
    }
    if (sortField === 'u2Lang') {
      return sortDir === 'asc' ? a.u2Lang.localeCompare(b.u2Lang) : b.u2Lang.localeCompare(a.u2Lang);
    }
    if (sortField === 'u1') { valA = a.u1Point; valB = b.u1Point; }
    else if (sortField === 'u2') { valA = a.u2Point; valB = b.u2Point; }
    else if (sortField === 'diff') { valA = a.diff; valB = b.diff; }
    else { valA = a.u1Point; valB = b.u1Point; }

    if (valA !== valB) return sortDir === 'desc' ? valB - valA : valA - valB;
    return a.hole.localeCompare(b.hole);
  });

  if (filterText) {
    return sorted.filter(r => r.hole.toLowerCase().includes(filterText));
  }
  return sorted;
}

function renderCompareResults(data) {
  const { u1Name, u2Name, u1TotalScore, u1RawTotalScore, u1SolvedCount, u1Golds, u1Diamonds, u2TotalScore, u2RawTotalScore, u2SolvedCount, u2Golds, u2Diamonds, hasUser2, scoringMode } = data;
  const statsContainer = document.getElementById('statsContainer');
  const tableHead = document.getElementById('tableHead');

  const u1Link = getGolferLink(u1Name);
  const u2Link = getGolferLink(u2Name);
  const modeLabel = scoringMode === 'chars' ? 'Chars' : 'Bytes';

  const thStyle = (f) => `cursor: pointer; user-select: none; color: ${currentCompareSortField === f ? '#38bdf8' : 'inherit'};`;

  if (hasUser2) {
    const diffTotal = u1TotalScore - u2TotalScore;
    const diffSign = diffTotal > 0 ? `+${diffTotal.toLocaleString()}` : diffTotal.toLocaleString();

    statsContainer.innerHTML = `
      <div class="stat-box">
        <div class="val">${u1TotalScore.toLocaleString()} <span style="font-size: 0.6em; opacity: 0.7; font-weight: normal; margin-left: 4px;">(${u1RawTotalScore.toLocaleString()})</span></div>
        <div class="lbl">${u1Link} (${u1SolvedCount} solved • 🥇 ${u1Golds.toLocaleString()} / 💎 ${u1Diamonds.toLocaleString()})</div>
      </div>
      <div class="stat-box">
        <div class="val">${u2TotalScore.toLocaleString()} <span style="font-size: 0.6em; opacity: 0.7; font-weight: normal; margin-left: 4px;">(${u2RawTotalScore.toLocaleString()})</span></div>
        <div class="lbl">${u2Link} (${u2SolvedCount} solved • 🥇 ${u2Golds.toLocaleString()} / 💎 ${u2Diamonds.toLocaleString()})</div>
      </div>
      <div class="stat-box">
        <div class="val ${diffTotal > 0 ? 'diff-pos' : diffTotal < 0 ? 'diff-neg' : 'diff-zero'}">${diffSign}</div>
        <div class="lbl">SCORE DIFF (${modeLabel})</div>
      </div>
    `;

    const holeArrow = currentCompareSortField === 'hole' ? (currentCompareSortDir === 'asc' ? ' ▲' : ' ▼') : '';
    const u1LangArrow = currentCompareSortField === 'u1Lang' ? (currentCompareSortDir === 'asc' ? ' ▲' : ' ▼') : '';
    const u1Arrow = currentCompareSortField === 'u1' ? (currentCompareSortDir === 'desc' ? ' ▼' : ' ▲') : '';
    const u2LangArrow = currentCompareSortField === 'u2Lang' ? (currentCompareSortDir === 'asc' ? ' ▲' : ' ▼') : '';
    const u2Arrow = currentCompareSortField === 'u2' ? (currentCompareSortDir === 'desc' ? ' ▼' : ' ▲') : '';
    const diffArrow = currentCompareSortField === 'diff' ? (currentCompareSortDir === 'asc' ? ' ▲' : ' ▼') : '';

    tableHead.innerHTML = `
      <tr>
        <th id="thCompHole" style="${thStyle('hole')}">Hole${holeArrow}</th>
        <th id="thCompU1Lang" class="col-border-left" style="${thStyle('u1Lang')}">${u1Link} (Lang)${u1LangArrow}</th>
        <th id="thCompU1Score" style="text-align: right; ${thStyle('u1')}">Score${u1Arrow}</th>
        <th id="thCompU2Lang" class="col-border-left" style="${thStyle('u2Lang')}">${u2Link} (Lang)${u2LangArrow}</th>
        <th id="thCompU2Score" style="text-align: right; ${thStyle('u2')}">Score${u2Arrow}</th>
        <th id="thCompDiff" class="col-border-left" style="text-align: right; ${thStyle('diff')}">Diff${diffArrow}</th>
      </tr>
    `;
  } else {
    statsContainer.innerHTML = `
      <div class="stat-box">
        <div class="val">${u1TotalScore.toLocaleString()} <span style="font-size: 0.6em; opacity: 0.7; font-weight: normal; margin-left: 4px;">(${u1RawTotalScore.toLocaleString()})</span></div>
        <div class="lbl">${u1Link} Total Score (${modeLabel})</div>
      </div>
      <div class="stat-box">
        <div class="val">${u1SolvedCount}</div>
        <div class="lbl">Holes Solved</div>
      </div>
      <div class="stat-box">
        <div class="val">🥇 ${u1Golds.toLocaleString()} <span style="font-size: 0.85em; opacity: 0.85;">(💎 ${u1Diamonds.toLocaleString()})</span></div>
        <div class="lbl">Golds & Diamonds</div>
      </div>
    `;

    const holeArrow = currentCompareSortField === 'hole' ? (currentCompareSortDir === 'asc' ? ' ▲' : ' ▼') : '';
    const u1LangArrow = currentCompareSortField === 'u1Lang' ? (currentCompareSortDir === 'asc' ? ' ▲' : ' ▼') : '';
    const u1Arrow = currentCompareSortField === 'u1' ? (currentCompareSortDir === 'desc' ? ' ▼' : ' ▲') : '';

    tableHead.innerHTML = `
      <tr>
        <th id="thCompHole" style="${thStyle('hole')}">Hole${holeArrow}</th>
        <th id="thCompU1Lang" class="col-border-left" style="${thStyle('u1Lang')}">Language${u1LangArrow}</th>
        <th id="thCompU1Score" style="text-align: right; ${thStyle('u1')}">Points${u1Arrow}</th>
      </tr>
    `;
  }

  const bindCompSort = (id, fieldName, defaultDir = 'desc') => {
    const el = document.getElementById(id);
    el?.addEventListener('click', () => {
      if (currentCompareSortField === fieldName) {
        currentCompareSortDir = currentCompareSortDir === 'desc' ? 'asc' : 'desc';
      } else {
        currentCompareSortField = fieldName;
        currentCompareSortDir = defaultDir;
      }
      renderCompareResults(lastCompareResults);
    });
  };

  bindCompSort('thCompHole', 'hole', 'asc');
  bindCompSort('thCompU1Lang', 'u1Lang', 'asc');
  bindCompSort('thCompU1Score', 'u1', 'desc');
  if (hasUser2) {
    bindCompSort('thCompU2Lang', 'u2Lang', 'asc');
    bindCompSort('thCompU2Score', 'u2', 'desc');
    bindCompSort('thCompDiff', 'diff', 'asc');
  }

  sortAndRenderCompareTable(data.rows, currentCompareSortField, currentCompareSortDir, hasUser2, scoringMode, u1Name, u2Name);
  document.getElementById('resultsCard')?.classList.remove('hidden');
}

function sortAndRenderCompareTable(rows, sortField, sortDir, hasUser2, scoringMode, u1Name, u2Name) {
  const resultsBody = document.getElementById('resultsBody');
  const filterText = (document.getElementById('tableSearch')?.value || '').toLowerCase();
  const sorted = getSortedCompareRows(rows, sortField, sortDir, filterText);

  resultsBody.innerHTML = '';
  sorted.forEach(r => {
    const tr = document.createElement('tr');
    const holeUrl = `https://code.golf/${encodeURIComponent(r.hole)}`;
    const holeDisplay = `<a href="${holeUrl}" target="_blank" rel="noopener noreferrer" class="golf-link"><strong>${escapeHtml(r.hole)}</strong></a>`;

    const u1LangDisplay = formatLangDisplay(r.hole, r.u1Lang);
    const u1ScoreDisplay = formatScoreDisplay(r.hole, r.u1Lang, r.u1Point, scoringMode, r.u1Medal, u1Name, r.u1AllMedals);

    if (hasUser2) {
      const u2LangDisplay = formatLangDisplay(r.hole, r.u2Lang);
      const u2ScoreDisplay = formatScoreDisplay(r.hole, r.u2Lang, r.u2Point, scoringMode, r.u2Medal, u2Name, r.u2AllMedals);

      const diffClass = r.diff > 0 ? 'diff-pos' : r.diff < 0 ? 'diff-neg' : 'diff-zero';
      const diffText = r.diff > 0 ? `+${r.diff.toLocaleString()}` : r.diff.toLocaleString();

      const u1LangsJson = escapeHtml(JSON.stringify(r.u1AllLangs || []));
      const u2LangsJson = escapeHtml(JSON.stringify(r.u2AllLangs || []));

      tr.innerHTML = `
        <td>${holeDisplay}</td>
        <td class="col-border-left user-lang-cell">${u1LangDisplay}</td>
        <td class="user-score-cell" style="text-align: right;">${u1ScoreDisplay}</td>
        <td class="col-border-left user-lang-cell">${u2LangDisplay}</td>
        <td class="user-score-cell" style="text-align: right;">${u2ScoreDisplay}</td>
        <td class="col-border-left" style="text-align: right;">
          <span class="diff-clickable ${diffClass}" 
            data-hole="${escapeHtml(r.hole)}"
            data-u1-point="${r.u1Point}"
            data-u2-point="${r.u2Point}"
            data-u1-langs="${u1LangsJson}"
            data-u2-langs="${u2LangsJson}"
            style="cursor: pointer; text-decoration: none;">
            ${diffText}
          </span>
        </td>
      `;
    } else {
      tr.innerHTML = `
        <td>${holeDisplay}</td>
        <td class="col-border-left user-lang-cell">${u1LangDisplay}</td>
        <td class="user-score-cell" style="text-align: right;">${u1ScoreDisplay}</td>
      `;
    }
    resultsBody.appendChild(tr);
  });
}

document.getElementById('tableSearch')?.addEventListener('input', () => {
  if (lastCompareResults) renderCompareResults(lastCompareResults);
});

document.getElementById('scoringSelect')?.addEventListener('change', () => {
  document.getElementById('goBtn')?.click();
});

document.getElementById('dlResultsBtn')?.addEventListener('click', () => {
  if (!lastCompareResults) return;
  const jsonStr = JSON.stringify(lastCompareResults.rows, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'code_golf_results.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
});

document.getElementById('dlResultsTxtBtn')?.addEventListener('click', () => {
  if (!lastCompareResults) return;
  const filterText = (document.getElementById('tableSearch')?.value || '').toLowerCase();
  const mdContent = generateCompareMarkdownTable(lastCompareResults, currentCompareSortField, currentCompareSortDir, filterText);
  downloadMarkdownFile('compare_results.md', mdContent);
});

function generateCompareMarkdownTable(compareData, sortField, sortDir, filterText = '') {
  const { rows, u1Name, u2Name, hasUser2 } = compareData;
  const sortedRows = getSortedCompareRows(rows, sortField, sortDir, filterText);

  let headers = [];
  let rightAlignCols = [];

  if (hasUser2) {
    headers = ['hole', `${u1Name} (lang)`, `${u1Name} (medals)`, `${u1Name} (score)`, `${u2Name} (lang)`, `${u2Name} (medals)`, `${u2Name} (score)`, 'diff'];
    rightAlignCols = [3, 6, 7];
  } else {
    headers = ['hole', 'language', 'medals', 'points'];
    rightAlignCols = [3];
  }

  const tableRows = sortedRows.map(r => {
    if (hasUser2) {
      const diffStr = r.diff > 0 ? `+${r.diff.toLocaleString()}` : r.diff.toLocaleString();
      return [
        r.hole, r.u1Lang, r.u1MedalsAscii, r.u1Point.toLocaleString(),
        r.u2Lang, r.u2MedalsAscii, r.u2Point.toLocaleString(), diffStr
      ];
    } else {
      return [r.hole, r.u1Lang, r.u1MedalsAscii, r.u1Point.toLocaleString()];
    }
  });

  const colWidths = headers.map((header, colIdx) => {
    let maxW = getVisualWidth(header);
    tableRows.forEach(r => {
      const w = getVisualWidth(r[colIdx]);
      if (w > maxW) maxW = w;
    });
    return Math.max(maxW, 4);
  });

  const formatRow = (rowCells) => {
    const formattedCells = rowCells.map((cell, idx) => {
      const width = colWidths[idx];
      return rightAlignCols.includes(idx)
        ? padVisualStart(cell, width)
        : padVisualEnd(cell, width);
    });
    return `| ${formattedCells.join(' | ')} |`;
  };

  const headerLine = formatRow(headers);
  const separatorCells = colWidths.map((w, idx) => {
    const isRight = rightAlignCols.includes(idx);
    return isRight ? '-'.repeat(Math.max(1, w - 1)) + ':' : ':' + '-'.repeat(Math.max(1, w - 1));
  });
  const separatorLine = `| ${separatorCells.join(' | ')} |`;
  const dataLines = tableRows.map(r => formatRow(r));

  return [headerLine, separatorLine, ...dataLines].join('\n');
}

// ==========================================
// PAGE 2: Custom Leaderboard Logic (Bytes Only)
// ==========================================
document.getElementById('lbGoBtn')?.addEventListener('click', async () => {
  const inputVal = document.getElementById('leaderboardUsersInput')?.value.trim() || '';
  const minScore = parseFloat(document.getElementById('lbFormulaValue')?.textContent || 750);
  const chiExponent = parseFloat(document.getElementById('lbChiValue')?.textContent || 1);
  const lambdaExponent = parseFloat(document.getElementById('lbLambdaSlider')?.value || 1000);
  
  const subFileInput = document.getElementById('submissionsFile');
  const holesFileInput = document.getElementById('holesFile');
  const langsFileInput = document.getElementById('langsFile');
  const includeExperimental = document.getElementById('experimentalCheck')?.checked ?? false;

  if (!inputVal) {
    alert("Please enter at least one username.");
    return;
  }

  showLoading();
  await new Promise(r => setTimeout(r, 50));

  try {
    const submissionsData = await getSubmissionsData(subFileInput);

    if (!submissionsData) {
      hideLoading();
      handleSolutionsDownload();
      return;
    }

    const [holesData, langsData] = await Promise.all([
      getOrFetchJson(holesFileInput, 'https://code.golf/api/holes', 'holes.json'),
      getOrFetchJson(langsFileInput, 'https://code.golf/api/langs', 'langs.json')
    ]);

    const targetUsers = inputVal
      .split(',')
      .map(u => u.trim())
      .filter(Boolean);

    lastLeaderboardResults = processLeaderboardData(
      submissionsData,
      targetUsers,
      holesData,
      langsData,
      includeExperimental,
      minScore,
      chiExponent,
      lambdaExponent
    );

    currentLbSortField = 'points';
    currentLbSortDir = 'desc';
    updateLeaderboardScoresAndRanks();
    renderLeaderboard(lastLeaderboardResults);
  } catch (err) {
    alert(err.message);
  } finally {
    hideLoading();
  }
});

function processLeaderboardData(jsonData, targetUsers, holesJson, langsJson, includeExperimental, minScore = 750, chiExponent = 1, lambdaExponent = 1000) {
  const targetMap = new Map();
  targetUsers.forEach((u, index) => {
    targetMap.set(u.toLowerCase(), { displayName: u, initialRank: index + 1 });
  });

  let validHoles = null;
  if (holesJson && Array.isArray(holesJson)) {
    validHoles = new Set(
      holesJson
        .filter(h => includeExperimental || h.experiment === null || h.experiment === undefined)
        .map(h => h.id)
    );
  }

  let validLangs = null;
  if (langsJson && Array.isArray(langsJson)) {
    validLangs = new Set(
      langsJson
        .filter(l => includeExperimental || l.experiment === null || l.experiment === undefined)
        .map(l => l.id)
    );
  }

  const globalHoleMin = new Map();
  const globalLangStats = new Map();
  const userBestSubmissions = new Map();

  for (const x of jsonData) {
    if (x.scoring !== "bytes") continue;

    const lang = x.lang;
    const hole = x.hole;
    const login = x.login;
    const loginLower = login.toLowerCase();
    const byte = Number(x.bytes);

    if (validHoles && !validHoles.has(hole)) continue;
    if (validLangs && !validLangs.has(lang)) continue;

    if (!globalHoleMin.has(hole) || byte < globalHoleMin.get(hole)) {
      globalHoleMin.set(hole, byte);
    }

    const langKey = `${hole}::${lang}`;
    if (!globalLangStats.has(langKey)) {
      globalLangStats.set(langKey, { min_bytes: byte, logins: new Set() });
    }
    const langStat = globalLangStats.get(langKey);
    if (byte < langStat.min_bytes) {
      langStat.min_bytes = byte;
    }
    langStat.logins.add(loginLower);

    const userLangKey = `${hole}::${lang}::${loginLower}`;
    if (!userBestSubmissions.has(userLangKey) || byte < userBestSubmissions.get(userLangKey)) {
      userBestSubmissions.set(userLangKey, byte);
    }
  }

  const allLangsSet = new Set();
  for (const langKey of globalLangStats.keys()) {
    allLangsSet.add(langKey.split("::")[1]);
  }
  const totalLangsCount = validLangs ? validLangs.size : (allLangsSet.size || 1);

  const holeLangUsers = new Map();
  for (const [userLangKey, byte] of userBestSubmissions.entries()) {
    const parts = userLangKey.split("::");
    const key = `${parts[0]}::${parts[1]}`;
    const loginLower = parts[2];

    if (!holeLangUsers.has(key)) holeLangUsers.set(key, []);
    holeLangUsers.get(key).push({ login: loginLower, byte });
  }

  const diamondCounts = new Map();
  for (const users of holeLangUsers.values()) {
    users.sort((a, b) => a.byte - b.byte);
    if (users.length === 0) continue;

    const minByte = users[0].byte;
    const tiedForFirst = users.filter(u => u.byte === minByte).length;

    if (tiedForFirst === 1) {
      const winner = users[0].login;
      diamondCounts.set(winner, (diamondCounts.get(winner) || 0) + 1);
    }
  }

  const allHoles = Array.from(globalHoleMin.keys());
  const totalHolesCount = allHoles.length;
  const leaderboard = [];
  
  const isFlat1000 = minScore >= 1000;
  const offset2 = isFlat1000 ? 0 : minScore / (1000 - minScore);
  const offset1 = isFlat1000 ? 0 : offset2 - 1;

  for (const [targetLower, userInfo] of targetMap.entries()) {
    let totalBytes = 0;
    let holesSolved = 0;
    const userScores = [];
    const userHoleLangScoresList = [];

    for (const hole of allHoles) {
      const holeByteMin = globalHoleMin.get(hole);
      let bestHoleByte = Infinity;
      const userHoleLangScores = [];

      for (const [langKey, langStat] of globalLangStats.entries()) {
        if (!langKey.startsWith(`${hole}::`)) continue;
        const lang = langKey.split("::")[1];
        const userLangKey = `${hole}::${lang}::${targetLower}`;

        if (userBestSubmissions.has(userLangKey)) {
          const loginByte = userBestSubmissions.get(userLangKey);
          const solCount = langStat.logins.size;
          const langByteMin = langStat.min_bytes;
          const sqrtN = Math.sqrt(solCount);
          
          let sb;
          if (isFlat1000) {
            sb = langByteMin;
          } else {
            sb = ((sqrtN + offset1) / (sqrtN + offset2)) * langByteMin + (1.0 / (sqrtN + offset2)) * holeByteMin;
          }
          
          const point = (sb / loginByte) * 1000.0;
          userHoleLangScores.push(point);

          if (loginByte < bestHoleByte) {
            bestHoleByte = loginByte;
          }
        }
      }

      userHoleLangScoresList.push(userHoleLangScores);

      let holePoint = 0;
      if (userHoleLangScores.length > 0) {
        if (lambdaExponent >= 1000) {
          holePoint = Math.max(...userHoleLangScores, 0);
        } else {
          holePoint = calculateLangPowerMean(userHoleLangScores, totalLangsCount, lambdaExponent);
        }
      }

      const roundedPoint = holePoint > 0 ? Math.round(holePoint) : 0;
      userScores.push(roundedPoint);

      if (roundedPoint > 0) {
        totalBytes += bestHoleByte;
        holesSolved++;
      }
    }

    const basePoints = Math.round(calculateHolePowerMean(userScores, totalHolesCount, chiExponent));
    const diamonds = diamondCounts.get(targetLower) || 0;

    leaderboard.push({
      name: userInfo.displayName,
      initialRank: userInfo.initialRank,
      holes: holesSolved,
      diamonds: diamonds,
      diamondContrib: 0,
      basePoints: basePoints,
      points: basePoints,
      bytes: totalBytes,
      userHoleLangScoresList: userHoleLangScoresList,
      totalLangsCount: totalLangsCount,
      totalHolesCount: totalHolesCount
    });
  }

  return leaderboard;
}

function updateLeaderboardScoresAndRanks() {
  if (!lastLeaderboardResults || lastLeaderboardResults.length === 0) return;

  const chiExponent = parseFloat(document.getElementById('lbChiValue')?.textContent || '1');
  const lambdaExponent = parseFloat(document.getElementById('lbLambdaSlider')?.value || '1000');
  const diamondBonusVal = parseFloat(document.getElementById('lbDiamondValue')?.textContent || '0');

  lastLeaderboardResults.forEach(row => {
    if (row.userHoleLangScoresList) {
      const userScores = row.userHoleLangScoresList.map(langScores => {
        if (!langScores || langScores.length === 0) return 0;
        let holePoint = 0;
        if (lambdaExponent >= 1000) {
          holePoint = Math.max(...langScores, 0);
        } else {
          holePoint = calculateLangPowerMean(langScores, row.totalLangsCount || 1, lambdaExponent);
        }
        return holePoint > 0 ? Math.round(holePoint) : 0;
      });

      row.basePoints = Math.round(calculateHolePowerMean(userScores, row.totalHolesCount || userScores.length, chiExponent));
    }

    row.diamondContrib = Math.round(row.diamonds * diamondBonusVal);
    row.points = Math.round(row.basePoints + row.diamondContrib);
  });

  const tempSorted = [...lastLeaderboardResults].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    return a.bytes - b.bytes;
  });

  tempSorted.forEach((row, index) => {
    row.standardRank = index + 1;
    row.rankChange = row.initialRank - row.standardRank;
  });
}

function sortLeaderboardData(results, sortField = 'points', sortDir = 'desc') {
  return [...results].sort((a, b) => {
    let valA, valB;
    if (sortField === 'rank') { valA = a.standardRank; valB = b.standardRank; }
    else if (sortField === 'name') {
      return sortDir === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
    }
    else if (sortField === 'holes') { valA = a.holes; valB = b.holes; }
    else if (sortField === 'diamonds') { valA = a.diamondContrib; valB = b.diamondContrib; }
    else if (sortField === 'points') { valA = a.points; valB = b.points; }
    else if (sortField === 'bytes') { valA = a.bytes; valB = b.bytes; }
    else if (sortField === 'change') { valA = a.rankChange; valB = b.rankChange; }
    else { valA = a.points; valB = b.points; }

    if (valA !== valB) return sortDir === 'desc' ? valB - valA : valA - valB;
    if (b.points !== a.points) return b.points - a.points;
    return a.bytes - b.bytes;
  });
}

function renderLeaderboard(results) {
  const sortedResults = sortLeaderboardData(results, currentLbSortField, currentLbSortDir);

  const thead = document.querySelector('#lbResultsTable thead');
  if (thead) {
    const rankArrow = currentLbSortField === 'rank' ? (currentLbSortDir === 'asc' ? ' ▲' : ' ▼') : '';
    const nameArrow = currentLbSortField === 'name' ? (currentLbSortDir === 'asc' ? ' ▲' : ' ▼') : '';
    const holesArrow = currentLbSortField === 'holes' ? (currentLbSortDir === 'desc' ? ' ▼' : ' ▲') : '';
    const pointsArrow = currentLbSortField === 'points' ? (currentLbSortDir === 'desc' ? ' ▼' : ' ▲') : '';
    const diamondsArrow = currentLbSortField === 'diamonds' ? (currentLbSortDir === 'desc' ? ' ▼' : ' ▲') : '';
    const bytesArrow = currentLbSortField === 'bytes' ? (currentLbSortDir === 'asc' ? ' ▲' : ' ▼') : '';
    const changeArrow = currentLbSortField === 'change' ? (currentLbSortDir === 'desc' ? ' ▼' : ' ▲') : '';

    const thStyle = (f) => `cursor: pointer; user-select: none; color: ${currentLbSortField === f ? '#38bdf8' : 'inherit'};`;

    thead.innerHTML = `
      <tr>
        <th id="thLbRank" style="${thStyle('rank')}">#${rankArrow}</th>
        <th id="thLbName" style="${thStyle('name')}">Name${nameArrow}</th>
        <th id="thLbHoles" style="${thStyle('holes')}">Holes${holesArrow}</th>
        <th id="thLbPoints" style="text-align: right; ${thStyle('points')}">Points${pointsArrow}</th>
        <th id="thLbDiamonds" style="text-align: right; ${thStyle('diamonds')}">💎${diamondsArrow}</th>
        <th id="thLbBytes" style="text-align: right; ${thStyle('bytes')}">Bytes${bytesArrow}</th>
        <th id="thLbChange" style="text-align: right; ${thStyle('change')}">+/-${changeArrow}</th>
      </tr>
    `;

    const bindLbSort = (id, fieldName, defaultDir = 'desc') => {
      const el = document.getElementById(id);
      el?.addEventListener('click', () => {
        if (currentLbSortField === fieldName) {
          currentLbSortDir = currentLbSortDir === 'desc' ? 'asc' : 'desc';
        } else {
          currentLbSortField = fieldName;
          currentLbSortDir = defaultDir;
        }
        renderLeaderboard(lastLeaderboardResults);
      });
    };

    bindLbSort('thLbRank', 'rank', 'asc');
    bindLbSort('thLbName', 'name', 'asc');
    bindLbSort('thLbHoles', 'holes', 'desc');
    bindLbSort('thLbPoints', 'points', 'desc');
    bindLbSort('thLbDiamonds', 'diamonds', 'desc');
    bindLbSort('thLbBytes', 'bytes', 'asc');
    bindLbSort('thLbChange', 'change', 'desc');
  }

  const tbody = document.getElementById('lbResultsBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  sortedResults.forEach((row) => {
    const tr = document.createElement('tr');
    const changeVal = row.rankChange;
    const changeSign = changeVal > 0 ? `+${changeVal}` : `${changeVal}`;
    const diffClass = changeVal > 0 ? 'diff-pos' : changeVal < 0 ? 'diff-neg' : 'diff-zero';

    tr.innerHTML = `
      <td><strong>${row.standardRank}</strong></td>
      <td><strong>${getGolferLink(row.name)}</strong></td>
      <td>${row.holes.toLocaleString()}</td>
      <td style="text-align: right;"><strong>${row.points.toLocaleString()}</strong></td>
      <td style="text-align: right;">${row.diamondContrib.toLocaleString()}</td>
      <td style="text-align: right;">${row.bytes.toLocaleString()}</td>
      <td style="text-align: right;" class="${diffClass}"><strong>${changeSign}</strong></td>
    `;
    tbody.appendChild(tr);
  });

  document.getElementById('lbResultsCard')?.classList.remove('hidden');
}

// Export Leaderboard Markdown
document.getElementById('exportLbTxtBtn')?.addEventListener('click', () => {
  if (!lastLeaderboardResults || lastLeaderboardResults.length === 0) {
    alert("No leaderboard data to export!");
    return;
  }

  const mdContent = generateLeaderboardMarkdownTable(lastLeaderboardResults, currentLbSortField, currentLbSortDir);
  downloadMarkdownFile('leaderboard.md', mdContent);
});

function generateLeaderboardMarkdownTable(results, sortField = 'points', sortDir = 'desc') {
  const sortedResults = sortLeaderboardData(results, sortField, sortDir);
  const headers = ['#', 'golfer', 'holes', 'points', '💎', 'bytes', '+/-'];
  const rightAlignCols = [0, 2, 3, 4, 5, 6];
  
  const tableRows = sortedResults.map((row) => [
    String(row.standardRank),
    row.name,
    row.holes.toLocaleString(),
    row.points.toLocaleString(),
    row.diamondContrib.toLocaleString(),
    row.bytes.toLocaleString(),
    row.rankChange > 0 ? `+${row.rankChange}` : String(row.rankChange)
  ]);

  const colWidths = headers.map((header, colIdx) => {
    let maxW = getVisualWidth(header);
    tableRows.forEach(r => {
      const w = getVisualWidth(r[colIdx]);
      if (w > maxW) maxW = w;
    });
    return Math.max(maxW, 4);
  });

  const formatRow = (rowCells) => {
    const formattedCells = rowCells.map((cell, idx) => {
      const width = colWidths[idx];
      return rightAlignCols.includes(idx)
        ? padVisualStart(cell, width)
        : padVisualEnd(cell, width);
    });
    return `| ${formattedCells.join(' | ')} |`;
  };

  const headerLine = formatRow(headers);
  const separatorCells = colWidths.map((w, idx) => {
    const isRight = rightAlignCols.includes(idx);
    return isRight ? '-'.repeat(Math.max(1, w - 1)) + ':' : ':' + '-'.repeat(Math.max(1, w - 1));
  });
  const separatorLine = `| ${separatorCells.join(' | ')} |`;
  const dataLines = tableRows.map(r => formatRow(r));

  return [headerLine, separatorLine, ...dataLines].join('\n');
}

// ==========================================
// PAGE 3: Solutions Query Logic (Bytes Only)
// ==========================================
document.getElementById('queryGoBtn')?.addEventListener('click', async () => {
  const queryType = document.getElementById('queryTypeSelect')?.value || 'longest_golds';

  const subFileInput = document.getElementById('submissionsFile');
  const holesFileInput = document.getElementById('holesFile');
  const langsFileInput = document.getElementById('langsFile');
  const includeExperimental = document.getElementById('experimentalCheck')?.checked ?? false;

  showLoading();
  await new Promise(r => setTimeout(r, 50));

  try {
    const submissionsData = await getSubmissionsData(subFileInput);

    if (!submissionsData) {
      hideLoading();
      handleSolutionsDownload();
      return;
    }

    const [holesData, langsData] = await Promise.all([
      getOrFetchJson(holesFileInput, 'https://code.golf/api/holes', 'holes.json'),
      getOrFetchJson(langsFileInput, 'https://code.golf/api/langs', 'langs.json')
    ]);

    lastQueryResults = processQueryData(
      submissionsData,
      holesData,
      langsData,
      includeExperimental,
      queryType
    );

    currentQuerySortField = 'bytes';
    currentQuerySortDir = 'desc';

    const titleEl = document.getElementById('queryResultsTitle');
    if (titleEl) {
      const typeNames = {
        'longest_golds': 'Longest Bytes Golds',
        'longest_diamonds': 'Longest Bytes Diamonds',
        'longest_unicorns': 'Longest Bytes Unicorns'
      };
      titleEl.textContent = `${typeNames[queryType] || 'Query Results'} (${lastQueryResults.length.toLocaleString()})`;
    }

    renderQueryResults(lastQueryResults);
  } catch (err) {
    alert(err.message);
  } finally {
    hideLoading();
  }
});

/**
 * Processes solutions for BYTES scoring only.
 * - Gold: shortest solution in a lang/combo pair
 * - Diamond: uncontested gold (only 1 golfer at shortest solution length)
 * - Unicorn: diamond where that solution is the only solution in a lang/combo pair
 */
function processQueryData(jsonData, holesJson, langsJson, includeExperimental, queryType) {
  let validHoles = null;
  if (holesJson && Array.isArray(holesJson)) {
    validHoles = new Set(
      holesJson
        .filter(h => includeExperimental || h.experiment === null || h.experiment === undefined)
        .map(h => h.id)
    );
  }

  let validLangs = null;
  if (langsJson && Array.isArray(langsJson)) {
    validLangs = new Set(
      langsJson
        .filter(l => includeExperimental || l.experiment === null || l.experiment === undefined)
        .map(l => l.id)
    );
  }

  // Aggregate user solutions per hole::lang pair (Bytes only)
  const comboMap = new Map();

  for (const x of jsonData) {
    if (x.scoring !== "bytes") continue;

    const lang = x.lang;
    const hole = x.hole;
    const login = x.login;
    const byte = Number(x.bytes);

    if (validHoles && !validHoles.has(hole)) continue;
    if (validLangs && !validLangs.has(lang)) continue;

    const key = `${hole}::${lang}`;
    if (!comboMap.has(key)) {
      comboMap.set(key, new Map());
    }
    const userMap = comboMap.get(key);
    if (!userMap.has(login) || byte < userMap.get(login)) {
      userMap.set(login, byte);
    }
  }

  const results = [];

  for (const [key, userMap] of comboMap.entries()) {
    const parts = key.split("::");
    const hole = parts[0];
    const lang = parts[1];

    const solvers = Array.from(userMap.entries()).map(([login, byte]) => ({ login, byte }));
    if (solvers.length === 0) continue;

    const totalSolvers = solvers.length;
    let minBytes = Infinity;
    for (const s of solvers) {
      if (s.byte < minBytes) minBytes = s.byte;
    }

    const minSolvers = solvers.filter(s => s.byte === minBytes);
    const tiedCount = minSolvers.length;

    const isDiamond = tiedCount === 1;
    const isUnicorn = isDiamond && totalSolvers === 1;

    minSolvers.forEach(solver => {
      let matchesQuery = false;
      let medalType = "🥇 Gold";

      if (isUnicorn) {
        medalType = "🦄 Unicorn";
      } else if (isDiamond) {
        medalType = "💎 Diamond";
      }

      if (queryType === "longest_unicorns") {
        if (isUnicorn) matchesQuery = true;
      } else if (queryType === "longest_diamonds") {
        if (isDiamond) matchesQuery = true;
      } else if (queryType === "longest_golds") {
        matchesQuery = true; // All minSolvers are golds
      }

      if (matchesQuery) {
        results.push({
          hole,
          lang,
          login: solver.login,
          bytes: solver.byte,
          totalSolvers,
          tiedCount,
          isUnicorn,
          isDiamond,
          medalType
        });
      }
    });
  }

  return results;
}

function sortQueryData(results, sortField = 'bytes', sortDir = 'desc') {
  return [...results].sort((a, b) => {
    let valA, valB;
    if (sortField === 'bytes') { valA = a.bytes; valB = b.bytes; }
    else if (sortField === 'hole') { return sortDir === 'asc' ? a.hole.localeCompare(b.hole) : b.hole.localeCompare(a.hole); }
    else if (sortField === 'lang') { return sortDir === 'asc' ? a.lang.localeCompare(b.lang) : b.lang.localeCompare(a.lang); }
    else if (sortField === 'login') { return sortDir === 'asc' ? a.login.localeCompare(b.login) : b.login.localeCompare(a.login); }
    else if (sortField === 'type') { return sortDir === 'asc' ? a.medalType.localeCompare(b.medalType) : b.medalType.localeCompare(a.medalType); }
    else { valA = a.bytes; valB = b.bytes; }

    if (valA !== valB) return sortDir === 'desc' ? valB - valA : valA - valB;
    return a.hole.localeCompare(b.hole) || a.lang.localeCompare(b.lang) || a.login.localeCompare(b.login);
  });
}

function renderQueryResults(results) {
  const filterText = (document.getElementById('queryTableSearch')?.value || '').toLowerCase();
  let filtered = results;
  if (filterText) {
    filtered = results.filter(r =>
      r.hole.toLowerCase().includes(filterText) ||
      r.lang.toLowerCase().includes(filterText) ||
      r.login.toLowerCase().includes(filterText)
    );
  }

  const sortedResults = sortQueryData(filtered, currentQuerySortField, currentQuerySortDir);
  
  // --- CAP TO TOP 500 TO PREVENT DOM LAG ---
  const displayResults = sortedResults.slice(0, 500);

  const thead = document.querySelector('#queryResultsTable thead');
  if (thead) {
    const thStyle = (f) => `cursor: pointer; user-select: none; color: ${currentQuerySortField === f ? '#38bdf8' : 'inherit'};`;
    const holeArrow = currentQuerySortField === 'hole' ? (currentQuerySortDir === 'asc' ? ' ▲' : ' ▼') : '';
    const langArrow = currentQuerySortField === 'lang' ? (currentQuerySortDir === 'asc' ? ' ▲' : ' ▼') : '';
    const loginArrow = currentQuerySortField === 'login' ? (currentQuerySortDir === 'asc' ? ' ▲' : ' ▼') : '';
    const bytesArrow = currentQuerySortField === 'bytes' ? (currentQuerySortDir === 'desc' ? ' ▼' : ' ▲') : '';
    const typeArrow = currentQuerySortField === 'type' ? (currentQuerySortDir === 'asc' ? ' ▲' : ' ▼') : '';

    thead.innerHTML = `
      <tr>
        <th>#</th>
        <th id="thQueryHole" style="${thStyle('hole')}">Hole${holeArrow}</th>
        <th id="thQueryLang" style="${thStyle('lang')}">Language${langArrow}</th>
        <th id="thQueryLogin" style="${thStyle('login')}">Golfer${loginArrow}</th>
        <th id="thQueryBytes" style="text-align: right; ${thStyle('bytes')}">Bytes${bytesArrow}</th>
        <th id="thQueryType" style="text-align: right; ${thStyle('type')}">Type${typeArrow}</th>
      </tr>
    `;

    const bindQuerySort = (id, fieldName, defaultDir = 'desc') => {
      const el = document.getElementById(id);
      el?.addEventListener('click', () => {
        if (currentQuerySortField === fieldName) {
          currentQuerySortDir = currentQuerySortDir === 'desc' ? 'asc' : 'desc';
        } else {
          currentQuerySortField = fieldName;
          currentQuerySortDir = defaultDir;
        }
        renderQueryResults(lastQueryResults);
      });
    };

    bindQuerySort('thQueryHole', 'hole', 'asc');
    bindQuerySort('thQueryLang', 'lang', 'asc');
    bindQuerySort('thQueryLogin', 'login', 'asc');
    bindQuerySort('thQueryBytes', 'bytes', 'desc');
    bindQuerySort('thQueryType', 'type', 'asc');
  }

  const tbody = document.getElementById('queryResultsBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  // Render only the top 500 capped items
  displayResults.forEach((row, index) => {
    const tr = document.createElement('tr');
    const holeUrl = `https://code.golf/${encodeURIComponent(row.hole)}`;
    const langUrl = `https://code.golf/${encodeURIComponent(row.hole)}#${encodeURIComponent(row.lang)}`;

    tr.innerHTML = `
      <td>${index + 1}</td>
      <td><a href="${holeUrl}" target="_blank" rel="noopener noreferrer" class="golf-link"><strong>${escapeHtml(row.hole)}</strong></a></td>
      <td><a href="${langUrl}" target="_blank" rel="noopener noreferrer" class="golf-link-clean" style="color: #4da6ff; font-weight: bold;">${escapeHtml(row.lang)}</a></td>
      <td>${getGolferLink(row.login)}</td>
      <td style="text-align: right;"><strong>${row.bytes.toLocaleString()}</strong></td>
      <td style="text-align: right;">${row.medalType}</td>
    `;
    tbody.appendChild(tr);
  });

  document.getElementById('queryResultsCard')?.classList.remove('hidden');
}

document.getElementById('queryTableSearch')?.addEventListener('input', () => {
  if (lastQueryResults && lastQueryResults.length > 0) {
    renderQueryResults(lastQueryResults);
  }
});

document.getElementById('exportQueryTxtBtn')?.addEventListener('click', () => {
  if (!lastQueryResults || lastQueryResults.length === 0) {
    alert("No query data to export!");
    return;
  }

  const filterText = (document.getElementById('queryTableSearch')?.value || '').toLowerCase();
  let filtered = lastQueryResults;
  if (filterText) {
    filtered = lastQueryResults.filter(r =>
      r.hole.toLowerCase().includes(filterText) ||
      r.lang.toLowerCase().includes(filterText) ||
      r.login.toLowerCase().includes(filterText)
    );
  }

  const sorted = sortQueryData(filtered, currentQuerySortField, currentQuerySortDir);
  const queryTypeSel = document.getElementById('queryTypeSelect')?.value || 'query';
  const mdContent = generateQueryMarkdownTable(sorted);
  downloadMarkdownFile(`${queryTypeSel}_results.md`, mdContent);
});

function generateQueryMarkdownTable(results) {
  const headers = ['#', 'hole', 'language', 'golfer', 'bytes', 'type'];
  const rightAlignCols = [0, 4, 5];

  const tableRows = results.map((row, idx) => [
    String(idx + 1),
    row.hole,
    row.lang,
    row.login,
    row.bytes.toLocaleString(),
    row.medalType
  ]);

  const colWidths = headers.map((header, colIdx) => {
    let maxW = getVisualWidth(header);
    tableRows.forEach(r => {
      const w = getVisualWidth(r[colIdx]);
      if (w > maxW) maxW = w;
    });
    return Math.max(maxW, 4);
  });

  const formatRow = (rowCells) => {
    const formattedCells = rowCells.map((cell, idx) => {
      const width = colWidths[idx];
      return rightAlignCols.includes(idx)
        ? padVisualStart(cell, width)
        : padVisualEnd(cell, width);
    });
    return `| ${formattedCells.join(' | ')} |`;
  };

  const headerLine = formatRow(headers);
  const separatorCells = colWidths.map((w, idx) => {
    const isRight = rightAlignCols.includes(idx);
    return isRight ? '-'.repeat(Math.max(1, w - 1)) + ':' : ':' + '-'.repeat(Math.max(1, w - 1));
  });
  const separatorLine = `| ${separatorCells.join(' | ')} |`;
  const dataLines = tableRows.map(r => formatRow(r));

  return [headerLine, separatorLine, ...dataLines].join('\n');
}

// --- Universal Numeric Control Setup (Sliders + Prompts) ---
function setupSliderControl(valueElId, sliderElId, minVal = 0, maxVal = 1000, autoUpdate = true, isInfinityMax = false) {
  const valueEl = document.getElementById(valueElId);
  const sliderEl = document.getElementById(sliderElId);

  if (!valueEl || !sliderEl) return;

  const formatVal = (val) => {
    const num = parseFloat(val);
    if (isInfinityMax && num >= maxVal) return '∞';
    return num;
  };

  const handleUpdate = () => {
    if (!autoUpdate) return;

    if (leaderboardPage && !leaderboardPage.classList.contains('hidden')) {
      if (lastLeaderboardResults && lastLeaderboardResults.length > 0) {
        updateLeaderboardScoresAndRanks();
        renderLeaderboard(lastLeaderboardResults);
      }
    } else {
      if (lastCompareResults) {
        updateCompareScores();
        renderCompareResults(lastCompareResults);
      }
    }
  };

  sliderEl.addEventListener('input', (e) => {
    valueEl.textContent = formatVal(e.target.value);
    handleUpdate();
  });

  const clickTarget = valueEl.closest('label') || valueEl.parentElement || valueEl;

  clickTarget.addEventListener('click', (e) => {
    if (e.target === sliderEl) return;
    const currentVal = sliderEl.value;
    const input = prompt(`Enter manual value (${minVal} to ${maxVal}):`, currentVal);

    if (input !== null) {
      const num = parseFloat(input);
      if (!isNaN(num) && num >= minVal && num <= maxVal) {
        sliderEl.value = num;
        valueEl.textContent = formatVal(num);
        handleUpdate();
      } else {
        alert(`Please enter a valid number between ${minVal} and ${maxVal}.`);
      }
    }
  });
}

// Initialize controls
setupSliderControl('chiValue', 'chiSlider', 1, 30, true);
setupSliderControl('lambdaValue', 'lambdaSlider', 1, 1000, true, true);
setupSliderControl('diamondValue', 'diamondSlider', 0, 30, true);
setupSliderControl('formulaValue', 'formulaSlider', 1, 1000, false);

setupSliderControl('lbChiValue', 'lbChiSlider', 1, 30, true);
setupSliderControl('lbLambdaValue', 'lbLambdaSlider', 1, 1000, true, true);
setupSliderControl('lbDiamondValue', 'lbDiamondSlider', 0, 30, true);
setupSliderControl('lbFormulaValue', 'lbFormulaSlider', 1, 1000, false);