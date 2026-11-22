/**
 * HaqSetu (हक-सेतु) Client Application Logic
 * Dark Futuristic Edition • Automatic Role-Based Auth
 */

let recognition = null;
let isRecording = false;
let currentLanguage = 'mr-IN';
let lastAnalysisResult = null;
let currentUser = null;
let savedSchemes = [];

// Initialize Lucide icons on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  if (window.lucide) {
    lucide.createIcons();
  }
  setupSpeechRecognition();
  checkAuthStatus();
  updateVoiceLanguage(false);
  loadSchemesDrawer();
});

// -------------------------------------------------------------
// 1. EDGE VOICE RECOGNITION (WEB SPEECH API)
// -------------------------------------------------------------

let speechSessionBase = '';
let speechSessionAccumulated = '';

function setupSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    const statusElem = document.getElementById('speechStatus');
    if (statusElem) {
      statusElem.innerHTML = `<span class="text-amber-400 font-medium">Live mic available on Chrome/Edge. You can also type or use presets.</span>`;
    }
    return;
  }

  recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;
  recognition.lang = currentLanguage;

  recognition.onstart = () => {
    isRecording = true;
    speechSessionAccumulated = '';
    updateMicUI(true);
  };

  recognition.onresult = (event) => {
    let finalStr = '';
    let interimStr = '';

    // CRITICAL FIX: Loop from index 0 across ALL results in the session.
    // Using event.resultIndex previously caused earlier finished phrases to be forgotten!
    for (let i = 0; i < event.results.length; i++) {
      const item = event.results[i];
      if (item.isFinal) {
        finalStr += item[0].transcript + ' ';
      } else {
        interimStr += item[0].transcript;
      }
    }

    speechSessionAccumulated = finalStr;
    const currentSpoken = (finalStr + interimStr).trim();
    const inputElem = document.getElementById('citizenInput');
    if (inputElem) {
      if (speechSessionBase) {
        inputElem.value = (speechSessionBase + ' ' + currentSpoken).trim();
      } else {
        inputElem.value = currentSpoken;
      }
    }
  };

  recognition.onerror = (event) => {
    console.warn("Speech recognition notice/error:", event.error);
    if (event.error === 'no-speech') {
      // User paused speaking; do not abruptly kill recording
      return;
    }
    isRecording = false;
    updateMicUI(false);
  };

  recognition.onend = () => {
    isRecording = false;
    updateMicUI(false);
  };
}

const PREDEFINED_LANGUAGE_SAMPLES = {
  'mr-IN': {
    placeholder: "माझं १.५ एकर कोरडवाहू शेत आहे, सोयाबीन पिकवतो, अवकाळी पावसाने नुकसान झालं. वार्षिक उत्पन्न १ लाख रुपये आहे आणि मुलगी १२वी शिकतेय... किंवा बोला (Tap mic to speak)",
    sampleText: "माझं १.५ एकर कोरडवाहू शेत आहे, सोयाबीन पिकवतो, अवकाळी पावसाने नुकसान झालं. वार्षिक उत्पन्न १ लाख रुपये आहे आणि मुलगी १२वी शिकतेय.",
    statusHint: "माहिती टाइप करा किंवा 'पात्रता तपासा' वर क्लिक करा."
  },
  'hi-IN': {
    placeholder: "मेरी 1.5 एकड़ असिंचित जमीन है, सोयाबीन की फसल उगाता हूँ, बेमौसम बारिश से नुकसान हुआ। परिवार की वार्षिक आय 1 लाख रुपये है और बेटी 12वीं कक्षा में पढ़ रही है... या बोलें (Tap mic to speak)",
    sampleText: "मेरी 1.5 एकड़ असिंचित जमीन है, सोयाबीन की फसल उगाता हूँ, बेमौसम बारिश से नुकसान हुआ। परिवार की वार्षिक आय 1 लाख रुपये है और बेटी 12वीं कक्षा में पढ़ रही है।",
    statusHint: "विवरण टाइप करें या 'पात्रता जांचें' पर क्लिक करें।"
  },
  'en-IN': {
    placeholder: "I have 1.5 acres of dryland farm, grow soybean crop, suffered unseasonal rain loss. Annual family income is 1 lakh rupees and daughter is studying in 12th standard... or speak (Tap mic to speak)",
    sampleText: "I have 1.5 acres of dryland farm, grow soybean crop, suffered unseasonal rain loss. Annual family income is 1 lakh rupees and daughter is studying in 12th standard.",
    statusHint: "Type your situation or click 'Check Eligibility'."
  }
};

function updateVoiceLanguage(syncDrawer = true) {
  const select = document.getElementById('voiceLanguage');
  if (!select) return;
  currentLanguage = select.value;
  if (recognition) {
    recognition.lang = currentLanguage;
  }

  // Update background placeholder text (keep value empty so it renders purely in the background)
  const sample = PREDEFINED_LANGUAGE_SAMPLES[currentLanguage];
  const inputElem = document.getElementById('citizenInput');
  if (inputElem && sample) {
    inputElem.placeholder = sample.placeholder;

    // Clear value so the text displays purely as a placeholder in the background
    const currentVal = inputElem.value.trim();
    const isSampleVal = Object.values(PREDEFINED_LANGUAGE_SAMPLES).some(s => s.sampleText.trim() === currentVal);
    if (!currentVal || isSampleVal) {
      inputElem.value = '';
    }
    
    // Smooth visual feedback highlight
    inputElem.classList.add('ring-2', 'ring-emerald-400');
    setTimeout(() => inputElem.classList.remove('ring-2', 'ring-emerald-400'), 500);
  }

  const speechStatus = document.getElementById('speechStatus');
  if (speechStatus && sample && !isRecording) {
    speechStatus.innerHTML = `<i data-lucide="info" class="w-3.5 h-3.5 text-emerald-400"></i><span>${sample.statusHint}</span>`;
    if (window.lucide) lucide.createIcons();
  }

  // Sync right-side drawer language if requested
  if (syncDrawer && typeof setDrawerLanguage === 'function') {
    setDrawerLanguage(currentLanguage, false);
  }
}

function toggleSpeechRecognition() {
  if (!recognition) {
    setupSpeechRecognition();
    if (!recognition) {
      alert("Please use Google Chrome or Microsoft Edge for live voice recognition.");
      return;
    }
  }

  if (isRecording) {
    recognition.stop();
  } else {
    try {
      const inputElem = document.getElementById('citizenInput');
      const currentVal = (inputElem?.value || '').trim();

      // Check if current input is just one of the default template samples
      const isDefaultSample = Object.values(PREDEFINED_LANGUAGE_SAMPLES).some(
        s => s.sampleText.trim() === currentVal
      );

      if (isDefaultSample) {
        // Clear sample so the citizen's voice input starts clean
        speechSessionBase = '';
        if (inputElem) inputElem.value = '';
      } else if (currentVal) {
        // User already entered custom text, keep it as base and append
        speechSessionBase = currentVal;
      } else {
        speechSessionBase = '';
      }

      recognition.lang = currentLanguage;
      recognition.start();
    } catch (e) {
      console.warn("Speech start issue:", e);
      try {
        recognition.stop();
        setTimeout(() => {
          recognition.lang = currentLanguage;
          recognition.start();
        }, 200);
      } catch (err) {
        console.error("Speech start retry failed:", err);
      }
    }
  }
}

function updateMicUI(recording) {
  const micButton = document.getElementById('micButton');
  const micRing = document.getElementById('micRing');
  const speechStatus = document.getElementById('speechStatus');
  const soundWaveBox = document.getElementById('soundWaveBox');
  const engineStatusPill = document.getElementById('engineStatusPill');

  if (recording) {
    if (micRing) micRing.classList.remove('hidden');
    if (micButton) micButton.classList.add('mic-glow-active');
    if (soundWaveBox) {
      soundWaveBox.classList.remove('hidden');
      soundWaveBox.classList.add('flex');
    }
    if (engineStatusPill) engineStatusPill.classList.add('hidden');
    if (speechStatus) speechStatus.innerHTML = `<span class="text-emerald-400 font-bold flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span> Live Audio Active (${currentLanguage})... Speak now</span>`;
  } else {
    if (micRing) micRing.classList.add('hidden');
    if (micButton) micButton.classList.remove('mic-glow-active');
    if (soundWaveBox) {
      soundWaveBox.classList.add('hidden');
      soundWaveBox.classList.remove('flex');
    }
    if (engineStatusPill) engineStatusPill.classList.remove('hidden');
    if (speechStatus) speechStatus.innerHTML = `<span class="text-slate-400">Voice captured. Tap "Check Eligibility" or adjust text.</span>`;
  }
}

// -------------------------------------------------------------
// 2. LIVE STAGE DEMO PRESETS
// -------------------------------------------------------------

const PRESETS = {
  1: {
    lang: "mr-IN",
    text: "माझं १.५ एकर कोरडवाहू शेत आहे, सोयाबीन पिकवतो, अवकाळी पावसाने नुकसान झालं. वार्षिक उत्पन्न १ लाख रुपये आहे आणि मुलगी १२वी शिकतेय."
  },
  2: {
    lang: "hi-IN",
    text: "हम विदर्भ से हैं, हमारे पास 3 एकड़ जमीन है, बारिश न होने से कपास की फसल खराब हो गई, परिवार की आय 80 हजार है, क्या कोई राहत मिलेगी?"
  },
  3: {
    lang: "mr-IN",
    text: "मी ६८ वर्षांची निराधार विधवा महिला आहे, घरात कोणी कमावणारा नाही, उत्पन्न ५० हजारांपेक्षा कमी आहे, पेन्शनसाठी काय कागदपत्रे लागतील?"
  },
  4: {
    lang: "en-IN",
    text: "I am a small farmer in Maharashtra with 4 acres of land. I want to buy a tractor rotavator for cultivation. Annual income is 1.8 lakhs."
  }
};

function applyPreset(id) {
  const p = PRESETS[id];
  if (!p) return;
  document.getElementById('voiceLanguage').value = p.lang;
  updateVoiceLanguage();
  document.getElementById('citizenInput').value = p.text;
  
  const btn = document.getElementById('analyzeBtn');
  btn.classList.add('ring-4', 'ring-emerald-400');
  setTimeout(() => btn.classList.remove('ring-4', 'ring-emerald-400'), 800);
}

// -------------------------------------------------------------
// 3. ELIGIBILITY ANALYSIS & DYNAMIC FUTURISTIC PIPELINE
// -------------------------------------------------------------

