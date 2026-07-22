const GITHUB_HISTORY_URL = "https://github.com/code-golf/code-golf/blob/master/dump/results.json.zst";

let lastCompareResults = null;
let lastLeaderboardResults = [];

// --- Helper Functions ---
function showLoading() {
  document.getElementById('loadingOverlay').classList.remove('hidden');
}

function hideLoading() {
  document.getElementById('loadingOverlay').classList.add('hidden');
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

// --- Tab Navigation Switcher ---
const navCompareBtn = document.getElementById('navCompareBtn');
const navLeaderboardBtn = document.getElementById('navLeaderboardBtn');
const comparePage = document.getElementById('comparePage');
const leaderboardPage = document.getElementById('leaderboardPage');

navCompareBtn.addEventListener('click', () => {
  navCompareBtn.classList.add('active');
  navLeaderboardBtn.classList.remove('active');
  comparePage.classList.remove('hidden');
  leaderboardPage.classList.add('hidden');
});

navLeaderboardBtn.addEventListener('click', () => {
  navLeaderboardBtn.classList.add('active');
  navCompareBtn.classList.remove('active');
  leaderboardPage.classList.remove('hidden');
  comparePage.classList.add('hidden');
});

// Download Help Buttons
document.getElementById('dlSolutionsBtn').addEventListener('click', () => window.open(GITHUB_HISTORY_URL, '_blank'));
document.getElementById('dlHolesBtn').addEventListener('click', () => window.open('https://code.golf/api/holes', '_blank'));
document.getElementById('dlLangsBtn').addEventListener('click', () => window.open('https://code.golf/api/langs', '_blank'));

// ==========================================
// PAGE 1: Golfer Comparison Logic
// ==========================================
document.getElementById('goBtn').addEventListener('click', async () => {
  const subFileInput = document.getElementById('submissionsFile').files[0];
  const u1Name = document.getElementById('user1Input').value.trim();
  const u2Name = document.getElementById('user2Input').value.trim();
  const langFilter = document.getElementById('langFilterInput').value.trim().toLowerCase();
  const sortOrder = document.getElementById('sortOrderInput').value;
  const holesFileInput = document.getElementById('holesFile');
  const langsFileInput = document.getElementById('langsFile');
  const includeExperimental = document.getElementById('experimentalCheck').checked;

  if (!subFileInput) {
    if (confirm("Submissions JSON (solutions.json) is mandatory!\n\nWould you like to visit GitHub to download solutions.json?")) {
      window.open(GITHUB_HISTORY_URL, '_blank');
    }
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
      langFilter,
      holesJson: holesData,
      langsJson: langsData,
      includeExperimental
    });

    document.getElementById('activeSortSelect').value = sortOrder;
    renderCompareResults(lastCompareResults, sortOrder);
    document.getElementById('dlResultsBtn').classList.remove('hidden');
  } catch (err) {
    alert(err.message);
  } finally {
    hideLoading();
  }
});

