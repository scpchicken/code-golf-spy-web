/**
 * Code Golf Comparison & Custom Leaderboard Script
 */

// --- Global Constants & State ---
const DEFAULT_GOLFERS_LIST = "zzh1996, Steffan153, codereport, ovs-code, pardouin, sean-niemann, rucin93, emplv, edsrzf, scpchicken, blaztoma, MeWhenI, Seek64, kg583, emgordon154, stefangimmillaro, lyphyser, saito-ta, SirBogman, snoozingnewt, lynn, nwellnhof, CaedenHarper, KasperKivimaeki, vang1ong7ang, 5cw, canissimia, sisyphus-gpt, duckyluuk, GrayJoKing, hallvabo, Natanaelel, GolfingSuccess, bitsandbeyond, bizy-coder, CornerMercury, ryyyn, AlephSquirrel, AdrienHache, antimon2, DialFrost, plcc0, jared-hughes, JayXon, Shanethegamer, namelessiw, bricknellj, sisyphus-ppcg, KatieLG, albanian-laundromat, JOrE20, primo-ppcg, anter69, rkg-huwdu, m-tkach, oaiqjuy, btnlq, ndren, annaproxy, aksyristos, inventshah, Yax42, Flekay, dokutan, 2bular, IanUtley, acotis, lukegustafson, vlpx, RainVniaR, Kacarott, Lydxn, CLOStrophobic, StefanHabel, error256, lifthrasiir, BREMAUCY, targrik, commandz0, voytxt, FortuiteMan, madex, retrohun, xsot, tomtheisen, HPWiz, qpwoeirut, UnderKoen, prestosilver, helbling, ahmetdemirag, Yewzir, LostSyntax21, dmrichwa, prplz, iczelia, CatsAreFluffy, InigoK, kumavale, ZakkkkAttackkkk";

let lastCompareResults = null;
let lastLeaderboardResults = [];

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

