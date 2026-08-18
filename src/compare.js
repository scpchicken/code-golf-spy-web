/**
 * Page 1: Golfer Comparison Logic
 */

let currentExclusiveSortField = 'goldHolders';
let currentExclusiveSortDir = 'desc';

/**
 * ==========================================================================
 * Shared Language / Experimental Filter (used by compare.js, leaderboard.js,
 * and query.js). Replaces the old single "Include Experimental" checkbox
 * with a dropdown offering four modes:
 *   - default:     exclude experimental holes & langs (previous unchecked state)
 *   - experimental: include experimental holes & langs (previous checked state)
 *   - permitted:   only the langs the user explicitly checks are allowed
 *   - banned:      every lang EXCEPT the ones the user checks is allowed
 * Permitted/Banned only affect language filtering; hole filtering still
 * follows the default/experimental setting.
 * ==========================================================================
 */
let langFilterMode = 'default'; // 'default' | 'experimental' | 'permitted' | 'banned'
let permittedLangsSet = new Set();
let bannedLangsSet = new Set();
let langFilterModalMode = null;
let cachedLangsForModal = null;

function computeValidHoles(holesJson) {
  if (!holesJson || !Array.isArray(holesJson)) return null;
  const includeExperimentalHoles = langFilterMode === 'experimental';
  return new Set(
    holesJson
      .filter(h => includeExperimentalHoles || h.experiment === null || h.experiment === undefined)
      .map(h => h.id)
  );
}

function computeValidLangs(langsJson) {
  if (!langsJson || !Array.isArray(langsJson)) return null;

  if (langFilterMode === 'permitted') {
    return new Set(langsJson.filter(l => permittedLangsSet.has(l.id)).map(l => l.id));
  }

  if (langFilterMode === 'banned') {
    return new Set(langsJson.filter(l => !bannedLangsSet.has(l.id)).map(l => l.id));
  }

  const includeExperimentalLangs = langFilterMode === 'experimental';
  return new Set(
    langsJson
      .filter(l => includeExperimentalLangs || l.experiment === null || l.experiment === undefined)
      .map(l => l.id)
  );
}

// Non-experimental langs first (alphabetical), then experimental langs (alphabetical).
function sortLangsForModal(langsJson) {
  return [...langsJson].sort((a, b) => {
    const aExp = !(a.experiment === null || a.experiment === undefined);
    const bExp = !(b.experiment === null || b.experiment === undefined);
    if (aExp !== bExp) return aExp ? 1 : -1;
    const aName = a.name || a.id;
    const bName = b.name || b.id;
    return aName.localeCompare(bName);
  });
}

// Every {select, editBtn} pair that shares the single langFilterMode state
// above (Compare Users page + Custom Leaderboard page). Add a new pair here
// to hook up another page's controls to the same shared state so all pages
// always show the current mode and stay in sync with one another.
const langFilterControlPairs = [
  { selectId: 'langFilterModeSelect', editBtnId: 'editLangFilterBtn' },
  { selectId: 'lbLangFilterModeSelect', editBtnId: 'lbEditLangFilterBtn' }
];

function updateLangFilterEditButton() {
  langFilterControlPairs.forEach(({ editBtnId }) => {
    const editBtn = document.getElementById(editBtnId);
    if (!editBtn) return;

    if (langFilterMode === 'permitted') {
      editBtn.classList.remove('hidden');
      editBtn.textContent = `Edit Permitted Languages (${permittedLangsSet.size})`;
    } else if (langFilterMode === 'banned') {
      editBtn.classList.remove('hidden');
      editBtn.textContent = `Edit Banned Languages (${bannedLangsSet.size})`;
    } else {
      editBtn.classList.add('hidden');
    }
  });
}

function revertLangFilterSelect() {
  langFilterControlPairs.forEach(({ selectId }) => {
    const select = document.getElementById(selectId);
    if (select) select.value = langFilterMode;
  });
}

