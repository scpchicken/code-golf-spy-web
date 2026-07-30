/**
 * Page 3: Query Solutions Logic
 */

document.getElementById('queryGoBtn')?.addEventListener('click', async () => {
  const queryType = document.getElementById('queryTypeSelect')?.value;
  const subFileInput = document.getElementById('submissionsFile');
  const holesFileInput = document.getElementById('holesFile');
  const langsFileInput = document.getElementById('langsFile');
  const includeExperimental = document.getElementById('experimentalCheck')?.checked ?? false;

  if (!queryType) {
    alert("Please select a query type.");
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

    lastQueryResults = runSolutionsQuery(
      submissionsData, 
      queryType, 
      holesData, 
      langsData, 
      includeExperimental
    );
    
    currentQuerySortField = 'bytes';
    currentQuerySortDir = 'desc';
    
    renderQueryResults(lastQueryResults, queryType);
  } catch (err) {
    alert(err.message);
  } finally {
    hideLoading();
  }
});

function runSolutionsQuery(jsonData, queryType, holesJson, langsJson, includeExperimental) {
  const holeLangUsers = new Map();

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

  for (const x of jsonData) {
    if (x.scoring !== "bytes") continue;

    const lang = x.lang;
    const hole = x.hole;
    const login = x.login;
    const byte = Number(x.bytes);

    if (validHoles && !validHoles.has(hole)) continue;
    if (validLangs && !validLangs.has(lang)) continue;

    const key = `${hole}::${lang}`;
    if (!holeLangUsers.has(key)) {
      holeLangUsers.set(key, []);
    }
    holeLangUsers.get(key).push({ login, byte });
  }

  const results = [];
  let totalGolds = 0;
  let totalDiamonds = 0;
  let totalUnicorns = 0;

  for (const [key, users] of holeLangUsers.entries()) {
    const parts = key.split("::");
    const hole = parts[0];
    const lang = parts[1];

    users.sort((a, b) => a.byte - b.byte);
    if (users.length === 0) continue;

    const minByte = users[0].byte;
    const tiedForFirst = users.filter(u => u.byte === minByte);

    const isDiamond = tiedForFirst.length === 1;
    const isUnicorn = isDiamond && users.length === 1;

    if (isUnicorn) totalUnicorns++;
    if (isDiamond) totalDiamonds++;
    totalGolds += tiedForFirst.length;
      
    let typeLabel = '';
    let shouldInclude = false;

    if (queryType === 'longest_unicorns' && isUnicorn) {
      shouldInclude = true;
      typeLabel = '🦄 Unicorn';
    } else if (queryType === 'longest_diamonds' && isDiamond) {
      shouldInclude = true;
      typeLabel = isUnicorn ? '🦄 Unicorn' : '💎 Diamond';
    } else if (queryType === 'longest_golds') {
      shouldInclude = true;
      typeLabel = isDiamond ? '💎 Diamond' : `🥇 Gold (Tie: ${tiedForFirst.length})`;
    }

    if (shouldInclude) {
      tiedForFirst.forEach(winner => {
        results.push({
          hole,
          lang,
          golfer: winner.login,
          bytes: winner.byte,
          type: typeLabel
        });
      });
    }
  }

  return {
    results,
    totalGolds,
    totalDiamonds,
    totalUnicorns
  };
}

function sortQueryData(results, sortField, sortDir) {
  return [...results].sort((a, b) => {
    let valA, valB;
    if (sortField === 'hole') {
      return sortDir === 'asc' ? a.hole.localeCompare(b.hole) : b.hole.localeCompare(a.hole);
    } else if (sortField === 'lang') {
      return sortDir === 'asc' ? a.lang.localeCompare(b.lang) : b.lang.localeCompare(a.lang);
    } else if (sortField === 'golfer') {
      return sortDir === 'asc' ? a.golfer.localeCompare(b.golfer) : b.golfer.localeCompare(a.golfer);
    } else if (sortField === 'bytes') {
      valA = a.bytes; valB = b.bytes;
    } else if (sortField === 'type') {
      return sortDir === 'asc' ? a.type.localeCompare(b.type) : b.type.localeCompare(a.type);
    } else {
      valA = a.bytes; valB = b.bytes;
    }

    if (valA !== valB) return sortDir === 'desc' ? valB - valA : valA - valB;
    return a.hole.localeCompare(b.hole) || a.lang.localeCompare(b.lang);
  });
}