async function getOrFetchJson(fileInput, fetchUrl, fileName) {
  if (fileInput && fileInput.files && fileInput.files[0]) {
    return await readJsonFile(fileInput.files[0]);
  }
  try {
    const resp = await fetch(fetchUrl);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return await resp.json();
  } catch (err) {
    console.warn(`Could not auto-fetch ${fileName} from ${fetchUrl}. Falling back to default behavior.`);
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
  if (a.loginByte !== undefined && b.loginByte !== undefined && a.loginByte !== b.loginByte) {
    return a.loginByte - b.loginByte;
  }
  return (b.point || 0) - (a.point || 0);
}

function formatLangDisplay(hole, lang, medal, golferName, allMedals = []) {
  if (!lang || lang === "N/A" || lang === "-") return "-";
  const langUrl = `https://code.golf/${encodeURIComponent(hole)}#${encodeURIComponent(lang)}`;
  const medalHtml = medal ? ` <span class="medal">${medal}</span>` : '';
  
  let extraHtml = '';
  if (allMedals && allMedals.length > 1) {
    const medalsJson = escapeHtml(JSON.stringify(allMedals));
    extraHtml = ` <button type="button" class="extra-medals-btn" data-hole="${escapeHtml(hole)}" data-golfer="${escapeHtml(golferName)}" data-medals="${medalsJson}" style="background: none; border: none; color: #4da6ff; cursor: pointer; padding: 0 2px; font-weight: bold; text-decoration: underline;">(${allMedals.length})</button>`;
  }

  return `<a href="${langUrl}" target="_blank" rel="noopener noreferrer" class="golf-link-clean">${escapeHtml(lang)}</a>${medalHtml}${extraHtml}`;
}

function formatScoreDisplay(hole, lang, point, mode) {
  if (!point || point <= 0 || !lang || lang === "N/A" || lang === "-") {
    return `<strong>${(point || 0).toLocaleString()}</strong>`;
  }
  const scoreUrl = `https://code.golf/rankings/holes/${encodeURIComponent(hole)}/${encodeURIComponent(lang)}/${mode}`;
  return `<a href="${scoreUrl}" target="_blank" rel="noopener noreferrer" class="golf-link-clean"><strong>${point.toLocaleString()}</strong></a>`;
}

// --- Modals ---
// Solutions Modal
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

// Extra Medals Popup Modal
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
        <a href="${langUrl}" target="_blank" rel="noopener noreferrer" class="golf-link-clean" style="font-weight: bold; color: #4da6ff;">${escapeHtml(m.lang)}</a>
        <span style="font-size: 1.1em; margin-left: 12px;">${m.medal}${ptDisplay}</span>
      </div>
    `;
  }).join('');

  modal.innerHTML = `
    <div style="background: var(--card-bg, #1e293b); color: #fff; padding: 20px 24px; border-radius: 8px; min-width: 280px; max-width: 420px; box-shadow: 0 4px 20px rgba(0,0,0,0.5); border: 1px solid var(--border, #334155);">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,0.2); padding-bottom: 8px;">
        <strong style="font-size: 1.1em; color: var(--accent, #38bdf8);">${escapeHtml(hole)} (${escapeHtml(golfer)})</strong>
        <button id="closeExtraMedalsBtn" style="background: none; border: none; color: #aaa; font-size: 1.4em; cursor: pointer; line-height: 1;">&times;</button>
      </div>
      <div style="max-height: 300px; overflow-y: auto;">
        ${rowsHtml}
      </div>
    </div>
  `;

  modal.classList.remove('hidden');

  const closeBtn = modal.querySelector('#closeExtraMedalsBtn');
  closeBtn?.addEventListener('click', () => modal.classList.add('hidden'));

  modal.onclick = (e) => {
    if (e.target === modal) modal.classList.add('hidden');
  };
}

// Diff Breakdown Popup Modal
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

  // Default sorting: User 2 (descending)
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

      let valA = 0;
      let valB = 0;

      if (currentSortField === 'u1') {
        valA = u1PtsA; valB = u1PtsB;
      } else if (currentSortField === 'u2') {
        valA = u2PtsA; valB = u2PtsB;
      } else if (currentSortField === 'diff') {
        valA = diffA; valB = diffB;
      } else if (currentSortField === 'diffBest') {
        valA = diffBestA; valB = diffBestB;
      }

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

      const u1Str = item1 ? `${u1Pts.toLocaleString()}${item1.medal ? ' ' + item1.medal : ''}` : '-';
      let u2Str = item2 ? `${u2Pts.toLocaleString()}${item2.medal ? ' ' + item2.medal : ''}` : '-';

      // Highlight User 2 in yellow if higher than User 1's best score (Kept in diff modal)
      const isU2GreaterThanU1Best = item2 && u2Pts > u1Point;
      if (isU2GreaterThanU1Best) {
        u2Str = `<span style="color: #facc15; font-weight: bold;">${u2Str}</span>`;
      }

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
          <td style="padding: 8px 12px; text-align: right;">${u1Str}</td>
          <td style="padding: 8px 12px; text-align: right;">${u2Str}</td>
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
            <h3 style="margin: 0; color: var(--accent, #38bdf8); font-size: 1.2em;">${escapeHtml(hole)}</h3>
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
                <th id="thSortU1" style="padding: 6px 12px; text-align: right; cursor: pointer; user-select: none; color: ${currentSortField === 'u1' ? '#38bdf8' : 'inherit'};" title="Click to sort by ${escapeHtml(u1Name)} score">
                  ${escapeHtml(u1Name)}${u1Arrow}
                </th>
                <th id="thSortU2" style="padding: 6px 12px; text-align: right; cursor: pointer; user-select: none; color: ${currentSortField === 'u2' ? '#38bdf8' : 'inherit'};" title="Click to sort by ${escapeHtml(u2Name)} score">
                  ${escapeHtml(u2Name)}${u2Arrow}
                </th>
                <th id="thSortDiff" style="padding: 6px 12px; text-align: right; cursor: pointer; user-select: none; color: ${currentSortField === 'diff' ? '#38bdf8' : 'inherit'};" title="Click to sort by Diff">
                  Diff${diffArrow}
                </th>
                <th id="thSortDiffBest" style="padding: 6px 12px; text-align: right; cursor: pointer; user-select: none; color: ${currentSortField === 'diffBest' ? '#38bdf8' : 'inherit'};" title="Click to sort by Diff from Best">
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

    // Rebind Modal Events
    const closeBtn = modal.querySelector('#closeDiffModalBtn');
    closeBtn?.addEventListener('click', () => modal.classList.add('hidden'));

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

  modal.onclick = (e) => {
    if (e.target === modal) modal.classList.add('hidden');
  };
}

// --- Event Delegation for Results Table ---
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

// --- Tab Navigation Switcher ---
const navCompareBtn = document.getElementById('navCompareBtn');
const navLeaderboardBtn = document.getElementById('navLeaderboardBtn');
const comparePage = document.getElementById('comparePage');
const leaderboardPage = document.getElementById('leaderboardPage');

navCompareBtn?.addEventListener('click', () => {
  navCompareBtn.classList.add('active');
  navLeaderboardBtn.classList.remove('active');
  comparePage.classList.remove('hidden');
  leaderboardPage.classList.add('hidden');
});

navLeaderboardBtn?.addEventListener('click', () => {
  navLeaderboardBtn.classList.add('active');
  navCompareBtn.classList.remove('active');
  leaderboardPage.classList.remove('hidden');
  comparePage.classList.add('hidden');
});

// Keyboard Shortcuts (Ctrl+Enter / Cmd+Enter)
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    if (leaderboardPage && !leaderboardPage.classList.contains('hidden')) {
      document.getElementById('lbGoBtn')?.click();
    } else if (comparePage && !comparePage.classList.contains('hidden')) {
      document.getElementById('goBtn')?.click();
    }
  }
});

// Default Golfers List Click Handler
document.getElementById('leaderboardUsersLabel')?.addEventListener('click', (e) => {
  e.preventDefault();
  const input = document.getElementById('leaderboardUsersInput');
  if (input) {
    input.value = DEFAULT_GOLFERS_LIST;
    input.focus();
  }
});

// Download Help Buttons
document.getElementById('dlSolutionsBtn')?.addEventListener('click', handleSolutionsDownload);
document.getElementById('dlHolesBtn')?.addEventListener('click', () => window.open('https://code.golf/api/holes', '_blank'));
document.getElementById('dlLangsBtn')?.addEventListener('click', () => window.open('https://code.golf/api/langs', '_blank'));

// ==========================================
// PAGE 1: Golfer Comparison Logic
// ==========================================
document.getElementById('goBtn')?.addEventListener('click', async () => {
  const subFileInput = document.getElementById('submissionsFile')?.files?.[0];
  const u1Name = document.getElementById('user1Input')?.value.trim() || '';
  const u2Name = document.getElementById('user2Input')?.value.trim() || '';
  const scoringMode = getScoringMode();
  const formulaType = document.getElementById('compareScoringFormulaSelect')?.value || 'standard';
  const chiExponent = parseFloat(document.getElementById('chiValue')?.textContent || 1);
  const langFilter = (document.getElementById('langFilterInput')?.value || '').trim().toLowerCase();
  
  const activeSortEl = document.getElementById('activeSortSelect');

  // Auto-select U2 - U1 option (diff-asc) from dropdown when 2 golfers are present
  if (u2Name) {
    if (activeSortEl) activeSortEl.value = 'diff-asc';
  } else if (activeSortEl && activeSortEl.value.startsWith('diff')) {
    activeSortEl.value = 'u1-desc';
  }

  const sortOrder = activeSortEl ? activeSortEl.value : (u2Name ? 'diff-asc' : 'u1-desc');

  const holesFileInput = document.getElementById('holesFile');
  const langsFileInput = document.getElementById('langsFile');
  const includeExperimental = document.getElementById('experimentalCheck')?.checked ?? false;

  if (!subFileInput) {
    handleSolutionsDownload();
    return;
  }

  if (!u1Name) {
    alert("Please specify Username 1.");
    return;
  }

  showLoading();
  await new Promise(r => setTimeout(r, 50));

  try {
    const [submissionsData, holesData, langsData] = await Promise.all([
      readJsonFile(subFileInput),
      getOrFetchJson(holesFileInput, 'https://code.golf/api/holes', 'holes.json'),
      getOrFetchJson(langsFileInput, 'https://code.golf/api/langs', 'langs.json')
    ]);

    lastCompareResults = processCompareData({
      jsonData: submissionsData,
      u1Name,
      u2Name,
      scoringMode,
      formulaType,
      chiExponent,
      langFilter,
      holesJson: holesData,
      langsJson: langsData,
      includeExperimental
    });

    if (activeSortEl) {
      activeSortEl.value = sortOrder;
    }
    renderCompareResults(lastCompareResults, sortOrder);
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
  formulaType = 'standard', 
  chiExponent = 1, 
  langFilter, 
  holesJson, 
  langsJson, 
  includeExperimental 
}) {
  const u1Lower = u1Name.toLowerCase();
  const u2Lower = u2Name ? u2Name.toLowerCase() : null;
  const hasUser2 = Boolean(u2Lower);

  let offset1 = 2.0;
  let offset2 = 3.0;
  let isFlat1000 = false;

  if (formulaType === 'alt') {
    offset1 = 8.0;
    offset2 = 9.0;
  } else if (formulaType === 'min950') {
    offset1 = 18.0;
    offset2 = 19.0;
  } else if (formulaType === 'min999') {
    offset1 = 998.0;
    offset2 = 999.0;
  } else if (formulaType === 'min1000') {
    isFlat1000 = true;
  }

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

  // Calculate Medals (💎 Diamonds, 🥇 Golds, 🥈 Silvers, 🥉 Bronzes)
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
      if (place === 1) {
        medal = (tiedForFirst === 1) ? "💎" : "🥇";
      } else if (place === 2) {
        medal = "🥈";
      } else if (place === 3) {
        medal = "🥉";
      }

      medalsMap.set(`${key}::${current.login}`, medal);
    }
  }

  // Count total Golds and Diamonds
  let u1Golds = 0, u1Diamonds = 0;
  let u2Golds = 0, u2Diamonds = 0;

  for (const [userLangKey] of userBestSubmissions.entries()) {
    const parts = userLangKey.split("::");
    const loginLower = parts[2];
    const medal = medalsMap.get(userLangKey) || "";

    if (loginLower === u1Lower) {
      if (medal === "💎") {
        u1Diamonds++;
        u1Golds++;
      } else if (medal === "🥇") {
        u1Golds++;
      }
    } else if (hasUser2 && loginLower === u2Lower) {
      if (medal === "💎") {
        u2Diamonds++;
        u2Golds++;
      } else if (medal === "🥇") {
        u2Golds++;
      }
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
    const roundedPoint = Math.round(best.point);

    if (roundedPoint === 0) return { lang: "-", point: 0, medal: "", allMedals: [], medalsAscii: "-", allLangScores: [] };

    const allMedals = candidates
      .filter(c => c.medal !== "")
      .sort(compareMedalCandidates);

    let dCount = 0, gCount = 0, sCount = 0, bCount = 0;
    allMedals.forEach(m => {
      if (m.medal === '💎') {
        dCount++;
        gCount++;
      } else if (m.medal === '🥇') {
        gCount++;
      } else if (m.medal === '🥈') {
        sCount++;
      } else if (m.medal === '🥉') {
        bCount++;
      }
    });

    const asciiParts = [];
    if (dCount > 0) asciiParts.push(`${dCount}D`);
    if (gCount > 0) asciiParts.push(`${gCount}G`);
    if (sCount > 0) asciiParts.push(`${sCount}S`);
    if (bCount > 0) asciiParts.push(`${bCount}B`);
    const medalsAscii = asciiParts.join(' ') || '-';

    return {
      lang: best.lang,
      point: roundedPoint,
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

  const u1TotalScore = Math.round(calculateHolePowerMean(u1Scores, totalHolesCount, chiExponent));
  const u2TotalScore = hasUser2 ? Math.round(calculateHolePowerMean(u2Scores, totalHolesCount, chiExponent)) : 0;

  return {
    rows,
    u1Name,
    u1TotalScore,
    u1SolvedCount,
    u1Golds,
    u1Diamonds,
    u2Name,
    u2TotalScore,
    u2SolvedCount,
    u2Golds,
    u2Diamonds,
    hasUser2,
    scoringMode,
    chiExponent
  };
}

function renderCompareResults(data, sortOrder) {
  const { u1Name, u2Name, u1TotalScore, u1SolvedCount, u1Golds, u1Diamonds, u2TotalScore, u2SolvedCount, u2Golds, u2Diamonds, hasUser2, scoringMode } = data;
  const statsContainer = document.getElementById('statsContainer');
  const tableHead = document.getElementById('tableHead');

  const u1Link = getGolferLink(u1Name);
  const u2Link = getGolferLink(u2Name);
  const modeLabel = scoringMode === 'chars' ? 'Chars' : 'Bytes';

  if (hasUser2) {
    const diffTotal = u1TotalScore - u2TotalScore;
    const diffSign = diffTotal > 0 ? `+${diffTotal.toLocaleString()}` : diffTotal.toLocaleString();

    statsContainer.innerHTML = `
      <div class="stat-box">
        <div class="val">${u1TotalScore.toLocaleString()}</div>
        <div class="lbl">${u1Link} (${u1SolvedCount} solved • 🥇 ${u1Golds.toLocaleString()} / 💎 ${u1Diamonds.toLocaleString()})</div>
      </div>
      <div class="stat-box">
        <div class="val">${u2TotalScore.toLocaleString()}</div>
        <div class="lbl">${u2Link} (${u2SolvedCount} solved • 🥇 ${u2Golds.toLocaleString()} / 💎 ${u2Diamonds.toLocaleString()})</div>
      </div>
      <div class="stat-box">
        <div class="val ${diffTotal > 0 ? 'diff-pos' : diffTotal < 0 ? 'diff-neg' : 'diff-zero'}">${diffSign}</div>
        <div class="lbl">SCORE DIFF (${modeLabel})</div>
      </div>
    `;

    tableHead.innerHTML = `
      <tr>
        <th>Hole</th>
        <th>${u1Link} (Lang)</th>
        <th>${u1Link} (Score)</th>
        <th>${u2Link} (Lang)</th>
        <th>${u2Link} (Score)</th>
        <th>Diff</th>
      </tr>
    `;
  } else {
    statsContainer.innerHTML = `
      <div class="stat-box">
        <div class="val">${u1TotalScore.toLocaleString()}</div>
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

    tableHead.innerHTML = `
      <tr>
        <th>Hole</th>
        <th>Language</th>
        <th>Points</th>
      </tr>
    `;
  }

  sortAndRenderCompareTable(data.rows, sortOrder, hasUser2, scoringMode, u1Name, u2Name);
  document.getElementById('resultsCard')?.classList.remove('hidden');
}