async function openLangFilterModal(mode) {
  langFilterModalMode = mode;

  const modal = document.getElementById('langFilterModal');
  const title = document.getElementById('langFilterModalTitle');
  const searchInput = document.getElementById('langFilterSearchInput');
  if (!modal) return;

  if (title) title.textContent = mode === 'permitted' ? 'Select Permitted Languages' : 'Select Banned Languages';
  if (searchInput) searchInput.value = '';

  showLoading();
  let langsJson;
  try {
    const langsFileInput = document.getElementById('langsFile');
    langsJson = await getOrFetchJson(langsFileInput, 'https://code.golf/api/langs', 'langs.json');
  } catch (err) {
    hideLoading();
    alert('Failed to load languages: ' + err.message);
    revertLangFilterSelect();
    return;
  }
  hideLoading();

  if (!langsJson || !Array.isArray(langsJson) || langsJson.length === 0) {
    alert('No language data available to select from.');
    revertLangFilterSelect();
    return;
  }

  cachedLangsForModal = langsJson;
  renderLangFilterList(langsJson, mode);
  modal.classList.remove('hidden');
}

// Builds the FULL list once (every language, both groups). Searching only
// toggles visibility of rows/sections via CSS - it never removes checkboxes
// from the DOM, so checked/unchecked state survives typing into the search
// box and is preserved whether or not a row is currently visible.
function renderLangFilterList(langsJson, mode) {
  const listContainer = document.getElementById('langFilterListContainer');
  if (!listContainer) return;

  const sorted = sortLangsForModal(langsJson);
  const selectedSet = mode === 'permitted' ? permittedLangsSet : bannedLangsSet;

  // First-time defaults: Permitted starts pre-checked with the non-experimental
  // langs (mirrors the old default filter); Banned starts with nothing checked.
  const isFreshPermitted = mode === 'permitted' && selectedSet.size === 0;

  const groups = { standard: [], experimental: [] };
  sorted.forEach(l => {
    const isExperimental = !(l.experiment === null || l.experiment === undefined);
    (isExperimental ? groups.experimental : groups.standard).push(l);
  });

  const renderGroup = (label, langs) => {
    if (langs.length === 0) return '';
    const rows = langs.map(l => {
      const displayLabel = l.name || l.id;
      const checked = isFreshPermitted ? (label === 'Standard') : selectedSet.has(l.id);
      const searchKey = `${displayLabel} ${l.id}`.toLowerCase();
      return `
        <label class="lang-filter-row" data-search="${searchKey}" style="display: flex; align-items: center; gap: 0.5rem; padding: 0.3rem 0; cursor: pointer;">
          <input type="checkbox" class="lang-filter-checkbox" data-lang-id="${l.id}" ${checked ? 'checked' : ''} style="accent-color: var(--accent); width: 1rem; height: 1rem; cursor: pointer;">
          <span>${displayLabel}</span>
        </label>
      `;
    }).join('');

    return `
      <div class="lang-filter-section" data-section="${label.toLowerCase()}">
        <div style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-dim); margin: 0 0 0.35rem 0;">${label}</div>
        ${rows}
      </div>
    `;
  };

  listContainer.innerHTML = renderGroup('Standard', groups.standard) + renderGroup('Experimental', groups.experimental);
}

function filterLangFilterList(filterText) {
  const listContainer = document.getElementById('langFilterListContainer');
  if (!listContainer) return;

  const lower = filterText.trim().toLowerCase();

  listContainer.querySelectorAll('.lang-filter-section').forEach(section => {
    let anyVisible = false;
    section.querySelectorAll('.lang-filter-row').forEach(row => {
      const match = !lower || row.dataset.search.includes(lower);
      row.style.display = match ? 'flex' : 'none';
      if (match) anyVisible = true;
    });
    section.style.display = anyVisible ? '' : 'none';
  });
}