function setPipelineStage(stageNum, status, progressPercent, descText, badgeClass = 'text-emerald-400 bg-emerald-500/10') {
  const node = document.getElementById(`pipeStep${stageNum}`);
  const badge = document.getElementById(`pipeBadge${stageNum}`);
  const progress = document.getElementById(`pipeProgress${stageNum}`);
  const desc = document.getElementById(`pipeDesc${stageNum}`);
  
  if (badge) {
    badge.textContent = status;
    badge.className = `text-[10px] font-mono px-2 py-0.5 rounded ${badgeClass}`;
  }
  if (progress) progress.style.width = `${progressPercent}%`;
  if (desc && descText) desc.textContent = descText;
  
  if (node) {
    if (progressPercent >= 100) {
      node.classList.remove('pipe-active');
      node.classList.add('pipe-completed');
    } else {
      node.classList.add('pipe-active');
      node.classList.remove('pipe-completed');
    }
  }
}

function toggleDemographics() {
  const panel = document.getElementById('demographicsPanel');
  const text = document.getElementById('demoToggleText');
  const icon = document.getElementById('demoToggleIcon');
  if (panel) {
    if (panel.classList.contains('hidden')) {
      panel.classList.remove('hidden');
      if (text) text.textContent = 'Hide Refiners';
      if (icon) icon.style.transform = 'rotate(180deg)';
    } else {
      panel.classList.add('hidden');
      if (text) text.textContent = 'Refine Details';
      if (icon) icon.style.transform = 'rotate(0deg)';
    }
  }
}

function resetPipelineUI() {
  for (let i = 1; i <= 4; i++) {
    const node = document.getElementById(`pipeStep${i}`);
    const badge = document.getElementById(`pipeBadge${i}`);
    const progress = document.getElementById(`pipeProgress${i}`);
    if (node) {
      node.classList.remove('pipe-active', 'pipe-completed');
    }
    if (badge) {
      badge.textContent = 'Waiting';
      badge.className = 'text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400';
    }
    if (progress) progress.style.width = '0%';
  }
  const statusElem = document.getElementById('pipelineLiveStatus');
  if (statusElem) statusElem.textContent = 'Ingesting plain language query through multi-tier discovery pipeline...';
}

async function runEligibilityAnalysis() {
  let text = document.getElementById('citizenInput').value.trim();
  if (!text) {
    // If input box is empty, use the current background placeholder sample
    const sample = PREDEFINED_LANGUAGE_SAMPLES[currentLanguage];
    if (sample && sample.sampleText) {
      text = sample.sampleText;
    } else {
      alert("कृपया माहिती टाइप करा किंवा बोला (Please describe your situation first).");
      return;
    }
  }

  // Reset and Show Futuristic Pipeline
  resetPipelineUI();
  document.getElementById('loadingState').classList.remove('hidden');
  document.getElementById('resultsSection').classList.add('hidden');
  document.getElementById('adaptiveBanner').classList.add('hidden');
  if (window.lucide) lucide.createIcons();

  // Start latency counter
  const startTime = Date.now();
  const timerElem = document.getElementById('pipelineTimer');
  const timerInterval = setInterval(() => {
    if (timerElem) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      timerElem.textContent = `Latency: ${elapsed}s`;
    }
  }, 100);

  // Stage 1: Active
  setPipelineStage(1, 'Scanning...', 60, 'Scanning 12-digit patterns');
  const statusElem = document.getElementById('pipelineLiveStatus');
  if (statusElem) statusElem.textContent = 'Stage 1: Scanning vernacular input for Zero-PII compliance...';

  // Animate stages smoothly while waiting
  const p1 = setTimeout(() => {
    setPipelineStage(1, '✓ Clean', 100, 'Zero-PII Verified');
    setPipelineStage(2, 'Extracting...', 50, 'Extracting vernacular slots');
    if (statusElem) statusElem.textContent = 'Stage 2: Parsing context via LLM (OpenAI gpt-4o-mini / Ambient)...';
  }, 250);

  const p2 = setTimeout(() => {
    setPipelineStage(2, '✓ Extracted', 100, 'Profile slots mapped');
    setPipelineStage(3, 'Auditing...', 50, 'Evaluating schemes.json rules');
    if (statusElem) statusElem.textContent = 'Stage 3: Scrutinizing eligibility against schemes.json & SQLite DB...';
  }, 550);

  const p3 = setTimeout(() => {
    setPipelineStage(3, '✓ Audited', 100, 'All criteria verified');
    setPipelineStage(4, 'Optimizing...', 60, 'Sorting descending benefit');
    if (statusElem) statusElem.textContent = 'Stage 4: Sorting monetary benefits in descending order & building Action Dossier...';
  }, 850);

  const demographics = {
    financial_year: document.getElementById('selFinancialYear')?.value || '',
    religion: document.getElementById('selReligion')?.value || '',
    caste_category: document.getElementById('selCasteCategory')?.value || '',
    annual_income: document.getElementById('selAnnualIncome')?.value || '',
    department: document.getElementById('selDepartment')?.value || '',
    disability_type: document.getElementById('selDisability')?.value || '',
    gender: window.currentSelectedGender || ''
  };

  try {
    const response = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: text, demographics: demographics })
    });

    const data = await response.json();
    clearInterval(timerInterval);
    clearTimeout(p1);
    clearTimeout(p2);
    clearTimeout(p3);

    if (!response.ok) {
      document.getElementById('loadingState').classList.add('hidden');
      alert(data.error || "Analysis failed.");
      return;
    }

    // Finalize all stages
    setPipelineStage(1, '✓ Clean', 100, 'Zero-PII Verified');
    setPipelineStage(2, '✓ Extracted', 100, data.pipeline_metadata?.engine_used || 'LLM Slots Resolved');
    setPipelineStage(3, '✓ Audited', 100, `${data.pipeline_metadata?.rules_evaluated || 8} Schemes Scrutinized`);
    setPipelineStage(4, '✓ Unlocked', 100, `${data.total_matched || 0} Schemes Unlocked`);
    if (statusElem) statusElem.textContent = `Pipeline Completed: ${data.total_matched || 0} schemes discovered (${data.total_potential_benefit_formatted || '₹0'} unlocked benefit).`;

    // Brief pause so user can perceive the completed pipeline, then smoothly show results
    setTimeout(async () => {
      document.getElementById('loadingState').classList.add('hidden');
      lastAnalysisResult = data;
      renderResults(data);

      if (data.persisted_to_database) {
        await checkAuthStatus();
      }
    }, 380);

  } catch (err) {
    clearInterval(timerInterval);
    clearTimeout(p1);
    clearTimeout(p2);
    clearTimeout(p3);
    document.getElementById('loadingState').classList.add('hidden');
    console.error(err);
    alert("Connection error. Ensure the server is running.");
  }
}

// -------------------------------------------------------------
// 4. EXPLAINABLE RESULTS RENDERING (FUTURISTIC DARK THEME)
// -------------------------------------------------------------