function getSortedCompareRows(rows, sortOrder, filterText = '') {
  const sorted = [...rows].sort((a, b) => {
    if (sortOrder === 'u1-desc') return b.u1Point - a.u1Point || a.hole.localeCompare(b.hole);
    if (sortOrder === 'u2-desc') return b.u2Point - a.u2Point || a.hole.localeCompare(b.hole);
    if (sortOrder === 'diff-desc') return b.diff - a.diff || a.hole.localeCompare(b.hole);
    if (sortOrder === 'diff-asc') return a.diff - b.diff || a.hole.localeCompare(b.hole);
    if (sortOrder === 'alpha-asc') return a.hole.localeCompare(b.hole);
    if (sortOrder === 'alpha-desc') return b.hole.localeCompare(a.hole);
    return 0;
  });

  if (filterText) {
    return sorted.filter(r => r.hole.toLowerCase().includes(filterText));
  }
  return sorted;
}

function sortAndRenderCompareTable(rows, sortOrder, hasUser2, scoringMode, u1Name, u2Name) {
  const resultsBody = document.getElementById('resultsBody');
  const filterText = (document.getElementById('tableSearch')?.value || '').toLowerCase();
  const sorted = getSortedCompareRows(rows, sortOrder, filterText);

  resultsBody.innerHTML = '';
  sorted.forEach(r => {
    const tr = document.createElement('tr');
    const holeUrl = `https://code.golf/${encodeURIComponent(r.hole)}`;
    const holeDisplay = `<a href="${holeUrl}" target="_blank" rel="noopener noreferrer" class="golf-link"><strong>${escapeHtml(r.hole)}</strong></a>`;

    const u1LangDisplay = formatLangDisplay(r.hole, r.u1Lang, r.u1Medal, u1Name, r.u1AllMedals);
    const u1ScoreDisplay = formatScoreDisplay(r.hole, r.u1Lang, r.u1Point, scoringMode);

    if (hasUser2) {
      const u2LangDisplay = formatLangDisplay(r.hole, r.u2Lang, r.u2Medal, u2Name, r.u2AllMedals);
      const u2ScoreDisplay = formatScoreDisplay(r.hole, r.u2Lang, r.u2Point, scoringMode);

      const diffClass = r.diff > 0 ? 'diff-pos' : r.diff < 0 ? 'diff-neg' : 'diff-zero';
      const diffText = r.diff > 0 ? `+${r.diff.toLocaleString()}` : r.diff.toLocaleString();

      const u1LangsJson = escapeHtml(JSON.stringify(r.u1AllLangs || []));
      const u2LangsJson = escapeHtml(JSON.stringify(r.u2AllLangs || []));

      tr.innerHTML = `
        <td>${holeDisplay}</td>
        <td>${u1LangDisplay}</td>
        <td>${u1ScoreDisplay}</td>
        <td>${u2LangDisplay}</td>
        <td>${u2ScoreDisplay}</td>
        <td>
          <span class="diff-clickable ${diffClass}" 
            data-hole="${escapeHtml(r.hole)}"
            data-u1-point="${r.u1Point}"
            data-u2-point="${r.u2Point}"
            data-u1-langs="${u1LangsJson}"
            data-u2-langs="${u2LangsJson}"
            style="cursor: pointer; text-decoration: none;"
            title="Click to view language breakdown">
            ${diffText}
          </span>
        </td>
      `;
    } else {
      tr.innerHTML = `
        <td>${holeDisplay}</td>
        <td>${u1LangDisplay}</td>
        <td>${u1ScoreDisplay}</td>
      `;
    }
    resultsBody.appendChild(tr);
  });
}