function processCompareData({ jsonData, u1Name, u2Name, langFilter, holesJson, langsJson, includeExperimental }) {
  const u1Lower = u1Name.toLowerCase();
  const u2Lower = u2Name ? u2Name.toLowerCase() : null;

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
    const scoring = x.scoring;
    const lang = x.lang;
    const hole = x.hole;
    const login = x.login;
    const loginLower = login.toLowerCase();
    const byte = Number(x.bytes);

    if (langFilter && lang.toLowerCase() !== langFilter) continue;
    if (validHoles && !validHoles.has(hole)) continue;
    if (validLangs && !validLangs.has(lang)) continue;

    const holeKey = `${hole}::${scoring}`;
    if (!globalHoleMin.has(holeKey) || byte < globalHoleMin.get(holeKey)) {
      globalHoleMin.set(holeKey, byte);
    }

    const langKey = `${hole}::${scoring}::${lang}`;
    if (!globalLangStats.has(langKey)) {
      globalLangStats.set(langKey, { min_bytes: byte, logins: new Set() });
    }
    const langStat = globalLangStats.get(langKey);
    if (byte < langStat.min_bytes) {
      langStat.min_bytes = byte;
    }
    langStat.logins.add(loginLower);

    const userLangKey = `${hole}::${scoring}::${lang}::${loginLower}`;
    if (!userBestSubmissions.has(userLangKey) || byte < userBestSubmissions.get(userLangKey)) {
      userBestSubmissions.set(userLangKey, byte);
    }
  }

  const allHoleKeys = Array.from(globalHoleMin.keys());
  const rowsMap = new Map();

  for (const holeKey of allHoleKeys) {
    const [hole, scoring] = holeKey.split("::");
    const holeByteMin = globalHoleMin.get(holeKey);

    let u1BestPoint = 0, u1BestByte = 0, u1BestLang = "";
    let u2BestPoint = 0, u2BestByte = 0, u2BestLang = "";

    for (const [langKey, langStat] of globalLangStats.entries()) {
      if (!langKey.startsWith(`${holeKey}::`)) continue;
      const lang = langKey.split("::")[2];

      const u1UserKey = `${holeKey}::${lang}::${u1Lower}`;
      if (userBestSubmissions.has(u1UserKey)) {
        const loginByte = userBestSubmissions.get(u1UserKey);
        const solCount = langStat.logins.size;
        const langByteMin = langStat.min_bytes;
        const sqrtN = Math.sqrt(solCount);
        const sb = ((sqrtN + 2.0) / (sqrtN + 3.0)) * langByteMin + (1.0 / (sqrtN + 3.0)) * holeByteMin;
        const point = (sb / loginByte) * 1000.0;

        if (point > u1BestPoint) {
          u1BestPoint = point;
          u1BestByte = loginByte;
          u1BestLang = lang;
        }
      }

      if (u2Lower) {
        const u2UserKey = `${holeKey}::${lang}::${u2Lower}`;
        if (userBestSubmissions.has(u2UserKey)) {
          const loginByte = userBestSubmissions.get(u2UserKey);
          const solCount = langStat.logins.size;
          const langByteMin = langStat.min_bytes;
          const sqrtN = Math.sqrt(solCount);
          const sb = ((sqrtN + 2.0) / (sqrtN + 3.0)) * langByteMin + (1.0 / (sqrtN + 3.0)) * holeByteMin;
          const point = (sb / loginByte) * 1000.0;

          if (point > u2BestPoint) {
            u2BestPoint = point;
            u2BestByte = loginByte;
            u2BestLang = lang;
          }
        }
      }
    }

    if (!rowsMap.has(hole)) {
      rowsMap.set(hole, {
        hole,
        bytes: { u1Pt: 0, u1B: 0, u1L: '', u2Pt: 0, u2B: 0, u2L: '' },
        chars: { u1Pt: 0, u1B: 0, u1L: '', u2Pt: 0, u2B: 0, u2L: '' },
      });
    }

    const rowObj = rowsMap.get(hole);
    if (scoring === "bytes") {
      rowObj.bytes = { u1Pt: u1BestPoint, u1B: u1BestByte, u1L: u1BestLang, u2Pt: u2BestPoint, u2B: u2BestByte, u2L: u2BestLang };
    } else if (scoring === "chars") {
      rowObj.chars = { u1Pt: u1BestPoint, u1B: u1BestByte, u1L: u1BestLang, u2Pt: u2BestPoint, u2B: u2BestByte, u2L: u2BestLang };
    }
  }

  return {
    u1Name,
    u2Name,
    rows: Array.from(rowsMap.values())
  };
}

function renderCompareResults(data, sortOrder) {
  const { u1Name, u2Name, rows } = data;
  const statsContainer = document.getElementById('statsContainer');
  const tableHead = document.getElementById('tableHead');
  const resultsBody = document.getElementById('resultsBody');

  let u1Total = 0, u2Total = 0;
  rows.forEach(r => {
    u1Total += Math.round(r.bytes.u1Pt) + Math.round(r.chars.u1Pt);
    u2Total += Math.round(r.bytes.u2Pt) + Math.round(r.chars.u2Pt);
  });

  statsContainer.innerHTML = `
    <div class="stat-box">
      <div class="val">${u1Total.toLocaleString()}</div>
      <div class="lbl">${escapeHtml(u1Name)} Total Score</div>
    </div>
    ${u2Name ? `
    <div class="stat-box">
      <div class="val">${u2Total.toLocaleString()}</div>
      <div class="lbl">${escapeHtml(u2Name)} Total Score</div>
    </div>
    <div class="stat-box">
      <div class="val" style="color: ${u1Total >= u2Total ? 'var(--win)' : 'var(--loss)'}">
        ${(u1Total - u2Total > 0 ? '+' : '')}${(u1Total - u2Total).toLocaleString()}
      </div>
      <div class="lbl">Difference (U1 - U2)</div>
    </div>
    ` : ''}
  `;

  tableHead.innerHTML = `
    <tr>
      <th>Hole</th>
      <th>${escapeHtml(u1Name)} Bytes</th>
      <th>${escapeHtml(u1Name)} Chars</th>
      ${u2Name ? `
        <th>${escapeHtml(u2Name)} Bytes</th>
        <th>${escapeHtml(u2Name)} Chars</th>
        <th>Diff (U1 - U2)</th>
      ` : ''}
    </tr>
  `;

  sortAndRenderCompareTable(rows, sortOrder, u2Name);
  document.getElementById('resultsCard').classList.remove('hidden');
}

