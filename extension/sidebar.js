'use strict';

const BACKEND = 'https://github-n92a.onrender.com';

const params = new URLSearchParams(window.location.search);
const USERNAME = params.get('username') || '';

let state = {
  currentStep: 1,
  token: null,
  geminiKey: null,
  profileData: null,
  profileDataReady: false,
  repoData: [],
  auditResult: null,
  generatedReadme: null,
  enabledSections: {
    typing_header: true,
    about: true,
    tech_badges: true,
    stats: true,
    trophies: true,
    visitor_counter: true,
    contrib_graph: true,
    social_links: true
  },
  changes: [],
  finalScore: 0,
  dark: false
};

const $ = id => document.getElementById(id);

/* ── INIT ─────────────────────────────────── */
async function init() {
  const { gh_token, gemini_key } = await chrome.storage.sync.get(['gh_token', 'gemini_key']);

  if (!gh_token) {
    showError('No GitHub token found. Click the ✨ GitHub Pilot extension icon and save your token first.');
    return;
  }
  if (!gemini_key) {
    showError('No Gemini API key found. Click the ✨ GitHub Pilot extension icon and add your Gemini key first.');
    return;
  }

  state.token = gh_token;
  state.geminiKey = gemini_key;
  $('sb-sub').textContent = `@${USERNAME} · github.com`;

  requestProfileData();
  bindEvents();
}

function bindEvents() {
  $('close-btn').addEventListener('click', () => {
    window.parent.postMessage({ type: 'GP_CLOSE_SIDEBAR' }, '*');
  });

  $('theme-btn').addEventListener('click', () => {
    state.dark = !state.dark;
    document.body.classList.toggle('dark', state.dark);
    $('theme-icon').innerHTML = state.dark
      ? `<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>`
      : `<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>`;
  });

  $('analyze-btn').addEventListener('click', onAnalyzeClick);
  $('repo-created-btn').addEventListener('click', onRepoCreated);
  $('skip-setup-btn').addEventListener('click', startAnalysis);
  $('to-review-btn').addEventListener('click', goToReview);
  $('apply-btn').addEventListener('click', applyChanges);
  $('back-btn').addEventListener('click', () => goToStep(4));
  $('retry-btn').addEventListener('click', () => goToStep(1));
  $('copy-markdown-btn').addEventListener('click', copyMarkdown);
  $('view-profile-btn').addEventListener('click', () => {
    window.open(`https://github.com/${USERNAME}`, '_blank');
  });
  $('audit-log-btn').addEventListener('click', viewAuditLog);
}

/* ── PROFILE DATA ─────────────────────────── */
function requestProfileData() {
  window.parent.postMessage({ type: 'GP_GET_PROFILE_DATA' }, '*');

  window.addEventListener('message', (e) => {
    if (e.data?.type === 'GP_PROFILE_DATA') {
      state.profileData = e.data.data;
      state.profileDataReady = true;
      updateExtractionTags(state.profileData);
    }
  });

  // Re-request after 600ms in case first message was missed
  setTimeout(() => {
    if (!state.profileDataReady) {
      window.parent.postMessage({ type: 'GP_GET_PROFILE_DATA' }, '*');
    }
  }, 600);
}

function waitForProfileData() {
  return new Promise(resolve => {
    if (state.profileDataReady) { resolve(); return; }
    const timeout = setTimeout(() => {
      // Fallback: minimal profile from username
      if (!state.profileData) {
        state.profileData = {
          username: USERNAME,
          displayName: USERNAME,
          bio: '',
          followers: '0',
          following: '0',
          location: '',
          website: '',
          pinnedRepos: [],
          publicRepos: '0',
          contributions: '',
          pageUrl: `https://github.com/${USERNAME}`,
          scrapedAt: new Date().toISOString()
        };
      }
      resolve();
    }, 4000);

    const interval = setInterval(() => {
      if (state.profileDataReady) {
        clearTimeout(timeout);
        clearInterval(interval);
        resolve();
      }
    }, 100);
  });
}

