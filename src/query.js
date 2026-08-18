/**
 * Page 3: Query Solutions Logic
 */

(() => {
  let currentQueryType = 'lost_golds_diamonds';
  let currentQuerySortField = 'bytes';
  let currentQuerySortDir = 'desc';
  let lastQueryResults = null;
  let cachedSubmissionsData = null;
  let cachedHolesData = null;
  let cachedLangsData = null;
  let solutionHistoryIsGrouped = false;
  let solutionHistoryAllResults = null;
  let solutionHistoryCurrentPage = 1;
  const SOLUTIONS_PER_PAGE = 100;

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

  // Helper: parse submission dates into YYYY-MM-DD---HH-MM-SS (for solution history)
  function parseDateStrWithMs(submitted) {
    if (!submitted) return 'Unknown';
    let d;
    if (typeof submitted === 'number') {
      d = new Date(submitted < 1e11 ? submitted * 1000 : submitted);
    } else {
      d = new Date(submitted);
    }
    if (isNaN(d.getTime())) {
      const str = String(submitted);
      return str.replace('T', '---').replace(/:/g, '-').slice(0, 19);
    }
    const iso = d.toISOString(); // "YYYY-MM-DDTHH:mm:ss.sssZ"
    const datePart = iso.slice(0, 10);
    const timePart = iso.slice(11, 19).replace(/:/g, '-');
    return `${datePart}---${timePart}`;
  }

  // Helper: Ensure "Group by Day" button is rendered to the left of queryTableSearch
  function ensureGroupByDayButton() {
    const queryTableSearch = document.getElementById('queryTableSearch');
    let btn = document.getElementById('groupByDayBtn');

    if (!queryTableSearch) return;

    if (!btn) {
      btn = document.createElement('button');
      btn.id = 'groupByDayBtn';
      btn.type = 'button';
      btn.className = 'btn-secondary';
      btn.style.cssText = 'margin-right: 8px; padding: 6px 12px; font-size: 0.85rem; cursor: pointer; white-space: nowrap; flex-shrink: 0;';

      if (queryTableSearch.parentNode) {
        queryTableSearch.parentNode.insertBefore(btn, queryTableSearch);
      }

      btn.addEventListener('click', () => {
        solutionHistoryIsGrouped = !solutionHistoryIsGrouped;
        solutionHistoryCurrentPage = 1;
        currentQuerySortField = solutionHistoryIsGrouped ? 'date' : 'submitted';
        currentQuerySortDir = 'desc';
        renderSolutionHistoryResults();
      });
    }

    if (currentQueryType === 'solution_history') {
      btn.classList.remove('hidden');
      btn.style.display = 'inline-block';
      if (solutionHistoryIsGrouped) {
        btn.textContent = '📅 Grouped by Day (Click to Ungroup)';
        btn.style.backgroundColor = 'var(--accent, #22c55e)';
        btn.style.color = '#fff';
      } else {
        btn.textContent = '📅 Group by Day';
        btn.style.backgroundColor = '';
        btn.style.color = '';
      }
    } else {
      if (btn) {
        btn.classList.add('hidden');
        btn.style.display = 'none';
      }
    }
  }

  // Check if current query type is a user medal/count aggregation query
  function isUserQueryType(type) {
    return ['bytes_gold_medals', 'bytes_diamonds', 'bytes_unicorns'].includes(type);
  }

 // Attach event listeners safely after DOM is loaded
  function initQueryEvents() {
    const queryGoBtn = document.getElementById('queryGoBtn');
    const queryTypeSelect = document.getElementById('queryTypeSelect');
    const lostGoldsControls = document.getElementById('lostGoldsControls');
    const lostGolferInput = document.getElementById('lostGolferInput');
    const lostTypeSelect = document.getElementById('lostTypeSelect');
    const mismatchControls = document.getElementById('mismatchControls');
    const mismatchUserInput = document.getElementById('mismatchUserInput');
    const mismatchLangInput = document.getElementById('mismatchLangInput');
    const solutionHistoryControls = document.getElementById('solutionHistoryControls');
    const solutionHistoryUserInput = document.getElementById('solutionHistoryUserInput');

    if (queryTypeSelect) {
      queryTypeSelect.value = 'lost_golds_diamonds';
    }

    const toggleControls = () => {
      const val = queryTypeSelect?.value;

      if (val === 'lost_golds_diamonds') {
        lostGoldsControls?.classList.remove('hidden');
      } else {
        lostGoldsControls?.classList.add('hidden');
      }

      if (val === 'medal_mismatch') {
        mismatchControls?.classList.remove('hidden');
      } else {
        mismatchControls?.classList.add('hidden');
      }

      if (val === 'solution_history') {
        solutionHistoryControls?.classList.remove('hidden');
      } else {
        solutionHistoryControls?.classList.add('hidden');
      }

      ensureGroupByDayButton();
    };

    queryTypeSelect?.addEventListener('change', toggleControls);
    toggleControls();

    if (!queryGoBtn || queryGoBtn.dataset.initialized) return;
    queryGoBtn.dataset.initialized = 'true';

    queryGoBtn.addEventListener('click', async () => {
      currentQueryType = queryTypeSelect ? queryTypeSelect.value : 'longest_golds';

      if (currentQueryType === 'medal_mismatch' && !(mismatchUserInput?.value || '').trim()) {
        alert('Please enter a username for the Medal Mismatch query.');
        return;
      }

      const subFileInput = document.getElementById('submissionsFile');
      const holesFileInput = document.getElementById('holesFile');
      const langsFileInput = document.getElementById('langsFile');

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

        cachedSubmissionsData = submissionsData;
        cachedHolesData = holesData;
        cachedLangsData = langsData;
        const includeExperimental = typeof langFilterMode !== 'undefined' && langFilterMode === 'experimental';

        if (currentQueryType === 'total_bytes_of_golds_per_day') {
          currentQuerySortField = 'date';
          currentQuerySortDir = 'desc';
          lastQueryResults = processGoldsPerDay(submissionsData, holesData, langsData, includeExperimental);
          renderGoldsPerDayResults();
        } else if (currentQueryType === 'lost_golds_diamonds') {
          const golferFilter = lostGolferInput?.value || '';
          const medalTypeFilter = lostTypeSelect?.value || 'all';
          lastQueryResults = processLostMedals(
            submissionsData,
            holesData,
            langsData,
            golferFilter,
            medalTypeFilter,
            includeExperimental
          );
          renderLostMedalsResults(lastQueryResults);
        } else if (currentQueryType === 'medal_mismatch') {
          const username = (mismatchUserInput?.value || '').trim();
          const langFilter = (mismatchLangInput?.value || '').trim().toLowerCase();
          currentQuerySortField = 'hole';
          currentQuerySortDir = 'asc';
          lastQueryResults = processMedalMismatch(
            submissionsData,
            holesData,
            langsData,
            username,
            langFilter,
            includeExperimental
          );
          renderMedalMismatchResults(lastQueryResults);
        } else if (currentQueryType === 'solution_history') {
          const userFilter = (solutionHistoryUserInput?.value || '').trim();
          solutionHistoryCurrentPage = 1;
          currentQuerySortField = solutionHistoryIsGrouped ? 'date' : 'submitted';
          currentQuerySortDir = 'desc';
          solutionHistoryAllResults = processSolutionHistory(
            submissionsData,
            userFilter,
            holesData,
            langsData,
            includeExperimental
          );
          renderSolutionHistoryResults();
        } else if (isUserQueryType(currentQueryType)) {
          currentQuerySortField = 'count';
          currentQuerySortDir = 'desc';
          lastQueryResults = runSolutionsQuery(
            submissionsData,
            currentQueryType,
            holesData,
            langsData,
            includeExperimental
          );
          renderQueryResults(lastQueryResults, currentQueryType);
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

    // Real-time lost golds filter listeners
    const triggerLostFilterUpdate = () => {
      if (currentQueryType === 'lost_golds_diamonds' && cachedSubmissionsData) {
        const golferFilter = lostGolferInput?.value || '';
        const medalTypeFilter = lostTypeSelect?.value || 'all';
        const includeExperimental = typeof langFilterMode !== 'undefined' && langFilterMode === 'experimental';
        lastQueryResults = processLostMedals(
          cachedSubmissionsData,
          cachedHolesData,
          cachedLangsData,
          golferFilter,
          medalTypeFilter,
          includeExperimental
        );
        renderLostMedalsResults(lastQueryResults);
      }
    };

    lostGolferInput?.addEventListener('input', triggerLostFilterUpdate);
    lostTypeSelect?.addEventListener('change', triggerLostFilterUpdate);

    // Search input dispatch
    document.getElementById('queryTableSearch')?.addEventListener('input', () => {
      if (currentQueryType === 'total_bytes_of_golds_per_day') {
        sortAndRenderGoldsPerDayBody();
      } else if (currentQueryType === 'lost_golds_diamonds') {
        triggerLostFilterUpdate();
      } else if (currentQueryType === 'medal_mismatch') {
        sortAndRenderMismatchBody();
      } else if (currentQueryType === 'solution_history') {
        renderSolutionHistoryResults();
      } else {
        if (lastQueryResults) applyQueryFilterAndRender();
      }
    });

    // Table click delegation
    document.getElementById('queryResultsBody')?.addEventListener('click', (e) => {
      if (currentQueryType === 'total_bytes_of_golds_per_day') {
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
      } else if (isUserQueryType(currentQueryType)) {
        const btn = e.target.closest('.user-medals-btn');
        if (btn) {
          e.preventDefault();
          e.stopPropagation();
          const golferName = btn.getAttribute('data-golfer');
          const rowData = lastQueryResults?.results?.find(r => r.golfer === golferName);
          if (rowData) {
            showUserMedalsModal(golferName, currentQueryType, rowData.items || []);
          }
        }
      }
    });

    // Lost medals row click delegation
    document.getElementById('multiTableContainer')?.addEventListener('click', (e) => {
      if (currentQueryType !== 'lost_golds_diamonds' || !lastQueryResults) return;
      if (e.target.tagName === 'A') return;

      const row = e.target.closest('.lost-event-row');
      if (row) {
        const tf = row.getAttribute('data-timeframe');
        const idx = parseInt(row.getAttribute('data-index'), 10);

        let eventList = [];
        if (tf === '24h') eventList = lastQueryResults.events24h;
        else if (tf === 'week') eventList = lastQueryResults.eventsWeek;
        else if (tf === 'month') eventList = lastQueryResults.eventsMonth;
        else if (tf === 'year') eventList = lastQueryResults.eventsYear;

        const eventData = eventList[idx];
        if (eventData && typeof showLostMedalModal === 'function') {
          showLostMedalModal(eventData);
        }
      }
    });

    // Export handler
    document.getElementById('exportQueryTxtBtn')?.addEventListener('click', handleExport);
  }
  /* ==========================================================================
     1. TOTAL BYTES OF GOLDS PER DAY
     ========================================================================== */

function processGoldsPerDay(jsonData, holesJson, langsJson, includeExperimental = false) {
    const validHoles = computeValidHoles(holesJson, includeExperimental);
    const validLangs = computeValidLangs(langsJson, includeExperimental);

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
          holeLangState.set(key, bytes);
          currentTotalBytes += bytes;

          newGoldSolutions.push({
            hole: sub.hole,
            lang: sub.lang,
            login: login,
            bytes: bytes,
            diff: bytes,
            submitted: sub.submitted,
            medal: '💎',
            note: 'First Solve'
          });
          golferGoldsCount.set(login, (golferGoldsCount.get(login) || 0) + 1);
        } else {
          const currentMinBytes = holeLangState.get(key);
          if (bytes < currentMinBytes) {
            const diff = bytes - currentMinBytes;
            holeLangState.set(key, bytes);
            currentTotalBytes += diff;

            newGoldSolutions.push({
              hole: sub.hole,
              lang: sub.lang,
              login: login,
              bytes: bytes,
              diff: diff,
              submitted: sub.submitted,
              medal: '🥇',
              note: 'Record Improved'
            });
            golferGoldsCount.set(login, (golferGoldsCount.get(login) || 0) + 1);
          }
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
    const singleTableContainer = document.getElementById('singleTableContainer');
    const multiTableContainer = document.getElementById('multiTableContainer');
    const table = document.getElementById('queryResultsTable');

    if (!card || !table) return;

    if (titleEl) titleEl.textContent = 'Total Bytes of Golds Per Day (Cumulative)';
    if (singleTableContainer) singleTableContainer.classList.remove('hidden');
    if (multiTableContainer) multiTableContainer.classList.add('hidden');

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
        const diffText = s.diff > 0 ? `+${s.diff} B` : `${s.diff} B`;
        const diffClass = s.diff > 0 ? 'diff-pos' : s.diff < 0 ? 'diff-neg' : 'diff-zero';
        const golferLink = typeof getGolferLink === 'function' ? getGolferLink(s.login) : escapeHtml(s.login);

        return `
          <tr>
            <td><a href="${holeUrl}" target="_blank" rel="noopener noreferrer" class="golf-link"><strong>${escapeHtml(s.hole)}</strong></a></td>
            <td><a href="${langUrl}" target="_blank" rel="noopener noreferrer" class="golf-link-clean" style="font-weight: bold; color: #4da6ff;">${escapeHtml(s.lang)}</a></td>
            <td>${golferLink}</td>
            <td style="text-align: right;"><strong>${s.bytes.toLocaleString()} B</strong></td>
            <td style="text-align: right;" class="${diffClass}">${diffText}</td>
            <td style="text-align: right;"><span class="medal">${s.medal}</span> ${escapeHtml(s.note)}</td>
          </tr>
        `;
      }).join('');
    }

    modal.innerHTML = `
      <div style="background: var(--card-bg, #1e293b); color: #fff; padding: 20px 24px; border-radius: 8px; min-width: 320px; max-width: 780px; width: 90%; box-shadow: 0 4px 20px rgba(0,0,0,0.5); border: 1px solid var(--border, #334155);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,0.2); padding-bottom: 10px;">
          <div>
            <h3 style="margin: 0; color: var(--accent, #22c55e); font-size: 1.2em;">Record Changes for ${escapeHtml(dateStr)}</h3>
            <div style="font-size: 0.85em; color: var(--text-dim, #94a3b8); margin-top: 4px;">
              Net Change: <strong>${changeText}</strong> &nbsp;|&nbsp; Solves: <strong>${solutions ? solutions.length : 0}</strong>
            </div>
          </div>
          <button id="closeDailyGoldsModalBtn" style="background: none; border: none; color: #aaa; font-size: 1.5em; cursor: pointer; line-height: 1;">&times;</button>
        </div>
        <div style="max-height: 380px; overflow-y: auto;">
          <table class="main-table" style="font-size: 0.9rem;">
            <thead>
              <tr>
                <th>Hole</th>
                <th>Lang</th>
                <th>Golfer</th>
                <th style="text-align: right;">Bytes</th>
                <th style="text-align: right;">Diff</th>
                <th style="text-align: right;">Type</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        </div>
      </div>
    `;

    modal.classList.remove('hidden');
    modal.querySelector('#closeDailyGoldsModalBtn')?.addEventListener('click', () => modal.classList.add('hidden'));
    modal.onclick = (e) => { if (e.target === modal) modal.classList.add('hidden'); };
  }

  /* ==========================================================================
     2. LOST DIAMONDS / GOLDS / UNICORNS QUERY
     ========================================================================== */

function processLostMedals(jsonData, holesJson, langsJson, golferFilter = '', medalTypeFilter = 'all', includeExperimental = false) {
    const validHoles = computeValidHoles(holesJson, includeExperimental);
    const validLangs = computeValidLangs(langsJson, includeExperimental);

    const bytesSubs = jsonData.filter(x => {
      if (x.scoring !== 'bytes') return false;
      if (validHoles && !validHoles.has(x.hole)) return false;
      if (validLangs && !validLangs.has(x.lang)) return false;
      return true;
    });

    bytesSubs.sort((a, b) => {
      const timeA = new Date(a.submitted).getTime() || 0;
      const timeB = new Date(b.submitted).getTime() || 0;
      return timeA - timeB;
    });

    const state = new Map();
    const lossEvents = [];
    let maxTimestamp = 0;

    for (const sub of bytesSubs) {
      const key = `${sub.hole}::${sub.lang}`;
      const bytes = Number(sub.bytes);
      const login = sub.login;
      const subTime = new Date(sub.submitted).getTime() || 0;
      if (subTime > maxTimestamp) maxTimestamp = subTime;

      if (!state.has(key)) {
        const solversSet = new Set([login.toLowerCase()]);
        state.set(key, {
          currentBestBytes: bytes,
          currentHolders: [{ login, submitted: sub.submitted }],
          solversSet,
          lastEvent: null
        });
      } else {
        const st = state.get(key);
        const oldSolversCount = st.solversSet.size;
        st.solversSet.add(login.toLowerCase());
        const newSolversCount = st.solversSet.size;

        if (bytes < st.currentBestBytes) {
          const oldBytes = st.currentBestBytes;
          const oldHolders = [...st.currentHolders];
          const oldHoldersCount = oldHolders.length;

          let oldMedalType = 'gold';
          let oldEmoji = '🥇';

          if (oldHoldersCount === 1) {
            if (oldSolversCount === 1) {
              oldMedalType = 'unicorn';
              oldEmoji = '🦄';
            } else {
              oldMedalType = 'diamond';
              oldEmoji = '💎';
            }
          }

          const oldDisplayHtml = `${oldBytes}b${oldHoldersCount > 1 ? `<sub>${oldHoldersCount}</sub>` : ''} ${oldEmoji}`;
          const oldDisplayTxt = `${oldBytes}b${oldHoldersCount > 1 ? ` (${oldHoldersCount})` : ''} ${oldEmoji}`;

          let newMedalType = 'diamond';
          let newEmoji = '💎';
          if (newSolversCount === 1) {
            newMedalType = 'unicorn';
            newEmoji = '🦄';
          }
          const newDisplayHtml = `${bytes}b ${newEmoji}`;
          const newDisplayTxt = `${bytes}b ${newEmoji}`;

          const newEvent = {
            hole: sub.hole,
            lang: sub.lang,
            timestamp: subTime,
            dateStr: parseDateStr(sub.submitted),
            formattedTime: sub.submitted ? String(sub.submitted).replace('T', ' ').substring(0, 19) : 'Unknown',
            oldBytes,
            oldHolders: oldHolders.map(h => h.login),
            oldMedalType,
            oldEmoji,
            oldDisplayHtml,
            oldDisplayTxt,
            newBytes: bytes,
            newGolfer: login,
            newHolders: [login],
            newMedalType,
            newEmoji,
            newDisplayHtml,
            newDisplayTxt,
            byteDiff: oldBytes - bytes
          };

          lossEvents.push(newEvent);

          st.currentBestBytes = bytes;
          st.currentHolders = [{ login, submitted: sub.submitted }];
          st.lastEvent = newEvent;
        } else if (bytes === st.currentBestBytes) {
          if (!st.currentHolders.some(h => h.login.toLowerCase() === login.toLowerCase())) {
            st.currentHolders.push({ login, submitted: sub.submitted });
            
            if (st.lastEvent) {
              st.lastEvent.newHolders.push(login);
              const count = st.lastEvent.newHolders.length;
              st.lastEvent.newMedalType = 'gold';
              st.lastEvent.newEmoji = '🥇';
              st.lastEvent.newDisplayHtml = `${bytes}b<sub>${count}</sub> 🥇`;
              st.lastEvent.newDisplayTxt = `${bytes}b (${count}) 🥇`;
            }
          }
        }
      }
    }

    if (maxTimestamp === 0) maxTimestamp = Date.now();

    const ms24h = 24 * 3600 * 1000;
    const msWeek = 7 * 24 * 3600 * 1000;
    const msMonth = 30 * 24 * 3600 * 1000;
    const msYear = 365 * 24 * 3600 * 1000;

    const cutoff24h = maxTimestamp - ms24h;
    const cutoffWeek = maxTimestamp - msWeek;
    const cutoffMonth = maxTimestamp - msMonth;
    const cutoffYear = maxTimestamp - msYear;

    const searchGolferLower = golferFilter.trim().toLowerCase();

    function filterEvents(events) {
      return events.filter(e => {
        if (searchGolferLower) {
          const matchOld = e.oldHolders.some(u => u.toLowerCase().includes(searchGolferLower));
          if (!matchOld) return false;
        }

        if (medalTypeFilter === 'diamonds' && e.oldMedalType !== 'diamond') return false;
        if (medalTypeFilter === 'unicorns' && e.oldMedalType !== 'unicorn') return false;
        if (medalTypeFilter === 'golds' && e.oldMedalType !== 'gold') return false;

        return true;
      });
    }

    const events24h = filterEvents(lossEvents.filter(e => e.timestamp >= cutoff24h));
    const eventsWeek = filterEvents(lossEvents.filter(e => e.timestamp >= cutoffWeek && e.timestamp < cutoff24h));
    const eventsMonth = filterEvents(lossEvents.filter(e => e.timestamp >= cutoffMonth && e.timestamp < cutoffWeek));
    const eventsYear = filterEvents(lossEvents.filter(e => e.timestamp >= cutoffYear && e.timestamp < cutoffMonth));

    const sortDesc = (arr) => [...arr].sort((a, b) => b.timestamp - a.timestamp);

    return {
      type: 'lost_golds_diamonds',
      totalLosses: lossEvents.length,
      maxTimestamp,
      events24h: sortDesc(events24h),
      eventsWeek: sortDesc(eventsWeek),
      eventsMonth: sortDesc(eventsMonth),
      eventsYear: sortDesc(eventsYear)
    };
  }

  function renderLostMedalsResults(lostResults) {
    const card = document.getElementById('queryResultsCard');
    const titleEl = document.getElementById('queryResultsTitle');
    const statsContainer = document.getElementById('queryStatsContainer');
    const singleTableContainer = document.getElementById('singleTableContainer');
    const multiTableContainer = document.getElementById('multiTableContainer');

    if (!card || !multiTableContainer) return;

    if (titleEl) titleEl.textContent = 'Lost Diamonds / Golds / Unicorns';
    if (singleTableContainer) singleTableContainer.classList.add('hidden');
    multiTableContainer.classList.remove('hidden');

    if (statsContainer) {
      statsContainer.innerHTML = `
        <div class="stat-box">
          <div class="val">${lostResults.events24h.length.toLocaleString()}</div>
          <div class="lbl">Last 24 Hours</div>
        </div>
        <div class="stat-box">
          <div class="val">${lostResults.eventsWeek.length.toLocaleString()}</div>
          <div class="lbl">Last Week</div>
        </div>
        <div class="stat-box">
          <div class="val">${lostResults.eventsMonth.length.toLocaleString()}</div>
          <div class="lbl">Last Month</div>
        </div>
        <div class="stat-box">
          <div class="val">${lostResults.eventsYear.length.toLocaleString()}</div>
          <div class="lbl">Last Year</div>
        </div>
      `;
    }

    const getDynamicStyle = (htmlText) => {
      const plainText = String(htmlText).replace(/<[^>]+>/g, '');
      const len = plainText.length;
      let size = 1;
      if (len > 12) {
        size = Math.max(0.65, 1 - (len - 12) * 0.02);
      }
      return `font-size: ${size}rem; white-space: nowrap; padding-right: 15px; overflow: hidden; text-overflow: ellipsis;`;
    };

    const timeframes = [
      { id: '24h', title: '⏱️ Last 24 Hours', events: lostResults.events24h },
      { id: 'week', title: '🗓️ Last Week', events: lostResults.eventsWeek },
      { id: 'month', title: '📅 Last Month', events: lostResults.eventsMonth },
      { id: 'year', title: '📆 Last Year', events: lostResults.eventsYear }
    ];

    multiTableContainer.innerHTML = timeframes.map(tf => {
      let rowsHtml = '';
      if (tf.events.length === 0) {
        rowsHtml = `<tr><td colspan="7" style="text-align: center; color: var(--text-dim); padding: 1.2rem;">No lost record events found in this timeframe.</td></tr>`;
      } else {
        rowsHtml = tf.events.map((e, idx) => {
          const holeUrl = `https://code.golf/${encodeURIComponent(e.hole)}`;
          const langUrl = `https://code.golf/${encodeURIComponent(e.hole)}#${encodeURIComponent(e.lang)}`;
          
          let lostByDisplay = e.oldHolders.slice(0, 2).map(u => typeof getGolferLink === 'function' ? getGolferLink(u) : escapeHtml(u)).join(', ');
          if (e.oldHolders.length > 2) lostByDisplay += `...`;

          const newHoldersArr = e.newHolders || [e.newGolfer];
          let newGolferDisplay = newHoldersArr.slice(0, 2).map(u => typeof getGolferLink === 'function' ? getGolferLink(u) : escapeHtml(u)).join(', ');
          if (newHoldersArr.length > 2) newGolferDisplay += `...`;

          let lostByRaw = lostByDisplay;
          let newByRaw = newGolferDisplay;

          return `
            <tr class="lost-event-row" data-timeframe="${tf.id}" data-index="${idx}" style="cursor: pointer;">
              <td style="${getDynamicStyle(e.hole)}"><a href="${holeUrl}" target="_blank" rel="noopener noreferrer" class="golf-link"><strong>${escapeHtml(e.hole)}</strong></a></td>
              <td style="${getDynamicStyle(e.lang)}"><a href="${langUrl}" target="_blank" rel="noopener noreferrer" class="golf-link-clean" style="font-weight: bold; color: #4da6ff;">${escapeHtml(e.lang)}</a></td>
              <td style="${getDynamicStyle(e.oldDisplayHtml)}">${e.oldDisplayHtml}</td>
              <td style="${getDynamicStyle(e.newDisplayHtml)}">${e.newDisplayHtml}</td>
              <td style="${getDynamicStyle(lostByRaw)}" title="${escapeHtml(e.oldHolders.join(', '))}">${lostByDisplay}</td>
              <td style="${getDynamicStyle(newByRaw)}" title="${escapeHtml(newHoldersArr.join(', '))}"><strong>${newGolferDisplay}</strong></td>
              <td style="white-space: nowrap; font-size: 0.85rem; padding-right: 8px;">${escapeHtml(e.dateStr)}</td>
            </tr>
          `;
        }).join('');
      }

      return `
        <div class="card" style="margin: 0; background: rgba(15, 23, 42, 0.6); border: 1px solid var(--border, #334155);">
          <h4 style="margin-top: 0; margin-bottom: 0.8rem; color: #38bdf8; font-size: 1.1rem; display: flex; justify-content: space-between; align-items: center;">
            <span>${tf.title}</span>
            <span style="font-size: 0.85rem; color: var(--text-dim); font-weight: normal;">(${tf.events.length.toLocaleString()} event${tf.events.length === 1 ? '' : 's'})</span>
          </h4>
          <div style="overflow-x: auto;">
            <table class="main-table" style="table-layout: fixed; width: 100%;">
              <thead>
                <tr>
                  <th style="width: 15%; padding-right: 15px;">Hole</th>
                  <th style="width: 12%; padding-right: 15px;">Language</th>
                  <th style="width: 13%; padding-right: 15px;">Old Best</th>
                  <th style="width: 13%; padding-right: 15px;">New Best</th>
                  <th style="width: 20%; padding-right: 15px;">Lost By</th>
                  <th style="width: 17%; padding-right: 15px;">New Best By</th>
                  <th style="width: 10%; padding-right: 8px;">Date</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }).join('');

    card.classList.remove('hidden');
  }

  /* ==========================================================================
     3. STANDARD SOLUTIONS QUERIES
     ========================================================================== */
function runSolutionsQuery(jsonData, queryType, holesJson, langsJson, includeExperimental = false) {
    const validHoles = computeValidHoles(holesJson, includeExperimental);
    const validLangs = computeValidLangs(langsJson, includeExperimental);

    const bytesSubs = jsonData.filter(x => {
      if (x.scoring !== 'bytes') return false;
      if (validHoles && !validHoles.has(x.hole)) return false;
      if (validLangs && !validLangs.has(x.lang)) return false;
      return true;
    });

    const holeLangStats = new Map();
    const holeSolversMap = new Map();

    for (const x of bytesSubs) {
      const key = `${x.hole}::${x.lang}`;
      const bytes = Number(x.bytes);
      const login = x.login;

      if (!holeSolversMap.has(key)) holeSolversMap.set(key, new Set());
      holeSolversMap.get(key).add(login.toLowerCase());

      if (!holeLangStats.has(key)) {
        holeLangStats.set(key, { minBytes: bytes, holders: [x] });
      } else {
        const stat = holeLangStats.get(key);
        if (bytes < stat.minBytes) {
          stat.minBytes = bytes;
          stat.holders = [x];
        } else if (bytes === stat.minBytes) {
          if (!stat.holders.some(h => h.login.toLowerCase() === login.toLowerCase())) {
            stat.holders.push(x);
          }
        }
      }
    }

    if (isUserQueryType(queryType)) {
      const userCounts = new Map();

      for (const [key, stat] of holeLangStats.entries()) {
        const [hole, lang] = key.split('::');
        const totalSolvers = holeSolversMap.get(key)?.size || 0;
        const isUnique = stat.holders.length === 1;

        for (const h of stat.holders) {
          const golfer = h.login;
          if (!userCounts.has(golfer)) userCounts.set(golfer, []);

          if (queryType === 'bytes_gold_medals') {
            userCounts.get(golfer).push({ hole, lang, bytes: stat.minBytes, type: isUnique ? '💎' : '🥇', tieCount: stat.holders.length });
          } else if (queryType === 'bytes_diamonds' && isUnique) {
            userCounts.get(golfer).push({ hole, lang, bytes: stat.minBytes, type: '💎', tieCount: 1 });
          } else if (queryType === 'bytes_unicorns' && isUnique && totalSolvers === 1) {
            userCounts.get(golfer).push({ hole, lang, bytes: stat.minBytes, type: '🦄', tieCount: 1 });
          }
        }
      }

      const results = [];
      for (const [golfer, items] of userCounts.entries()) {
        results.push({
          golfer,
          count: items.length,
          items
        });
      }

      return { type: queryType, results };
    } else {
      const list = [];

      for (const [key, stat] of holeLangStats.entries()) {
        const [hole, lang] = key.split('::');
        const totalSolvers = holeSolversMap.get(key)?.size || 0;
        const isUnique = stat.holders.length === 1;

        if (queryType === 'longest_golds') {
          for (const h of stat.holders) {
            let medalType = `🥇 (${stat.holders.length})`;
            if (isUnique) {
              if (totalSolvers === 1) {
                medalType = '🦄';
              } else {
                medalType = '💎';
              }
            }
            list.push({ hole, lang, golfer: h.login, bytes: stat.minBytes, type: medalType });
          }
        } else if (queryType === 'longest_diamonds' && isUnique) {
          list.push({ hole, lang, golfer: stat.holders[0].login, bytes: stat.minBytes, type: '💎' });
        } else if (queryType === 'longest_unicorns' && isUnique && totalSolvers === 1) {
          list.push({ hole, lang, golfer: stat.holders[0].login, bytes: stat.minBytes, type: '🦄' });
        }
      }

      list.sort((a, b) => b.bytes - a.bytes);

      return { type: queryType, results: list };
    }
  }

  function renderQueryResults(data, queryType) {
    const card = document.getElementById('queryResultsCard');
    const titleEl = document.getElementById('queryResultsTitle');
    const statsContainer = document.getElementById('queryStatsContainer');
    const singleTableContainer = document.getElementById('singleTableContainer');
    const multiTableContainer = document.getElementById('multiTableContainer');
    const table = document.getElementById('queryResultsTable');

    if (!card || !table) return;

    if (singleTableContainer) singleTableContainer.classList.remove('hidden');
    if (multiTableContainer) multiTableContainer.classList.add('hidden');

    let titleText = 'Query Results';
    if (queryType === 'longest_golds') titleText = 'Longest BYTES Golds (Showing Top 100)';
    else if (queryType === 'longest_diamonds') titleText = 'Longest BYTES Diamonds (Showing Top 100)';
    else if (queryType === 'longest_unicorns') titleText = 'Longest BYTES Unicorns (Showing Top 100)';
    else if (queryType === 'bytes_gold_medals') titleText = 'Golfer Bytes Gold Medals Ranking';
    else if (queryType === 'bytes_diamonds') titleText = 'Golfer Bytes Diamonds Ranking';
    else if (queryType === 'bytes_unicorns') titleText = 'Golfer Bytes Unicorns Ranking';

    if (titleEl) titleEl.textContent = titleText;

    if (statsContainer) {
      if (isUserQueryType(queryType)) {
        const totalGolfers = data.results.length;
        const totalMedals = data.results.reduce((a, r) => a + r.count, 0);
        const topGolfer = totalGolfers > 0 ? data.results[0].golfer : '-';
        statsContainer.innerHTML = `
          <div class="stat-box"><div class="val">${totalGolfers.toLocaleString()}</div><div class="lbl">Total Golfers</div></div>
          <div class="stat-box"><div class="val">${totalMedals.toLocaleString()}</div><div class="lbl">Total Medals Held</div></div>
          <div class="stat-box"><div class="val">${escapeHtml(topGolfer)}</div><div class="lbl">Top Golfer</div></div>
        `;
      } else {
        const totalSolutions = data.results.length;
        const maxBytes = totalSolutions > 0 ? Math.max(...data.results.map(r => r.bytes)) : 0;
        statsContainer.innerHTML = `
          <div class="stat-box"><div class="val">${totalSolutions.toLocaleString()}</div><div class="lbl">Total Matching Solutions</div></div>
          <div class="stat-box"><div class="val">${maxBytes.toLocaleString()} B</div><div class="lbl">Max Solution Length</div></div>
        `;
      }
    }

    const thead = table.querySelector('thead');
    if (thead) {
      const renderTh = (id, label, fieldName, align = 'left') => {
        const isCurrent = currentQuerySortField === fieldName;
        const arrow = isCurrent ? (currentQuerySortDir === 'desc' ? ' ▼' : ' ▲') : '';
        const colorStyle = isCurrent ? 'color: #38bdf8;' : 'color: inherit;';
        return `<th id="${id}" style="text-align: ${align}; cursor: pointer; user-select: none; ${colorStyle}">${label}${arrow}</th>`;
      };

      if (isUserQueryType(queryType)) {
        thead.innerHTML = `
          <tr>
            <th style="width: 50px;">#</th>
            ${renderTh('thQGolfer', 'Golfer', 'golfer', 'left')}
            ${renderTh('thQCount', 'Medal Count', 'count', 'right')}
          </tr>
        `;
      } else {
        thead.innerHTML = `
          <tr>
            <th style="width: 50px;">#</th>
            ${renderTh('thQHole', 'Hole', 'hole', 'left')}
            ${renderTh('thQLang', 'Language', 'lang', 'left')}
            ${renderTh('thQGolfer', 'Golfer', 'golfer', 'left')}
            ${renderTh('thQBytes', 'Bytes', 'bytes', 'right')}
            ${renderTh('thQType', 'Type', 'type', 'right')}
          </tr>
        `;
      }

      const bindQSort = (id, fieldName, defaultDir = 'desc') => {
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

      if (isUserQueryType(queryType)) {
        bindQSort('thQGolfer', 'golfer', 'asc');
        bindQSort('thQCount', 'count', 'desc');
      } else {
        bindQSort('thQHole', 'hole', 'asc');
        bindQSort('thQLang', 'lang', 'asc');
        bindQSort('thQGolfer', 'golfer', 'asc');
        bindQSort('thQBytes', 'bytes', 'desc');
        bindQSort('thQType', 'type', 'asc');
      }
    }

    applyQueryFilterAndRender();
    card.classList.remove('hidden');
  }

  function applyQueryFilterAndRender() {
    const tbody = document.getElementById('queryResultsBody');
    const filterText = (document.getElementById('queryTableSearch')?.value || '').toLowerCase();
    if (!tbody || !lastQueryResults) return;

    let items = [...lastQueryResults.results];

    if (filterText) {
      items = items.filter(r => {
        if (isUserQueryType(lastQueryResults.type)) {
          return r.golfer.toLowerCase().includes(filterText);
        } else {
          return r.hole.toLowerCase().includes(filterText) ||
                 r.lang.toLowerCase().includes(filterText) ||
                 r.golfer.toLowerCase().includes(filterText);
        }
      });
    }

    items.sort((a, b) => {
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

    if (!isUserQueryType(lastQueryResults.type)) {
      items = items.slice(0, 100);
    }

    tbody.innerHTML = '';

    items.forEach((r, idx) => {
      const tr = document.createElement('tr');

      if (isUserQueryType(lastQueryResults.type)) {
        const golferLink = typeof getGolferLink === 'function' ? getGolferLink(r.golfer) : escapeHtml(r.golfer);

        tr.innerHTML = `
          <td>${idx + 1}</td>
          <td>${golferLink}</td>
          <td style="text-align: right;">
            <button class="btn-secondary user-medals-btn" data-golfer="${escapeHtml(r.golfer)}" style="padding: 2px 8px; font-size: 0.85rem;">
              ${r.count.toLocaleString()} Medals 🔍
            </button>
          </td>
        `;
      } else {
        const holeUrl = `https://code.golf/${encodeURIComponent(r.hole)}`;
        const langUrl = `https://code.golf/${encodeURIComponent(r.hole)}#${encodeURIComponent(r.lang)}`;
        const golferLink = typeof getGolferLink === 'function' ? getGolferLink(r.golfer) : escapeHtml(r.golfer);

        tr.innerHTML = `
          <td>${idx + 1}</td>
          <td><a href="${holeUrl}" target="_blank" rel="noopener noreferrer" class="golf-link"><strong>${escapeHtml(r.hole)}</strong></a></td>
          <td><a href="${langUrl}" target="_blank" rel="noopener noreferrer" class="golf-link-clean" style="font-weight: bold; color: #4da6ff;">${escapeHtml(r.lang)}</a></td>
          <td>${golferLink}</td>
          <td style="text-align: right;"><strong>${r.bytes.toLocaleString()} B</strong></td>
          <td style="text-align: right;"><span class="medal">${r.type}</span></td>
        `;
      }

      tbody.appendChild(tr);
    });
  }

  /* ==========================================================================
     4. MEDAL MISMATCH: BYTES VS CHARS
     ========================================================================== */

  function computeMedalForStat(stat, solverCount) {
    if (!stat || stat.holders.length === 0) return '';
    if (stat.holders.length === 1) return solverCount === 1 ? '🦄' : '💎';
    return '🥇';
  }

function processMedalMismatch(jsonData, holesJson, langsJson, username, langFilter = '', includeExperimental = false) {
  const validHoles = computeValidHoles(holesJson);
const validLangs = computeValidLangs(langsJson);

  // ... rest of function remains unchanged
    const statsBytes = new Map();
    const statsChars = new Map();
    const usernameLower = username.trim().toLowerCase();

    for (const x of jsonData) {
      if (x.scoring !== 'bytes' && x.scoring !== 'chars') continue;
      if (validHoles && !validHoles.has(x.hole)) continue;
      if (validLangs && !validLangs.has(x.lang)) continue;
      if (langFilter && x.lang.toLowerCase() !== langFilter) continue;

      const key = `${x.hole}::${x.lang}`;
      const login = x.login;
      const loginLower = login.toLowerCase();
      const value = Number(x.scoring === 'chars' ? (x.chars ?? x.bytes) : x.bytes);
      const statsMap = x.scoring === 'chars' ? statsChars : statsBytes;

      if (!statsMap.has(key)) {
        statsMap.set(key, { minVal: value, holders: [{ login, loginLower }], solvers: new Set([loginLower]) });
      } else {
        const stat = statsMap.get(key);
        stat.solvers.add(loginLower);
        if (value < stat.minVal) {
          stat.minVal = value;
          stat.holders = [{ login, loginLower }];
        } else if (value === stat.minVal) {
          if (!stat.holders.some(h => h.loginLower === loginLower)) {
            stat.holders.push({ login, loginLower });
          }
        }
      }
    }

    const allKeys = new Set([...statsBytes.keys(), ...statsChars.keys()]);
    const results = [];

    for (const key of allKeys) {
      const bStat = statsBytes.get(key) || null;
      const cStat = statsChars.get(key) || null;

      const bHas = bStat ? bStat.holders.some(h => h.loginLower === usernameLower) : false;
      const cHas = cStat ? cStat.holders.some(h => h.loginLower === usernameLower) : false;

      const bMedal = bHas ? computeMedalForStat(bStat, bStat.solvers.size) : '';
      const cMedal = cHas ? computeMedalForStat(cStat, cStat.solvers.size) : '';

      if (bMedal === cMedal) continue;

      const [hole, lang] = key.split('::');

      results.push({
        hole,
        lang,
        bytesMedal: bMedal,
        bytesValue: bStat ? bStat.minVal : null,
        bytesHolders: bStat ? bStat.holders.filter(h => h.loginLower !== usernameLower).map(h => h.login) : [],
        charsMedal: cMedal,
        charsValue: cStat ? cStat.minVal : null,
        charsHolders: cStat ? cStat.holders.filter(h => h.loginLower !== usernameLower).map(h => h.login) : []
      });
    }

    results.sort((a, b) => a.hole.localeCompare(b.hole) || a.lang.localeCompare(b.lang));

    return { type: 'medal_mismatch', username: username.trim(), results };
  }

  function processSolutionHistory(jsonData, userFilter = '', holesJson = null, langsJson = null, includeExperimental = false) {
    const validHoles = computeValidHoles(holesJson, includeExperimental);
    const validLangs = computeValidLangs(langsJson, includeExperimental);

    let results = jsonData.filter(x => {
      if (x.scoring !== 'bytes') return false;
      if (validHoles && !validHoles.has(x.hole)) return false;
      if (validLangs && !validLangs.has(x.lang)) return false;
      return true;
    });

    const uf = (userFilter || '').trim().toLowerCase();
    if (uf) {
      results = results.filter(x => (x.login || '').toLowerCase().includes(uf));
    }

    results.sort((a, b) => {
      const dateA = new Date(a.submitted || 0).getTime();
      const dateB = new Date(b.submitted || 0).getTime();
      return dateB - dateA;
    });

    return {
      type: 'solution_history',
      userFilter: userFilter,
      results: results
    };
  }

  function renderSolutionHistoryResults() {
    ensureGroupByDayButton();

    const card = document.getElementById('queryResultsCard');
    const titleEl = document.getElementById('queryResultsTitle');
    const statsContainer = document.getElementById('queryStatsContainer');
    const singleTableContainer = document.getElementById('singleTableContainer');
    const multiTableContainer = document.getElementById('multiTableContainer');
    const table = document.getElementById('queryResultsTable');
    const thead = table?.querySelector('thead');
    const tbody = document.getElementById('queryResultsBody');

    if (!card || !table || !tbody || !solutionHistoryAllResults) return;

    if (titleEl) {
      const modeTxt = solutionHistoryIsGrouped ? ' (Grouped by Day)' : '';
      titleEl.textContent = solutionHistoryAllResults.userFilter 
        ? `Solution History (Bytes): ${escapeHtml(solutionHistoryAllResults.userFilter)}${modeTxt}`
        : `Solution History (Bytes)${modeTxt}`;
    }

    if (singleTableContainer) singleTableContainer.classList.remove('hidden');
    if (multiTableContainer) multiTableContainer.classList.add('hidden');

    let dataToDisplay = [];
    if (solutionHistoryIsGrouped) {
      const dayMap = new Map();
      solutionHistoryAllResults.results.forEach(x => {
        const dateStr = parseDateStr(x.submitted);
        const login = x.login;
        const key = `${dateStr}::${login.toLowerCase()}`;
        if (!dayMap.has(key)) {
          dayMap.set(key, {
            date: dateStr,
            login: login,
            count: 0,
            totalBytes: 0
          });
        }
        const item = dayMap.get(key);
        item.count += 1;
        item.totalBytes += Number(x.bytes || 0);
      });
      dataToDisplay = Array.from(dayMap.values());
    } else {
      dataToDisplay = [...solutionHistoryAllResults.results];
    }

    const searchText = (document.getElementById('queryTableSearch')?.value || '').toLowerCase();
    if (searchText) {
      if (solutionHistoryIsGrouped) {
        dataToDisplay = dataToDisplay.filter(r => 
          r.login.toLowerCase().includes(searchText) || 
          r.date.toLowerCase().includes(searchText) ||
          String(r.count).includes(searchText) ||
          String(r.totalBytes).includes(searchText)
        );
      } else {
        dataToDisplay = dataToDisplay.filter(r =>
          (r.hole || '').toLowerCase().includes(searchText) ||
          (r.lang || '').toLowerCase().includes(searchText) ||
          (r.login || '').toLowerCase().includes(searchText) ||
          String(r.bytes || '').includes(searchText) ||
          parseDateStrWithMs(r.submitted).toLowerCase().includes(searchText)
        );
      }
    }

    if (statsContainer) {
      if (solutionHistoryIsGrouped) {
        const totalDays = dataToDisplay.length;
        const totalBytesSum = dataToDisplay.reduce((acc, r) => acc + r.totalBytes, 0);
        const totalSolvesSum = dataToDisplay.reduce((acc, r) => acc + r.count, 0);
        statsContainer.innerHTML = `
          <div class="stat-box"><div class="val">${totalDays.toLocaleString()}</div><div class="lbl">Days Active</div></div>
          <div class="stat-box"><div class="val">${totalSolvesSum.toLocaleString()}</div><div class="lbl">Total Byte Solves</div></div>
          <div class="stat-box"><div class="val">${totalBytesSum.toLocaleString()} B</div><div class="lbl">Total Bytes</div></div>
        `;
      } else {
        const totalSolves = dataToDisplay.length;
        const totalBytesSum = dataToDisplay.reduce((acc, r) => acc + Number(r.bytes || 0), 0);
        statsContainer.innerHTML = `
          <div class="stat-box"><div class="val">${totalSolves.toLocaleString()}</div><div class="lbl">Total Byte Solves</div></div>
          <div class="stat-box"><div class="val">${totalBytesSum.toLocaleString()} B</div><div class="lbl">Total Bytes</div></div>
        `;
      }
    }

    if (thead) {
      const renderTh = (id, label, fieldName, align = 'left') => {
        const isCurrent = currentQuerySortField === fieldName;
        const arrow = isCurrent ? (currentQuerySortDir === 'desc' ? ' ▼' : ' ▲') : '';
        const colorStyle = isCurrent ? 'color: #38bdf8;' : 'color: inherit;';
        return `<th id="${id}" style="text-align: ${align}; cursor: pointer; user-select: none; ${colorStyle}">${label}${arrow}</th>`;
      };

      if (solutionHistoryIsGrouped) {
        thead.innerHTML = `
          <tr>
            <th style="width: 50px;">#</th>
            ${renderTh('thSCount', 'Solves', 'count', 'right')}
            ${renderTh('thSGolfer', 'Golfer', 'login', 'left')}
            ${renderTh('thSTotalBytes', 'Total Bytes', 'totalBytes', 'right')}
            ${renderTh('thSDate', 'Date', 'date', 'left')}
          </tr>
        `;

        const bindSHSort = (id, fieldName, defaultDir = 'desc') => {
          const el = document.getElementById(id);
          el?.addEventListener('click', () => {
            if (currentQuerySortField === fieldName) {
              currentQuerySortDir = currentQuerySortDir === 'desc' ? 'asc' : 'desc';
            } else {
              currentQuerySortField = fieldName;
              currentQuerySortDir = defaultDir;
            }
            renderSolutionHistoryResults();
          });
        };

        bindSHSort('thSCount', 'count', 'desc');
        bindSHSort('thSGolfer', 'login', 'asc');
        bindSHSort('thSTotalBytes', 'totalBytes', 'desc');
        bindSHSort('thSDate', 'date', 'desc');
      } else {
        thead.innerHTML = `
          <tr>
            <th style="width: 50px;">#</th>
            ${renderTh('thSHole', 'Hole', 'hole', 'left')}
            ${renderTh('thSLang', 'Language', 'lang', 'left')}
            ${renderTh('thSGolfer', 'Golfer', 'login', 'left')}
            ${renderTh('thSBytes', 'Bytes', 'bytes', 'right')}
            ${renderTh('thSDate', 'Date Submitted', 'submitted', 'left')}
          </tr>
        `;

        const bindSHSort = (id, fieldName, defaultDir = 'desc') => {
          const el = document.getElementById(id);
          el?.addEventListener('click', () => {
            if (currentQuerySortField === fieldName) {
              currentQuerySortDir = currentQuerySortDir === 'desc' ? 'asc' : 'desc';
            } else {
              currentQuerySortField = fieldName;
              currentQuerySortDir = defaultDir;
            }
            renderSolutionHistoryResults();
          });
        };

        bindSHSort('thSHole', 'hole', 'asc');
        bindSHSort('thSLang', 'lang', 'asc');
        bindSHSort('thSGolfer', 'login', 'asc');
        bindSHSort('thSBytes', 'bytes', 'desc');
        bindSHSort('thSDate', 'submitted', 'desc');
      }
    }

    dataToDisplay.sort((a, b) => {
      let valA = a[currentQuerySortField];
      let valB = b[currentQuerySortField];

      if (currentQuerySortField === 'submitted') {
        valA = new Date(valA || 0).getTime();
        valB = new Date(valB || 0).getTime();
      }

      if (typeof valA === 'string') {
        const comp = currentQuerySortDir === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        if (comp !== 0) return comp;
      } else {
        if (valA !== valB) return currentQuerySortDir === 'desc' ? valB - valA : valA - valB;
      }
      return 0;
    });

    const startIdx = (solutionHistoryCurrentPage - 1) * SOLUTIONS_PER_PAGE;
    const endIdx = startIdx + SOLUTIONS_PER_PAGE;
    const displayItems = dataToDisplay.slice(startIdx, endIdx);
    const hasMorePages = endIdx < dataToDisplay.length;

    tbody.innerHTML = '';
    displayItems.forEach((r, idx) => {
      const tr = document.createElement('tr');
      const rowNum = startIdx + idx + 1;

      if (solutionHistoryIsGrouped) {
        tr.innerHTML = `
          <td>${rowNum}</td>
          <td style="text-align: right;"><strong>${r.count.toLocaleString()}</strong></td>
          <td>${typeof getGolferLink === 'function' ? getGolferLink(r.login) : escapeHtml(r.login)}</td>
          <td style="text-align: right;"><strong>${r.totalBytes.toLocaleString()} B</strong></td>
          <td>${escapeHtml(r.date)}</td>
        `;
      } else {
        const holeUrl = `https://code.golf/${encodeURIComponent(r.hole)}`;
        const langUrl = `https://code.golf/${encodeURIComponent(r.hole)}#${encodeURIComponent(r.lang)}`;
        const dateStr = parseDateStrWithMs(r.submitted);

        tr.innerHTML = `
          <td>${rowNum}</td>
          <td><a href="${holeUrl}" target="_blank" rel="noopener noreferrer" class="golf-link"><strong>${escapeHtml(r.hole)}</strong></a></td>
          <td><a href="${langUrl}" target="_blank" rel="noopener noreferrer" class="golf-link-clean" style="font-weight: bold; color: #4da6ff;">${escapeHtml(r.lang)}</a></td>
          <td>${typeof getGolferLink === 'function' ? getGolferLink(r.login) : escapeHtml(r.login)}</td>
          <td style="text-align: right;"><strong>${r.bytes} B</strong></td>
          <td>${escapeHtml(dateStr)}</td>
        `;
      }
      tbody.appendChild(tr);
    });

    const oldLoadMoreContainer = document.getElementById('solutionHistoryLoadMoreContainer');
    if (oldLoadMoreContainer) oldLoadMoreContainer.remove();

    if (hasMorePages) {
      const loadMoreContainer = document.createElement('div');
      loadMoreContainer.id = 'solutionHistoryLoadMoreContainer';
      loadMoreContainer.style.cssText = 'margin-top: 1.5rem; display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;';

      const loadMoreBtn = document.createElement('button');
      loadMoreBtn.className = 'btn-submit';
      const totalPages = Math.ceil(dataToDisplay.length / SOLUTIONS_PER_PAGE);
      loadMoreBtn.textContent = `Load More (Page ${solutionHistoryCurrentPage + 1} of ${totalPages})`;
      loadMoreBtn.addEventListener('click', () => {
        solutionHistoryCurrentPage++;
        renderSolutionHistoryResults();
        setTimeout(() => {
          table.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
      });

      loadMoreContainer.appendChild(loadMoreBtn);
      table.parentElement.after(loadMoreContainer);
    }

    card.classList.remove('hidden');
  }

  function renderMedalMismatchResults(data) {
    const card = document.getElementById('queryResultsCard');
    const titleEl = document.getElementById('queryResultsTitle');
    const statsContainer = document.getElementById('queryStatsContainer');
    const singleTableContainer = document.getElementById('singleTableContainer');
    const multiTableContainer = document.getElementById('multiTableContainer');
    const table = document.getElementById('queryResultsTable');

    if (!card || !table) return;

    if (titleEl) titleEl.textContent = `Medal Mismatch (Bytes vs Chars): ${escapeHtml(data.username)}`;
    if (singleTableContainer) singleTableContainer.classList.remove('hidden');
    if (multiTableContainer) multiTableContainer.classList.add('hidden');

    if (statsContainer) {
      const bytesOnly = data.results.filter(r => r.bytesMedal && !r.charsMedal).length;
      const charsOnly = data.results.filter(r => r.charsMedal && !r.bytesMedal).length;
      const differing = data.results.filter(r => r.bytesMedal && r.charsMedal && r.bytesMedal !== r.charsMedal).length;

      statsContainer.innerHTML = `
        <div class="stat-box">
          <div class="val">${data.results.length.toLocaleString()}</div>
          <div class="lbl">Total Mismatches</div>
        </div>
        <div class="stat-box">
          <div class="val">${bytesOnly.toLocaleString()}</div>
          <div class="lbl">Bytes Only</div>
        </div>
        <div class="stat-box">
          <div class="val">${charsOnly.toLocaleString()}</div>
          <div class="lbl">Chars Only</div>
        </div>
        <div class="stat-box">
          <div class="val">${differing.toLocaleString()}</div>
          <div class="lbl">Different Medal Tier</div>
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
          ${renderTh('thMMHole', 'Hole', 'hole')}
          ${renderTh('thMMLang', 'Language', 'lang')}
          ${renderTh('thMMBytes', 'Bytes', 'bytesMedal', 'right')}
          ${renderTh('thMMChars', 'Chars', 'charsMedal', 'right')}
        </tr>
      `;

      const bindMMSort = (id, fieldName, defaultDir = 'asc') => {
        const el = document.getElementById(id);
        el?.addEventListener('click', () => {
          if (currentQuerySortField === fieldName) {
            currentQuerySortDir = currentQuerySortDir === 'desc' ? 'asc' : 'desc';
          } else {
            currentQuerySortField = fieldName;
            currentQuerySortDir = defaultDir;
          }
          sortAndRenderMismatchBody();
        });
      };

      bindMMSort('thMMHole', 'hole', 'asc');
      bindMMSort('thMMLang', 'lang', 'asc');
      bindMMSort('thMMBytes', 'bytesMedal', 'desc');
      bindMMSort('thMMChars', 'charsMedal', 'desc');
    }

    sortAndRenderMismatchBody();
    card.classList.remove('hidden');
  }

  function sortAndRenderMismatchBody() {
    const tbody = document.getElementById('queryResultsBody');
    if (!tbody || !lastQueryResults || lastQueryResults.type !== 'medal_mismatch') return;

    const searchText = (document.getElementById('queryTableSearch')?.value || '').toLowerCase();
    let items = [...lastQueryResults.results];

    if (searchText) {
      items = items.filter(r =>
        r.hole.toLowerCase().includes(searchText) ||
        r.lang.toLowerCase().includes(searchText)
      );
    }

    const medalRank = { '🦄': 0, '💎': 1, '🥇': 2, '': 3 };

    items.sort((a, b) => {
      if (currentQuerySortField === 'hole') {
        const c = a.hole.localeCompare(b.hole);
        if (c !== 0) return currentQuerySortDir === 'asc' ? c : -c;
        return a.lang.localeCompare(b.lang);
      }
      if (currentQuerySortField === 'lang') {
        const c = a.lang.localeCompare(b.lang);
        if (c !== 0) return currentQuerySortDir === 'asc' ? c : -c;
        return a.hole.localeCompare(b.hole);
      }

      const field = currentQuerySortField === 'charsMedal' ? 'charsMedal' : 'bytesMedal';
      const rankA = medalRank[a[field]] ?? 3;
      const rankB = medalRank[b[field]] ?? 3;
      if (rankA !== rankB) return currentQuerySortDir === 'desc' ? rankA - rankB : rankB - rankA;
      return a.hole.localeCompare(b.hole) || a.lang.localeCompare(b.lang);
    });

    tbody.innerHTML = '';

    items.forEach(r => {
      const tr = document.createElement('tr');
      const holeUrl = `https://code.golf/${encodeURIComponent(r.hole)}`;
      const langUrl = `https://code.golf/${encodeURIComponent(r.hole)}#${encodeURIComponent(r.lang)}`;

      const renderCell = (medal, value, holders) => {
        if (medal) {
          return `<span class="medal">${medal}</span> <strong>${(value ?? 0).toLocaleString()}</strong>`;
        }
        if (value !== null && value !== undefined) {
          let holderTxt = holders.slice(0, 2).map(h => typeof getGolferLink === 'function' ? getGolferLink(h) : escapeHtml(h)).join(', ');
          if (holders.length > 2) holderTxt += '…';
          return `<span style="color: var(--text-dim);">— ${holderTxt ? `(held by ${holderTxt}, ${value.toLocaleString()})` : ''}</span>`;
        }
        return `<span style="color: var(--text-dim);">—</span>`;
      };

      tr.innerHTML = `
        <td><a href="${holeUrl}" target="_blank" rel="noopener noreferrer" class="golf-link"><strong>${escapeHtml(r.hole)}</strong></a></td>
        <td><a href="${langUrl}" target="_blank" rel="noopener noreferrer" class="golf-link-clean" style="font-weight: bold; color: #4da6ff;">${escapeHtml(r.lang)}</a></td>
        <td style="text-align: right;">${renderCell(r.bytesMedal, r.bytesValue, r.bytesHolders)}</td>
        <td style="text-align: right;">${renderCell(r.charsMedal, r.charsValue, r.charsHolders)}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  function showUserMedalsModal(golferName, queryType, items) {
    let modal = document.getElementById('userMedalsModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'userMedalsModal';
      modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
        background-color: rgba(0, 0, 0, 0.75); -webkit-backdrop-filter: blur(4px);
        backdrop-filter: blur(4px); display: flex; justify-content: center;
        align-items: center; z-index: 9999; padding: 1rem;
      `;
      document.body.appendChild(modal);
    }

    const rowsHtml = items.map(m => {
      const holeUrl = `https://code.golf/${encodeURIComponent(m.hole)}`;
      const langUrl = `https://code.golf/${encodeURIComponent(m.hole)}#${encodeURIComponent(m.lang)}`;
      const tieDisplay = m.tieCount > 1 ? ` (${m.tieCount} tied)` : '';

      return `
        <tr>
          <td><a href="${holeUrl}" target="_blank" rel="noopener noreferrer" class="golf-link"><strong>${escapeHtml(m.hole)}</strong></a></td>
          <td><a href="${langUrl}" target="_blank" rel="noopener noreferrer" class="golf-link-clean" style="font-weight: bold; color: #4da6ff;">${escapeHtml(m.lang)}</a></td>
          <td style="text-align: right;"><strong>${m.bytes.toLocaleString()} B</strong></td>
          <td style="text-align: right;"><span class="medal">${m.type}</span>${tieDisplay}</td>
        </tr>
      `;
    }).join('');

    modal.innerHTML = `
      <div style="background: var(--card-bg, #1e293b); color: #fff; padding: 20px 24px; border-radius: 8px; min-width: 320px; max-width: 680px; width: 90%; box-shadow: 0 4px 20px rgba(0,0,0,0.5); border: 1px solid var(--border, #334155);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,0.2); padding-bottom: 10px;">
          <div>
            <h3 style="margin: 0; color: var(--accent, #22c55e); font-size: 1.2em;">Medals for ${escapeHtml(golferName)}</h3>
            <div style="font-size: 0.85em; color: var(--text-dim, #94a3b8); margin-top: 4px;">Total Held: <strong>${items.length}</strong></div>
          </div>
          <button id="closeUserMedalsModalBtn" style="background: none; border: none; color: #aaa; font-size: 1.5em; cursor: pointer; line-height: 1;">&times;</button>
        </div>
        <div style="max-height: 380px; overflow-y: auto;">
          <table class="main-table" style="font-size: 0.9rem;">
            <thead>
              <tr>
                <th>Hole</th>
                <th>Language</th>
                <th style="text-align: right;">Bytes</th>
                <th style="text-align: right;">Type</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        </div>
      </div>
    `;

    modal.classList.remove('hidden');
    modal.querySelector('#closeUserMedalsModalBtn')?.addEventListener('click', () => modal.classList.add('hidden'));
    modal.onclick = (e) => { if (e.target === modal) modal.classList.add('hidden'); };
  }

  function handleExport() {
    if (!lastQueryResults) return;

    if (currentQueryType === 'lost_golds_diamonds') {
      const timeframes = [
        { name: 'Last 24 Hours', events: lastQueryResults.events24h },
        { name: 'Last Week', events: lastQueryResults.eventsWeek },
        { name: 'Last Month', events: lastQueryResults.eventsMonth },
        { name: 'Last Year', events: lastQueryResults.eventsYear }
      ];

      const lines = ['# Lost Diamonds / Golds / Unicorns Report\n'];
      timeframes.forEach(tf => {
        lines.push(`## ${tf.name}`);
        lines.push('| Hole | Language | Old Best | New Best | Lost By | New Best By | Date |');
        lines.push('|:---|:---|:---|:---|:---|:---|:---|');
        if (tf.events.length === 0) {
          lines.push('| - | - | - | - | - | - | - |');
        } else {
          tf.events.forEach(e => {
            const newHoldersTxt = e.newHolders ? e.newHolders.join(', ') : e.newGolfer;
            lines.push(`| ${e.hole} | ${e.lang} | ${e.oldDisplayTxt} | ${e.newDisplayTxt} | ${e.oldHolders.join(', ')} | ${newHoldersTxt} | ${e.dateStr} |`);
          });
        }
        lines.push('');
      });

      if (typeof downloadMarkdownFile === 'function') {
        downloadMarkdownFile('lost_medals_report.md', lines.join('\n'));
      }
    } else if (currentQueryType === 'total_bytes_of_golds_per_day') {
      const headers = ['Date', 'Total Gold Bytes', 'Change', 'Record Solves', 'Top Golfer'];
      const rows = lastQueryResults.map(r => [
        r.date,
        `${r.totalBytes.toLocaleString()} B`,
        r.change > 0 ? `+${r.change} B` : `${r.change} B`,
        String(r.newGoldsCount),
        r.topGolfer
      ]);

      const lines = [`| ${headers.join(' | ')} |`, `|:${'-'.repeat(10)}|${'-'.repeat(18)}:|${'-'.repeat(10)}:|${'-'.repeat(15)}:|${'-'.repeat(15)}:|`];
      rows.forEach(r => lines.push(`| ${r.join(' | ')} |`));

      if (typeof downloadMarkdownFile === 'function') {
        downloadMarkdownFile('golds_per_day.md', lines.join('\n'));
      }
    } else if (currentQueryType === 'medal_mismatch') {
      const headers = ['Hole', 'Language', 'Bytes', 'Chars'];
      const cellText = (medal, value, holders) => {
        if (medal) return `${medal} ${value.toLocaleString()}`;
        if (value !== null && value !== undefined) {
          const holderTxt = holders.length ? ` (${holders.join(', ')})` : '';
          return `- ${value.toLocaleString()}${holderTxt}`;
        }
        return '-';
      };

      const rows = lastQueryResults.results.map(r => [
        r.hole,
        r.lang,
        cellText(r.bytesMedal, r.bytesValue, r.bytesHolders),
        cellText(r.charsMedal, r.charsValue, r.charsHolders)
      ]);

      const lines = [`| ${headers.join(' | ')} |`, `|:---|:---|---:|---:|`];
      rows.forEach(r => lines.push(`| ${r.join(' | ')} |`));

      if (typeof downloadMarkdownFile === 'function') {
        downloadMarkdownFile(`medal_mismatch_${lastQueryResults.username}.md`, lines.join('\n'));
      }
    } else if (isUserQueryType(lastQueryResults.type)) {
      const headers = ['#', 'Golfer', 'Medal Count'];
      const rows = lastQueryResults.results.map((r, i) => [String(i + 1), r.golfer, String(r.count)]);
      const lines = [`| ${headers.join(' | ')} |`, `|:---|:---|---:|`];
      rows.forEach(r => lines.push(`| ${r.join(' | ')} |`));

      if (typeof downloadMarkdownFile === 'function') {
        downloadMarkdownFile('golfer_medals_ranking.md', lines.join('\n'));
      }
    } else {
      const headers = ['#', 'Hole', 'Language', 'Golfer', 'Bytes', 'Type'];
      
      const exportItems = isUserQueryType(lastQueryResults.type) ? lastQueryResults.results : lastQueryResults.results.slice(0, 100);

      const rows = exportItems.map((r, i) => [String(i + 1), r.hole, r.lang, r.golfer, `${r.bytes} B`, r.type]);
      const lines = [`| ${headers.join(' | ')} |`, `|:---|:---|:---|:---|---:|---:|`];
      rows.forEach(r => lines.push(`| ${r.join(' | ')} |`));

      if (typeof downloadMarkdownFile === 'function') {
        downloadMarkdownFile('query_results.md', lines.join('\n'));
      }
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initQueryEvents);
  } else {
    initQueryEvents();
  }
})();