function renderResults(data) {
  const resultsSec = document.getElementById('resultsSection');
  resultsSec.classList.remove('hidden');

  // Counters & Chips
  document.getElementById('totalMatchedCount').textContent = data.total_matched || 0;
  const benefitElem = document.getElementById('totalBenefitValue');
  if (benefitElem) {
    benefitElem.textContent = data.total_potential_benefit_formatted || '₹0';
  }

  const p = data.profile || {};
  document.getElementById('chipState').textContent = `State: ${p.state || 'Maharashtra'}`;
  document.getElementById('chipLand').textContent = `Land: ${p.land_holding_acres ? p.land_holding_acres + ' Acres' : 'Non-agri'}`;
  document.getElementById('chipIncome').textContent = `Income: ${p.annual_income ? '₹' + p.annual_income.toLocaleString('en-IN') : 'Low / Marginal'}`;
  document.getElementById('chipStatus').textContent = p.is_farmer ? 'Farmer: Small / Marginal' : 'Social Welfare';

  // Update Futuristic Pipeline Audit Card
  const meta = data.pipeline_metadata || {};
  const enginePill = document.getElementById('pipelineEnginePill');
  if (enginePill) {
    enginePill.textContent = meta.engine_used || 'OpenAI gpt-4o-mini';
  }
  const latencyPill = document.getElementById('pipelineLatencyPill');
  if (latencyPill) {
    latencyPill.textContent = `Latency: ${meta.execution_time_ms || 120}ms`;
  }
  const traceSlot = document.getElementById('pipelineTraceSlot');
  if (traceSlot) {
    traceSlot.textContent = `Land: ${p.land_holding_acres ? p.land_holding_acres + ' Acres' : 'Non-agri'} • ${p.annual_income ? '₹' + p.annual_income.toLocaleString('en-IN') : 'Marginal'}`;
  }
  const traceRules = document.getElementById('pipelineTraceRules');
  if (traceRules) {
    traceRules.textContent = `${meta.rules_evaluated || 8} Schemes Scrutinized`;
  }
  const traceOutput = document.getElementById('pipelineTraceOutput');
  if (traceOutput) {
    traceOutput.textContent = `${data.total_matched || 0} Eligible (${data.total_potential_benefit_formatted || '₹0'})`;
  }

  // Vernacular AI Summary (if returned by LLM)
  const summaryBox = document.getElementById('pipelineVernacularSummary');
  const summaryText = document.getElementById('pipelineVernacularSummaryText');
  const summaryVal = meta.vernacular_summary || p.vernacular_summary;
  if (summaryVal && summaryVal.trim()) {
    if (summaryText) summaryText.textContent = summaryVal.trim();
    if (summaryBox) summaryBox.classList.remove('hidden');
  } else {
    if (summaryBox) summaryBox.classList.add('hidden');
  }

  // Adaptive Follow-up Banner
  const adaptiveBanner = document.getElementById('adaptiveBanner');
  const adaptiveText = document.getElementById('adaptiveText');
  if (data.adaptive_follow_up) {
    adaptiveText.textContent = data.adaptive_follow_up;
    adaptiveBanner.classList.remove('hidden');
  } else {
    adaptiveBanner.classList.add('hidden');
  }

  // Scheme Cards
  const schemesList = document.getElementById('schemesList');
  schemesList.innerHTML = '';

  if (!data.matched_schemes || data.matched_schemes.length === 0) {
    schemesList.innerHTML = `
      <div class="p-8 text-center bg-slate-900/60 rounded-2xl border border-slate-800">
        <p class="text-slate-400 font-medium">No direct scheme matched your description. Try specifying land size, family members, or income.</p>
      </div>
    `;
  } else {
    data.matched_schemes.forEach((item, index) => {
      const s = item.scheme;
      const card = document.createElement('div');
      card.className = "glass-card rounded-2xl border border-white/10 shadow-2xl space-y-4 p-5 sm:p-6 transition-all hover:border-emerald-500/40";
      
      const passRulesHtml = item.passed_rules.map(r => `
        <div class="flex items-start space-x-2 text-xs text-slate-300">
          <i data-lucide="check-circle-2" class="w-4 h-4 text-emerald-400 shrink-0 mt-0.5"></i>
          <div>
            <span class="font-bold text-white">${r.rule}:</span>
            <span class="text-slate-400">${r.reason}</span>
          </div>
        </div>
      `).join('');

      const topBenefitBadge = (index === 0 && (s.monetary_value_inr || 0) > 0) ? `
        <span class="inline-flex items-center gap-1 text-[11px] font-black bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 px-3 py-1 rounded-full shadow-lg shadow-amber-500/25 animate-pulse">
          👑 HIGHEST VALUE BENEFIT
        </span>
      ` : '';

      card.innerHTML = `
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/[0.08] pb-3">
          <div>
            <div class="flex items-center gap-2">
              <span class="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">${s.category}</span>
              <span class="text-xs text-slate-400">${s.department}</span>
              ${topBenefitBadge}
            </div>
            <h3 class="text-lg font-extrabold text-white mt-1">${s.scheme_name}</h3>
          </div>
          <div class="text-right">
            <span class="inline-flex items-center gap-1 text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-3 py-1 rounded-full">
              <i data-lucide="award" class="w-3.5 h-3.5"></i>
              <span>${item.status}</span>
            </span>
            <div class="text-[11px] text-slate-400 mt-1">Match Confidence: ${item.confidence_score}%</div>
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-950/80 p-3.5 rounded-xl border border-white/10 text-xs">
          <div>
            <span class="text-slate-400 font-medium">Entitlement Benefit:</span>
            <div class="font-extrabold text-emerald-400 text-sm mt-0.5">${s.benefit_amount}</div>
          </div>
          <div class="flex flex-col justify-between">
            <div class="flex justify-between items-center">
              <span class="text-slate-400 font-medium">Monetary Value:</span>
              <span class="text-emerald-400 font-black text-sm">₹${(s.monetary_value_inr || 0).toLocaleString('en-IN')}</span>
            </div>
            <div class="flex justify-between items-center mt-1">
              <span class="text-slate-400 font-medium">Govt Application Fee:</span>
              <span class="font-bold text-white">${s.official_fee_inr === 0 ? '<span class="text-emerald-400">₹0 (Free)</span>' : '₹' + s.official_fee_inr}</span>
            </div>
          </div>
        </div>

        <div class="space-y-2 bg-slate-950/90 p-4 rounded-xl border border-slate-800">
          <div class="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
            <i data-lucide="sparkles" class="w-3.5 h-3.5 text-emerald-400"></i>
            <span>Why You Qualify (Exact Rules Matched):</span>
          </div>
          <div class="space-y-1.5">
            ${passRulesHtml}
          </div>
        </div>

        <div class="flex flex-wrap items-center justify-between gap-3 text-xs pt-1">
          <div class="flex items-center space-x-3 text-slate-400">
            <span class="flex items-center gap-1">
              <i data-lucide="calendar" class="w-3.5 h-3.5 text-slate-500"></i>
              <span>Deadline: <strong class="text-slate-300">${s.application_deadline}</strong></span>
            </span>
            <span class="flex items-center gap-1">
              <i data-lucide="badge-check" class="w-3.5 h-3.5 text-emerald-400"></i>
              <span>Verified: ${s.last_verified_date}</span>
            </span>
          </div>
          
          <a href="${s.portal_apply_url}" target="_blank" rel="noopener noreferrer" class="btn-neon-primary px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-md">
            <span>Apply on Official Portal</span>
            <i data-lucide="external-link" class="w-3.5 h-3.5 stroke-[2.5]"></i>
          </a>
        </div>
      `;
      schemesList.appendChild(card);
    });
  }

  // Document Readiness Ladder
  renderDocumentLadder(data.document_ladder);

  // Sync the visual highlight of active refiner chips
  syncActiveRefinerChips();

  if (window.lucide) {
    lucide.createIcons();
  }
  
  if (data.adaptive_follow_up && adaptiveBanner) {
    adaptiveBanner.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } else {
    resultsSec.scrollIntoView({ behavior: 'smooth' });
  }
}

// Global Quick Refiner styling constants
const activeChipClass = "bg-emerald-500 text-slate-950 font-bold border-emerald-400 shadow-md shadow-emerald-500/30 ring-1 ring-emerald-300";
const defaultChipClass = "bg-slate-900/90 border-amber-500/30 text-amber-200 hover:bg-amber-500/20 font-medium";

// Interactive chip toggle without immediate premature page reload
window.toggleRefinerChip = function(btn, field, value) {
  // Sync to form dropdowns & globals
  if (field === 'caste_category') {
    const sel = document.getElementById('selCasteCategory');
    if (sel) sel.value = value;
  } else if (field === 'religion') {
    const sel = document.getElementById('selReligion');
    if (sel) sel.value = value;
  } else if (field === 'disability') {
    const sel = document.getElementById('selDisability');
    if (sel) sel.value = value;
  } else if (field === 'gender') {
    window.currentSelectedGender = value;
  }

  // Update visual state across sibling chips for the same field
  const parent = btn.parentElement;
  if (parent) {
    parent.querySelectorAll('.refiner-chip').forEach(b => {
      if (b.getAttribute('onclick')?.includes(`'${field}'`)) {
        b.className = `refiner-chip px-2.5 py-1 rounded-lg transition ${defaultChipClass}`;
      }
    });
  }
  btn.className = `refiner-chip px-2.5 py-1 rounded-lg transition ${activeChipClass}`;

  const applyBtnText = document.getElementById('applyRefinementBtnText');
  if (applyBtnText) {
    applyBtnText.textContent = 'Update Schemes with Selected Options';
  }
};

// Apply all selected tags together
window.applyRefinementsNow = function() {
  runEligibilityAnalysis();
};

// Keeps the active chip visually highlighted after re-analysis
window.syncActiveRefinerChips = function() {
  const caste = document.getElementById('selCasteCategory')?.value || '';
  const religion = document.getElementById('selReligion')?.value || '';
  const disability = document.getElementById('selDisability')?.value || '';
  const gender = window.currentSelectedGender || '';

  document.querySelectorAll('.refiner-chip').forEach(btn => {
    const val = btn.getAttribute('data-val');
    const oc = btn.getAttribute('onclick') || '';
    let isActive = false;
    if (oc.includes("'caste_category'") && val === caste) isActive = true;
    if (oc.includes("'religion'") && val === religion) isActive = true;
    if (oc.includes("'disability'") && val === disability) isActive = true;
    if (oc.includes("'gender'") && val === gender) isActive = true;

    if (isActive) {
      btn.className = `refiner-chip px-2.5 py-1 rounded-lg transition ${activeChipClass}`;
    } else if (oc.includes("'caste_category'") || oc.includes("'religion'") || oc.includes("'disability'") || oc.includes("'gender'")) {
      btn.className = `refiner-chip px-2.5 py-1 rounded-lg transition ${defaultChipClass}`;
    }
  });
};

window.quickSelectRefiner = function(field, value) {
  const btn = document.querySelector(`.refiner-chip[data-val="${value}"]`);
  if (btn) {
    window.toggleRefinerChip(btn, field, value);
  }
};

function renderDocumentLadder(ladder) {
  const l1List = document.getElementById('level1DocsList');
  const l2List = document.getElementById('level2DocsList');
  l1List.innerHTML = '';
  l2List.innerHTML = '';

  if (!ladder) return;

  (ladder.level1_foundation || []).forEach(doc => {
    const item = document.createElement('div');
    item.className = "p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs space-y-1";
    item.innerHTML = `
      <div class="flex justify-between font-bold text-white">
        <span>${doc.name}</span>
        <span class="text-emerald-400">₹${doc.official_cost_inr}</span>
      </div>
      <p class="text-slate-400 text-[11px]">${doc.how_to_get}</p>
    `;
    l1List.appendChild(item);
  });

  (ladder.level2_derived || []).forEach(doc => {
    const item = document.createElement('div');
    item.className = "p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs space-y-1";
    item.innerHTML = `
      <div class="flex justify-between font-bold text-white">
        <span>${doc.name}</span>
        <span class="text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded font-extrabold border border-emerald-500/30">₹${doc.official_cost_inr}</span>
      </div>
      <p class="text-slate-400 text-[11px]">${doc.how_to_get}</p>
      <div class="text-[10px] text-slate-500">Prerequisites: ${doc.prerequisites.join(', ') || 'Standard ID'}</div>
    `;
    l2List.appendChild(item);
  });
}

// -------------------------------------------------------------
// 5. 1-PAGE ACTION DOSSIER
// -------------------------------------------------------------

function openDossierModal() {
  if (!lastAnalysisResult || !lastAnalysisResult.matched_schemes) {
    alert("Please check eligibility first to generate your action dossier.");
    return;
  }

  const dSchemes = document.getElementById('dossierSchemesList');
  const dDocs = document.getElementById('dossierDocsList');
  dSchemes.innerHTML = '';
  dDocs.innerHTML = '';

  lastAnalysisResult.matched_schemes.forEach((item, idx) => {
    const s = item.scheme;
    const row = document.createElement('div');
    row.className = "p-2 rounded bg-slate-50 border border-slate-200";
    row.innerHTML = `
      <div class="font-bold text-slate-900">${idx + 1}. ${s.scheme_name}</div>
      <div class="flex justify-between text-slate-600 text-[11px] mt-0.5">
        <span>Benefit: <strong>${s.benefit_amount}</strong></span>
        <span>Official Fee: <strong>₹${s.official_fee_inr}</strong></span>
      </div>
    `;
    dSchemes.appendChild(row);
  });

  const allDocs = [
    ...(lastAnalysisResult.document_ladder.level1_foundation || []),
    ...(lastAnalysisResult.document_ladder.level2_derived || [])
  ];

  allDocs.forEach(d => {
    const item = document.createElement('div');
    item.className = "p-2 rounded bg-slate-50 border border-slate-200";
    item.innerHTML = `
      <div class="font-bold text-slate-800">${d.name}</div>
      <div class="text-[10px] text-slate-500">Official Rate: ₹${d.official_cost_inr}</div>
    `;
    dDocs.appendChild(item);
  });

  document.getElementById('dossierModal').classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
}

function closeDossierModal() {
  document.getElementById('dossierModal').classList.add('hidden');
}

