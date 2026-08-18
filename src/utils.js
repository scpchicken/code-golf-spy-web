/**
 * Global Constants, Shared State & Utility Helpers
 */

// Global Constants & State
const DEFAULT_GOLFERS_LIST = "zzh1996, Steffan153, ovs-code, codereport, pardouin, rucin93, emplv, edsrzf, blaztoma, scpchicken, sean-niemann, emgordon154, MeWhenI, Seek64, kg583, stefangimmillaro, lyphyser, saito-ta, lynn, CaedenHarper, KasperKivimaeki, SirBogman, nwellnhof, snoozingnewt, 5cw, canissimia, duckyluuk, vang1ong7ang, sisyphus-gpt, hallvabo, GolfingSuccess, CornerMercury, Natanaelel, GrayJoKing, bizy-coder, ryyyn, AlephSquirrel, AdrienHache, antimon2, DialFrost, jared-hughes, albanian-laundromat, plcc0, JayXon, namelessiw, JOrE20, Shanethegamer, bricknellj, bitsandbeyond, sisyphus-ppcg, KatieLG, anter69, primo-ppcg, rkg-huwdu, m-tkach, oaiqjuy, btnlq, ndren, annaproxy, acotis, aksyristos, inventshah, 2bular, Flekay, dokutan, IanUtley, Waffle3z, lukegustafson, LostSyntax21, vlpx, RainVniaR, Kacarott, Lydxn, StefanHabel, error256, CLOStrophobic, qpwoeirut, BREMAUCY, targrik, lifthrasiir, madex, commandz0, voytxt, 4atj, retrohun, FortuiteMan, UnderKoen, xsot, tomtheisen, HPWiz, prestosilver, helbling, ahmetdemirag, Yewzir, CatsAreFluffy, dmrichwa, iczelia, kumavale, prplz, elgan65536";

let lastCompareResults = null;
let lastLeaderboardResults = [];
let lastQueryResults = [];

// Compare Sort State
let currentCompareSortField = 'u1';
let currentCompareSortDir = 'desc';

// Leaderboard Sort State
let currentLbSortField = 'points';
let currentLbSortDir = 'desc';

// Query Sort State
let currentQuerySortField = 'bytes';
let currentQuerySortDir = 'desc';

// Unicode & Visual Alignment Helpers
function getVisualWidth(str) {
  return [...String(str || '')].length;
}

function padVisualEnd(str, targetWidth) {
  const s = String(str || '');
  const vWidth = getVisualWidth(s);
  const padLen = Math.max(0, targetWidth - vWidth);
  return s + ' '.repeat(padLen);
}

function padVisualStart(str, targetWidth) {
  const s = String(str || '');
  const vWidth = getVisualWidth(s);
  const padLen = Math.max(0, targetWidth - vWidth);
  return ' '.repeat(padLen) + s;
}

// Mathematical Helpers
function calculateHolePowerMean(holeScores, totalHoles, chi) {
  if (totalHoles === 0) return 0;

  if (chi === 1) {
    return holeScores.reduce((acc, score) => acc + score, 0);
  }

  if (chi >= 100) {
    return Math.max(...holeScores, 0) * totalHoles;
  }

  const sumPow = holeScores.reduce((acc, score) => acc + Math.pow(score, chi), 0);
  const mean = Math.pow(sumPow / totalHoles, 1 / chi);
  return mean * totalHoles;
}

function calculateLangPowerMean(langScores, totalLangs, lambda) {
  if (totalLangs === 0) return 0;
  if (lambda >= 1000) {
    return Math.max(...langScores, 0);
  }
  const maxScore = Math.max(...langScores, 0);
  if (maxScore === 0) return 0;

  if (lambda === 1) {
    return langScores.reduce((acc, score) => acc + score, 0) / totalLangs;
  }

  const sumScaledPow = langScores.reduce((acc, score) => {
    return acc + Math.pow(score / maxScore, lambda);
  }, 0);

  return maxScore * Math.pow(sumScaledPow / totalLangs, 1 / lambda);
}

// General UI Helper Functions
function showLoading() {
  document.getElementById('loadingOverlay')?.classList.remove('hidden');
}

function hideLoading() {
  document.getElementById('loadingOverlay')?.classList.add('hidden');
}

