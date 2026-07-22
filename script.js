const DEFAULT_GOLFERS_LIST = "zzh1996, Steffan153, codereport, ovs-code, pardouin, sean-niemann, rucin93, emplv, edsrzf, scpchicken, blaztoma, MeWhenI, Seek64, kg583, emgordon154, stefangimmillaro, lyphyser, saito-ta, SirBogman, snoozingnewt, lynn, nwellnhof, CaedenHarper, KasperKivimaeki, vang1ong7ang, 5cw, canissimia, sisyphus-gpt, duckyluuk, GrayJoKing, hallvabo, Natanaelel, GolfingSuccess, bitsandbeyond, bizy-coder, CornerMercury, ryyyn, AlephSquirrel, AdrienHache, antimon2, DialFrost, plcc0, jared-hughes, JayXon, Shanethegamer, namelessiw, bricknellj, sisyphus-ppcg, KatieLG, albanian-laundromat, JOrE20, primo-ppcg, anter69, rkg-huwdu, m-tkach, oaiqjuy, btnlq, ndren, annaproxy, aksyristos, inventshah, Yax42, Flekay, dokutan, 2bular, IanUtley, acotis, lukegustafson, vlpx, RainVniaR, Kacarott, Lydxn, CLOStrophobic, StefanHabel, error256, lifthrasiir, BREMAUCY, targrik, commandz0, voytxt, FortuiteMan, madex, retrohun, xsot, tomtheisen, HPWiz, qpwoeirut, UnderKoen, prestosilver, helbling, ahmetdemirag, Yewzir, LostSyntax21, dmrichwa, prplz, iczelia, CatsAreFluffy, InigoK, kumavale, ZakkkkAttackkkk";

// --- Mathematical Helper: Hole Power Mean ---
function calculateHolePowerMean(holeScores, totalHoles, chi) {
  if (totalHoles === 0) return 0;

  // Standard Arithmetic Sum across all holes (chi = 1)
  if (chi === 1) {
    return holeScores.reduce((acc, score) => acc + score, 0);
  }

  // Pure Maximum scaled by number of holes (chi >= 100)
  if (chi >= 100) {
    return Math.max(...holeScores, 0) * totalHoles;
  }

  // Generalized Power Mean multiplied by total holes
  const sumPow = holeScores.reduce((acc, score) => acc + Math.pow(score, chi), 0);
  const mean = Math.pow(sumPow / totalHoles, 1 / chi);
  return mean * totalHoles;
}

// Default Golfers List Click Handler
document.getElementById('leaderboardUsersLabel')?.addEventListener('click', (e) => {
  e.preventDefault();
  const input = document.getElementById('leaderboardUsersInput');
  if (input) {
    input.value = DEFAULT_GOLFERS_LIST;
    input.focus();
  }
});

// --- Keyboard Shortcuts (Ctrl+Enter / Cmd+Enter) ---
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    const leaderboardPage = document.getElementById('leaderboardPage');
    const comparePage = document.getElementById('comparePage');

    if (leaderboardPage && !leaderboardPage.classList.contains('hidden')) {
      document.getElementById('lbGoBtn')?.click();
    } else if (comparePage && !comparePage.classList.contains('hidden')) {
      document.getElementById('goBtn')?.click();
    }
  }
});

// --- General UI Helper Functions ---
function showLoading() {
  document.getElementById('loadingOverlay')?.classList.remove('hidden');
}