function updateExtractionTags(data) {
  if (data.username) markTag('tag-username');
  if (data.bio) markTag('tag-bio');
  if (data.pinnedRepos?.length) { markTag('tag-repos'); markTag('tag-languages'); }
  markTag('tag-followers');
}

function markTag(id) {
  const el = $(id);
  if (el) el.classList.add('done');
}

/* ── STEP NAVIGATION ──────────────────────── */
function goToStep(n) {
  document.querySelectorAll('.step-view').forEach(v => v.style.display = 'none');
  $('step-error').style.display = 'none';
  const target = n === 'success' ? 'step-success' : `step-${n}`;
  const el = $(target);
  if (el) el.style.display = 'flex';
  if (typeof n === 'number') {
    state.currentStep = n;
    updateProgressBar(n);
  }
}

function updateProgressBar(active) {
  for (let i = 1; i <= 5; i++) {
    const dot = $(`dot-${i}`);
    const line = $(`line-${i}`);
    if (!dot) continue;
    dot.className = 'p-dot ' + (i < active ? 'done' : i === active ? 'active' : '');
    dot.innerHTML = dot.classList.contains('done')
      ? `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>`
      : String(i);
    if (line) line.className = 'p-line ' + (i < active ? 'done' : '');
  }
}

/* ── STEP 1: ANALYZE ──────────────────────── */
async function onAnalyzeClick() {
  const prompt = $('prompt-input').value.trim();
  if (!prompt) {
    $('prompt-input').focus();
    $('prompt-input').style.borderColor = '#ef4444';
    setTimeout(() => $('prompt-input').style.borderColor = '', 2000);
    return;
  }
  state.userPrompt = prompt;

  $('analyze-btn').disabled = true;
  $('analyze-btn').textContent = 'Checking profile...';

  await waitForProfileData();

  $('analyze-btn').disabled = false;
  $('analyze-btn').innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> Analyze with Gemini`;

  // Fill setup step details
  $('warn-repo-name').textContent = `${USERNAME}/${USERNAME} doesn't exist yet`;
  $('step-username-code').textContent = USERNAME;
  $('step-4-note').innerHTML = `GitHub will show: <em>"${USERNAME}/${USERNAME} is a special repository — its README.md will appear on your profile."</em>`;

  goToStep(2);

  const exists = await checkProfileRepo();
  if (exists) {
    await startAnalysis();
  }
}

async function checkProfileRepo() {
  try {
    const res = await fetch(`https://api.github.com/repos/${USERNAME}/${USERNAME}`, {
      headers: { Authorization: `Bearer ${state.token}`, 'User-Agent': 'GitHub-Pilot' }
    });
    return res.ok;
  } catch { return false; }
}

async function onRepoCreated() {
  $('repo-created-btn').disabled = true;
  $('repo-created-btn').textContent = 'Checking...';
  const exists = await checkProfileRepo();
  if (exists) {
    await startAnalysis();
  } else {
    $('repo-created-btn').disabled = false;
    $('repo-created-btn').innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.56"/></svg> I've created it → Continue`;
    const hint = document.querySelector('.success-hint');
    if (hint) {
      hint.textContent = `Repository not found yet. Make sure the name matches exactly: ${USERNAME}`;
      hint.style.background = '#fef9c3';
      hint.style.borderColor = '#fde68a';
      hint.style.color = '#92400e';
    }
  }
}