function renderQueryResults(queryData, queryType) {
  const queryResultsCard = document.getElementById('queryResultsCard');
  const queryResultsTitle = document.getElementById('queryResultsTitle');
  const queryStatsContainer = document.getElementById('queryStatsContainer');
  const thead = document.querySelector('#queryResultsTable thead');

  const titleMap = {
    'longest_golds': 'Longest BYTES Golds',
    'longest_diamonds': 'Longest BYTES Diamonds',
    'longest_unicorns': 'Longest BYTES Unicorns'
  };
  queryResultsTitle.textContent = `${titleMap[queryType] || 'Query Results'} (Top 100)`;

  if (queryStatsContainer) {
    queryStatsContainer.innerHTML = `
      <div class="stat-box">
        <div class="val">${queryData.totalGolds.toLocaleString()}</div>
        <div class="lbl">🥇 Total Golds</div>
      </div>
      <div class="stat-box">
        <div class="val">${queryData.totalDiamonds.toLocaleString()}</div>
        <div class="lbl">💎 Total Diamonds</div>
      </div>
      <div class="stat-box">
        <div class="val">${queryData.totalUnicorns.toLocaleString()}</div>
        <div class="lbl">🦄 Total Unicorns</div>
      </div>
    `;
  }

  if (thead) {
    const renderTh = (id, label, fieldName, align = 'left') => {
      const isCurrent = currentQuerySortField === fieldName;
      const arrow = isCurrent ? (currentQuerySortDir === 'desc' ? ' ▼' : ' ▲') : '';
      const colorStyle = isCurrent ? 'color: #38bdf8;' : 'color: inherit;';
      return `<th id="${id}" style="text-align: ${align}; cursor: pointer; user-select: none; ${colorStyle}">${label}${arrow}</th>`;
    };

    thead.innerHTML = `
      <tr>
        <th style="width: 40px; color: var(--text-dim);">#</th>
        ${renderTh('thQueryHole', 'Hole', 'hole')}
        ${renderTh('thQueryLang', 'Language', 'lang')}
        ${renderTh('thQueryGolfer', 'Golfer', 'golfer')}
        ${renderTh('thQueryBytes', 'Bytes', 'bytes', 'right')}
        ${renderTh('thQueryType', 'Type', 'type', 'right')}
      </tr>
    `;

    const bindSort = (id, fieldName, defaultDir = 'desc') => {
      const el = document.getElementById(id);
      el?.addEventListener('click', () => {
        if (currentQuerySortField === fieldName) {
          currentQuerySortDir = currentQuerySortDir === 'desc' ? 'asc' : 'desc';
        } else {
          currentQuerySortField = fieldName;
          currentQuerySortDir = defaultDir;
        }
        applyQueryFilterAndRender();
      });
    };

    bindSort('thQueryHole', 'hole', 'asc');
    bindSort('thQueryLang', 'lang', 'asc');
    bindSort('thQueryGolfer', 'golfer', 'asc');
    bindSort('thQueryBytes', 'bytes', 'desc');
    bindSort('thQueryType', 'type', 'asc');
  }

  applyQueryFilterAndRender();
  queryResultsCard.classList.remove('hidden');
}

function applyQueryFilterAndRender() {
  const queryResultsBody = document.getElementById('queryResultsBody');
  const filterText = (document.getElementById('queryTableSearch')?.value || '').toLowerCase();
  
  let filtered = lastQueryResults.results || [];
  
  if (filterText) {
    filtered = filtered.filter(r => 
      r.hole.toLowerCase().includes(filterText) || 
      r.lang.toLowerCase().includes(filterText) ||
      r.golfer.toLowerCase().includes(filterText)
    );
  }

  let sorted = sortQueryData(filtered, currentQuerySortField, currentQuerySortDir);
  const limitedResults = sorted.slice(0, 100);

  queryResultsBody.innerHTML = '';
  limitedResults.forEach((r, index) => {
    const tr = document.createElement('tr');
    
    const holeUrl = `https://code.golf/${encodeURIComponent(r.hole)}`;
    const holeDisplay = `<a href="${holeUrl}" target="_blank" rel="noopener noreferrer" class="golf-link"><strong>${escapeHtml(r.hole)}</strong></a>`;
    const langDisplay = formatLangDisplay(r.hole, r.lang);
    const golferDisplay = getGolferLink(r.golfer);

    tr.innerHTML = `
      <td style="color: var(--text-dim);">${index + 1}</td>
      <td>${holeDisplay}</td>
      <td>${langDisplay}</td>
      <td>${golferDisplay}</td>
      <td style="text-align: right;"><strong>${r.bytes.toLocaleString()}</strong></td>
      <td style="text-align: right; color: var(--text-dim);">${escapeHtml(r.type)}</td>
    `;
    queryResultsBody.appendChild(tr);
  });
}

document.getElementById('queryTableSearch')?.addEventListener('input', () => {
  if (lastQueryResults) applyQueryFilterAndRender();
});

document.getElementById('exportQueryTxtBtn')?.addEventListener('click', () => {
  if (!lastQueryResults || !lastQueryResults.results || lastQueryResults.results.length === 0) return;
  
  const filterText = (document.getElementById('queryTableSearch')?.value || '').toLowerCase();
  let filtered = lastQueryResults.results;
  
  if (filterText) {
    filtered = filtered.filter(r => 
      r.hole.toLowerCase().includes(filterText) || 
      r.lang.toLowerCase().includes(filterText) ||
      r.golfer.toLowerCase().includes(filterText)
    );
  }

  const sortedRows = sortQueryData(filtered, currentQuerySortField, currentQuerySortDir).slice(0, 100);
  const headers = ['#', 'Hole', 'Language', 'Golfer', 'Bytes', 'Type'];
  const rightAlignCols = [4, 5];

  const tableRows = sortedRows.map((r, i) => [
    String(i + 1),
    r.hole,
    r.lang,
    r.golfer,
    r.bytes.toLocaleString(),
    r.type
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

  const queryType = document.getElementById('queryTypeSelect')?.value || 'query';
  downloadMarkdownFile(`${queryType}_results_top100.md`, mdContent);
});