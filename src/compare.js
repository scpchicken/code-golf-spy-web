/**
 * Page 1: Golfer Comparison Logic
 */

let currentExclusiveSortField = 'goldHolders';
let currentExclusiveSortDir = 'desc';

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

  const u2ExclusiveGolds = [];
  if (hasUser2) {
    for (const [key, users] of holeLangUsers.entries()) {
      const parts = key.split("::");
      const hole = parts[0];
      const lang = parts[1];

      const u1Medal = medalsMap.get(`${key}::${u1Lower}`) || "";
      const u2Medal = medalsMap.get(`${key}::${u2Lower}`) || "";

      const u2HasGold = u2Medal === "🥇" || u2Medal === "💎";
      const u1HasGold = u1Medal === "🥇" || u1Medal === "💎";

      if (u2HasGold && !u1HasGold) {
        let goldHolders = 0;
        for (const u of users) {
          const m = medalsMap.get(`${key}::${u.login}`);
          if (m === "🥇" || m === "💎") {
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