function shareOnWhatsApp() {
  if (!lastAnalysisResult) return;
  const count = lastAnalysisResult.matched_schemes.length;
  const text = `*HaqSetu Welfare Report*\nI am likely eligible for *${count} Government Schemes*!\nOfficial Application Fee: *₹0 (Free)*.\nVerified via official Maharashtra state portals.`;
  const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank');
}

// -------------------------------------------------------------
// 6. CITIZEN & ADMIN AUTHENTICATION (AUTO ROLE RECOGNITION)
// -------------------------------------------------------------

async function checkAuthStatus() {
  try {
    const res = await fetch('/api/auth/me');
    const data = await res.json();
    if (data.logged_in && data.user) {
      currentUser = data.user;
      savedSchemes = data.saved_schemes || [];
      updateAuthUI(true);
    } else {
      currentUser = null;
      savedSchemes = [];
      updateAuthUI(false);
    }
  } catch (err) {
    console.error("Auth status check failed:", err);
  }
}

function updateAuthUI(isLoggedIn) {
  const container = document.getElementById('authNavContainer');
  if (!container) return;

  if (isLoggedIn && currentUser) {
    if (currentUser.role === 'admin') {
      container.innerHTML = `
        <div class="flex items-center space-x-2">
          <button onclick="openAdminModal()" class="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition shadow-md shadow-indigo-600/30">
            <i data-lucide="shield" class="w-3.5 h-3.5"></i>
            <span>Admin Console</span>
          </button>
          <button onclick="handleLogout()" class="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition" title="Sign Out">
            <i data-lucide="log-out" class="w-3.5 h-3.5"></i>
          </button>
        </div>
      `;
    } else {
      container.innerHTML = `
        <div class="flex items-center space-x-2">
          <button onclick="openTrackerModal()" class="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold hover:bg-emerald-500/20 transition">
            <i data-lucide="clipboard-check" class="w-3.5 h-3.5"></i>
            <span>${currentUser.name.split(' ')[0]}</span>
            <span class="bg-emerald-500 text-slate-950 text-[10px] px-1.5 py-0.2 rounded-full font-black ml-1">${savedSchemes.length}</span>
          </button>
          <button onclick="handleLogout()" class="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition" title="Sign Out">
            <i data-lucide="log-out" class="w-3.5 h-3.5"></i>
          </button>
        </div>
      `;
    }
  } else {
    container.innerHTML = `
      <button onclick="openAuthModal('login')" class="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition shadow-md shadow-emerald-500/20 active:scale-95">
        <i data-lucide="user" class="w-3.5 h-3.5"></i>
        <span>Sign In</span>
      </button>
    `;
  }
  if (window.lucide) lucide.createIcons();
}

function openAuthModal(tab = 'login') {
  const modal = document.getElementById('authModal');
  modal.classList.remove('hidden');
  document.getElementById('authErrorBanner').classList.add('hidden');
  switchAuthTab(tab);
  if (window.lucide) lucide.createIcons();
}

function closeAuthModal() {
  document.getElementById('authModal').classList.add('hidden');
}

function switchAuthTab(tab) {
  const tabSignIn = document.getElementById('tabSignInBtn');
  const tabRegister = document.getElementById('tabRegisterBtn');
  const signInForm = document.getElementById('signInForm');
  const registerForm = document.getElementById('registerForm');
  document.getElementById('authErrorBanner').classList.add('hidden');

  if (tab === 'login') {
    tabSignIn.className = "flex-1 py-3 text-xs font-bold text-emerald-400 border-b-2 border-emerald-400 bg-slate-900/50";
    tabRegister.className = "flex-1 py-3 text-xs font-bold text-slate-400 hover:text-slate-200";
    signInForm.classList.remove('hidden');
    registerForm.classList.add('hidden');
  } else {
    tabRegister.className = "flex-1 py-3 text-xs font-bold text-emerald-400 border-b-2 border-emerald-400 bg-slate-900/50";
    tabSignIn.className = "flex-1 py-3 text-xs font-bold text-slate-400 hover:text-slate-200";
    registerForm.classList.remove('hidden');
    signInForm.classList.add('hidden');
  }
}

async function handleSignIn(e) {
  e.preventDefault();
  const phone = document.getElementById('loginPhone').value.trim();
  const password = document.getElementById('loginPassword').value.trim();
  const errorBanner = document.getElementById('authErrorBanner');

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, password })
    });
    const data = await res.json();
    if (!res.ok) {
      errorBanner.textContent = data.error || "Sign in failed.";
      errorBanner.classList.remove('hidden');
      return;
    }

    currentUser = data.user;
    closeAuthModal();
    await checkAuthStatus();

    // Automatic role routing!
    if (currentUser.role === 'admin') {
      alert(`🛡️ Admin Mode Activated: Welcome ${currentUser.name}!`);
      openAdminModal();
    } else {
      alert(`Welcome back, ${currentUser.name}!`);
    }

  } catch (err) {
    errorBanner.textContent = "Server error. Please ensure server is running.";
    errorBanner.classList.remove('hidden');
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const name = document.getElementById('regName').value.trim();
  const phone = document.getElementById('regPhone').value.trim();
  const district = document.getElementById('regDistrict').value;
  const taluka = document.getElementById('regTaluka').value.trim();
  const password = document.getElementById('regPassword').value.trim();
  const errorBanner = document.getElementById('authErrorBanner');

  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phone, district, taluka, password })
    });
    const data = await res.json();
    if (!res.ok) {
      errorBanner.textContent = data.error || "Registration failed.";
      errorBanner.classList.remove('hidden');
      return;
    }

    currentUser = data.user;
    closeAuthModal();
    await checkAuthStatus();
    alert(`Account created successfully for ${currentUser.name}!`);
  } catch (err) {
    errorBanner.textContent = "Server error. Please try again.";
    errorBanner.classList.remove('hidden');
  }
}

async function handleLogout() {
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
    currentUser = null;
    savedSchemes = [];
    updateAuthUI(false);
    alert("Signed out.");
  } catch (e) {
    console.error(e);
  }
}

// -------------------------------------------------------------
// 7. APPLICATION TRACKER & ADMIN MODALS
// -------------------------------------------------------------

function openTrackerModal() {
  if (!currentUser) {
    openAuthModal('login');
    return;
  }

  const modal = document.getElementById('trackerModal');
  const subtitle = document.getElementById('trackerSubtitle');
  subtitle.innerHTML = `Citizen: <strong class="text-white">${currentUser.name}</strong> • Phone: <strong class="text-white">+91 ${currentUser.phone}</strong> • District: <strong class="text-white">${currentUser.district}</strong>`;
  modal.classList.remove('hidden');

  renderTrackerItems();
  if (window.lucide) lucide.createIcons();
}

function closeTrackerModal() {
  document.getElementById('trackerModal').classList.add('hidden');
}

function renderTrackerItems() {
  const container = document.getElementById('trackerItemsContainer');
  if (!savedSchemes || savedSchemes.length === 0) {
    container.innerHTML = `
      <div class="p-8 text-center bg-slate-900/50 rounded-xl border border-slate-800">
        <p class="text-xs font-bold text-slate-300">No saved schemes yet.</p>
        <p class="text-[11px] text-slate-500 mt-1">Run an eligibility check, and schemes will be saved automatically.</p>
      </div>
    `;
    return;
  }

  const stages = [
    { key: "Discovered", label: "1. Discovered" },
    { key: "Documents Pending", label: "2. Documents Pending" },
    { key: "Submitted at CSC", label: "3. Submitted at CSC / Setu" },
    { key: "DBT Approved", label: "4. Sanctioned / DBT Credited" }
  ];

  container.innerHTML = savedSchemes.map((s, idx) => {
    const stageOptions = stages.map(st => `
      <option value="${st.key}" ${s.application_stage === st.key ? 'selected' : ''}>${st.label}</option>
    `).join('');

    return `
      <div class="p-4 rounded-xl border border-slate-800 bg-slate-900/80 space-y-3">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2">
          <div>
            <div class="text-xs font-extrabold text-white">${idx + 1}. ${s.scheme_name}</div>
            <div class="text-[11px] text-slate-400">Benefit: <strong class="text-emerald-400">${s.benefit_amount}</strong></div>
          </div>
          <span class="text-[11px] bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-bold px-2 py-0.5 rounded self-start sm:self-auto">
            ${s.status}
          </span>
        </div>

        <div class="flex flex-wrap items-center justify-between gap-3 text-xs bg-slate-950 p-2.5 rounded-lg border border-slate-800">
          <div class="flex items-center space-x-2">
            <span class="font-bold text-slate-400">Status:</span>
            <select onchange="handleStageChange('${s.scheme_id}', this.value)" class="text-xs font-semibold bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 focus:outline-none focus:border-emerald-500">
              ${stageOptions}
            </select>
          </div>

          <a href="${s.portal_url || '#'}" target="_blank" class="text-xs font-bold text-emerald-400 hover:underline flex items-center gap-1">
            <span>Official Portal</span>
            <i data-lucide="external-link" class="w-3 h-3"></i>
          </a>
        </div>
      </div>
    `;
  }).join('');
}

async function handleStageChange(schemeId, newStage) {
  try {
    const res = await fetch('/api/user/schemes/stage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scheme_id: schemeId, new_stage: newStage })
    });
    if (res.ok) {
      await checkAuthStatus();
    }
  } catch (err) {
    console.error("Failed to update status:", err);
  }
}

// -------------------------------------------------------------
// 8. GOVERNMENT ADMIN CONSOLE (SHREY PAUNWALA)
// -------------------------------------------------------------

async function openAdminModal() {
  const modal = document.getElementById('adminModal');
  modal.classList.remove('hidden');

  try {
    const res = await fetch('/api/admin/overview');
    if (!res.ok) {
      alert("Admin privileges required.");
      return;
    }
    const data = await res.json();
    document.getElementById('adminTotalCitizens').textContent = data.total_citizens || 0;
    document.getElementById('adminTotalApps').textContent = data.total_applications || 0;
    document.getElementById('adminTotalSchemes').textContent = data.schemes_count || 6;

    const tbody = document.getElementById('adminCitizensTableBody');
    if (data.citizens && data.citizens.length > 0) {
      tbody.innerHTML = data.citizens.map(c => `
        <tr class="hover:bg-slate-900/60 transition">
          <td class="p-3 font-bold text-white">${c.name}</td>
          <td class="p-3 text-slate-400 font-mono">+91 ${c.phone}</td>
          <td class="p-3 text-slate-300">${c.district}${c.taluka ? ', ' + c.taluka : ''}</td>
          <td class="p-3 text-slate-300">${c.land_holding_acres ? c.land_holding_acres + ' Acres' : 'Non-agri'}</td>
          <td class="p-3">
            <span class="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-bold text-[11px]">${c.saved_schemes_count || 0} Schemes</span>
          </td>
        </tr>
      `).join('');
    } else {
      tbody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-slate-500">No citizens registered yet.</td></tr>`;
    }
  } catch (e) {
    console.error("Admin overview error:", e);
  }

  if (window.lucide) lucide.createIcons();
}