// Compare Controls Listeners
document.getElementById('activeSortSelect')?.addEventListener('change', (e) => {
  if (lastCompareResults) {
    renderCompareResults(lastCompareResults, e.target.value);
  }
});

document.getElementById('tableSearch')?.addEventListener('input', () => {
  if (lastCompareResults) {
    const sortOrder = document.getElementById('activeSortSelect')?.value || 'u1-desc';
    renderCompareResults(lastCompareResults, sortOrder);
  }
});

document.getElementById('scoringSelect')?.addEventListener('change', () => {
  if (document.getElementById('submissionsFile')?.files[0]) {
    document.getElementById('goBtn')?.click();
  }
});

// JSON Export for Compare
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

// Markdown (.md) Export for Compare
document.getElementById('dlResultsTxtBtn')?.addEventListener('click', () => {
  if (!lastCompareResults) return;
  const sortOrder = document.getElementById('activeSortSelect')?.value || 'u1-desc';
  const filterText = (document.getElementById('tableSearch')?.value || '').toLowerCase();
  const mdContent = generateCompareMarkdownTable(lastCompareResults, sortOrder, filterText);
  downloadMarkdownFile('compare_results.md', mdContent);
});

function generateCompareMarkdownTable(compareData, sortOrder, filterText = '') {
  const { rows, u1Name, u2Name, hasUser2 } = compareData;
  const sortedRows = getSortedCompareRows(rows, sortOrder, filterText);

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
        r.hole,
        r.u1Lang,
        r.u1MedalsAscii,
        r.u1Point.toLocaleString(),
        r.u2Lang,
        r.u2MedalsAscii,
        r.u2Point.toLocaleString(),
        diffStr
      ];
    } else {
      return [
        r.hole,
        r.u1Lang,
        r.u1MedalsAscii,
        r.u1Point.toLocaleString()
      ];
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
  const formulaType = document.getElementById('scoringFormulaSelect')?.value || 'standard';
  const chiExponent = parseFloat(document.getElementById('lbChiValue')?.textContent || 1);
  
  const subFileInput = document.getElementById('submissionsFile')?.files?.[0];
  const holesFileInput = document.getElementById('holesFile');
  const langsFileInput = document.getElementById('langsFile');
  const includeExperimental = document.getElementById('experimentalCheck')?.checked ?? false;

  if (!inputVal) {
    alert("Please enter at least one username.");
    return;
  }

  if (!subFileInput) {
    handleSolutionsDownload();
    return;
  }

  showLoading();
  await new Promise(r => setTimeout(r, 50));

  try {
    const [submissionsData, holesData, langsData] = await Promise.all([
      readJsonFile(subFileInput),
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
      formulaType,
      chiExponent
    );

    const sortOrder = document.getElementById('lbSortSelect')?.value || 'points-desc';
    renderLeaderboard(lastLeaderboardResults, sortOrder);
  } catch (err) {
    alert(err.message);
  } finally {
    hideLoading();
  }
});

