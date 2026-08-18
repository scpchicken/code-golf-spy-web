/**
 * Page 2: Custom Leaderboard Logic (Bytes Only)
 */

document.getElementById('lbGoBtn')?.addEventListener('click', async () => {
  const inputVal = document.getElementById('leaderboardUsersInput')?.value.trim() || '';
  const minScore = parseFloat(document.getElementById('lbFormulaValue')?.textContent || 750);
  const chiExponent = parseFloat(document.getElementById('lbChiValue')?.textContent || 1);
  const lambdaExponent = parseFloat(document.getElementById('lbLambdaSlider')?.value || 1000);
  
  const subFileInput = document.getElementById('submissionsFile');
  const holesFileInput = document.getElementById('holesFile');
  const langsFileInput = document.getElementById('langsFile');

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

function processLeaderboardData(jsonData, targetUsers, holesJson, langsJson, minScore = 750, chiExponent = 1, lambdaExponent = 1000) {
  const targetMap = new Map();
  targetUsers.forEach((u, index) => {
    targetMap.set(u.toLowerCase(), { displayName: u, initialRank: index + 1 });
  });

  const validHoles = computeValidHoles(holesJson);
  const validLangs = computeValidLangs(langsJson);

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
    else if (sortField === 'points') { valA = a.points; valB = b.points; }
    else if (sortField === 'diamonds') { 
      valA = a.diamondContrib; valB = b.diamondContrib;
      if (valA === valB) {
        valA = a.diamonds; valB = b.diamonds;
      }
    }
    else if (sortField === 'bytes') { valA = a.bytes; valB = b.bytes; }
    else if (sortField === 'change') { valA = a.rankChange; valB = b.rankChange; }
    else { valA = a.points; valB = b.points; }

    if (valA !== valB) return sortDir === 'desc' ? valB - valA : valA - valB;

    if (sortField === 'points') return a.bytes - b.bytes;
    if (sortField === 'bytes') return b.points - a.points;
    return a.name.localeCompare(b.name);
  });
}

function renderLeaderboard(leaderboard) {
  const lbResultsCard = document.getElementById('lbResultsCard');
  const lbResultsBody = document.getElementById('lbResultsBody');

  const thead = document.querySelector('#lbResultsTable thead');
  if (thead) {
    const renderTh = (id, label, fieldName, align = 'left') => {
      const isCurrent = currentLbSortField === fieldName;
      const arrow = isCurrent ? (currentLbSortDir === 'desc' ? ' ▼' : ' ▲') : '';
      const colorStyle = isCurrent ? 'color: #38bdf8;' : 'color: inherit;';
      return `<th id="${id}" style="text-align: ${align}; cursor: pointer; user-select: none; ${colorStyle}">${label}${arrow}</th>`;
    };

    thead.innerHTML = `
      <tr>
        ${renderTh('thLBRank', '#', 'rank')}
        ${renderTh('thLBName', 'Name', 'name')}
        ${renderTh('thLBHoles', 'Holes', 'holes')}
        ${renderTh('thLBPoints', 'Points', 'points', 'right')}
        ${renderTh('thLBDiamonds', '💎', 'diamonds', 'right')}
        ${renderTh('thLBBytes', 'Bytes', 'bytes', 'right')}
        ${renderTh('thLBChange', '+/-', 'change', 'right')}
      </tr>
    `;

    const bindLBSort = (id, fieldName, defaultDir = 'desc') => {
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

    bindLBSort('thLBRank', 'rank', 'asc');
    bindLBSort('thLBName', 'name', 'asc');
    bindLBSort('thLBHoles', 'holes', 'desc');
    bindLBSort('thLBPoints', 'points', 'desc');
    bindLBSort('thLBDiamonds', 'diamonds', 'desc');
    bindLBSort('thLBBytes', 'bytes', 'asc');
    bindLBSort('thLBChange', 'change', 'desc');
  }

  const sortedLeaderboard = sortLeaderboardData(leaderboard, currentLbSortField, currentLbSortDir);
  lbResultsBody.innerHTML = '';

  sortedLeaderboard.forEach(r => {
    const tr = document.createElement('tr');

    const rankChangeClass = r.rankChange > 0 ? 'diff-pos' : r.rankChange < 0 ? 'diff-neg' : 'diff-zero';
    const rankChangeText = r.rankChange > 0 ? `+${r.rankChange}` : r.rankChange === 0 ? '-' : r.rankChange;

    const pointsDisplay = `<strong>${r.points.toLocaleString()}</strong>`;

    tr.innerHTML = `
      <td>${r.standardRank}</td>
      <td>${getGolferLink(r.name)}</td>
      <td>${r.holes}</td>
      <td style="text-align: right;">${pointsDisplay}</td>
      <td style="text-align: right;">${r.diamondContrib.toLocaleString()}</td>
      <td style="text-align: right;">${r.bytes.toLocaleString()}</td>
      <td style="text-align: right;" class="${rankChangeClass}">${rankChangeText}</td>
    `;
    lbResultsBody.appendChild(tr);
  });

  lbResultsCard.classList.remove('hidden');
}

document.getElementById('leaderboardUsersLabel')?.addEventListener('click', (e) => {
  e.preventDefault();
  const input = document.getElementById('leaderboardUsersInput');
  if (input) {
    input.value = DEFAULT_GOLFERS_LIST;
    input.focus();
  }
});

document.getElementById('exportLbTxtBtn')?.addEventListener('click', () => {
  if (!lastLeaderboardResults || lastLeaderboardResults.length === 0) return;
  const sortedRows = sortLeaderboardData(lastLeaderboardResults, currentLbSortField, currentLbSortDir);
  const headers = ['#', 'Name', 'Holes', 'Points', 'Diamonds', 'Bytes', '+/-'];
  const rightAlignCols = [3, 4, 5, 6];

  const tableRows = sortedRows.map(r => [
    String(r.standardRank),
    r.name,
    String(r.holes),
    r.points.toLocaleString(),
    r.diamondContrib.toLocaleString(),
    r.bytes.toLocaleString(),
    r.rankChange > 0 ? `+${r.rankChange}` : r.rankChange === 0 ? '-' : String(r.rankChange)
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
  const mdContent = [headerLine, separatorLine, ...dataLines].join('\n');

  downloadMarkdownFile('custom_leaderboard.md', mdContent);
});