function closeAdminModal() {
  document.getElementById('adminModal').classList.add('hidden');
}

async function triggerGazetteSync() {
  const btn = document.getElementById('triggerSyncBtn');
  const statusText = document.getElementById('syncStatusText');
  if (btn) {
    btn.innerHTML = `<i data-lucide="loader-2" class="w-3.5 h-3.5 animate-spin"></i><span>Polling Portals...</span>`;
    if (window.lucide) lucide.createIcons();
  }

  try {
    const res = await fetch('/api/admin/sync-schemes', { method: 'POST' });
    const data = await res.json();
    if (res.ok) {
      if (statusText) {
        statusText.innerHTML = `Last verified: <strong>${data.synced_at}</strong> against official gazettes.`;
      }
      alert(`✅ Success: Polled official Maharashtra portals (krishi.maharashtra.gov.in & mahadbt.gov.in). ${data.schemes_checked} schemes audited & verified up to date!`);
    } else {
      alert("Sync error: " + (data.error || "Failed to sync."));
    }
  } catch (err) {
    alert("Connection error: " + err.message);
  } finally {
    if (btn) {
      btn.innerHTML = `<i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i><span>Trigger Gazette Sync</span>`;
      if (window.lucide) lucide.createIcons();
    }
  }
}

// -------------------------------------------------------------
// 9. RIGHT-SIDE VERTICAL SLIDING SCHEMES DRAWER (MULTILINGUAL)
// -------------------------------------------------------------

let allDrawerSchemes = [];
let currentDrawerLanguage = 'mr-IN';

const DRAWER_UI_TEXTS = {
  "mr-IN": {
    title: "शासकीय योजना",
    countBadge: "८ सक्रिय",
    subtitle: "महाराष्ट्र शासन अधिकृत कल्याणकारी योजना",
    searchPlaceholder: "योजनेचे नाव, पीक, आरोग्य, घरकुल शोधा...",
    rankNotice: "आर्थिक लाभाच्या उतरत्या क्रमाने (कमाल प्रथम)",
    feeLabel: "सरकारी शुल्क: ₹० (मोफत)",
    applyBtn: "अर्ज करा ↗",
    testBtn: "तपासा",
    eligibilityTitle: "स्पष्ट पात्रता निकष:",
    maxBenefitTag: "👑 कमाल लाभ",
    footerHint: "अधिकृत पोर्टलवर जाण्यासाठी कार्डवर क्लिक करा",
    testMyEligibilityBtn: "माझी पात्रता तपासा",
    noMatch: "कोणतीही जुळणारी योजना आढळली नाही. कृपया वेगळा शब्द शोधा."
  },
  "hi-IN": {
    title: "सरकारी योजनाएं",
    countBadge: "8 सक्रिय",
    subtitle: "महाराष्ट्र सरकार आधिकारिक कल्याणकारी योजनाएं",
    searchPlaceholder: "योजना का नाम, फसल, स्वास्थ्य, आवास खोजें...",
    rankNotice: "वित्तीय लाभ के घटते क्रम में (सर्वाधिक पहले)",
    feeLabel: "सरकारी शुल्क: ₹0 (निशुल्क)",
    applyBtn: "आवेदन करें ↗",
    testBtn: "जांचें",
    eligibilityTitle: "स्पष्ट पात्रता मानदंड:",
    maxBenefitTag: "👑 अधिकतम लाभ",
    footerHint: "आधिकारिक पोर्टल पर जाने के लिए कार्ड पर क्लिक करें",
    testMyEligibilityBtn: "मेरी पात्रता जांचें",
    noMatch: "कोई मेल खाने वाली योजना नहीं मिली। कृपया कोई अन्य शब्द खोजें।"
  },
  "en-IN": {
    title: "Government Schemes",
    countBadge: "8 Active",
    subtitle: "Official Maharashtra Welfare Portals",
    searchPlaceholder: "Filter by scheme name, crop, health, grant...",
    rankNotice: "Ranked by Monetary Benefit (Max First)",
    feeLabel: "Govt Fee: ₹0 (Free)",
    applyBtn: "Apply ↗",
    testBtn: "Test",
    eligibilityTitle: "Crisp Eligibility Criteria:",
    maxBenefitTag: "👑 MAX BENEFIT",
    footerHint: "Click any card to open official portal",
    testMyEligibilityBtn: "Test My Eligibility",
    noMatch: "No matching schemes found. Try a different search keyword."
  }
};