function sortAndRenderCompareTable(rows, sortOrder, u2Name) {
  const resultsBody = document.getElementById('resultsBody');
  const filterText = document.getElementById('tableSearch').value.toLowerCase();

  const sorted = [...rows].sort((a, b) => {
    const aU1 = Math.round(a.bytes.u1Pt) + Math.round(a.chars.u1Pt);
    const bU1 = Math.round(b.bytes.u1Pt) + Math.round(b.chars.u1Pt);
    const aU2 = Math.round(a.bytes.u2Pt) + Math.round(a.chars.u2Pt);
    const bU2 = Math.round(b.bytes.u2Pt) + Math.round(b.chars.u2Pt);

    if (sortOrder === 'u1-desc') return bU1 - aU1;
    if (sortOrder === 'u2-desc') return bU2 - aU2;
    if (sortOrder === 'diff-desc') return (bU1 - bU2) - (aU1 - aU2);
    if (sortOrder === 'diff-asc') return (aU1 - aU2) - (bU1 - bU2);
    if (sortOrder === 'alpha-asc') return a.hole.localeCompare(b.hole);
    if (sortOrder === 'alpha-desc') return b.hole.localeCompare(a.hole);
    return 0;
  });

  resultsBody.innerHTML = '';
  sorted.forEach(r => {
    if (filterText && !r.hole.toLowerCase().includes(filterText)) return;

    const u1B = Math.round(r.bytes.u1Pt);
    const u1C = Math.round(r.chars.u1Pt);
    const u2B = Math.round(r.bytes.u2Pt);
    const u2C = Math.round(r.chars.u2Pt);

    const u1Sum = u1B + u1C;
    const u2Sum = u2B + u2C;
    const diff = u1Sum - u2Sum;

    let diffClass = 'diff-zero';
    if (diff > 0) diffClass = 'diff-pos';
    else if (diff < 0) diffClass = 'diff-neg';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <a href="https://code.golf/holes/${r.hole}" target="_blank" rel="noopener noreferrer" class="golf-link">
          ${escapeHtml(r.hole)}
        </a>
      </td>
      <td>${u1B ? `${u1B} <span style="color:var(--text-dim);font-size:0.85rem">(${r.bytes.u1B}b ${r.bytes.u1L})</span>` : '-'}</td>
      <td>${u1C ? `${u1C} <span style="color:var(--text-dim);font-size:0.85rem">(${r.chars.u1B}c ${r.chars.u1L})</span>` : '-'}</td>
      ${u2Name ? `
        <td>${u2B ? `${u2B} <span style="color:var(--text-dim);font-size:0.85rem">(${r.bytes.u2B}b ${r.bytes.u2L})</span>` : '-'}</td>
        <td>${u2C ? `${u2C} <span style="color:var(--text-dim);font-size:0.85rem">(${r.chars.u2B}c ${r.chars.u2L})</span>` : '-'}</td>
        <td class="${diffClass}">${diff > 0 ? '+' + diff : diff}</td>
      ` : ''}
    `;
    resultsBody.appendChild(tr);
  });
}

document.getElementById('activeSortSelect').addEventListener('change', (e) => {
  if (lastCompareResults) {
    sortAndRenderCompareTable(lastCompareResults.rows, e.target.value, lastCompareResults.u2Name);
  }
});

document.getElementById('tableSearch').addEventListener('input', () => {
  if (lastCompareResults) {
    const sortOrder = document.getElementById('activeSortSelect').value;
    sortAndRenderCompareTable(lastCompareResults.rows, sortOrder, lastCompareResults.u2Name);
  }
});

// ==========================================
// PAGE 2: Custom Leaderboard Logic (Bytes Only)
// ==========================================
document.getElementById('lbGoBtn').addEventListener('click', async () => {
  const inputVal = document.getElementById('leaderboardUsersInput').value.trim();
  const formulaType = document.getElementById('scoringFormulaSelect').value;
  
  const subFileInput = document.getElementById('submissionsFile').files[0];
  const holesFileInput = document.getElementById('holesFile');
  const langsFileInput = document.getElementById('langsFile');
  const includeExperimental = document.getElementById('experimentalCheck')?.checked ?? false;

  if (!inputVal) {
    alert("Please enter at least one username.");
    return;
  }

  if (!subFileInput) {
    if (confirm("Submissions JSON (solutions.json) is mandatory!\n\nWould you like to visit GitHub to download solutions.json?")) {
      window.open(GITHUB_HISTORY_URL, '_blank');
    }
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
      formulaType
    );

    renderLeaderboard(lastLeaderboardResults);
  } catch (err) {
    alert(err.message);
  } finally {
    hideLoading();
  }
});

function processLeaderboardData(jsonData, targetUsers, holesJson, langsJson, includeExperimental, formulaType = 'standard') {
  const targetMap = new Map();
  targetUsers.forEach(u => targetMap.set(u.toLowerCase(), u));

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

  // Process ONLY Bytes solutions
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
  const leaderboard = [];

  // Formula constants switch
  const offset1 = formulaType === 'alt' ? 8.0 : 2.0;
  const offset2 = formulaType === 'alt' ? 9.0 : 3.0;

  for (const [targetLower, displayName] of targetMap.entries()) {
    let totalPoints = 0;
    let totalBytes = 0;
    let holesSolved = 0;

    for (const hole of allHoles) {
      const holeByteMin = globalHoleMin.get(hole);
      let bestHolePoint = 0;
      let bestHoleByte = 0;

      for (const [langKey, langStat] of globalLangStats.entries()) {
        if (!langKey.startsWith(`${hole}::`)) continue;
        const lang = langKey.split("::")[1];
        const userLangKey = `${hole}::${lang}::${targetLower}`;

        if (userBestSubmissions.has(userLangKey)) {
          const loginByte = userBestSubmissions.get(userLangKey);
          const solCount = langStat.logins.size;
          const langByteMin = langStat.min_bytes;
          const sqrtN = Math.sqrt(solCount);

          // Code.golf scoring formula based on chosen option
          const sb = ((sqrtN + offset1) / (sqrtN + offset2)) * langByteMin + (1.0 / (sqrtN + offset2)) * holeByteMin;
          const point = (sb / loginByte) * 1000.0;

          if (point > bestHolePoint) {
            bestHolePoint = point;
            bestHoleByte = loginByte;
          }
        }
      }

      if (bestHolePoint > 0) {
        const roundedPoint = Math.round(bestHolePoint);
        if (roundedPoint > 0) {
          totalPoints += roundedPoint;
          totalBytes += bestHoleByte;
          holesSolved++;
        }
      }
    }

    leaderboard.push({
      name: displayName,
      holes: holesSolved,
      points: totalPoints,
      bytes: totalBytes
    });
  }

  // Sort by Points descending, then Bytes ascending
  leaderboard.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    return a.bytes - b.bytes;
  });

  return leaderboard;
}

function renderLeaderboard(results) {
  const tbody = document.getElementById('lbResultsBody');
  tbody.innerHTML = '';

  results.forEach((row, index) => {
    const tr = document.createElement('tr');
    const profileUrl = `https://code.golf/golfers/${encodeURIComponent(row.name)}`;

    tr.innerHTML = `
      <td><strong>${index + 1}</strong></td>
      <td>
        <a href="${profileUrl}" target="_blank" rel="noopener noreferrer" class="golf-link">
          <strong>${escapeHtml(row.name)}</strong>
        </a>
      </td>
      <td>${row.holes.toLocaleString()}</td>
      <td><strong>${row.points.toLocaleString()}</strong></td>
      <td>${row.bytes.toLocaleString()}</td>
    `;
    tbody.appendChild(tr);
  });

  document.getElementById('lbResultsCard').classList.remove('hidden');
}

// ==========================================
// TXT Export Feature
// ==========================================
document.getElementById('exportLbTxtBtn').addEventListener('click', () => {
  if (!lastLeaderboardResults || lastLeaderboardResults.length === 0) {
    alert("No leaderboard data to export!");
    return;
  }

  const txtContent = generateAsciiTable(lastLeaderboardResults);
  downloadTxtFile('leaderboard.txt', txtContent);
});

function generateAsciiTable(results) {
  const headers = ['#', 'golfer', 'holes', 'points', 'bytes'];
  
  const rows = results.map((row, index) => [
    String(index + 1),
    row.name,
    row.holes.toLocaleString(),
    row.points.toLocaleString(),
    row.bytes.toLocaleString()
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