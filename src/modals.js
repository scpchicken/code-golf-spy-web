// modals.js
/**
 * Modals & Popup Logic
 */

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

// Startup Modal Event Handlers
const initialModal = document.getElementById('initialModal');
const initialUploadBtn = document.getElementById('initialUploadBtn');
const initialFileInput = document.getElementById('initialFileInput');
const initialDownloadBtn = document.getElementById('initialDownloadBtn');
const initialCancelBtn = document.getElementById('initialCancelBtn');
const submissionsFileInput = document.getElementById('submissionsFile');

initialUploadBtn?.addEventListener('click', () => {
  initialFileInput?.click();
});

initialFileInput?.addEventListener('change', (e) => {
  if (e.target.files && e.target.files.length > 0) {
    if (submissionsFileInput) {
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(e.target.files[0]);
      submissionsFileInput.files = dataTransfer.files;
    }
    initialModal?.classList.add('hidden');
  }
});

initialDownloadBtn?.addEventListener('click', () => {
  initialModal?.classList.add('hidden');
  handleSolutionsDownload();
});

initialCancelBtn?.addEventListener('click', () => {
  initialModal?.classList.add('hidden');
});

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
        <a href="${langUrl}" target="_blank" rel="noopener noreferrer" class="golf-link-clean" style="font-weight: bold; color: #4ade80;">${escapeHtml(m.lang)}</a>
        <span style="font-size: 1.1em; margin-left: 12px;">${m.medal}${ptDisplay}</span>
      </div>
    `;
  }).join('');

  modal.innerHTML = `
    <div style="background: var(--card-bg, #1e293b); color: #fff; padding: 20px 24px; border-radius: 8px; min-width: 280px; max-width: 420px; box-shadow: 0 4px 20px rgba(0,0,0,0.5); border: 1px solid var(--border, #334155);">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,0.2); padding-bottom: 8px;">
        <strong style="font-size: 1.1em; color: var(--accent, #22c55e);">${escapeHtml(hole)} (${escapeHtml(golfer)})</strong>
        <button id="closeExtraMedalsBtn" style="background: none; border: none; color: #aaa; font-size: 1.4em; cursor: pointer; line-height: 1;">&times;</button>
      </div>
      <div style="max-height: 300px; overflow-y: auto;">
        ${rowsHtml}
      </div>
    </div>
  `;

  modal.classList.remove('hidden');
  modal.querySelector('#closeExtraMedalsBtn')?.addEventListener('click', () => modal.classList.add('hidden'));
  modal.onclick = (e) => { if (e.target === modal) modal.classList.add('hidden'); };
}

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

      let valA = 0, valB = 0;
      if (currentSortField === 'u1') { valA = u1PtsA; valB = u1PtsB; }
      else if (currentSortField === 'u2') { valA = u2PtsA; valB = u2PtsB; }
      else if (currentSortField === 'diff') { valA = diffA; valB = diffB; }
      else if (currentSortField === 'diffBest') { valA = diffBestA; valB = diffBestB; }

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

      const u1MedalStr = item1?.medal ? `<span class="medal">${item1.medal}</span>` : '';
      const u1PtsStr = item1 ? u1Pts.toLocaleString() : '-';
      const u1CellContent = `
        <div style="display: flex; justify-content: flex-end; align-items: center; width: 100%; gap: 6px;">
          <span style="display: inline-block; text-align: center;">${u1MedalStr}</span>
          <span style="min-width: 5ch; text-align: right; display: inline-block; font-variant-numeric: tabular-nums;">${u1PtsStr}</span>
        </div>
      `;

      const u2MedalStr = item2?.medal ? `<span class="medal">${item2.medal}</span>` : '';
      let u2PtsStr = item2 ? u2Pts.toLocaleString() : '-';

      if (item2 && u2Pts > u1Point) {
        u2PtsStr = `<span style="color: #facc15; font-weight: bold;">${u2PtsStr}</span>`;
      }

      const u2CellContent = `
        <div style="display: flex; justify-content: flex-end; align-items: center; width: 100%; gap: 6px;">
          <span style="display: inline-block; text-align: center;">${u2MedalStr}</span>
          <span style="min-width: 5ch; text-align: right; display: inline-block; font-variant-numeric: tabular-nums;">${u2PtsStr}</span>
        </div>
      `;

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
          <td style="padding: 8px 12px; text-align: right;">${u1CellContent}</td>
          <td style="padding: 8px 12px; text-align: right;">${u2CellContent}</td>
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
            <h3 style="margin: 0; color: var(--accent, #22c55e); font-size: 1.2em;">${escapeHtml(hole)}</h3>
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
                <th id="thSortU1" style="padding: 6px 12px; text-align: right; cursor: pointer; user-select: none; color: ${currentSortField === 'u1' ? '#38bdf8' : 'inherit'};">
                  ${escapeHtml(u1Name)}${u1Arrow}
                </th>
                <th id="thSortU2" style="padding: 6px 12px; text-align: right; cursor: pointer; user-select: none; color: ${currentSortField === 'u2' ? '#38bdf8' : 'inherit'};">
                  ${escapeHtml(u2Name)}${u2Arrow}
                </th>
                <th id="thSortDiff" style="padding: 6px 12px; text-align: right; cursor: pointer; user-select: none; color: ${currentSortField === 'diff' ? '#38bdf8' : 'inherit'};">
                  Diff${diffArrow}
                </th>
                <th id="thSortDiffBest" style="padding: 6px 12px; text-align: right; cursor: pointer; user-select: none; color: ${currentSortField === 'diffBest' ? '#38bdf8' : 'inherit'};">
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

    modal.querySelector('#closeDiffModalBtn')?.addEventListener('click', () => modal.classList.add('hidden'));

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
  modal.onclick = (e) => { if (e.target === modal) modal.classList.add('hidden'); };
}

function showLostMedalModal(eventData) {
  let modal = document.getElementById('lostMedalModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'lostMedalModal';
    modal.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
      background: rgba(0, 0, 0, 0.75); -webkit-backdrop-filter: blur(4px);
      backdrop-filter: blur(4px); display: flex; align-items: center;
      justify-content: center; z-index: 9999; padding: 1rem;
    `;
    document.body.appendChild(modal);
  }

  const holeUrl = `https://code.golf/${encodeURIComponent(eventData.hole)}`;
  const langUrl = `https://code.golf/${encodeURIComponent(eventData.hole)}#${encodeURIComponent(eventData.lang)}`;

  const lostByList = eventData.oldHolders.map(u => typeof getGolferLink === 'function' ? getGolferLink(u) : `<strong>${escapeHtml(u)}</strong>`).join(', ');
  const newGolferLink = typeof getGolferLink === 'function' ? getGolferLink(eventData.newGolfer) : `<strong>${escapeHtml(eventData.newGolfer)}</strong>`;

  modal.innerHTML = `
    <div style="background: var(--card-bg, #1e293b); color: #fff; padding: 24px; border-radius: 10px; min-width: 320px; max-width: 520px; width: 90%; box-shadow: 0 4px 20px rgba(0,0,0,0.5); border: 1px solid var(--border, #334155);">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; border-bottom: 1px solid rgba(255,255,255,0.15); padding-bottom: 10px;">
        <div>
          <h3 style="margin: 0; color: var(--accent, #38bdf8); font-size: 1.25em;">
            <a href="${holeUrl}" target="_blank" rel="noopener noreferrer" class="golf-link" style="color: #38bdf8; text-decoration: none;">${escapeHtml(eventData.hole)}</a>
            (<a href="${langUrl}" target="_blank" rel="noopener noreferrer" class="golf-link-clean" style="color: #4da6ff; text-decoration: none;">${escapeHtml(eventData.lang)}</a>)
          </h3>
          <div style="font-size: 0.85em; color: var(--text-dim, #94a3b8); margin-top: 4px;">Record Breakdown & Loss Event</div>
        </div>
        <button id="closeLostMedalBtn" style="background: none; border: none; color: #aaa; font-size: 1.5em; cursor: pointer; line-height: 1;">&times;</button>
      </div>

      <div style="display: flex; flex-direction: column; gap: 14px; font-size: 0.95rem;">
        <div style="background: rgba(239, 68, 68, 0.1); border-left: 4px solid #ef4444; padding: 10px 14px; border-radius: 4px;">
          <div style="font-size: 0.8em; color: #fca5a5; font-weight: bold; text-transform: uppercase;">Previous Record (Lost)</div>
          <div style="margin-top: 4px; font-size: 1.1em;">
            Score: <strong>${eventData.oldDisplayHtml}</strong>
          </div>
          <div style="margin-top: 4px;">
            Lost by: ${lostByList}
          </div>
        </div>

        <div style="background: rgba(34, 197, 94, 0.1); border-left: 4px solid #22c55e; padding: 10px 14px; border-radius: 4px;">
          <div style="font-size: 0.8em; color: #86efac; font-weight: bold; text-transform: uppercase;">New Record (Achieved)</div>
          <div style="margin-top: 4px; font-size: 1.1em;">
            Score: <strong>${eventData.newDisplayHtml}</strong> <span style="font-size: 0.85em; color: #86efac;">(-${eventData.byteDiff} B)</span>
          </div>
          <div style="margin-top: 4px;">
            Achieved by: ${newGolferLink}
          </div>
        </div>

        <div style="display: flex; justify-content: space-between; font-size: 0.85em; color: var(--text-dim, #94a3b8); border-top: 1px solid rgba(255,255,255,0.1); padding-top: 10px;">
          <span>Date: ${escapeHtml(eventData.dateStr)}</span>
          <span>Time: ${escapeHtml(eventData.formattedTime)}</span>
        </div>
      </div>
    </div>
  `;

  modal.classList.remove('hidden');
  modal.querySelector('#closeLostMedalBtn')?.addEventListener('click', () => modal.classList.add('hidden'));
  modal.onclick = (e) => { if (e.target === modal) modal.classList.add('hidden'); };
}