const SCHEME_MULTILINGUAL_CRITERIA = {
  "mr-IN": {
    "mh_mjpjay_health_2026": {
      name: "महात्मा ज्योतिराव फुले जन आरोग्य योजना (MJPJAY)",
      dept: "सार्वजनिक आरोग्य विभाग, महाराष्ट्र शासन",
      badge: "आरोग्य विमा",
      monetaryBadge: "₹५,००,००० / कुटुंब / वर्ष",
      criteria: [
        "महाराष्ट्राचा कायमचा रहिवासी आणि कोणतेही वैध रेशनकार्ड (पिवळे, केशरी किंवा पांढरे) धारक.",
        "१,३५६ गंभीर आजार आणि शस्त्रक्रियांसाठी संपूर्ण कुटुंबाला दरवर्षी ₹५ लाखांचे मोफत कॅशलेस उपचार.",
        "१,०००+ सरकारी व खाजगी अंगीकृत रुग्णालयांत आरोग्यमित्राद्वारे त्वरित मोफत प्रवेश."
      ],
      fee: "₹० (१००% मोफत)",
      presetPrompt: "माझं कुटुंब महाराष्ट्रात राहतं, आम्हाला ५ लाख रुपयांचा महात्मा ज्योतिराव फुले जन आरोग्य विमा हवा आहे."
    },
    "mh_pmay_rural_housing_2026": {
      name: "प्रधानमंत्री ग्रामीण व रमाई घरकुल योजना (PMAY-G)",
      dept: "ग्रामविकास विभाग, महाराष्ट्र शासन",
      badge: "ग्रामीण घरकुल अनुदान",
      monetaryBadge: "₹१,३८,००० थेट अनुदान",
      criteria: [
        "ग्रामीण महाराष्ट्रातील बेघर किंवा कच्चे/मातीचे मोडकळीस आलेले घर असलेले कुटुंब.",
        "कुटुंबाचे वार्षिक उत्पन्न ₹१,५०,००० पेक्षा कमी असावे आणि पक्के घर नसावे.",
        "थेट बँक खात्यात: ₹१.२० लाख बांधकाम + ₹१८,००० मनरेगा मजुरी + ₹१२,००० शौचालय अनुदान."
      ],
      fee: "₹० (१००% मोफत)",
      presetPrompt: "माझं ग्रामीण महाराष्ट्रात कच्चे घर आहे, पक्के घरकुल बांधण्यासाठी १ लाख ३८ हजार रुपयांचे अनुदान हवे आहे."
    },
    "mh_mahadbt_tractor_subsidy_2026": {
      name: "महाडीबीटी कृषी यांत्रिकीकरण ट्रॅक्टर व अवजारे अनुदान",
      dept: "कृषी विभाग, महाराष्ट्र शासन",
      badge: "कृषी यांत्रिकीकरण",
      monetaryBadge: "₹१,२५,००० पर्यंत अनुदान",
      criteria: [
        "महाराष्ट्रात ७/१२ उतारा असलेले किमान १ एकर शेतजमीन धारक शेतकरी.",
        "अनुसूचित जाती/जमाती, महिला व अल्पभूधारक शेतकऱ्यांसाठी ५०% तर सर्वसाधारणसाठी ४०% अनुदान.",
        "ट्रॅक्टर, रोटाव्हेटर, पॉवर टिलर, पेरणी यंत्र आणि आधुनिक शेती अवजारांवर थेट अनुदान."
      ],
      fee: "₹० (१००% मोफत)",
      presetPrompt: "माझ्याकडे ४ एकर शेतजमीन आहे, शेतीसाठी नवीन ट्रॅक्टर आणि अवजारे खरेदीवर महाडीबीटी अनुदान हवे आहे."
    },
    "mh_magel_tyala_shettale_2026": {
      name: "मागेल त्याला शेततळे योजना (Magel Tyala Shettale)",
      dept: "कृषी विभाग, महाराष्ट्र शासन",
      badge: "जलसंधारण व सिंचन",
      monetaryBadge: "₹७५,००० थेट अनुदान",
      criteria: [
        "महाराष्ट्रात किमान ०.६० हेक्टर (१.५ एकर) शेतजमीन असणारे सर्व शेतकरी पात्र.",
        "शेततळे खोदण्यासाठी नैसर्गिक उतार व पाणी साठवणुकीची जागा उपलब्ध असणे आवश्यक.",
        "शेततळे खोदणे व प्लास्टिक अस्तरीकरणासाठी थेट बँक खात्यात ₹७५,००० अनुदान."
      ],
      fee: "₹० (१००% मोफत)",
      presetPrompt: "माझं २ एकर कोरडवाहू शेत आहे, पाण्यासाठी शेततळे (Farm Pond) खोदायचे आहे, ७५ हजार रुपयांचे अनुदान हवे."
    },
    "mh_pm_fasal_bima_2026": {
      name: "१ रुपयात प्रधानमंत्री पीक विमा योजना (PMFBY)",
      dept: "कृषी विभाग, महाराष्ट्र शासन",
      badge: "नैसर्गिक आपत्ती विमा",
      monetaryBadge: "₹५०,०००+ नुकसान भरपाई",
      criteria: [
        "महाराष्ट्रातील शेतकऱ्यांना फक्त ₹१ टोकन हप्ता भरावा लागतो (उर्वरित १००% हप्ता शासन भरते).",
        "सोयाबीन, कापूस, तूर, भात, मूग, उडीद या पिकांचे अवकाळी पाऊस, दुष्काळ व किडीपासून संरक्षण.",
        "अवकाळी पाऊस किंवा गारपिटीनंतर ७२ तासांच्या आत ऑनलाइन पंचनामा तक्रार नोंदवणे आवश्यक."
      ],
      fee: "फक्त ₹१ टोकन (शासन भरते)",
      presetPrompt: "माझं १.५ एकर शेतातील सोयाबीन अवकाळी पावसाने खराब झालं, १ रुपयात पीक विमा नुकसान भरपाई हवी आहे."
    },
    "mh_sanjay_gandhi_niradhar_2026": {
      name: "संजय गांधी निराधार अनुदान पेन्शन योजना",
      dept: "सामाजिक न्याय विभाग, महाराष्ट्र शासन",
      badge: "सामाजिक पेन्शन सहाय्य",
      monetaryBadge: "₹१८,००० / वर्ष (₹१,५००/महिना)",
      criteria: [
        "महाराष्ट्रातील निराधार, दिव्यांग (४०%+ अपंगत्व), विधवा, घटस्फोटित महिला (वय १८ ते ६५ वर्षे).",
        "कुटुंबाची वार्षिक उत्पन्न मर्यादा ₹५०,००० पेक्षा कमी असावी.",
        "दरमहा ₹१,५०० थेट लाभार्थ्याच्या बँक खात्यात पेन्शन जमा केली जाते."
      ],
      fee: "₹० (१००% मोफत)",
      presetPrompt: "मी ६८ वर्षांची निराधार विधवा महिला आहे, उत्पन्नाचे कोणतेही साधन नाही, संजय गांधी निराधार पेन्शन हवी आहे."
    },
    "mh_namo_shetkari_pmkisan_2026": {
      name: "नमो शेतकरी महासन्मान निधी + पीएम-किसान योजना",
      dept: "कृषी व महसूल विभाग, महाराष्ट्र शासन",
      badge: "शेतकरी उत्पन्न सहाय्य",
      monetaryBadge: "₹१२,००० / वर्ष थेट DBT",
      criteria: [
        "महाराष्ट्रातील नोंदणीकृत ७/१२ उतारा असलेले अल्प व अत्यल्प भूधारक शेतकरी.",
        "एकत्रित लाभ: केंद्र सरकारचे ₹६,००० + महाराष्ट्र राज्य सरकारचे ₹६,००० टॉप-अप.",
        "दर ४ महिन्यांनी ₹४,००० चे तीन समान हप्ते थेट आधार लिंक बँक खात्यात जमा."
      ],
      fee: "₹० (१००% मोफत)",
      presetPrompt: "मी महाराष्ट्रातील अल्पभूधारक शेतकरी आहे, २ एकर शेती आहे, नमो शेतकरी आणि पीएम-किसान सन्मान निधी हवा आहे."
    },
    "mh_savitribai_phule_scholarship_2026": {
      name: "क्रांतीज्योती सावित्रीबाई फुले कन्या शिक्षण शिष्यवृत्ती",
      dept: "सामाजिक न्याय व विशेष सहाय्य विभाग",
      badge: "मुलींचे शिक्षण सहाय्य",
      monetaryBadge: "₹३,००० / वर्ष थेट विद्यावेतन",
      criteria: [
        "महाराष्ट्रातील मान्यताप्राप्त शाळेत इयत्ता ८वी, ९वी किंवा १०वी मध्ये शिकणाऱ्या विद्यार्थिनी.",
        "अनुसूचित जाती (SC), विमुक्त जाती व भटक्या जमाती (VJNT) किंवा विशेष मागास प्रवर्ग (SBC).",
        "कोणतीही उत्पन्न मर्यादा नाही (पात्र विद्यार्थिनींना सरसकट लाभ दिला जातो)."
      ],
      fee: "₹० (१००% मोफत)",
      presetPrompt: "माझी मुलगी ९वी इयत्तेत शिकत आहे, आम्ही मागासवर्गीय प्रवर्गातील आहोत, सावित्रीबाई फुले शिष्यवृत्ती हवी आहे."
    }
  },
  "hi-IN": {
    "mh_mjpjay_health_2026": {
      name: "महात्मा ज्योतिराव फुले जन आरोग्य योजना (MJPJAY)",
      dept: "सार्वजनिक स्वास्थ्य विभाग, महाराष्ट्र सरकार",
      badge: "सार्वभौमिक स्वास्थ्य सुरक्षा",
      monetaryBadge: "₹5,00,000 / परिवार / वर्ष",
      criteria: [
        "महाराष्ट्र के स्थायी निवासी और वैध राशन कार्ड (पीला, नारंगी या सफेद) धारक।",
        "1,356 गंभीर बीमारियों और सर्जरी के लिए पूरे परिवार को सालाना ₹5 लाख तक का कैशलेस इलाज।",
        "1,000+ सरकारी एवं सूचीबद्ध निजी अस्पतालों में आरोग्यमित्र के जरिए तत्काल निशुल्क भर्ती।"
      ],
      fee: "₹0 (100% निशुल्क)",
      presetPrompt: "मेरा परिवार महाराष्ट्र में रहता है, हमें 5 लाख रुपये का महात्मा ज्योतिराव फुले जन आरोग्य स्वास्थ्य बीमा चाहिए।"
    },
    "mh_pmay_rural_housing_2026": {
      name: "प्रधानमंत्री ग्रामीण एवं रमाई आवास योजना (PMAY-G)",
      dept: "ग्रामीण विकास विभाग, महाराष्ट्र सरकार",
      badge: "ग्रामीण पक्का आवास अनुदान",
      monetaryBadge: "₹1,38,000 प्रत्यक्ष अनुदान",
      criteria: [
        "ग्रामीण महाराष्ट्र में रहने वाला परिवार जिसके पास देश में कहीं भी पक्का मकान न हो।",
        "कच्चे/मिट्टी के घर में रहने वाला परिवार और वार्षिक पारिवारिक आय ₹1.5 लाख से कम।",
        "सीधे बैंक खाते में: ₹1.20 लाख निर्माण + ₹18,000 मनरेगा मजदूरी + ₹12,000 शौचालय अनुदान।"
      ],
      fee: "₹0 (100% निशुल्क)",
      presetPrompt: "मेरा ग्रामीण महाराष्ट्र में कच्चा घर है, पक्का मकान बनाने के लिए 1 लाख 38 हजार रुपये का सरकारी अनुदान चाहिए।"
    },
    "mh_mahadbt_tractor_subsidy_2026": {
      name: "महाडीबीटी कृषि यंत्रीकरण ट्रैक्टर एवं कृषि उपकरण सब्सिडी",
      dept: "कृषि विभाग, महाराष्ट्र सरकार",
      badge: "कृषि यंत्रीकरण अनुदान",
      monetaryBadge: "₹1,25,000 तक प्रत्यक्ष सब्सिडी",
      criteria: [
        "महाराष्ट्र में 7/12 खतौनी वाले न्यूनतम 1 एकड़ कृषि भूमि धारक किसान।",
        "अनुसूचित जाति/जनजाति, महिला एवं लघु किसानों के लिए 50% और सामान्य वर्ग हेतु 40% सब्सिडी।",
        "ट्रैक्टर, रोटावेटर, पावर टिलर और आधुनिक खेती के उपकरणों की खरीद पर मान्य।"
      ],
      fee: "₹0 (100% निशुल्क)",
      presetPrompt: "मेरे पास 4 एकड़ कृषि भूमि है, खेती के लिए नया ट्रैक्टर और उपकरण खरीदने पर महाडीबीटी सब्सिडी चाहिए।"
    },
    "mh_magel_tyala_shettale_2026": {
      name: "मागेल त्याला शेततले - मांग पर खेत तालाब योजना",
      dept: "कृषि विभाग, महाराष्ट्र सरकार",
      badge: "सिंचाई एवं जल सुरक्षा",
      monetaryBadge: "₹75,000 प्रत्यक्ष अनुदान",
      criteria: [
        "महाराष्ट्र में न्यूनतम 0.60 हेक्टेयर (1.5 एकड़) कृषि भूमि का स्वामित्व रखने वाले किसान।",
        "खेत में तालाब निर्माण हेतु प्राकृतिक ढलान व जल संचयन की उपयुक्त जगह होना अनिवार्य।",
        "तालाब खुदाई एवं प्लास्टिक लाइनिंग के लिए सीधे बैंक खाते में ₹75,000 अनुदान।"
      ],
      fee: "₹0 (100% निशुल्क)",
      presetPrompt: "मेरे पास 2 एकड़ असिंचित जमीन है, पानी के लिए खेत तालाब (Farm Pond) खुदवाना है, 75 हजार का अनुदान चाहिए।"
    },
    "mh_pm_fasal_bima_2026": {
      name: "₹1 में प्रधानमंत्री फसल बीमा योजना (PMFBY)",
      dept: "कृषि विभाग, महाराष्ट्र सरकार",
      badge: "फसल क्षति मुआवजा",
      monetaryBadge: "₹50,000+ नुकसान भरपाई",
      criteria: [
        "महाराष्ट्र के किसानों को केवल ₹1 टोकन प्रीमियम देना होता है (शेष 100% प्रीमियम सरकार भरती है)।",
        "सोयाबीन, कपास, अरहर, धान आदि फसलों का सूखा, बेमौसम बारिश और ओलावृष्टि से सुरक्षा।",
        "फसल नुकसान होने के 72 घंटे के भीतर फसल बीमा पोर्टल/ऐप पर सूचना दर्ज कराना आवश्यक।"
      ],
      fee: "केवल ₹1 टोकन (सरकार वहन करती है)",
      presetPrompt: "मेरी 1.5 एकड़ में सोयाबीन की फसल बेमौसम बारिश से खराब हो गई, ₹1 वाली फसल बीमा योजना से मुआवजा चाहिए।"
    },
    "mh_sanjay_gandhi_niradhar_2026": {
      name: "संजय गांधी निराधार अनुदान पेंशन योजना",
      dept: "सामाजिक न्याय विभाग, महाराष्ट्र सरकार",
      badge: "सामाजिक सुरक्षा पेंशन",
      monetaryBadge: "₹18,000 / वर्ष (₹1,500/माह)",
      criteria: [
        "महाराष्ट्र के बेसहारा, दिव्यांग (40%+ विकलांगता), विधवा या परित्यक्ता नागरिक (आयु 18-65 वर्ष)।",
        "परिवार की कुल वार्षिक आय सीमा ₹50,000 से कम होनी चाहिए।",
        "प्रति माह ₹1,500 की पेंशन राशि सीधे लाभार्थी के बैंक खाते में जमा होती है।"
      ],
      fee: "₹0 (100% निशुल्क)",
      presetPrompt: "मैं 68 वर्ष की निराधार विधवा महिला हूँ, आय का कोई साधन नहीं है, संजय गांधी निराधार पेंशन सहायता चाहिए।"
    },
    "mh_namo_shetkari_pmkisan_2026": {
      name: "नमो शेतकरी महासम्मान निधि + पीएम-किसान योजना",
      dept: "कृषि एवं राजस्व विभाग, महाराष्ट्र सरकार",
      badge: "किसान आय सहायता",
      monetaryBadge: "₹12,000 / वर्ष प्रत्यक्ष DBT",
      criteria: [
        "महाराष्ट्र में पंजीकृत 7/12 भूलेख वाले लघु एवं सीमांत कृषक परिवार।",
        "संयुक्त लाभ: केंद्र सरकार के ₹6,000 + महाराष्ट्र राज्य सरकार का ₹6,000 टॉप-अप।",
        "हर 4 महीने पर ₹4,000 की तीन समान किस्तें सीधे आधार लिंक बैंक खाते में स्थानांतरित।"
      ],
      fee: "₹0 (100% निशुल्क)",
      presetPrompt: "मैं महाराष्ट्र का छोटा किसान हूँ, 2 एकड़ जमीन है, नमो शेतकरी और पीएम-किसान सम्मान निधि राशि चाहिए।"
    },
    "mh_savitribai_phule_scholarship_2026": {
      name: "सावित्रीबाई फुले बालिका शिक्षा छात्रवृत्ति योजना",
      dept: "सामाजिक न्याय एवं विशेष सहायता विभाग",
      badge: "बालिका शिक्षा प्रोत्साहन",
      monetaryBadge: "₹3,000 / वर्ष प्रत्यक्ष वजीफा",
      criteria: [
        "महाराष्ट्र के मान्यता प्राप्त विद्यालय में कक्षा 8वीं, 9वीं या 10वीं में अध्ययनरत छात्राएं।",
        "अनुसूचित जाति (SC), विमुक्त जाति/भटकती जनजाति (VJNT) या विशेष पिछड़ा वर्ग (SBC)।",
        "परिवार की कोई आय सीमा अनिवार्य नहीं (सभी पात्र छात्राओं को शत-प्रतिशत लाभ)।"
      ],
      fee: "₹0 (100% निशुल्क)",
      presetPrompt: "मेरी बेटी 9वीं कक्षा में पढ़ रही है, हम पिछड़ा वर्ग से हैं, सावित्रीबाई फुले छात्रवृत्ति का लाभ चाहिए।"
    }
  },
  "en-IN": {
    "mh_mjpjay_health_2026": {
      name: "Mahatma Jyotirao Phule Jan Arogya Yojana (MJPJAY)",
      dept: "Public Health Department, Government of Maharashtra",
      badge: "Universal Health Cover",
      monetaryBadge: "₹5,00,000 / Family / Year",
      criteria: [
        "Permanent resident of Maharashtra holding any valid Ration Card (Yellow, Orange, or White).",
        "₹5,00,000 cashless hospitalization coverage for 1,356 serious medical treatments and surgeries.",
        "Instant cashless admission at 1,000+ government and empaneled private network hospitals."
      ],
      fee: "₹0 (100% Free)",
      presetPrompt: "My family lives in Maharashtra, we need 5 lakh rupees health cover under Mahatma Jyotirao Phule Jan Arogya Yojana."
    },
    "mh_pmay_rural_housing_2026": {
      name: "PMAY-G / Ramai Gharkul Rural Housing Scheme",
      dept: "Rural Development Department, Government of Maharashtra",
      badge: "Rural Pucca Housing Grant",
      monetaryBadge: "₹1,38,000 Direct Grant",
      criteria: [
        "Rural resident of Maharashtra with no pucca house anywhere in India.",
        "Living in dilapidated kutcha/mud house; family annual income ≤ ₹1,50,000.",
        "100% DBT: ₹1.20L construction grant + ₹18,000 MGNREGA wages + ₹12,000 toilet grant."
      ],
      fee: "₹0 (100% Free)",
      presetPrompt: "I live in rural Maharashtra in a kutcha house, I need 1.38 lakh rupees government grant to build a pucca house."
    },
    "mh_mahadbt_tractor_subsidy_2026": {
      name: "MahaDBT Farm Mechanization Tractor & Equipment Subsidy",
      dept: "Department of Agriculture, Government of Maharashtra",
      badge: "Farm Mechanization Subsidy",
      monetaryBadge: "Up to ₹1,25,000 Subsidy",
      criteria: [
        "Farmer holding 1+ acre cultivable land with 7/12 extract in Maharashtra.",
        "50% subsidy for SC / ST / Women & Small Farmers; 40% for General Category farmers.",
        "Covers tractors, rotavators, power tillers, cultivators, and high-efficiency sprayers."
      ],
      fee: "₹0 (100% Free)",
      presetPrompt: "I have 4 acres of farm land in Maharashtra, I want MahaDBT subsidy to purchase a new tractor and farm equipment."
    },
    "mh_magel_tyala_shettale_2026": {
      name: "Magel Tyala Shettale (Farm Pond On-Demand)",
      dept: "Department of Agriculture, Government of Maharashtra",
      badge: "Irrigation & Water Security",
      monetaryBadge: "Up to ₹75,000 Direct Subsidy",
      criteria: [
        "Farmer holding at least 0.60 hectare (1.5 acres) agricultural land in Maharashtra.",
        "Site must have natural slope / catchment suitable for farm pond water harvesting.",
        "100% on-demand government sanction for farm pond excavation and plastic lining."
      ],
      fee: "₹0 (100% Free)",
      presetPrompt: "I have 2 acres of dryland farm, I want to construct a farm pond for water storage, need 75,000 subsidy."
    },
    "mh_pm_fasal_bima_2026": {
      name: "PM Fasal Bima Yojana (₹1 Token Premium Scheme)",
      dept: "Department of Agriculture, Government of Maharashtra",
      badge: "Crop Calamity Insurance",
      monetaryBadge: "₹50,000+ Loss Compensation",
      criteria: [
        "Maharashtra farmers pay only ₹1 token premium (State Govt covers 100% remaining farmer premium).",
        "Covers Soybean, Cotton, Tur, Rice, Gram, Wheat against drought, unseasonal rain, and pests.",
        "Claim intimation within 72 hours of unseasonal rainfall or calamity via crop insurance app."
      ],
      fee: "₹1 Token (State Pays 100% Rest)",
      presetPrompt: "My soybean crop on 1.5 acres was damaged due to unseasonal rain, need crop insurance compensation under 1 rupee scheme."
    },
    "mh_sanjay_gandhi_niradhar_2026": {
      name: "Sanjay Gandhi Niradhar Anudan Pension Scheme",
      dept: "Social Justice Department, Government of Maharashtra",
      badge: "Social Pension Support",
      monetaryBadge: "₹18,000 / Year (₹1,500 / mo)",
      criteria: [
        "Destitute, disabled (40%+ disability), widow, or orphan resident in Maharashtra (Age 18–65).",
        "Family annual income ceiling: less than ₹50,000 per year.",
        "Direct DBT pension transferred directly into beneficiary bank account every month."
      ],
      fee: "₹0 (100% Free)",
      presetPrompt: "I am a 68-year-old destitute widow with no source of income, annual income under 50k, need Sanjay Gandhi pension."
    },
    "mh_namo_shetkari_pmkisan_2026": {
      name: "Namo Shetkari Mahasanman Nidhi + PM-KISAN Combined",
      dept: "Department of Agriculture & Revenue, Govt of Maharashtra",
      badge: "Farmer Income Support",
      monetaryBadge: "₹12,000 / Year Direct DBT",
      criteria: [
        "Small and marginal landholding farmers in Maharashtra with valid 7/12 land records.",
        "Combined benefit: ₹6,000 Central PM-KISAN + ₹6,000 Maharashtra Namo Shetkari Top-Up.",
        "Disbursed in 3 equal installments of ₹4,000 every 4 months directly to Aadhaar-linked bank account."
      ],
      fee: "₹0 (100% Free)",
      presetPrompt: "I am a small farmer in Maharashtra with 2 acres land, need Namo Shetkari and PM-KISAN income support."
    },
    "mh_savitribai_phule_scholarship_2026": {
      name: "Savitribai Phule Girl Child Education Scholarship",
      dept: "Social Justice & Special Assistance Department",
      badge: "Girl Child Education",
      monetaryBadge: "₹3,000 / Year Cash Stipend",
      criteria: [
        "Girl student enrolled in Class 8, 9, or 10 in recognized schools in Maharashtra.",
        "Belongs to SC, VJNT, or SBC communities.",
        "No family income ceiling (Universal coverage for all eligible girl students)."
      ],
      fee: "₹0 (100% Free)",
      presetPrompt: "My daughter is studying in 9th standard, we belong to backward category, need Savitribai Phule scholarship."
    }
  }
};

