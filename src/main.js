/**
 * Application Entry Point, Navigation & Global Event Controllers
 */

// Navigation Switcher
const navCompareBtn = document.getElementById('navCompareBtn');
const navLeaderboardBtn = document.getElementById('navLeaderboardBtn');
const navQueryBtn = document.getElementById('navQueryBtn');
const comparePage = document.getElementById('comparePage');
const leaderboardPage = document.getElementById('leaderboardPage');
const queryPage = document.getElementById('queryPage');

navCompareBtn?.addEventListener('click', () => {
  navCompareBtn.classList.add('active');
  navLeaderboardBtn.classList.remove('active');
  navQueryBtn?.classList.remove('active');
  comparePage.classList.remove('hidden');
  leaderboardPage.classList.add('hidden');
  queryPage?.classList.add('hidden');
});

navLeaderboardBtn?.addEventListener('click', () => {
  navLeaderboardBtn.classList.add('active');
  navCompareBtn.classList.remove('active');
  navQueryBtn?.classList.remove('active');
  leaderboardPage.classList.remove('hidden');
  comparePage.classList.add('hidden');
  queryPage?.classList.add('hidden');
});

navQueryBtn?.addEventListener('click', () => {
  navQueryBtn.classList.add('active');
  navCompareBtn.classList.remove('active');
  navLeaderboardBtn.classList.remove('active');
  queryPage?.classList.remove('hidden');
  comparePage.classList.add('hidden');
  leaderboardPage.classList.add('hidden');
});

// Event Delegation for Table Clickables
document.getElementById('resultsBody')?.addEventListener('click', (e) => {
  const diffBtn = e.target.closest('.diff-clickable');
  if (diffBtn) {
    e.preventDefault();
    e.stopPropagation();
    const hole = diffBtn.getAttribute('data-hole');
    const u1Point = parseFloat(diffBtn.getAttribute('data-u1-point') || '0');
    const u2Point = parseFloat(diffBtn.getAttribute('data-u2-point') || '0');
    const u1Langs = JSON.parse(diffBtn.getAttribute('data-u1-langs') || '[]');
    const u2Langs = JSON.parse(diffBtn.getAttribute('data-u2-langs') || '[]');
    showDiffModal(hole, u1Point, u2Point, u1Langs, u2Langs);
    return;
  }

  const btn = e.target.closest('.extra-medals-btn');
  if (btn) {
    e.preventDefault();
    e.stopPropagation();
    const hole = btn.getAttribute('data-hole');
    const golfer = btn.getAttribute('data-golfer');
    const medals = JSON.parse(btn.getAttribute('data-medals') || '[]');
    showExtraMedalsModal(hole, golfer, medals);
  }
});

// Keyboard Shortcuts
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    if (queryPage && !queryPage.classList.contains('hidden')) {
      document.getElementById('queryGoBtn')?.click();
    } else if (leaderboardPage && !leaderboardPage.classList.contains('hidden')) {
      document.getElementById('lbGoBtn')?.click();
    } else if (comparePage && !comparePage.classList.contains('hidden')) {
      document.getElementById('goBtn')?.click();
    }
  }
});

// Top Download Quick-Links
document.getElementById('dlSolutionsBtn')?.addEventListener('click', handleSolutionsDownload);
document.getElementById('dlHolesBtn')?.addEventListener('click', () => window.open('https://code.golf/api/holes', '_blank'));
document.getElementById('dlLangsBtn')?.addEventListener('click', () => window.open('https://code.golf/api/langs', '_blank'));

// Slider Helper Setup
function setupSlider(sliderId, valueId, onUpdate) {
  const slider = document.getElementById(sliderId);
  const valueDisplay = document.getElementById(valueId);
  if (!slider || !valueDisplay) return;

  const getDisplayVal = (val) => {
    if (sliderId.toLowerCase().includes('lambda') && parseInt(val, 10) >= 1000) return '∞';
    return val;
  };

  // Trigger live score updates dynamically while dragging slider
  slider.addEventListener('input', (e) => {
    valueDisplay.textContent = getDisplayVal(e.target.value);
    if (onUpdate) onUpdate();
  });

  slider.addEventListener('change', (e) => {
    valueDisplay.textContent = getDisplayVal(e.target.value);
    if (onUpdate) onUpdate();
  });

  valueDisplay.parentElement.addEventListener('click', () => {
    let currentVal = slider.value;
    if (sliderId.toLowerCase().includes('lambda') && parseInt(currentVal, 10) >= 1000) currentVal = '∞';

    const input = prompt(`Enter a new value for ${sliderId.replace('Slider', '')} (${slider.min} - ${slider.max}):`, currentVal);
    if (input !== null && input !== "") {
      let rawVal = input.trim();
      if (sliderId.toLowerCase().includes('lambda') && (rawVal === '∞' || rawVal.toLowerCase() === 'inf' || rawVal.toLowerCase() === 'infinity')) {
        rawVal = slider.max;
      }
      const num = parseFloat(rawVal);
      if (!isNaN(num) && num >= parseFloat(slider.min) && num <= parseFloat(slider.max)) {
        slider.value = num;
        valueDisplay.textContent = getDisplayVal(num);
        if (onUpdate) onUpdate();
      } else {
        alert(`Invalid input. Please enter a number between ${slider.min} and ${slider.max}.`);
      }
    }
  });
}

// Live Score Recalculations for Compare Users Tab
const updateCompare = () => {
  if (typeof updateCompareScores === 'function') {
    updateCompareScores();
  }
  const data = typeof lastCompareResults !== 'undefined' ? lastCompareResults : (typeof lastCompareData !== 'undefined' ? lastCompareData : null);
  if (typeof renderCompareResults === 'function' && data) {
    renderCompareResults(data);
  }
};

// Live Score Recalculations for Custom Leaderboard Tab
const updateLeaderboard = () => {
  if (typeof updateLeaderboardScoresAndRanks === 'function') {
    updateLeaderboardScoresAndRanks();
  }
  const data = typeof lastLeaderboardResults !== 'undefined' ? lastLeaderboardResults : (typeof lastLeaderboardData !== 'undefined' ? lastLeaderboardData : null);
  if (typeof renderLeaderboard === 'function' && data) {
    renderLeaderboard(data);
  }
};

// Initialize Sliders & Startup Dialog
document.addEventListener('DOMContentLoaded', async () => {
  // Compare Sliders (Base Min Score is manual; Chi, Lambda, Diamond auto-update)
  setupSlider('formulaSlider', 'formulaValue');
  setupSlider('chiSlider', 'chiValue', updateCompare);
  setupSlider('lambdaSlider', 'lambdaValue', updateCompare);
  setupSlider('diamondSlider', 'diamondValue', updateCompare);

  // Leaderboard Sliders (Base Min Score is manual; Chi, Lambda, Diamond auto-update)
  setupSlider('lbFormulaSlider', 'lbFormulaValue');
  setupSlider('lbChiSlider', 'lbChiValue', updateLeaderboard);
  setupSlider('lbLambdaSlider', 'lbLambdaValue', updateLeaderboard);
  setupSlider('lbDiamondSlider', 'lbDiamondValue', updateLeaderboard);

  // Show Startup Modal conditionally (skip if src/solutions.json auto-loads)
  if (typeof initialModal !== 'undefined' && initialModal) {
    try {
      const autoData = await getOrFetchJson(null, './solutions.json', 'solutions.json') 
      if (autoData) {
        initialModal.classList.add('hidden');
      } else {
        initialModal.classList.remove('hidden');
      }
    } catch (err) {
      initialModal.classList.remove('hidden');
    }
  }
});