function processLeaderboardData(jsonData, targetUsers, holesJson, langsJson, includeExperimental, formulaType = 'standard', chiExponent = 1) {
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

  const allHoles = Array.from(globalHoleMin.keys());
  const totalHolesCount = allHoles.length;
  const leaderboard = [];
  
  let offset1 = 2.0;
  let offset2 = 3.0;
  let isFlat1000 = false;
  
  if (formulaType === 'alt') {
    offset1 = 8.0;
    offset2 = 9.0;
  } else if (formulaType === 'min950') {
    offset1 = 18.0;
    offset2 = 19.0;
  } else if (formulaType === 'min999') {
    offset1 = 998.0;
    offset2 = 999.0;
  } else if (formulaType === 'min1000') {
    isFlat1000 = true;
  }

  for (const [targetLower, userInfo] of targetMap.entries()) {
    let totalBytes = 0;
    let holesSolved = 0;
    const userScores = [];

    for (const hole of allHoles) {
      const holeByteMin = globalHoleMin.get(hole);
      let bestHolePoint = 0;
      let bestHoleByte = Infinity;

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

          if (point > bestHolePoint || (point === bestHolePoint && loginByte < bestHoleByte)) {
            bestHolePoint = point;
            bestHoleByte = loginByte;
          }
        }
      }

      const roundedPoint = bestHolePoint > 0 ? Math.round(bestHolePoint) : 0;
      userScores.push(roundedPoint);

      if (roundedPoint > 0) {
        totalBytes += bestHoleByte;
        holesSolved++;
      }
    }

    const totalPoints = Math.round(calculateHolePowerMean(userScores, totalHolesCount, chiExponent));

    leaderboard.push({
      name: userInfo.displayName,
      initialRank: userInfo.initialRank,
      holes: holesSolved,
      points: totalPoints,
      bytes: totalBytes
    });
  }

  leaderboard.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    return a.bytes - b.bytes;
  });

  leaderboard.forEach((row, index) => {
    row.standardRank = index + 1;
    row.rankChange = row.initialRank - row.standardRank;
  });

  return leaderboard;
}