/* ── STEP 3: LOADING + ANALYSIS ──────────── */
async function startAnalysis() {
  goToStep(3);

  // ── Extract: fetch repos ──────────────────
  setLoadStep('extract', 'active');
  let repos = [];
  try {
    repos = await fetchUserRepos();
    state.repoData = repos;
    markTag('tag-repos'); markTag('tag-topics');
    markTag('tag-stars'); markTag('tag-languages');
    $('ls-sub-extract').textContent = `${repos.length} repos · ${new Set(repos.flatMap(r => r.language ? [r.language] : [])).size} languages`;
  } catch (e) {
    $('ls-sub-extract').textContent = 'Could not fetch repos — using profile data only';
  }
  setLoadStep('extract', 'done');
  setProgress(15);

  // ── Read existing README ──────────────────
  setLoadStep('readme', 'active');
  let existingReadme = '';
  try {
    const readmeRes = await fetch(
      `https://api.github.com/repos/${USERNAME}/${USERNAME}/readme`,
      { headers: { Authorization: `Bearer ${state.token}`, 'User-Agent': 'GitHub-Pilot', Accept: 'application/vnd.github.v3.raw' } }
    );
    if (readmeRes.ok) {
      existingReadme = await readmeRes.text();
      $('ls-sub-readme').textContent = `${existingReadme.split('\n').length} lines found`;
      markTag('tag-readme');
    } else {
      $('ls-sub-readme').textContent = 'No README found (will create)';
    }
  } catch {
    $('ls-sub-readme').textContent = 'Could not read README';
  }
  setLoadStep('readme', 'done');
  setProgress(30);

  // ── Call Gemini via backend ───────────────
  setLoadStep('gemini', 'active');
  let result = null;

  // Retry up to 2 times on failure
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const payload = {
        username: USERNAME,
        prompt: state.userPrompt,
        profile: state.profileData || { username: USERNAME, displayName: USERNAME, bio: '', followers: '0', publicRepos: String(repos.length) },
        repos: repos.slice(0, 20),
        existing_readme: existingReadme
      };

      const res = await fetch(`${BACKEND}/api/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Gemini-Key': state.geminiKey        // ← user's own key
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Backend error ${res.status}`);
      }

      result = await res.json();
      break; // success — exit retry loop

    } catch (err) {
      if (attempt === 2) {
        showError(`Analysis failed after 2 attempts: ${err.message}`);
        return;
      }
      $('ls-sub-gemini').textContent = `Attempt ${attempt} failed, retrying...`;
      await delay(2000);
    }
  }

  state.auditResult = result.audit;
  state.generatedReadme = result.readme;
  state.repoSuggestions = result.repo_suggestions;
  state.finalScore = result.audit.score_after || 91;

  setLoadStep('gemini', 'done');
  setProgress(60);

  setLoadStep('readme-gen', 'active');
  $('ls-sub-readme-gen').textContent = `${Object.values(state.enabledSections).filter(Boolean).length} sections ready`;
  await delay(500);
  setLoadStep('readme-gen', 'done');
  setProgress(80);

  setLoadStep('repos', 'active');
  $('ls-sub-repos').textContent = `${state.repoSuggestions?.length || 0} repos improved`;
  await delay(400);
  setLoadStep('repos', 'done');
  setProgress(100);

  await delay(400);
  renderAuditStep();
  goToStep(4);
}

async function fetchUserRepos() {
  const res = await fetch(
    `https://api.github.com/users/${USERNAME}/repos?sort=updated&per_page=30`,
    { headers: { Authorization: `Bearer ${state.token}`, 'User-Agent': 'GitHub-Pilot' } }
  );
  if (!res.ok) throw new Error('Failed to fetch repos');
  const repos = await res.json();
  return repos.map(r => ({
    id: r.id,
    name: r.name,
    full_name: r.full_name,
    description: r.description || '',
    topics: r.topics || [],
    language: r.language || '',
    stargazers_count: r.stargazers_count || 0,
    forks_count: r.forks_count || 0,
    updated_at: r.updated_at,
    private: r.private,
    fork: r.fork
  }));
}

