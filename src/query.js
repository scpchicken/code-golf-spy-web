/**
 * Page 3: Query Solutions Logic (Scoped IIFE to prevent global scope collisions)
 */

(() => {
  let currentQueryType = 'longest_golds';
  let currentQuerySortField = 'bytes';
  let currentQuerySortDir = 'desc';
  let lastQueryResults = null;

  // Safe HTML Escape Helper
  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Helper: parse submission dates into YYYY-MM-DD
  function parseDateStr(submitted) {
    if (!submitted) return 'Unknown';
    if (typeof submitted === 'number') {
      const d = new Date(submitted < 1e11 ? submitted * 1000 : submitted);
      return d.toISOString().split('T')[0];
    }
    const str = String(submitted);
    if (str.includes('T')) return str.split('T')[0];
    if (str.includes(' ')) return str.split(' ')[0];
    return str.substring(0, 10);
  }

  // Attach event listeners safely after DOM is loaded
  function initQueryEvents() {
    const queryGoBtn = document.getElementById('queryGoBtn');
    if (!queryGoBtn || queryGoBtn.dataset.initialized) return;
    queryGoBtn.dataset.initialized = 'true';

    queryGoBtn.addEventListener('click', async () => {
      const typeSelect = document.getElementById('queryTypeSelect');
      currentQueryType = typeSelect ? typeSelect.value : 'longest_golds';

      const subFileInput = document.getElementById('submissionsFile');
      const holesFileInput = document.getElementById('holesFile');
      const langsFileInput = document.getElementById('langsFile');
      const includeExperimental = document.getElementById('experimentalCheck')?.checked ?? false;

      if (typeof showLoading === 'function') showLoading();
      await new Promise(r => setTimeout(r, 50));

      try {
        const submissionsData = typeof getSubmissionsData === 'function' ? await getSubmissionsData(subFileInput) : null;

        if (!submissionsData) {
          if (typeof hideLoading === 'function') hideLoading();
          if (typeof handleSolutionsDownload === 'function') handleSolutionsDownload();
          return;
        }

        const [holesData, langsData] = await Promise.all([
          typeof getOrFetchJson === 'function' ? getOrFetchJson(holesFileInput, 'https://code.golf/api/holes', 'holes.json') : null,
          typeof getOrFetchJson === 'function' ? getOrFetchJson(langsFileInput, 'https://code.golf/api/langs', 'langs.json') : null
        ]);

        if (currentQueryType === 'total_bytes_of_golds_per_day') {
          currentQuerySortField = 'date';
          currentQuerySortDir = 'desc';
          lastQueryResults = processGoldsPerDay(submissionsData, includeExperimental, holesData, langsData);
          renderGoldsPerDayResults();
        } else {
          currentQuerySortField = 'bytes';
          currentQuerySortDir = 'desc';
          lastQueryResults = runSolutionsQuery(
            submissionsData,
            currentQueryType,
            holesData,
            langsData,
            includeExperimental
          );
          renderQueryResults(lastQueryResults, currentQueryType);
        }
      } catch (err) {
        alert(err.message || err);
      } finally {
        if (typeof hideLoading === 'function') hideLoading();
      }
    });

    // Search input dispatch
    document.getElementById('queryTableSearch')?.addEventListener('input', () => {
      if (currentQueryType === 'total_bytes_of_golds_per_day') {
        sortAndRenderGoldsPerDayBody();
      } else {
        if (lastQueryResults) applyQueryFilterAndRender();
      }
    });

    // Event Delegation for Change column clicks
    document.getElementById('queryResultsBody')?.addEventListener('click', (e) => {
      if (currentQueryType !== 'total_bytes_of_golds_per_day') return;
      const btn = e.target.closest('.gold-change-btn');
      if (btn) {
        e.preventDefault();
        e.stopPropagation();
        const dateStr = btn.getAttribute('data-date');
        const idx = parseInt(btn.getAttribute('data-index'), 10);

        const rowData = lastQueryResults.find(r => r.originalIndex === idx) || lastQueryResults[idx];
        if (rowData) {
          showDailyGoldsModal(dateStr, rowData.change, rowData.solutions || []);
        }
      }
    });

    // Export Handler
    document.getElementById('exportQueryTxtBtn')?.addEventListener('click', handleExport);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initQueryEvents);
  } else {
    initQueryEvents();
  }

  /* ==========================================================================
     1. TOTAL BYTES OF GOLDS PER DAY (UNIQUE FIRST SOLVES & RECORD IMPROVEMENTS ONLY)
     ========================================================================== */

  function processGoldsPerDay(jsonData, includeExperimental, holesJson, langsJson) {
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

    const bytesSubmissions = jsonData.filter(x => {
      if (x.scoring !== 'bytes') return false;
      if (validHoles && !validHoles.has(x.hole)) return false;
      if (validLangs && !validLangs.has(x.lang)) return false;
      return true;
    });

    bytesSubmissions.sort((a, b) => {
      const timeA = new Date(a.submitted).getTime() || 0;
      const timeB = new Date(b.submitted).getTime() || 0;
      return timeA - timeB;
    });

    const dateMap = new Map();
    for (const sub of bytesSubmissions) {
      const dateStr = parseDateStr(sub.submitted);
      if (!dateMap.has(dateStr)) {
        dateMap.set(dateStr, []);
      }
      dateMap.get(dateStr).push(sub);
    }

    const sortedDates = Array.from(dateMap.keys()).sort();
    const holeLangState = new Map();
    const dailyResults = [];

    let currentTotalBytes = 0;
    let prevTotalBytes = 0;

    sortedDates.forEach((dateStr, idx) => {
      const daySubs = dateMap.get(dateStr);
      const newGoldSolutions = [];
      const golferGoldsCount = new Map();

      for (const sub of daySubs) {
        const key = `${sub.hole}::${sub.lang}`;
        const bytes = Number(sub.bytes);
        const login = sub.login;

        if (!holeLangState.has(key)) {
          // First time this hole+lang combination is solved! (+bytes)
          holeLangState.set(key, bytes);
          currentTotalBytes += bytes;

          newGoldSolutions.push({
            hole: sub.hole,
            lang: sub.lang,
            login: login,
            bytes: bytes,
            diff: bytes, // positive diff
            submitted: sub.submitted,
            medal: '💎',
            note: 'First Solve'
          });
          golferGoldsCount.set(login, (golferGoldsCount.get(login) || 0) + 1);
        } else {
          const currentMinBytes = holeLangState.get(key);
          if (bytes < currentMinBytes) {
            // New record! Total bytes decreases by the improvement difference (-diff)
            const diff = bytes - currentMinBytes;
            holeLangState.set(key, bytes);
            currentTotalBytes += diff;

            newGoldSolutions.push({
              hole: sub.hole,
              lang: sub.lang,
              login: login,
              bytes: bytes,
              diff: diff, // negative diff
              submitted: sub.submitted,
              medal: '🥇',
              note: 'Record Improved'
            });
            golferGoldsCount.set(login, (golferGoldsCount.get(login) || 0) + 1);
          }
          // Strictly ignore tied solutions and worse solutions
        }
      }

      const change = currentTotalBytes - prevTotalBytes;
      prevTotalBytes = currentTotalBytes;

      let topGolfer = '-';
      let maxGolds = 0;
      for (const [golfer, cnt] of golferGoldsCount.entries()) {
        if (cnt > maxGolds) {
          maxGolds = cnt;
          topGolfer = golfer;
        }
      }

      dailyResults.push({
        originalIndex: idx,
        date: dateStr,
        totalBytes: currentTotalBytes,
        change: change,
        newGoldsCount: newGoldSolutions.length,
        topGolfer: topGolfer !== '-' ? `${topGolfer} (${maxGolds})` : '-',
        solutions: newGoldSolutions
      });
    });

    return dailyResults;
  }

  function renderGoldsPerDayResults() {
    const card = document.getElementById('queryResultsCard');
    const titleEl = document.getElementById('queryResultsTitle');
    const statsContainer = document.getElementById('queryStatsContainer');
    const table = document.getElementById('queryResultsTable');

    if (!card || !table) return;

    if (titleEl) titleEl.textContent = 'Total Bytes of Golds Per Day (Cumulative)';

    if (statsContainer) {
      const totalDays = lastQueryResults.length;
      const latestBytes = totalDays > 0 ? lastQueryResults[totalDays - 1].totalBytes : 0;
      const totalNewGolds = lastQueryResults.reduce((acc, r) => acc + r.newGoldsCount, 0);

      statsContainer.innerHTML = `
        <div class="stat-box">
          <div class="val">${latestBytes.toLocaleString()} B</div>
          <div class="lbl">Current Total Gold Bytes</div>
        </div>
        <div class="stat-box">
          <div class="val">${totalDays.toLocaleString()}</div>
          <div class="lbl">Days Tracked</div>
        </div>
        <div class="stat-box">
          <div class="val">${totalNewGolds.toLocaleString()}</div>
          <div class="lbl">Unique Record Solves</div>
        </div>
      `;
    }

    const thead = table.querySelector('thead');
    if (thead) {
      const renderTh = (id, label, fieldName, align = 'left') => {
        const isCurrent = currentQuerySortField === fieldName;
        const arrow = isCurrent ? (currentQuerySortDir === 'desc' ? ' ▼' : ' ▲') : '';
        const colorStyle = isCurrent ? 'color: #38bdf8;' : 'color: inherit;';
        return `<th id="${id}" style="text-align: ${align}; cursor: pointer; user-select: none; ${colorStyle}">${label}${arrow}</th>`;
      };

      thead.innerHTML = `
        <tr>
          ${renderTh('thQDate', 'Date', 'date', 'left')}
          ${renderTh('thQTotalBytes', 'Total Gold Bytes', 'totalBytes', 'right')}
          ${renderTh('thQChange', 'Change', 'change', 'right')}
          ${renderTh('thQNewGolds', 'Record Solves', 'newGoldsCount', 'right')}
          ${renderTh('thQTopGolfer', 'Top Golfer', 'topGolfer', 'right')}
        </tr>
      `;

      const bindQSort = (id, fieldName, defaultDir = 'desc') => {
        const el = document.getElementById(id);
        el?.addEventListener('click', () => {
          if (currentQuerySortField === fieldName) {
            currentQuerySortDir = currentQuerySortDir === 'desc' ? 'asc' : 'desc';
          } else {
            currentQuerySortField = fieldName;
            currentQuerySortDir = defaultDir;
          }
          sortAndRenderGoldsPerDayBody();
        });
      };

      bindQSort('thQDate', 'date', 'desc');
      bindQSort('thQTotalBytes', 'totalBytes', 'desc');
      bindQSort('thQChange', 'change', 'desc');
      bindQSort('thQNewGolds', 'newGoldsCount', 'desc');
      bindQSort('thQTopGolfer', 'topGolfer', 'asc');
    }

    sortAndRenderGoldsPerDayBody();
    card.classList.remove('hidden');
  }

  function sortAndRenderGoldsPerDayBody() {
    const tbody = document.getElementById('queryResultsBody');
    const searchText = (document.getElementById('queryTableSearch')?.value || '').toLowerCase();
    if (!tbody) return;

    let filtered = [...lastQueryResults];

    if (searchText) {
      filtered = filtered.filter(r => 
        r.date.toLowerCase().includes(searchText) || 
        r.topGolfer.toLowerCase().includes(searchText)
      );
    }

    filtered.sort((a, b) => {
      let valA = a[currentQuerySortField];
      let valB = b[currentQuerySortField];

      if (typeof valA === 'string') {
        const comp = currentQuerySortDir === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        if (comp !== 0) return comp;
      } else {
        if (valA !== valB) return currentQuerySortDir === 'desc' ? valB - valA : valA - valB;
      }
      return 0;
    });

    tbody.innerHTML = '';

    filtered.forEach(r => {
      const tr = document.createElement('tr');
      const changeClass = r.change > 0 ? 'diff-pos' : r.change < 0 ? 'diff-neg' : 'diff-zero';
      const changeText = r.change > 0 ? `+${r.change} B` : `${r.change} B`;

      tr.innerHTML = `
        <td>${escapeHtml(r.date)}</td>
        <td style="text-align: right;"><strong>${r.totalBytes.toLocaleString()} B</strong></td>
        <td style="text-align: right;">
          <span class="diff-clickable ${changeClass} gold-change-btn" 
                data-date="${escapeHtml(r.date)}" 
                data-index="${r.originalIndex}" 
                title="Click to view solution details"
                style="cursor: pointer; font-weight: bold;">
            ${changeText}
          </span>
        </td>
        <td style="text-align: right;">${r.newGoldsCount.toLocaleString()}</td>
        <td style="text-align: right;">${escapeHtml(r.topGolfer)}</td>
      `;

      tbody.appendChild(tr);
    });
  }

  function showDailyGoldsModal(dateStr, changeVal, solutions) {
    let modal = document.getElementById('dailyGoldsModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'dailyGoldsModal';
      modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
        background-color: rgba(0, 0, 0, 0.75); -webkit-backdrop-filter: blur(4px);
        backdrop-filter: blur(4px); display: flex; justify-content: center;
        align-items: center; z-index: 9999; padding: 1rem;
      `;
      document.body.appendChild(modal);
    }

    const changeText = changeVal > 0 ? `+${changeVal} B` : `${changeVal} B`;

    let rowsHtml = '';
    if (!solutions || solutions.length === 0) {
      rowsHtml = `<tr><td colspan="6" style="text-align: center; color: var(--text-dim); padding: 1.5rem;">No new first solves or record improvements on this day.</td></tr>`;
    } else {
      rowsHtml = solutions.map(s => {
        const holeUrl = `https://code.golf/${encodeURIComponent(s.hole)}`;
        const langUrl = `https://code.golf/${encodeURIComponent(s.hole)}#${encodeURIComponent(s.lang)}`;
        const golferUrl = `https://code.golf/golfers/${encodeURIComponent(s.login)}`;

        const diffText = s.diff > 0 ? `+${s.diff} B` : `${s.diff} B`;
        const diffColor = s.diff > 0 ? '#22c55e' : '#ef4444'; // Green for first solve (+), Red for reduction (-)

        return `
          <tr>
            <td><a href="${holeUrl}" target="_blank" rel="noopener noreferrer" class="golf-link"><strong>${escapeHtml(s.hole)}</strong></a></td>
            <td><a href="${langUrl}" target="_blank" rel="noopener noreferrer" class="golf-link-clean" style="color: #4da6ff; font-weight: bold;">${escapeHtml(s.lang)}</a></td>
            <td><a href="${golferUrl}" target="_blank" rel="noopener noreferrer" class="golf-link">${escapeHtml(s.login)}</a></td>
            <td style="text-align: right;"><strong>${Number(s.bytes).toLocaleString()} B</strong></td>
            <td style="text-align: right; color: ${diffColor}; font-weight: bold;">${diffText}</td>
            <td style="text-align: center;"><span class="medal">${s.medal}</span> <span style="font-size: 0.85em; color: var(--text-dim);">${escapeHtml(s.note || '')}</span></td>
          </tr>
        `;
      }).join('');
    }

    modal.innerHTML = `
      <div class="card" style="max-width: 800px; width: 95%; max-height: 85vh; display: flex; flex-direction: column; gap: 1rem; overflow: hidden; position: relative;">
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border); padding-bottom: 0.75rem;">
          <h3 style="margin: 0; color: var(--accent); font-size: 1.25rem;">
            Record Solves on ${escapeHtml(dateStr)} (Net Change: ${changeText})
          </h3>
          <button id="closeDailyGoldsModalBtn" style="background: transparent; border: none; color: var(--text-dim); font-size: 1.6rem; cursor: pointer; line-height: 1; padding: 0 0.5rem;">&times;</button>
        </div>

        <div style="overflow-y: auto; flex: 1; border-radius: 4px;">
          <table class="main-table" style="width: 100%; margin-top: 0;">
            <thead>
              <tr>
                <th>Hole</th>
                <th>Language</th>
                <th>Golfer</th>
                <th style="text-align: right;">Bytes</th>
                <th style="text-align: right;">Diff</th>
                <th style="text-align: center;">Status</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        </div>

        <div style="display: flex; justify-content: flex-end; padding-top: 0.5rem; border-top: 1px solid var(--border);">
          <button id="closeDailyGoldsModalFooterBtn" class="btn-secondary">Close</button>
        </div>
      </div>
    `;

    modal.classList.remove('hidden');
    const closeModal = () => modal.classList.add('hidden');

    document.getElementById('closeDailyGoldsModalBtn')?.addEventListener('click', closeModal);
    document.getElementById('closeDailyGoldsModalFooterBtn')?.addEventListener('click', closeModal);

    modal.onclick = (e) => {
      if (e.target === modal) closeModal();
    };
  }

  /* ==========================================================================
     2. LONGEST GOLDS / DIAMONDS / UNICORNS
     ========================================================================== */

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
        typeLabel = isUnicorn ? '🦄 Unicorn' : (isDiamond ? '💎 Diamond' : `🥇 Gold (Tie: ${tiedForFirst.length})`);
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
    if (queryResultsTitle) {
      queryResultsTitle.textContent = `${titleMap[queryType] || 'Query Results'} (Top 100)`;
    }

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
    queryResultsCard?.classList.remove('hidden');
  }

  function applyQueryFilterAndRender() {
    const queryResultsBody = document.getElementById('queryResultsBody');
    const filterText = (document.getElementById('queryTableSearch')?.value || '').toLowerCase();

    if (!queryResultsBody || !lastQueryResults) return;

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

      const langUrl = `https://code.golf/${encodeURIComponent(r.hole)}#${encodeURIComponent(r.lang)}`;
      const langDisplay = `<a href="${langUrl}" target="_blank" rel="noopener noreferrer" class="golf-link-clean" style="color: #4da6ff; font-weight: bold;">${escapeHtml(r.lang)}</a>`;

      const golferUrl = `https://code.golf/golfers/${encodeURIComponent(r.golfer)}`;
      const golferDisplay = `<a href="${golferUrl}" target="_blank" rel="noopener noreferrer" class="golf-link">${escapeHtml(r.golfer)}</a>`;

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

  function handleExport() {
    if (!lastQueryResults) return;

    const searchText = (document.getElementById('queryTableSearch')?.value || '').toLowerCase();

    const getW = typeof getVisualWidth === 'function' ? getVisualWidth : (s => String(s).length);
    const padStart = typeof padVisualStart === 'function' ? padVisualStart : ((s, w) => String(s).padStart(w));
    const padEnd = typeof padVisualEnd === 'function' ? padVisualEnd : ((s, w) => String(s).padEnd(w));

    if (currentQueryType === 'total_bytes_of_golds_per_day') {
      let filtered = [...lastQueryResults];
      if (searchText) {
        filtered = filtered.filter(r => 
          r.date.toLowerCase().includes(searchText) || 
          r.topGolfer.toLowerCase().includes(searchText)
        );
      }

      filtered.sort((a, b) => {
        let valA = a[currentQuerySortField];
        let valB = b[currentQuerySortField];
        if (typeof valA === 'string') {
          const comp = currentQuerySortDir === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
          if (comp !== 0) return comp;
        } else {
          if (valA !== valB) return currentQuerySortDir === 'desc' ? valB - valA : valA - valB;
        }
        return 0;
      });

      const headers = ['Date', 'Total Gold Bytes', 'Change', 'Record Solves', 'Top Golfer'];
      const rightAlignCols = [1, 2, 3, 4];
      const tableRows = filtered.map(r => [
        r.date,
        `${r.totalBytes.toLocaleString()} B`,
        r.change > 0 ? `+${r.change} B` : `${r.change} B`,
        r.newGoldsCount.toLocaleString(),
        r.topGolfer
      ]);

      const colWidths = headers.map((header, colIdx) => {
        let maxW = getW(header);
        tableRows.forEach(r => {
          const w = getW(r[colIdx]);
          if (w > maxW) maxW = w;
        });
        return Math.max(maxW, 4);
      });

      const formatRow = (rowCells) => {
        const formattedCells = rowCells.map((cell, idx) => {
          const width = colWidths[idx];
          return rightAlignCols.includes(idx)
            ? padStart(cell, width)
            : padEnd(cell, width);
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

      if (typeof downloadMarkdownFile === 'function') {
        downloadMarkdownFile(`total_bytes_of_golds_per_day.md`, mdContent);
      }
    } else {
      if (!lastQueryResults.results || lastQueryResults.results.length === 0) return;

      let filtered = lastQueryResults.results;
      if (searchText) {
        filtered = filtered.filter(r => 
          r.hole.toLowerCase().includes(searchText) || 
          r.lang.toLowerCase().includes(searchText) ||
          r.golfer.toLowerCase().includes(searchText)
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
        let maxW = getW(header);
        tableRows.forEach(r => {
          const w = getW(r[colIdx]);
          if (w > maxW) maxW = w;
        });
        return Math.max(maxW, 4);
      });

      const formatRow = (rowCells) => {
        const formattedCells = rowCells.map((cell, idx) => {
          const width = colWidths[idx];
          return rightAlignCols.includes(idx)
            ? padStart(cell, width)
            : padEnd(cell, width);
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

      if (typeof downloadMarkdownFile === 'function') {
        downloadMarkdownFile(`${currentQueryType}_results_top100.md`, mdContent);
      }
    }
  }
})();