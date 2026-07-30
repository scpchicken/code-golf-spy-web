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
    if (sliderId.includes('lambda') && parseInt(val, 10) >= 1000) return '∞';
    return val;
  };

  slider.addEventListener('input', (e) => {
    valueDisplay.textContent = getDisplayVal(e.target.value);
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
      const num = parseFloat(input);
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

const updateCompare = () => {
  if (lastCompareResults && comparePage && !comparePage.classList.contains('hidden')) {
    updateCompareScores();
    renderCompareResults(lastCompareResults);
  }
};

const updateLeaderboard = () => {
  if (lastLeaderboardResults && lastLeaderboardResults.length > 0 && leaderboardPage && !leaderboardPage.classList.contains('hidden')) {
    updateLeaderboardScoresAndRanks();
    renderLeaderboard(lastLeaderboardResults);
  }
};

// Initialize Sliders & Startup Dialog
document.addEventListener('DOMContentLoaded', () => {
  const lbLambdaSlider = document.getElementById('lbLambdaSlider');
  const lbLambdaValue = document.getElementById('lbLambdaValue');

  if (lbLambdaSlider && lbLambdaValue) {
    lbLambdaSlider.addEventListener('input', (e) => {
      const val = Number(e.target.value);
      lbLambdaValue.textContent = val >= 1000 ? '∞' : val;
    });
  }

  // Compare Sliders
  setupSlider('formulaSlider', 'formulaValue', () => document.getElementById('goBtn')?.click());
  setupSlider('chiSlider', 'chiValue', updateCompare);
  setupSlider('lambdaSlider', 'lambdaValue', updateCompare);
  setupSlider('diamondSlider', 'diamondValue', updateCompare);

  // Leaderboard Sliders
  setupSlider('lbFormulaSlider', 'lbFormulaValue', () => document.getElementById('lbGoBtn')?.click());
  setupSlider('lbChiSlider', 'lbChiValue', updateLeaderboard);
  setupSlider('lbLambdaSlider', 'lbLambdaValue', updateLeaderboard);
  setupSlider('lbDiamondSlider', 'lbDiamondValue', updateLeaderboard);

  // Show Startup Modal
  if (initialModal) initialModal.classList.remove('hidden');
});