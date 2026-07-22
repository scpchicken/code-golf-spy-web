const UNSET_BYTE = 696969420;
const GITHUB_HISTORY_URL = `https://github.com/scpchicken/code-golf-history/tree/main/${new Date().getFullYear()}`;
let globalProcessedData = null;

// Utility: Trigger download of JSON object or string
function triggerDownload(content, fileName) {
  const jsonStr = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Read local file as JSON
function readJsonFile(file) {
  return new Promise((resolve, reject) => {
    if (!file) return resolve(null);
    const reader = new FileReader();
    reader.onload = e => {
      try { resolve(JSON.parse(e.target.result)); }
      catch (err) { reject(new Error(`Failed to parse ${file.name}`)); }
    };
    reader.onerror = () => reject(new Error(`Error reading ${file.name}`));
    reader.readAsText(file);
  });
}

// Fetch JSON with CORS proxy fallback
async function getOrFetchJson(fileInput, targetUrl, label) {
  if (fileInput && fileInput.files[0]) {
    return await readJsonFile(fileInput.files[0]);
  }

  // 1st Attempt: Direct fetch
  try {
    const response = await fetch(targetUrl);
    if (response.ok) return await response.json();
  } catch (directErr) {
    console.warn(`Direct fetch failed for ${targetUrl}, trying proxy...`);
  }

  // 2nd Attempt: Fetch via CORS proxy
  try {
    const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`;
    const response = await fetch(proxyUrl);
    if (response.ok) return await response.json();
  } catch (proxyErr) {
    console.error(`Proxy fetch also failed for ${targetUrl}`);
  }

  throw new Error(`Could not fetch ${label} directly from browser due to CORS security.`);
}

// Download Button Listeners
document.getElementById('dlHolesBtn').addEventListener('click', async () => {
  try {
    const fileInput = document.getElementById('holesFile');
    const data = await getOrFetchJson(fileInput, 'https://code.golf/api/holes', 'holes.json');
    triggerDownload(data, 'holes.json');
  } catch (err) {
    alert(err.message);
  }
});

document.getElementById('dlLangsBtn').addEventListener('click', async () => {
  try {
    const fileInput = document.getElementById('langsFile');
    const data = await getOrFetchJson(fileInput, 'https://code.golf/api/langs', 'langs.json');
    triggerDownload(data, 'langs.json');
  } catch (err) {
    alert(err.message);
  }
});

document.getElementById('dlSolutionsBtn').addEventListener('click', async () => {
  try {
    const fileInput = document.getElementById('submissionsFile');
    const data = await getOrFetchJson(fileInput, 'https://code.golf/scores/all-holes/all-langs/all', 'solutions.json');
    triggerDownload(data, 'solutions.json');
  } catch (err) {
    if (confirm(`${err.message}\n\nWould you like to open GitHub to download solutions.json from the history repository?`)) {
      window.open(GITHUB_HISTORY_URL, '_blank');
    }
  }
});

// Download Results JSON
document.getElementById('dlResultsBtn').addEventListener('click', () => {
  if (!globalProcessedData) return;
  triggerDownload(globalProcessedData.rows, 'code_golf_results.json');
});

// GO! Button Listener
document.getElementById('goBtn').addEventListener('click', async () => {
  const subFileInput = document.getElementById('submissionsFile').files[0];
  const user1 = document.getElementById('user1Input').value.trim();
  const user2 = document.getElementById('user2Input').value.trim();
  const langFilter = document.getElementById('langFilterInput').value.trim() || null;
  const initialSort = document.getElementById('sortOrderInput').value;
  const holesFileInput = document.getElementById('holesFile');
  const langsFileInput = document.getElementById('langsFile');
  const includeExperimental = document.getElementById('experimentalCheck').checked;

  if (!subFileInput) {
    if (confirm("Submissions JSON (solutions.json) is mandatory!\n\nWould you like to visit GitHub to download solutions.json?")) {
      window.open(GITHUB_HISTORY_URL, '_blank');
    }
    return;
  }
  if (!user1) {
    alert("Please enter at least Username 1.");
    return;
  }

  try {
    const [submissionsData, holesData, langsData] = await Promise.all([
      readJsonFile(subFileInput),
      getOrFetchJson(holesFileInput, 'https://code.golf/api/holes', 'holes.json'),
      getOrFetchJson(langsFileInput, 'https://code.golf/api/langs', 'langs.json')
    ]);

    globalProcessedData = processGolfData(
      submissionsData,
      user1,
      user2,
      langFilter,
      holesData,
      langsData,
      includeExperimental
    );

    document.getElementById('activeSortSelect').value = initialSort;
    document.getElementById('dlResultsBtn').classList.remove('hidden');
    renderData(initialSort);
  } catch (err) {
    alert(err.message);
  }
});

function processGolfData(jsonData, u1Name, u2Name, langFilter, holesJson, langsJson, includeExperimental) {
  const hasUser2 = Boolean(u2Name);

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
    const byte = Number(x.bytes);

    if (langFilter && lang !== langFilter) continue;
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
    langStat.logins.add(login);

    const userLangKey = `${hole}::${lang}::${login}`;
    if (!userBestSubmissions.has(userLangKey) || byte < userBestSubmissions.get(userLangKey)) {
      userBestSubmissions.set(userLangKey, byte);
    }
  }

  const holeLangUsers = new Map();
  for (const [userLangKey, byte] of userBestSubmissions.entries()) {
    const parts = userLangKey.split("::");
    const key = `${parts[0]}::${parts[1]}`;
    const login = parts[2];

    if (!holeLangUsers.has(key)) holeLangUsers.set(key, []);
    holeLangUsers.get(key).push({ login, byte });
  }

  const medalsMap = new Map();
  for (const [key, users] of holeLangUsers.entries()) {
    users.sort((a, b) => a.byte - b.byte);

    for (let i = 0; i < users.length; i++) {
      const current = users[i];
      const strictlyFewer = users.filter(u => u.byte < current.byte).length;
      const place = strictlyFewer + 1;
      const tiedCount = users.filter(u => u.byte === current.byte).length;

      let medal = "";
      if (place === 1) {
        medal = tiedCount === 1 ? "💎" : "🥇";
      } else if (place === 2) {
        medal = "🥈";
      } else if (place === 3) {
        medal = "🥉";
      }

      medalsMap.set(`${key}::${current.login}`, medal);
    }
  }

  function getUserHoleResult(hole, targetLogin) {
    if (!targetLogin) return { lang: "N/A", point: 0, medal: "" };

    const candidates = [];
    const holeByteMin = globalHoleMin.get(hole);

    for (const [key, langStat] of globalLangStats.entries()) {
      if (!key.startsWith(`${hole}::`)) continue;
      const lang = key.split("::")[1];
      const userLangKey = `${hole}::${lang}::${targetLogin}`;

      if (userBestSubmissions.has(userLangKey)) {
        const loginByte = userBestSubmissions.get(userLangKey);
        const solCount = langStat.logins.size;
        const langByteMin = langStat.min_bytes;
        const sqrtN = Math.sqrt(solCount);

        let point = 0;
        if (langFilter) {
          point = (holeByteMin / loginByte) * 1000.0;
        } else {
          const sb = ((sqrtN + 2.0) / (sqrtN + 3.0)) * langByteMin + (1.0 / (sqrtN + 3.0)) * holeByteMin;
          point = (sb / loginByte) * 1000.0;
        }

        const medal = medalsMap.get(userLangKey) || "";
        candidates.push({ lang, point, medal });
      }
    }

    if (candidates.length === 0) {
      return { lang: "N/A", point: 0, medal: "" };
    }

    candidates.sort((a, b) => {
      if (a.point !== b.point) return a.point - b.point;
      return a.lang.localeCompare(b.lang);
    });

    const best = candidates[candidates.length - 1];
    const roundedPoint = Math.round(best.point);

    if (roundedPoint === 0) {
      return { lang: "N/A", point: 0, medal: "" };
    }

    return {
      lang: best.lang,
      point: roundedPoint,
      medal: best.medal
    };
  }

  const allHoles = Array.from(globalHoleMin.keys()).sort();
  const rows = [];
  let u1TotalScore = 0;
  let u1SolvedCount = 0;
  let u2TotalScore = 0;
  let u2SolvedCount = 0;

  for (const hole of allHoles) {
    const u1Res = getUserHoleResult(hole, u1Name);
    const u2Res = hasUser2 ? getUserHoleResult(hole, u2Name) : null;

    if (u1Res.point > 0) {
      u1TotalScore += u1Res.point;
      u1SolvedCount++;
    }

    if (u2Res && u2Res.point > 0) {
      u2TotalScore += u2Res.point;
      u2SolvedCount++;
    }

    const diff = u1Res.point - (u2Res ? u2Res.point : 0);

    rows.push({
      hole,
      u1Lang: u1Res.lang,
      u1Point: u1Res.point,
      u1Medal: u1Res.medal,
      u2Lang: u2Res ? u2Res.lang : "N/A",
      u2Point: u2Res ? u2Res.point : 0,
      u2Medal: u2Res ? u2Res.medal : "",
      diff
    });
  }

  return {
    rows,
    u1Name,
    u1TotalScore,
    u1SolvedCount,
    u2Name,
    u2TotalScore,
    u2SolvedCount,
    hasUser2
  };
}

function renderData(sortOption) {
  if (!globalProcessedData) return;
  const data = globalProcessedData;

  const statsContainer = document.getElementById('statsContainer');
  statsContainer.innerHTML = '';

  if (data.hasUser2) {
    const diffTotal = data.u1TotalScore - data.u2TotalScore;
    const diffSign = diffTotal > 0 ? `+${diffTotal.toLocaleString()}` : diffTotal.toLocaleString();

    statsContainer.innerHTML = `
      <div class="stat-box">
        <div class="val">${data.u1TotalScore.toLocaleString()}</div>
        <div class="lbl">${escapeHtml(data.u1Name)} (${data.u1SolvedCount} solved)</div>
      </div>
      <div class="stat-box">
        <div class="val">${data.u2TotalScore.toLocaleString()}</div>
        <div class="lbl">${escapeHtml(data.u2Name)} (${data.u2SolvedCount} solved)</div>
      </div>
      <div class="stat-box">
        <div class="val ${diffTotal > 0 ? 'diff-pos' : diffTotal < 0 ? 'diff-neg' : 'diff-zero'}">${diffSign}</div>
        <div class="lbl">SCORE DIFF (U1 - U2)</div>
      </div>
    `;
  } else {
    statsContainer.innerHTML = `
      <div class="stat-box">
        <div class="val">${data.u1TotalScore.toLocaleString()}</div>
        <div class="lbl">TOTAL SCORE</div>
      </div>
      <div class="stat-box">
        <div class="val">${data.u1SolvedCount}</div>
        <div class="lbl">HOLES SOLVED</div>
      </div>
    `;
  }

  const tableHead = document.getElementById('tableHead');
  if (data.hasUser2) {
    tableHead.innerHTML = `
      <tr>
        <th>Hole</th>
        <th>${escapeHtml(data.u1Name)} (Lang)</th>
        <th>${escapeHtml(data.u1Name)} (Score)</th>
        <th>${escapeHtml(data.u2Name)} (Lang)</th>
        <th>${escapeHtml(data.u2Name)} (Score)</th>
        <th>Diff</th>
      </tr>
    `;
  } else {
    tableHead.innerHTML = `
      <tr>
        <th>Hole</th>
        <th>Language</th>
        <th>Points</th>
      </tr>
    `;
  }

  const sortedRows = sortRows([...data.rows], sortOption);

  const tbody = document.getElementById('resultsBody');
  tbody.innerHTML = '';

  sortedRows.forEach(row => {
    const tr = document.createElement('tr');

    const u1LangDisplay = row.u1Lang + (row.u1Medal ? ` <span class="medal">${row.u1Medal}</span>` : '');
    const u2LangDisplay = row.u2Lang + (row.u2Medal ? ` <span class="medal">${row.u2Medal}</span>` : '');

    if (data.hasUser2) {
      const diffClass = row.diff > 0 ? 'diff-pos' : row.diff < 0 ? 'diff-neg' : 'diff-zero';
      const diffText = row.diff > 0 ? `+${row.diff.toLocaleString()}` : row.diff.toLocaleString();

      tr.innerHTML = `
        <td><strong>${escapeHtml(row.hole)}</strong></td>
        <td>${u1LangDisplay}</td>
        <td><strong>${row.u1Point.toLocaleString()}</strong></td>
        <td>${u2LangDisplay}</td>
        <td><strong>${row.u2Point.toLocaleString()}</strong></td>
        <td class="${diffClass}">${diffText}</td>
      `;
    } else {
      tr.innerHTML = `
        <td><strong>${escapeHtml(row.hole)}</strong></td>
        <td>${u1LangDisplay}</td>
        <td><strong>${row.u1Point.toLocaleString()}</strong></td>
      `;
    }
    tbody.appendChild(tr);
  });

  document.getElementById('resultsCard').classList.remove('hidden');
  applySearchFilter();
}

function sortRows(rows, sortOption) {
  switch (sortOption) {
    case 'u1-desc':
      return rows.sort((a, b) => b.u1Point - a.u1Point || a.hole.localeCompare(b.hole));
    case 'diff-desc':
      return rows.sort((a, b) => b.diff - a.diff || a.hole.localeCompare(b.hole));
    case 'diff-asc':
      return rows.sort((a, b) => a.diff - b.diff || a.hole.localeCompare(b.hole));
    case 'alpha-asc':
      return rows.sort((a, b) => a.hole.localeCompare(b.hole));
    case 'alpha-desc':
      return rows.sort((a, b) => b.hole.localeCompare(a.hole));
    default:
      return rows;
  }
}

document.getElementById('activeSortSelect').addEventListener('change', (e) => {
  renderData(e.target.value);
});

document.getElementById('tableSearch').addEventListener('input', applySearchFilter);

function applySearchFilter() {
  const term = document.getElementById('tableSearch').value.toLowerCase();
  const rows = document.querySelectorAll('#resultsBody tr');
  rows.forEach(row => {
    const text = row.textContent.toLowerCase();
    row.style.display = text.includes(term) ? '' : 'none';
  });
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  }[m]));
}