function toggleSchemesDrawer() {
  const drawer = document.getElementById('schemesDrawer');
  const backdrop = document.getElementById('schemesDrawerBackdrop');
  if (!drawer) return;

  const isOpen = !drawer.classList.contains('translate-x-full');
  if (isOpen) {
    closeSchemesDrawer();
  } else {
    openSchemesDrawer();
  }
}

function openSchemesDrawer() {
  const drawer = document.getElementById('schemesDrawer');
  const backdrop = document.getElementById('schemesDrawerBackdrop');
  if (!drawer) return;

  drawer.classList.remove('translate-x-full');
  drawer.classList.add('translate-x-0');

  if (backdrop) {
    backdrop.classList.remove('hidden');
    setTimeout(() => {
      backdrop.classList.remove('opacity-0');
      backdrop.classList.add('opacity-100');
    }, 10);
  }
}

function closeSchemesDrawer() {
  const drawer = document.getElementById('schemesDrawer');
  const backdrop = document.getElementById('schemesDrawerBackdrop');
  if (!drawer) return;

  drawer.classList.add('translate-x-full');
  drawer.classList.remove('translate-x-0');

  if (backdrop) {
    backdrop.classList.remove('opacity-100');
    backdrop.classList.add('opacity-0');
    setTimeout(() => {
      backdrop.classList.add('hidden');
    }, 300);
  }
}