/* ── STEP 4: AUDIT RENDER ─────────────────── */
function renderAuditStep() {
  const audit = state.auditResult;
  if (!audit) return;

  const score = audit.score_before || 42;
  $('score-num').textContent = score;
  $('score-title').textContent = score >= 70 ? 'Looking good!' : score >= 50 ? 'Needs some work' : 'Needs improvement';
  $('score-desc').textContent = audit.summary || 'Profile visibility can be improved';
  if (score >= 70) $('score-circle').classList.add('good');

  const breakdown = audit.breakdown || {
    bio: { score: 3, max: 10 }, readme: { score: 0, max: 10 },
    repos: { score: 8, max: 20 }, topics: { score: 4, max: 10 },
    activity: { score: 14, max: 20 }, keywords: { score: 3, max: 10 }
  };

  $('score-bars').innerHTML = Object.entries(breakdown).map(([key, val]) => {
    const pct = Math.round((val.score / val.max) * 100);
    const cls = pct < 40 ? 'low' : pct < 70 ? 'mid' : 'high';
    return `<div class="score-bar-row">
      <div class="sb-label">${capitalize(key)}</div>
      <div class="sb-track"><div class="sb-fill ${cls}" style="width:${pct}%"></div></div>
      <div class="sb-val">${val.score}/${val.max}</div>
    </div>`;
  }).join('');

  $('insight-list').innerHTML = (audit.insights || []).map(i => `
    <div class="insight-item">
      <div class="insight-dot ${i.type || 'blue'}"></div>
      <span>${i.text}</span>
    </div>`).join('');

  const SECTIONS = [
    { key: 'typing_header',   label: 'Animated typing header',  sub: `Hi, I'm ${USERNAME}...` },
    { key: 'about',           label: 'About me section',         sub: '2–3 line professional summary' },
    { key: 'tech_badges',     label: 'Tech stack badges',        sub: 'Python, FastAPI, LangChain...' },
    { key: 'stats',           label: 'GitHub stats card',        sub: 'Stars, commits, PRs, languages' },
    { key: 'trophies',        label: 'GitHub trophies',          sub: 'Achievement badges' },
    { key: 'visitor_counter', label: 'Visitor counter',          sub: 'Profile view count badge' },
    { key: 'contrib_graph',   label: 'Contribution graph',       sub: 'Activity snake animation' },
    { key: 'social_links',    label: 'Social links',             sub: 'LinkedIn, email, portfolio' }
  ];

  $('toggle-list').innerHTML = SECTIONS.map(s => `
    <div class="toggle-row">
      <div class="toggle-info">
        <div class="toggle-title">${s.label}</div>
        <div class="toggle-sub">${s.sub}</div>
      </div>
      <button class="toggle-switch ${state.enabledSections[s.key] ? '' : 'off'}"
              data-key="${s.key}" aria-label="Toggle ${s.label}"></button>
    </div>`).join('');

  document.querySelectorAll('.toggle-switch').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.key;
      state.enabledSections[key] = !state.enabledSections[key];
      btn.classList.toggle('off', !state.enabledSections[key]);
    });
  });

  const preview = state.generatedReadme || '<!-- README will appear here -->';
  $('readme-preview').textContent = preview.slice(0, 800) + (preview.length > 800 ? '\n\n...(truncated in preview)' : '');
}