function sortLeaderboardData(results, sortOrder) {
  return [...results].sort((a, b) => {
    if (sortOrder === 'rank-change-desc') {
      if (b.rankChange !== a.rankChange) {
        return b.rankChange - a.rankChange;
      }
      if (b.points !== a.points) return b.points - a.points;
      return a.bytes - b.bytes;
    }

    if (sortOrder === 'abs-rank-change-desc') {
      const absA = Math.abs(a.rankChange);
      const absB = Math.abs(b.rankChange);

      if (absA !== absB) {
        return absB - absA;
      }
      if (b.rankChange !== a.rankChange) {
        return b.rankChange - a.rankChange;
      }
      if (b.points !== a.points) return b.points - a.points;
      return a.bytes - b.bytes;
    }

    if (b.points !== a.points) return b.points - a.points;
    return a.bytes - b.bytes;
  });
}

function renderLeaderboard(results, sortOrder = 'points-desc') {
  const sortedResults = sortLeaderboardData(results, sortOrder);
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
      <td>
        <strong>${getGolferLink(row.name)}</strong>
      </td>
      <td>${row.holes.toLocaleString()}</td>
      <td><strong>${row.points.toLocaleString()}</strong></td>
      <td>${row.bytes.toLocaleString()}</td>
      <td style="text-align: right;" class="${diffClass}"><strong>${changeSign}</strong></td>
    `;
    tbody.appendChild(tr);
  });

  document.getElementById('lbResultsCard')?.classList.remove('hidden');
}

// Leaderboard Listeners
document.getElementById('lbSortSelect')?.addEventListener('change', (e) => {
  if (lastLeaderboardResults && lastLeaderboardResults.length > 0) {
    renderLeaderboard(lastLeaderboardResults, e.target.value);
  }
});

// Markdown (.md) Export for Leaderboard
document.getElementById('exportLbTxtBtn')?.addEventListener('click', () => {
  if (!lastLeaderboardResults || lastLeaderboardResults.length === 0) {
    alert("No leaderboard data to export!");
    return;
  }

  const sortOrder = document.getElementById('lbSortSelect')?.value || 'points-desc';
  const mdContent = generateLeaderboardMarkdownTable(lastLeaderboardResults, sortOrder);
  downloadMarkdownFile('leaderboard.md', mdContent);
});

function generateLeaderboardMarkdownTable(results, sortOrder = 'points-desc') {
  const sortedResults = sortLeaderboardData(results, sortOrder);
  const headers = ['#', 'golfer', 'holes', 'points', 'bytes', '+/-'];
  const rightAlignCols = [0, 2, 3, 4, 5];
  
  const tableRows = sortedResults.map((row) => [
    String(row.standardRank),
    row.name,
    row.holes.toLocaleString(),
    row.points.toLocaleString(),
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

// --- Chi Exponent Control Setup ---
function setupChiInput(valueElId, sliderElId) {
  const valueEl = document.getElementById(valueElId);
  const sliderEl = document.getElementById(sliderElId);

  if (!valueEl || !sliderEl) return;

  sliderEl.addEventListener('input', (e) => {
    valueEl.textContent = e.target.value;
  });

  const clickTarget = valueEl.closest('label') || valueEl.parentElement || valueEl;

  clickTarget.addEventListener('click', () => {
    const currentVal = valueEl.textContent;
    const input = prompt('Enter Holes Exponent (χ value 1 to 1000):', currentVal);

    if (input !== null) {
      const num = parseFloat(input);
      if (!isNaN(num) && num >= 1 && num <= 1000) {
        valueEl.textContent = num;
        sliderEl.value = Math.min(num, parseFloat(sliderEl.max));
      } else {
        alert('Please enter a valid number between 1 and 1000.');
      }
    }
  });
}

// Initialize Chi controls for both tabs
setupChiInput('chiValue', 'chiSlider');
setupChiInput('lbChiValue', 'lbChiSlider');