langFilterControlPairs.forEach(({ selectId, editBtnId }) => {
  document.getElementById(selectId)?.addEventListener('change', (e) => {
    const newMode = e.target.value;

    if (newMode === 'permitted' || newMode === 'banned') {
      openLangFilterModal(newMode);
    } else {
      langFilterMode = newMode;
      // Immediately reflect the new mode on every synced dropdown (e.g. the
      // Compare Users <-> Custom Leaderboard pair), not just the one the
      // user touched.
      revertLangFilterSelect();
      updateLangFilterEditButton();
    }
  });

  document.getElementById(editBtnId)?.addEventListener('click', () => {
    if (langFilterMode === 'permitted' || langFilterMode === 'banned') {
      openLangFilterModal(langFilterMode);
    }
  });
});

// Keep the (exact-match) Lang Filter text inputs on the Compare Users page
// and Custom Leaderboard page mirrored, so typing in one immediately
// updates the other.
const langFilterTextInputIds = ['langFilterInput', 'lbLangFilterInput'];
langFilterTextInputIds.forEach(id => {
  document.getElementById(id)?.addEventListener('input', (e) => {
    const val = e.target.value;
    langFilterTextInputIds.forEach(otherId => {
      if (otherId === id) return;
      const otherEl = document.getElementById(otherId);
      if (otherEl && otherEl.value !== val) otherEl.value = val;
    });
  });
});

document.getElementById('langFilterSearchInput')?.addEventListener('input', (e) => {
  filterLangFilterList(e.target.value);
});

// Select All / Select None only affect rows currently visible (i.e. matching
// the active search), so a search-then-select-all doesn't touch languages
// that are filtered out of view.
document.getElementById('langFilterSelectAllBtn')?.addEventListener('click', () => {
  document.querySelectorAll('#langFilterListContainer .lang-filter-row').forEach(row => {
    if (row.style.display !== 'none') {
      const cb = row.querySelector('.lang-filter-checkbox');
      if (cb) cb.checked = true;
    }
  });
});

document.getElementById('langFilterSelectNoneBtn')?.addEventListener('click', () => {
  document.querySelectorAll('#langFilterListContainer .lang-filter-row').forEach(row => {
    if (row.style.display !== 'none') {
      const cb = row.querySelector('.lang-filter-checkbox');
      if (cb) cb.checked = false;
    }
  });
});

document.getElementById('langFilterCancelBtn')?.addEventListener('click', () => {
  document.getElementById('langFilterModal')?.classList.add('hidden');
  revertLangFilterSelect();
});