function copyMarkdown() {
  navigator.clipboard.writeText(state.generatedReadme || '').then(() => {
    $('copy-markdown-btn').textContent = '✓ Copied!';
    setTimeout(() => {
      $('copy-markdown-btn').innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy markdown`;
    }, 2000);
  });
}

/* ── STEP 5: REVIEW ───────────────────────── */
function goToReview() {
  buildChangesList();
  goToStep(5);
}

function buildChangesList() {
  state.changes = [];

  state.changes.push({
    id: 'readme', type: 'readme',
    title: `Profile README (${USERNAME}/${USERNAME})`,
    oldVal: 'No professional README',
    newVal: `Professional README with ${Object.values(state.enabledSections).filter(Boolean).length} sections`,
    approved: true,
    applyFn: applyReadme
  });

  if (state.auditResult?.suggested_bio) {
    state.changes.push({
      id: 'bio', type: 'bio',
      title: 'GitHub bio',
      oldVal: state.profileData?.bio || 'No bio set',
      newVal: state.auditResult.suggested_bio,
      approved: true,
      applyFn: applyBio
    });
  }

  (state.repoSuggestions || []).forEach(suggestion => {
    const repo = state.repoData.find(r => r.name === suggestion.name);
    if (!repo) return;

    if (suggestion.description && suggestion.description !== repo.description) {
      state.changes.push({
        id: `desc-${repo.name}`, type: 'desc',
        title: `Repo: ${repo.name} — description`,
        oldVal: repo.description || 'No description',
        newVal: suggestion.description,
        approved: true,
        repoName: repo.name,
        applyFn: () => applyRepoDescription(repo.name, suggestion.description)
      });
    }

    if (suggestion.topics?.length) {
      state.changes.push({
        id: `topics-${repo.name}`, type: 'topics',
        title: `Repo: ${repo.name} — topics`,
        oldVal: repo.topics?.join(', ') || 'No topics',
        newTopics: suggestion.topics,
        approved: true,
        repoName: repo.name,
        applyFn: () => applyRepoTopics(repo.name, suggestion.topics)
      });
    }
  });

  renderChangesList();
}

function renderChangesList() {
  const approved = state.changes.filter(c => c.approved).length;
  $('approved-count').textContent = approved;
  $('apply-btn').textContent = `Apply approved changes (${approved})`;

  $('changes-list').innerHTML = state.changes.map(c => `
    <div class="change-item" data-id="${c.id}">
      <div class="change-header">
        <button class="change-checkbox ${c.approved ? '' : 'unchecked'}" data-id="${c.id}" aria-label="Toggle approval">
          ${c.approved ? `<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>` : ''}
        </button>
        <div class="change-title">${c.title}</div>
        <span class="change-type ${c.type}">${c.type}</span>
      </div>
      <div class="change-body">
        <div class="ba-old">${c.oldVal}</div>
        ${c.type === 'topics'
          ? `<div class="ba-new"><div class="topics-row">${c.newTopics.map(t => `<span class="topic-tag">${t}</span>`).join('')}</div></div>`
          : `<div class="ba-new">${c.newVal}</div>`}
      </div>
    </div>`).join('');

  document.querySelectorAll('.change-checkbox').forEach(btn => {
    btn.addEventListener('click', () => {
      const change = state.changes.find(c => c.id === btn.dataset.id);
      if (change) { change.approved = !change.approved; renderChangesList(); }
    });
  });
}

/* ── APPLY CHANGES ────────────────────────── */
async function applyChanges() {
  const toApply = state.changes.filter(c => c.approved);
  if (!toApply.length) return;
  $('apply-btn').disabled = true;
  $('apply-btn').textContent = 'Applying...';

  const applied = [], failed = [];
  for (const change of toApply) {
    try { await change.applyFn(); applied.push(change.title); }
    catch (err) { failed.push(`${change.title}: ${err.message}`); }
  }

  chrome.runtime.sendMessage({
    type: 'SAVE_AUDIT_LOG',
    log: {
      timestamp: new Date().toISOString(),
      username: USERNAME,
      score_before: state.auditResult?.score_before || 0,
      score_after: state.finalScore,
      applied, failed,
      prompt: state.userPrompt
    }
  });
  chrome.runtime.sendMessage({ type: 'SET_LAST_USED' });
  renderSuccessScreen(applied, failed);
  goToStep('success');
}

// BUG FIX 1: Use TextEncoder instead of btoa for emoji/unicode safety
async function applyReadme() {
  const readme = buildFinalReadme();

  // Safe base64 encoding that handles emojis and unicode
  const encoder = new TextEncoder();
  const bytes = encoder.encode(readme);
  let binary = '';
  bytes.forEach(b => binary += String.fromCharCode(b));
  const encoded = btoa(binary);

  // Get current SHA
  let sha = undefined;
  try {
    const existing = await fetch(
      `https://api.github.com/repos/${USERNAME}/${USERNAME}/contents/README.md`,
      { headers: { Authorization: `Bearer ${state.token}`, 'User-Agent': 'GitHub-Pilot' } }
    );
    if (existing.ok) { const d = await existing.json(); sha = d.sha; }
  } catch {}

  const res = await fetch(
    `https://api.github.com/repos/${USERNAME}/${USERNAME}/contents/README.md`,
    {
      method: 'PUT',
      headers: { Authorization: `Bearer ${state.token}`, 'Content-Type': 'application/json', 'User-Agent': 'GitHub-Pilot' },
      body: JSON.stringify({ message: 'Update profile README via GitHub Pilot ✨', content: encoded, ...(sha ? { sha } : {}) })
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to update README');
  }
}

function buildFinalReadme() {
  let readme = state.generatedReadme || '';
  if (!state.enabledSections.social_links)
    readme = readme.replace(/<!--SOCIAL_START-->[\s\S]*?<!--SOCIAL_END-->/g, '');
  if (!state.enabledSections.visitor_counter)
    readme = readme.replace(/<!--VISITOR_START-->[\s\S]*?<!--VISITOR_END-->/g, '');
  return readme;
}

async function applyBio() {
  const res = await fetch('https://api.github.com/user', {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${state.token}`, 'Content-Type': 'application/json', 'User-Agent': 'GitHub-Pilot' },
    body: JSON.stringify({ bio: state.auditResult.suggested_bio })
  });
  if (!res.ok) throw new Error('Failed to update bio');
}

async function applyRepoDescription(repoName, description) {
  const res = await fetch(`https://api.github.com/repos/${USERNAME}/${repoName}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${state.token}`, 'Content-Type': 'application/json', 'User-Agent': 'GitHub-Pilot' },
    body: JSON.stringify({ description })
  });
  if (!res.ok) throw new Error(`Failed to update ${repoName} description`);
}

// BUG FIX 2: Use correct topics API header (non-deprecated)
async function applyRepoTopics(repoName, topics) {
  // Sanitize topics: lowercase, hyphens only, max 50 chars each, max 20 topics
  const clean = topics
    .map(t => t.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').slice(0, 50))
    .filter(t => t.length > 0)
    .slice(0, 20);

  const res = await fetch(`https://api.github.com/repos/${USERNAME}/${repoName}/topics`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${state.token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'GitHub-Pilot',
      Accept: 'application/vnd.github+json'   // ← fixed: non-deprecated header
    },
    body: JSON.stringify({ names: clean })
  });
  if (!res.ok) throw new Error(`Failed to update ${repoName} topics`);
}

/* ── SUCCESS ──────────────────────────────── */
function renderSuccessScreen(applied, failed) {
  $('sj-before').textContent = state.auditResult?.score_before || 42;
  $('sj-after').textContent = state.finalScore || 91;
  const items = [
    ...applied.map(a => `<div class="applied-item"><div class="applied-dot"></div><span>${a}</span></div>`),
    ...failed.map(f => `<div class="applied-item" style="color:#dc2626"><div class="applied-dot" style="background:#dc2626"></div><span>${f}</span></div>`)
  ];
  $('applied-summary').innerHTML = items.join('');
}

function viewAuditLog() {
  chrome.storage.local.get(['audit_logs'], ({ audit_logs = [] }) => {
    const latest = audit_logs[0];
    if (latest) alert(`Latest audit:\n${latest.timestamp}\nScore: ${latest.score_before} → ${latest.score_after}\nApplied: ${latest.applied.join(', ')}`);
    else alert('No audit logs saved yet.');
  });
}

/* ── ERROR ────────────────────────────────── */
function showError(msg) {
  document.querySelectorAll('.step-view').forEach(v => v.style.display = 'none');
  $('step-error').style.display = 'flex';
  $('error-msg').textContent = msg;
}

/* ── HELPERS ──────────────────────────────── */
function setLoadStep(key, status) {
  const icon = $(`ls-icon-${key}`);
  if (!icon) return;
  icon.className = `ls-icon ${status}`;
  const title = icon.closest('.load-step')?.querySelector('.ls-title');
  if (title) title.className = `ls-title${status === 'active' ? ' active' : ''}`;
}
function setProgress(pct) { $('load-progress-bar').style.width = `${pct}%`; }
function delay(ms) { return new Promise(r => setTimeout(r, ms)); }
function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

/* ── BOOT ─────────────────────────────────── */
init();