function hideLoading() {
  document.getElementById('loadingOverlay')?.classList.add('hidden');
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
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

function downloadTxtFile(filename, text) {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// --- Solutions Modal Handling ---
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

// Download Help Buttons
document.getElementById('dlSolutionsBtn')?.addEventListener('click', handleSolutionsDownload);
document.getElementById('dlHolesBtn')?.addEventListener('click', () => window.open('https://code.golf/api/holes', '_blank'));
document.getElementById('dlLangsBtn')?.addEventListener('click', () => window.open('https://code.golf/api/langs', '_blank'));

// Global App State
let lastCompareResults = null;
let lastLeaderboardResults = [];

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
  const sortOrder = activeSortEl ? activeSortEl.value : 'u1-desc';

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

  // Formula offsets
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

  // Calculate Medals
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

    for (let i = 0; i < users.length; i++) {
      const current = users[i];
      const strictlyFewer = users.filter(u => u.byte < current.byte).length;
      const place = strictlyFewer + 1;

      let medal = "";
      if (place === 1) medal = "🥇";
      else if (place === 2) medal = "🥈";
      else if (place === 3) medal = "🥉";

      medalsMap.set(`${key}::${current.login}`, medal);
    }
  }

  function getUserHoleResult(hole, targetLoginLower) {
    if (!targetLoginLower) return { lang: "-", point: 0, medal: "" };

    const candidates = [];
    const holeByteMin = globalHoleMin.get(hole);

    for (const [langKey, langStat] of globalLangStats.entries()) {
      if (!langKey.startsWith(`${hole}::`)) continue;
      const lang = langKey.split("::")[1];
      const userLangKey = `${hole}::${lang}::${targetLoginLower}`;

      if (userBestSubmissions.has(userLangKey)) {
        const loginByte = userBestSubmissions.get(userLangKey);
        const solCount = langStat.logins.size;
        const langByteMin = langStat.min_bytes;
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
        candidates.push({ lang, point, medal, loginByte });
      }
    }

    if (candidates.length === 0) return { lang: "-", point: 0, medal: "" };

    candidates.sort((a, b) => {
      if (a.point !== b.point) return a.point - b.point;
      if (a.loginByte !== b.loginByte) return b.loginByte - a.loginByte;
      return b.lang.localeCompare(a.lang);
    });

    const best = candidates[candidates.length - 1];
    const roundedPoint = Math.round(best.point);

    if (roundedPoint === 0) return { lang: "-", point: 0, medal: "" };

    return {
      lang: best.lang,
      point: roundedPoint,
      medal: best.medal
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
      u2Lang: u2Res ? u2Res.lang : "-",
      u2Point: u2Res ? u2Res.point : 0,
      u2Medal: u2Res ? u2Res.medal : "",
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
    u2Name,
    u2TotalScore,
    u2SolvedCount,
    hasUser2,
    scoringMode,
    chiExponent
  };
}

function renderCompareResults(data, sortOrder) {
  const { u1Name, u2Name, u1TotalScore, u1SolvedCount, u2TotalScore, u2SolvedCount, hasUser2, scoringMode } = data;
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
        <div class="lbl">${u1Link} (${u1SolvedCount} solved)</div>
      </div>
      <div class="stat-box">
        <div class="val">${u2TotalScore.toLocaleString()}</div>
        <div class="lbl">${u2Link} (${u2SolvedCount} solved)</div>
      </div>
      <div class="stat-box">
        <div class="val ${diffTotal > 0 ? 'diff-pos' : diffTotal < 0 ? 'diff-neg' : 'diff-zero'}">${diffSign}</div>
        <div class="lbl">SCORE DIFF (U1 - U2, ${modeLabel})</div>
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
    `;

    tableHead.innerHTML = `
      <tr>
        <th>Hole</th>
        <th>Language</th>
        <th>Points</th>
      </tr>
    `;
  }

  sortAndRenderCompareTable(data.rows, sortOrder, hasUser2, scoringMode);
  document.getElementById('resultsCard')?.classList.remove('hidden');
}

function formatLangDisplay(hole, lang, medal) {
  if (!lang || lang === "N/A" || lang === "-") return "-";
  const langUrl = `https://code.golf/${encodeURIComponent(hole)}#${encodeURIComponent(lang)}`;
  const medalHtml = medal ? ` <span class="medal">${medal}</span>` : '';
  return `<a href="${langUrl}" target="_blank" rel="noopener noreferrer" class="golf-link-clean">${escapeHtml(lang)}</a>${medalHtml}`;
}

function formatScoreDisplay(hole, lang, point, scoringMode) {
  if (!point || point <= 0 || !lang || lang === "N/A" || lang === "-") {
    return `<strong>${(point || 0).toLocaleString()}</strong>`;
  }
  const scoreUrl = `https://code.golf/rankings/holes/${encodeURIComponent(hole)}/${encodeURIComponent(lang)}/${scoringMode}`;
  return `<a href="${scoreUrl}" target="_blank" rel="noopener noreferrer" class="golf-link-clean"><strong>${point.toLocaleString()}</strong></a>`;
}

function sortAndRenderCompareTable(rows, sortOrder, hasUser2, scoringMode) {
  const resultsBody = document.getElementById('resultsBody');
  const filterText = (document.getElementById('tableSearch')?.value || '').toLowerCase();

  const sorted = [...rows].sort((a, b) => {
    if (sortOrder === 'u1-desc') return b.u1Point - a.u1Point || a.hole.localeCompare(b.hole);
    if (sortOrder === 'u2-desc') return b.u2Point - a.u2Point || a.hole.localeCompare(b.hole);
    if (sortOrder === 'diff-desc') return b.diff - a.diff || a.hole.localeCompare(b.hole);
    if (sortOrder === 'diff-asc') return a.diff - b.diff || a.hole.localeCompare(b.hole);
    if (sortOrder === 'alpha-asc') return a.hole.localeCompare(b.hole);
    if (sortOrder === 'alpha-desc') return b.hole.localeCompare(a.hole);
    return 0;
  });

  resultsBody.innerHTML = '';
  sorted.forEach(r => {
    if (filterText && !r.hole.toLowerCase().includes(filterText)) return;

    const tr = document.createElement('tr');
    const holeUrl = `https://code.golf/${encodeURIComponent(r.hole)}`;
    const holeDisplay = `<a href="${holeUrl}" target="_blank" rel="noopener noreferrer" class="golf-link"><strong>${escapeHtml(r.hole)}</strong></a>`;

    const u1LangDisplay = formatLangDisplay(r.hole, r.u1Lang, r.u1Medal);
    const u1ScoreDisplay = formatScoreDisplay(r.hole, r.u1Lang, r.u1Point, scoringMode);

    if (hasUser2) {
      const u2LangDisplay = formatLangDisplay(r.hole, r.u2Lang, r.u2Medal);
      const u2ScoreDisplay = formatScoreDisplay(r.hole, r.u2Lang, r.u2Point, scoringMode);
      const diffClass = r.diff > 0 ? 'diff-pos' : r.diff < 0 ? 'diff-neg' : 'diff-zero';
      const diffText = r.diff > 0 ? `+${r.diff.toLocaleString()}` : r.diff.toLocaleString();

      tr.innerHTML = `
        <td>${holeDisplay}</td>
        <td>${u1LangDisplay}</td>
        <td>${u1ScoreDisplay}</td>
        <td>${u2LangDisplay}</td>
        <td>${u2ScoreDisplay}</td>
        <td class="${diffClass}">${diffText}</td>
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

// Compare Re-render Listeners
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

// ==========================================
// PAGE 2: Custom Leaderboard Logic (Bytes Only)
// ==========================================
document.getElementById('lbGoBtn')?.addEventListener('click', async () => {
  const inputVal = document.getElementById('leaderboardUsersInput').value.trim();
  const formulaType = document.getElementById('scoringFormulaSelect')?.value || 'standard';
  const chiExponent = parseFloat(document.getElementById('lbChiValue')?.textContent || 1);
  
  const subFileInput = document.getElementById('submissionsFile').files[0];
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
  // Store initial input index (1-based seed rank)
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

  // Determine standard standings rank (Points desc, Bytes asc)
  leaderboard.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    return a.bytes - b.bytes;
  });

  // Calculate places rose (+) / fell (-)
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
      // Positive numbers take precedence over negative numbers with equal absolute value (+3 above -3)
      if (b.rankChange !== a.rankChange) {
        return b.rankChange - a.rankChange;
      }
      if (b.points !== a.points) return b.points - a.points;
      return a.bytes - b.bytes;
    }

    // Default 'points-desc'
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

// Leaderboard Sort Dropdown Change Listener
document.getElementById('lbSortSelect')?.addEventListener('change', (e) => {
  if (lastLeaderboardResults && lastLeaderboardResults.length > 0) {
    renderLeaderboard(lastLeaderboardResults, e.target.value);
  }
});

// ==========================================
// TXT Export Feature
// ==========================================
document.getElementById('exportLbTxtBtn')?.addEventListener('click', () => {
  if (!lastLeaderboardResults || lastLeaderboardResults.length === 0) {
    alert("No leaderboard data to export!");
    return;
  }

  const sortOrder = document.getElementById('lbSortSelect')?.value || 'points-desc';
  const txtContent = generateAsciiTable(lastLeaderboardResults, sortOrder);
  downloadTxtFile('leaderboard.txt', txtContent);
});

function generateAsciiTable(results, sortOrder = 'points-desc') {
  const sortedResults = sortLeaderboardData(results, sortOrder);
  const headers = ['#', 'golfer', 'holes', 'points', 'bytes', '+/-'];
  
  const rows = sortedResults.map((row) => [
    String(row.standardRank),
    row.name,
    row.holes.toLocaleString(),
    row.points.toLocaleString(),
    row.bytes.toLocaleString(),
    row.rankChange > 0 ? `+${row.rankChange}` : String(row.rankChange)
  ]);

  const colWidths = headers.map((header, colIdx) => {
    let maxLen = header.length;
    rows.forEach(r => {
      if (r[colIdx].length > maxLen) {
        maxLen = r[colIdx].length;
      }
    });
    return maxLen;
  });

  const formatRow = (rowCells) => {
    return rowCells.map((cell, idx) => {
      const width = colWidths[idx];
      return idx === 1 ? cell.padEnd(width, ' ') : cell.padStart(width, ' ');
    }).join(' | ');
  };

  const headerLine = formatRow(headers);
  const separatorLine = colWidths.map(w => '-'.repeat(w)).join('-+-');
  const dataLines = rows.map(r => formatRow(r));

  return [headerLine, separatorLine, ...dataLines].join('\n');
}

// --- Chi Slider & Text Click Handlers ---
function setupChiInput(valueElId, sliderElId) {
  const valueEl = document.getElementById(valueElId);
  const sliderEl = document.getElementById(sliderElId);

  if (!valueEl || !sliderEl) return;

  // 1. Update text when slider moves
  sliderEl.addEventListener('input', (e) => {
    valueEl.textContent = e.target.value;
  });

  // 2. Click text to manually enter a number from 1 to 1000
  valueEl.addEventListener('click', () => {
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

// Initialize both Chi controls
setupChiInput('chiValue', 'chiSlider');
setupChiInput('lbChiValue', 'lbChiSlider');