function setDrawerLanguage(lang, syncMain = true) {
  currentDrawerLanguage = lang;

  // Update tabs active state
  const tabs = {
    'mr-IN': document.getElementById('drawerLangMr'),
    'hi-IN': document.getElementById('drawerLangHi'),
    'en-IN': document.getElementById('drawerLangEn')
  };

  Object.entries(tabs).forEach(([k, btn]) => {
    if (!btn) return;
    if (k === lang) {
      btn.className = "px-2.5 py-1 rounded-md text-[11px] font-black transition bg-emerald-500 text-slate-950 shadow-sm";
    } else {
      btn.className = "px-2.5 py-1 rounded-md text-[11px] font-bold transition text-slate-400 hover:text-white";
    }
  });

  // Update Drawer UI static labels
  const ui = DRAWER_UI_TEXTS[lang] || DRAWER_UI_TEXTS['en-IN'];
  const titleElem = document.getElementById('drawerHeaderTitle');
  const badgeElem = document.getElementById('drawerHeaderBadge');
  const subtitleElem = document.getElementById('drawerHeaderSubtitle');
  const searchInput = document.getElementById('drawerSchemeSearch');
  const rankNotice = document.getElementById('drawerRankNoticeText');
  const feeNotice = document.getElementById('drawerFeeNoticeText');
  const footerHint = document.getElementById('drawerFooterHintText');
  const footerBtn = document.getElementById('drawerFooterTestBtnText');

  if (titleElem) titleElem.textContent = ui.title;
  if (badgeElem) badgeElem.textContent = ui.countBadge;
  if (subtitleElem) subtitleElem.textContent = ui.subtitle;
  if (searchInput) searchInput.placeholder = ui.searchPlaceholder;
  if (rankNotice) rankNotice.textContent = ui.rankNotice;
  if (feeNotice) feeNotice.textContent = ui.feeLabel;
  if (footerHint) footerHint.textContent = ui.footerHint;
  if (footerBtn) footerBtn.textContent = ui.testMyEligibilityBtn;

  // Re-render schemes in this language
  renderDrawerSchemes(allDrawerSchemes);

  // Sync main dropdown and input box if triggered from drawer
  if (syncMain) {
    const mainSelect = document.getElementById('voiceLanguage');
    if (mainSelect && mainSelect.value !== lang) {
      mainSelect.value = lang;
      updateVoiceLanguage(false);
    }
  }
}

async function loadSchemesDrawer() {
  const container = document.getElementById('drawerSchemesContainer');
  if (!container) return;

  try {
    const res = await fetch('/api/schemes');
    const schemes = await res.json();
    if (!Array.isArray(schemes)) return;

    // Sort in descending order of monetary benefit (highest value first)
    schemes.sort((a, b) => (b.monetary_value_inr || 0) - (a.monetary_value_inr || 0));
    allDrawerSchemes = schemes;
    renderDrawerSchemes(schemes);
  } catch (err) {
    console.error("Failed to load drawer schemes:", err);
  }
}

function getSchemeLocalizedInfo(langMap, schemeId) {
  if (!langMap) return null;
  if (langMap[schemeId]) return langMap[schemeId];

  const id = (schemeId || '').toLowerCase();
  if (id.includes("yantrikikaran") || id.includes("tractor")) {
    return langMap["mh_krishi_yantrikikaran_2026"] || langMap["mh_mahadbt_tractor_subsidy_2026"];
  }
  if (id.includes("shetetale") || id.includes("shettale")) {
    return langMap["mh_magel_tyala_shetetale_2026"] || langMap["mh_magel_tyala_shettale_2026"];
  }
  if (id.includes("fasal_bima") || id.includes("bima")) {
    return langMap["mh_pm_fasal_bima_1re"] || langMap["mh_pm_fasal_bima_2026"];
  }
  if (id.includes("namo_shetkari") || id.includes("shetkari")) {
    return langMap["mh_namo_shetkari_2026"] || langMap["mh_namo_shetkari_pmkisan_2026"];
  }
  if (id.includes("savitribai") || id.includes("phule")) {
    return langMap["mh_savitribai_phule_scholarship"] || langMap["mh_savitribai_phule_scholarship_2026"];
  }
  if (id.includes("mjpjay") || id.includes("health")) {
    return langMap["mh_mjpjay_health_2026"];
  }
  if (id.includes("pmay") || id.includes("housing") || id.includes("gharkul")) {
    return langMap["mh_pmay_rural_housing_2026"];
  }
  if (id.includes("niradhar") || id.includes("sanjay_gandhi")) {
    return langMap["mh_sanjay_gandhi_niradhar_2026"];
  }
  return null;
}

function renderDrawerSchemes(schemes) {
  const container = document.getElementById('drawerSchemesContainer');
  if (!container) return;

  const ui = DRAWER_UI_TEXTS[currentDrawerLanguage] || DRAWER_UI_TEXTS['en-IN'];
  const langCriteriaMap = SCHEME_MULTILINGUAL_CRITERIA[currentDrawerLanguage] || SCHEME_MULTILINGUAL_CRITERIA['en-IN'];

  if (!schemes || schemes.length === 0) {
    container.innerHTML = `
      <div class="p-6 text-center text-slate-500 text-xs">
        ${ui.noMatch}
      </div>
    `;
    return;
  }

  container.innerHTML = schemes.map((s, idx) => {
    const info = getSchemeLocalizedInfo(langCriteriaMap, s.scheme_id) || {
      name: s.scheme_name,
      dept: s.department,
      badge: s.category || "Welfare Scheme",
      monetaryBadge: s.monetary_value_inr ? `₹${s.monetary_value_inr.toLocaleString('en-IN')}` : s.benefit_amount,
      criteria: s.eligibility_rules ? s.eligibility_rules.map(r => r.rule_description || r.label) : [s.benefit_amount],
      fee: s.official_fee_inr === 0 ? "₹0 (Free)" : "₹" + s.official_fee_inr,
      presetPrompt: s.scheme_name
    };

    const criteriaBullets = (info.criteria || []).map(c => `
      <li class="flex items-start space-x-1.5 text-[11px] text-slate-300">
        <span class="text-emerald-400 font-bold shrink-0 mt-0.5">•</span>
        <span class="leading-relaxed">${c}</span>
      </li>
    `).join('');

    const topTag = idx === 0 ? `
      <span class="text-[10px] font-black bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 px-2 py-0.5 rounded-full shadow-md animate-pulse">
        ${ui.maxBenefitTag}
      </span>
    ` : '';

    const safePrompt = (info.presetPrompt || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');

    return `
      <div class="drawer-scheme-card glass-card rounded-xl border border-white/10 p-3.5 space-y-3 cursor-pointer group"
           onclick="handleDrawerSchemeClick('${s.portal_apply_url}', event)">
        
        <!-- Header: Category & Monetary Value Badge -->
        <div class="flex items-center justify-between gap-1.5">
          <div class="flex items-center gap-1.5">
            <span class="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
              ${info.badge}
            </span>
            ${topTag}
          </div>
          <span class="text-xs font-black text-emerald-300 bg-emerald-500/20 px-2.5 py-0.5 rounded-lg border border-emerald-500/30">
            ${info.monetaryBadge}
          </span>
        </div>

        <!-- Scheme Title & Department in Selected Language -->
        <div>
          <h4 class="text-xs font-bold text-white group-hover:text-emerald-300 transition-colors leading-snug">
            ${info.name}
          </h4>
          <div class="text-[10px] text-slate-400 truncate mt-0.5">${info.dept}</div>
        </div>

        <!-- Crisp Eligibility Criteria Box (In Selected Language) -->
        <div class="bg-slate-950/80 rounded-lg p-2.5 border border-white/5 space-y-1.5">
          <div class="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1">
            <i data-lucide="check-square" class="w-3 h-3 text-emerald-400"></i>
            <span>${ui.eligibilityTitle}</span>
          </div>
          <ul class="space-y-1">
            ${criteriaBullets}
          </ul>
        </div>

        <!-- Meta & Portal Navigation -->
        <div class="flex items-center justify-between pt-1 border-t border-white/[0.06] text-[11px]">
          <span class="text-slate-400">
            ${info.fee}
          </span>
          <div class="flex items-center space-x-1.5">
            <button 
              type="button"
              onclick="testSchemeInHaqSetu('${safePrompt}', '${currentDrawerLanguage}', event)"
              class="px-2 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-bold transition flex items-center gap-1"
              title="Test eligibility in HaqSetu"
            >
              <i data-lucide="sparkle" class="w-3 h-3 text-emerald-400"></i>
              <span>${ui.testBtn}</span>
            </button>
            <a 
              href="${s.portal_apply_url}" 
              target="_blank" 
              rel="noopener noreferrer" 
              onclick="event.stopPropagation();" 
              class="btn-neon-primary px-2.5 py-1 rounded-md text-[10px] font-bold flex items-center gap-1 shadow-sm"
              title="Open Official Government Portal in new tab"
            >
              <span>${ui.applyBtn}</span>
            </a>
          </div>
        </div>

      </div>
    `;
  }).join('');

  if (window.lucide) {
    lucide.createIcons();
  }
}

function handleDrawerSchemeClick(portalUrl, event) {
  if (event.target.closest('button') || event.target.closest('a')) {
    return;
  }
  if (portalUrl) {
    window.open(portalUrl, '_blank', 'noopener,noreferrer');
  }
}

function testSchemeInHaqSetu(promptText, lang, event) {
  if (event) event.stopPropagation();
  closeSchemesDrawer();

  // Sync main language dropdown to scheme language
  if (lang) {
    const select = document.getElementById('voiceLanguage');
    if (select && select.value !== lang) {
      select.value = lang;
      if (recognition) recognition.lang = lang;
      currentLanguage = lang;
    }
  }

  const input = document.getElementById('citizenInput');
  if (input) {
    input.value = promptText;
    const btn = document.getElementById('analyzeBtn');
    if (btn) {
      btn.classList.add('ring-4', 'ring-emerald-400');
      setTimeout(() => btn.classList.remove('ring-4', 'ring-emerald-400'), 800);
      runEligibilityAnalysis();
    }
  }
}

function filterDrawerSchemes() {
  const query = (document.getElementById('drawerSchemeSearch')?.value || '').toLowerCase().trim();
  if (!query) {
    renderDrawerSchemes(allDrawerSchemes);
    return;
  }

  const langCriteriaMap = SCHEME_MULTILINGUAL_CRITERIA[currentDrawerLanguage] || SCHEME_MULTILINGUAL_CRITERIA['en-IN'];

  const filtered = allDrawerSchemes.filter(s => {
    const rawName = (s.scheme_name || '').toLowerCase();
    const rawDept = (s.department || '').toLowerCase();
    const rawCat = (s.category || '').toLowerCase();
    const info = getSchemeLocalizedInfo(langCriteriaMap, s.scheme_id);
    const transName = info ? (info.name || '').toLowerCase() : '';
    const transDept = info ? (info.dept || '').toLowerCase() : '';
    const transBadge = info ? (info.badge || '').toLowerCase() : '';
    const critMatch = info && (info.criteria || []).some(c => c.toLowerCase().includes(query));

    return rawName.includes(query) || rawDept.includes(query) || rawCat.includes(query) ||
           transName.includes(query) || transDept.includes(query) || transBadge.includes(query) || critMatch;
  });

  renderDrawerSchemes(filtered);
}


