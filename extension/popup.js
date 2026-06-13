const $ = id => document.getElementById(id);

function showView(name) {
  $('view-setup').style.display = name === 'setup' ? 'flex' : 'none';
  $('view-connected').style.display = name === 'connected' ? 'flex' : 'none';
}

async function loadState() {
  const { gh_token, gh_username, gemini_key, last_used } =
    await chrome.storage.sync.get(['gh_token', 'gh_username', 'gemini_key', 'last_used']);

  if (gh_token && gh_username && gemini_key) {
    $('header-sub').textContent = `@${gh_username} · ready`;
    $('status-dot').classList.add('connected');
    $('connected-username').textContent = `@${gh_username}`;
    $('info-username').textContent = gh_username;
    $('info-last').textContent = last_used ? new Date(last_used).toLocaleDateString() : 'Never';
    showView('connected');
  } else {
    $('header-sub').textContent = 'Setup required';
    $('status-dot').classList.remove('connected');
    showView('setup');
  }
}

// Eye toggle factory
function makeEyeToggle(btnId, inputId) {
  $(btnId).addEventListener('click', () => {
    const inp = $(inputId);
    inp.type = inp.type === 'password' ? 'text' : 'password';
  });
}
makeEyeToggle('eye-btn-token', 'token-input');
makeEyeToggle('eye-btn-gemini', 'gemini-input');

function validateGitHubToken(t) {
  return t && (t.startsWith('ghp_') || t.startsWith('github_pat_')) && t.length > 20;
}
function validateGeminiKey(k) {
  return k && k.startsWith('AIza') && k.length > 20;
}

async function verifyGitHubToken(token) {
  try {
    const res = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${token}`, 'User-Agent': 'GitHub-Pilot-Extension' }
    });
    if (!res.ok) return null;
    return (await res.json()).login;
  } catch { return null; }
}

$('save-btn').addEventListener('click', async () => {
  const token = $('token-input').value.trim();
  const gemini = $('gemini-input').value.trim();

  $('token-error').style.display = 'none';
  $('gemini-error').style.display = 'none';

  let valid = true;
  if (!validateGitHubToken(token)) {
    $('token-error').style.display = 'block';
    valid = false;
  }
  if (!validateGeminiKey(gemini)) {
    $('gemini-error').style.display = 'block';
    valid = false;
  }
  if (!valid) return;

  $('save-btn').disabled = true;
  $('save-btn').textContent = 'Verifying...';

  const username = await verifyGitHubToken(token);
  if (!username) {
    $('token-error').textContent = 'Token verification failed. Check permissions.';
    $('token-error').style.display = 'block';
    $('save-btn').disabled = false;
    $('save-btn').textContent = 'Save & connect';
    return;
  }

  await chrome.storage.sync.set({ gh_token: token, gh_username: username, gemini_key: gemini });
  await loadState();
});

$('update-btn').addEventListener('click', () => {
  $('token-input').value = '';
  $('gemini-input').value = '';
  showView('setup');
});

$('clear-btn').addEventListener('click', async () => {
  if (confirm('Disconnect and clear all saved keys?')) {
    await chrome.storage.sync.remove(['gh_token', 'gh_username', 'gemini_key', 'last_used']);
    await loadState();
  }
});

loadState();