document.getElementById('langFilterApplyBtn')?.addEventListener('click', () => {
  // Reads every checkbox regardless of current search filter, so anything
  // hidden by a search term keeps whatever state it already had.
  const checkedIds = new Set(
    Array.from(document.querySelectorAll('#langFilterListContainer .lang-filter-checkbox:checked')).map(cb => cb.dataset.langId)
  );

  if (langFilterModalMode === 'permitted') {
    permittedLangsSet = checkedIds;
  } else if (langFilterModalMode === 'banned') {
    bannedLangsSet = checkedIds;
  }

  langFilterMode = langFilterModalMode;
  document.getElementById('langFilterModal')?.classList.add('hidden');
  revertLangFilterSelect();
  updateLangFilterEditButton();
});

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
      langsJson: langsData
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
  langsJson
}) {
  const u1Lower = u1Name.toLowerCase();
  const u2Lower = u2Name ? u2Name.toLowerCase() : null;
  const hasUser2 = Boolean(u2Lower);

  const isFlat1000 = minScore >= 1000;
  const offset2 = isFlat1000 ? 0 : minScore / (1000 - minScore);
  const offset1 = isFlat1000 ? 0 : offset2 - 1;

  const validHoles = computeValidHoles(holesJson);
  const validLangs = computeValidLangs(langsJson);

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
      if (place === 1) {
        if (tiedForFirst === 1) {
          // Unicorn 🦄: unique best AND the only solver of this hole/lang combo.
          // Otherwise it's a regular Diamond 💎 (unique best, but others also solved it).
          medal = (users.length === 1) ? "🦄" : "💎";
        } else {
          medal = "🥇";
        }
      }
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
      if (medal === "💎" || medal === "🦄") { u1Diamonds++; u1Golds++; }
      else if (medal === "🥇") u1Golds++;
    } else if (hasUser2 && loginLower === u2Lower) {
      if (medal === "💎" || medal === "🦄") { u2Diamonds++; u2Golds++; }
      else if (medal === "🥇") u2Golds++;
    }
  }

  const u2ExclusiveGolds = [];
  if (hasUser2) {
    for (const [key, users] of holeLangUsers.entries()) {
      const parts = key.split("::");
      const hole = parts[0];
      const lang = parts[1];

      const u1Medal = medalsMap.get(`${key}::${u1Lower}`) || "";
      const u2Medal = medalsMap.get(`${key}::${u2Lower}`) || "";

      const u2HasGold = u2Medal === "🥇" || u2Medal === "💎" || u2Medal === "🦄";
      const u1HasGold = u1Medal === "🥇" || u1Medal === "💎" || u1Medal === "🦄";

      if (u2HasGold && !u1HasGold) {
        let goldHolders = 0;
        for (const u of users) {
          const m = medalsMap.get(`${key}::${u.login}`);
          if (m === "🥇" || m === "💎" || m === "🦄") {
            goldHolders++;
          }
        }
        const u2Byte = userBestSubmissions.get(`${key}::${u2Lower}`);
        u2ExclusiveGolds.push({ hole, lang, medal: u2Medal, byte: u2Byte, goldHolders });
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
      const medalRank = { '🦄': 0, '💎': 1, '🥇': 2, '🥈': 3, '🥉': 4, '': 5 };
      const rankA = medalRank[a.medal] ?? 5;
      const rankB = medalRank[b.medal] ?? 5;
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

    let dCount = 0, gCount = 0, sCount = 0, bCount = 0, uCount = 0;
    allMedals.forEach(m => {
      if (m.medal === '🦄') { uCount++; dCount++; gCount++; }
      else if (m.medal === '💎') { dCount++; gCount++; }
      else if (m.medal === '🥇') gCount++;
      else if (m.medal === '🥈') sCount++;
      else if (m.medal === '🥉') bCount++;
    });

    const asciiParts = [];
    if (uCount > 0) asciiParts.push(`${uCount}U`);
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

  const u1RawScores = rows.map(r => r.u1AllLangs && r.u1AllLangs.length > 0 ? Math.max(...r.u1AllLangs.map(c => c.point), 0) : 0);
  const u2RawScores = rows.map(r => r.u2AllLangs && r.u2AllLangs.length > 0 ? Math.max(...r.u2AllLangs.map(c => c.point), 0) : 0);

  const u1RawBaseScore = Math.round(calculateHolePowerMean(u1RawScores, totalHolesCount, 1));
  const u2RawBaseScore = hasUser2 ? Math.round(calculateHolePowerMean(u2RawScores, totalHolesCount, 1)) : 0;

  const u1TotalScore = u1BaseScore + Math.round(u1Diamonds * diamondBonus);
  const u1RawTotalScore = u1RawBaseScore;

  const u2TotalScore = hasUser2 ? (u2BaseScore + Math.round(u2Diamonds * diamondBonus)) : 0;
  const u2RawTotalScore = hasUser2 ? u2RawBaseScore : 0;

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
    totalLangsCount,
    u2ExclusiveGolds
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

  const u1RawScores = lastCompareResults.rows.map(r => r.u1AllLangs && r.u1AllLangs.length > 0 ? Math.max(...r.u1AllLangs.map(c => c.point), 0) : 0);
  const u2RawScores = lastCompareResults.rows.map(r => r.u2AllLangs && r.u2AllLangs.length > 0 ? Math.max(...r.u2AllLangs.map(c => c.point), 0) : 0);

  const u1RawBaseScore = Math.round(calculateHolePowerMean(u1RawScores, totalHoles, 1));
  const u2RawBaseScore = lastCompareResults.hasUser2 ? Math.round(calculateHolePowerMean(u2RawScores, totalHoles, 1)) : 0;

  lastCompareResults.u1TotalScore = u1BaseScore + Math.round(lastCompareResults.u1Diamonds * diamondBonus);
  lastCompareResults.u1RawTotalScore = u1RawBaseScore;

  if (lastCompareResults.hasUser2) {
    lastCompareResults.u2TotalScore = u2BaseScore + Math.round(lastCompareResults.u2Diamonds * diamondBonus);
    lastCompareResults.u2RawTotalScore = u2RawBaseScore;
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

function sortExclusiveGoldsData(items, sortField, sortDir) {
  return [...items].sort((a, b) => {
    let valA, valB;
    if (sortField === 'hole') {
      return sortDir === 'asc' ? a.hole.localeCompare(b.hole) : b.hole.localeCompare(a.hole);
    } else if (sortField === 'lang') {
      return sortDir === 'asc' ? a.lang.localeCompare(b.lang) : b.lang.localeCompare(a.lang);
    } else if (sortField === 'medal') {
      return sortDir === 'asc' ? a.medal.localeCompare(b.medal) : b.medal.localeCompare(a.medal);
    } else if (sortField === 'byte') {
      valA = a.byte; valB = b.byte;
    } else if (sortField === 'goldHolders') {
      valA = a.goldHolders; valB = b.goldHolders;
    } else {
      valA = a.goldHolders; valB = b.goldHolders;
    }

    if (valA !== valB) return sortDir === 'desc' ? valB - valA : valA - valB;
    return a.hole.localeCompare(b.hole) || a.lang.localeCompare(b.lang);
  });
}

function renderCompareResults(data) {
  const { u1Name, u2Name, u1TotalScore, u1RawTotalScore, u1SolvedCount, u1Golds, u1Diamonds, u2TotalScore, u2RawTotalScore, u2SolvedCount, u2Golds, u2Diamonds, hasUser2, scoringMode, u2ExclusiveGolds } = data;
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

  renderExclusiveGoldsSection(data);
}

function renderExclusiveGoldsSection(data) {
  const { u1Name, u2Name, hasUser2, scoringMode, u2ExclusiveGolds } = data;
  const exclusiveGoldsCard = document.getElementById('exclusiveGoldsCard');
  const exclusiveGoldsTable = document.getElementById('exclusiveGoldsTable');
  const u1NameSpan = document.getElementById('u1NameSpan');
  const u2NameSpan = document.getElementById('u2NameSpan');

  if (hasUser2 && u2ExclusiveGolds && u2ExclusiveGolds.length > 0) {
    if (u1NameSpan) u1NameSpan.textContent = u1Name;
    if (u2NameSpan) u2NameSpan.textContent = u2Name;

    const scoreLabel = scoringMode === 'chars' ? 'Chars' : 'Bytes';
    const currentScoreLabel = scoreLabel;

    if (exclusiveGoldsTable) {
      const thead = exclusiveGoldsTable.querySelector('thead');
      if (thead) {
        const renderTh = (id, label, fieldName, align = 'left') => {
          const isCurrent = currentExclusiveSortField === fieldName;
          const arrow = isCurrent ? (currentExclusiveSortDir === 'desc' ? ' ▼' : ' ▲') : '';
          const colorStyle = isCurrent ? 'color: #38bdf8;' : 'color: inherit;';
          return `<th id="${id}" style="text-align: ${align}; cursor: pointer; user-select: none; ${colorStyle}">${label}${arrow}</th>`;
        };

        thead.innerHTML = `
          <tr>
            ${renderTh('thExHole', 'Hole', 'hole', 'left')}
            ${renderTh('thExLang', 'Language', 'lang', 'left')}
            ${renderTh('thExMedal', 'Medal', 'medal', 'right')}
            ${renderTh('thExByte', currentScoreLabel, 'byte', 'right')}
            ${renderTh('thExGoldHolders', 'Gold Holders', 'goldHolders', 'right')}
          </tr>
        `;

        const bindExSort = (id, fieldName, defaultDir = 'desc') => {
          const el = document.getElementById(id);
          el?.addEventListener('click', () => {
            if (currentExclusiveSortField === fieldName) {
              currentExclusiveSortDir = currentExclusiveSortDir === 'desc' ? 'asc' : 'desc';
            } else {
              currentExclusiveSortField = fieldName;
              currentExclusiveSortDir = defaultDir;
            }
            renderExclusiveGoldsSection(lastCompareResults);
          });
        };

        bindExSort('thExHole', 'hole', 'asc');
        bindExSort('thExLang', 'lang', 'asc');
        bindExSort('thExMedal', 'medal', 'asc');
        bindExSort('thExByte', 'byte', 'asc');
        bindExSort('thExGoldHolders', 'goldHolders', 'desc');
      }
    }

    const exclusiveGoldsBody = document.getElementById('exclusiveGoldsBody');
    const sortedExclusive = sortExclusiveGoldsData(u2ExclusiveGolds, currentExclusiveSortField, currentExclusiveSortDir);

    exclusiveGoldsBody.innerHTML = sortedExclusive.map(g => {
      const holeUrl = `https://code.golf/${encodeURIComponent(g.hole)}`;
      const langUrl = `https://code.golf/${encodeURIComponent(g.hole)}#${encodeURIComponent(g.lang)}`;
      
      return `
        <tr>
          <td><a href="${holeUrl}" target="_blank" rel="noopener noreferrer" class="golf-link"><strong>${escapeHtml(g.hole)}</strong></a></td>
          <td><a href="${langUrl}" target="_blank" rel="noopener noreferrer" class="golf-link-clean" style="font-weight: bold; color: #4da6ff;">${escapeHtml(g.lang)}</a></td>
          <td style="text-align: right;"><span class="medal">${g.medal}</span></td>
          <td style="text-align: right;"><strong>${g.byte.toLocaleString()}</strong></td>
          <td style="text-align: right;">${g.goldHolders.toLocaleString()}</td>
        </tr>
      `;
    }).join('');
    
    if (exclusiveGoldsCard) exclusiveGoldsCard.classList.remove('hidden');
  } else {
    if (exclusiveGoldsCard) exclusiveGoldsCard.classList.add('hidden');
  }
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

      // Raw (non-HTML-escaped) JSON for the row-level data attributes, set via
      // setAttribute directly rather than through an HTML string — using the
      // HTML-escaped version here would leave literal "&quot;" in the attribute
      // and break JSON.parse when read back.
      tr.style.cursor = 'pointer';
      tr.setAttribute('data-hole', r.hole);
      tr.setAttribute('data-u1-point', r.u1Point);
      tr.setAttribute('data-u2-point', r.u2Point);
      tr.setAttribute('data-u1-langs', JSON.stringify(r.u1AllLangs || []));
      tr.setAttribute('data-u2-langs', JSON.stringify(r.u2AllLangs || []));

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

// Clicking anywhere in the blank space of a compare row (not a link or an
// already-handled control) opens the diff breakdown modal for that row.
document.getElementById('resultsBody')?.addEventListener('click', (e) => {
  if (!lastCompareResults || !lastCompareResults.hasUser2) return;
  if (e.target.closest('a')) return;
  if (e.target.closest('.diff-clickable')) return;
  if (e.target.closest('.extra-medals-btn')) return;

  const tr = e.target.closest('tr[data-hole]');
  if (!tr) return;

  const hole = tr.getAttribute('data-hole');
  const u1Point = parseFloat(tr.getAttribute('data-u1-point') || '0');
  const u2Point = parseFloat(tr.getAttribute('data-u2-point') || '0');
  const u1Langs = JSON.parse(tr.getAttribute('data-u1-langs') || '[]');
  const u2Langs = JSON.parse(tr.getAttribute('data-u2-langs') || '[]');

  if (typeof showDiffModal === 'function') {
    showDiffModal(hole, u1Point, u2Point, u1Langs, u2Langs);
  }
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