function escapeHtml(str) {
  if (typeof str !== 'string') return str || '';
  return str
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

// File Reading & Fetching Helpers
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

/**
 * Gets submission data from user file input or defaults to fetching REPO/src/solutions.json
 */
async function getSubmissionsData(fileInput) {
  const file = fileInput?.files?.[0];
  if (file) {
    return await readJsonFile(file);
  }

  // Attempt auto-fetching from default relative paths to src/solutions.json.
  // getOrFetchJson caches by resolved URL, so this only hits the network once
  // per page load no matter how many times getSubmissionsData is called.
  let data = await getOrFetchJson(null, 'solutions.json', 'solutions.json');
  if (!data) {
    data = await getOrFetchJson(null, '../test/solutions.json', 'solutions.json');
  }
  return data;
}

// In-memory cache of network fetches, keyed by the resolved absolute URL.
// Stores the in-flight/completed Promise (not just the resolved value) so
// that concurrent callers for the same resource share a single request
// instead of racing to fire off duplicates.
const _jsonFetchCache = new Map();

function _resolveFetchCacheKey(url) {
  try {
    return new URL(url, document.baseURI).href;
  } catch (err) {
    return url;
  }
}

async function getOrFetchJson(fileInput, fetchUrl, fileName) {
  if (fileInput && fileInput.files && fileInput.files[0]) {
    // An uploaded file always takes priority over any cached/fetched data.
    return await readJsonFile(fileInput.files[0]);
  }

  const cacheKey = _resolveFetchCacheKey(fetchUrl);
  if (_jsonFetchCache.has(cacheKey)) {
    return await _jsonFetchCache.get(cacheKey);
  }

  const fetchPromise = (async () => {
    try {
      const resp = await fetch(fetchUrl);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      return await resp.json();
    } catch (err) {
      console.warn(`Could not auto-fetch ${fileName} from ${fetchUrl}.`);
      return null;
    }
  })();

  _jsonFetchCache.set(cacheKey, fetchPromise);
  return await fetchPromise;
}

function downloadJsonFile(filename = 'solutions.json', data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function downloadMarkdownFile(filename, text) {
  const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function compareMedalCandidates(a, b) {
  const medalRank = { '🦄': 0, '💎': 1, '🥇': 2, '🥈': 3, '🥉': 4, '': 5 };
  const rankA = medalRank[a.medal] ?? 5;
  const rankB = medalRank[b.medal] ?? 5;

  if (rankA !== rankB) return rankA - rankB;

  const ptA = a.point || 0;
  const ptB = b.point || 0;
  if (ptA !== ptB) return ptB - ptA;

  return (a.loginByte || 0) - (b.loginByte || 0);
}

function formatLangDisplay(hole, lang) {
  if (!lang || lang === "N/A" || lang === "-") return "-";
  const langUrl = `https://code.golf/${encodeURIComponent(hole)}#${encodeURIComponent(lang)}`;
  return `<a href="${langUrl}" target="_blank" rel="noopener noreferrer" class="golf-link-clean">${escapeHtml(lang)}</a>`;
}

function formatScoreDisplay(hole, lang, point, mode, medal, golferName, allMedals = []) {
  if (!point || point <= 0 || !lang || lang === "N/A" || lang === "-") {
    const valStr = (point || 0).toLocaleString();
    return `
      <div class="score-cell-container">
        <div class="medal-badge-wrapper"></div>
        <div class="score-value-box"><strong>${valStr}</strong></div>
      </div>
    `;
  }

  const scoreUrl = `https://code.golf/rankings/holes/${encodeURIComponent(hole)}/${encodeURIComponent(lang)}/${mode}`;
  const scoreLink = `<a href="${scoreUrl}" target="_blank" rel="noopener noreferrer" class="golf-link-clean"><strong>${point.toLocaleString()}</strong></a>`;

  let extraHtml = '';
  if (allMedals && allMedals.length > 1) {
    const medalsJson = escapeHtml(JSON.stringify(allMedals));
    extraHtml = `<button type="button" class="extra-medals-btn" data-hole="${escapeHtml(hole)}" data-golfer="${escapeHtml(golferName)}" data-medals="${medalsJson}">(${allMedals.length})</button>`;
  }

  const medalSpan = medal ? `<span class="medal">${medal}</span>` : '';

  return `
    <div class="score-cell-container">
      <div class="medal-badge-wrapper">
        ${medalSpan}
        ${extraHtml}
      </div>
      <div class="score-value-box">
        ${scoreLink}
      </div>
    </div>
  `;
}