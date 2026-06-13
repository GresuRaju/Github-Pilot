(() => {
  'use strict';

  const SIDEBAR_ID = 'github-pilot-sidebar';
  const FAB_ID = 'github-pilot-fab';

  function isProfilePage() {
    const path = window.location.pathname;
    const parts = path.split('/').filter(Boolean);
    if (parts.length !== 1) return false;
    const username = parts[0];
    const invalid = ['login', 'signup', 'explore', 'marketplace', 'topics', 'trending', 'collections', 'events', 'about', 'contact', 'pricing', 'features', 'team', 'security', 'enterprise', 'pulls', 'issues', 'notifications', 'settings', 'organizations', 'apps', 'new', 'orgs'];
    return !invalid.includes(username.toLowerCase());
  }

  function getUsername() {
    const path = window.location.pathname;
    return path.split('/').filter(Boolean)[0] || null;
  }

  function injectFAB() {
    if (document.getElementById(FAB_ID)) return;

    const fab = document.createElement('button');
    fab.id = FAB_ID;
    fab.innerHTML = `<span class="gp-fab-icon">✨</span><span class="gp-fab-text">Make My GitHub Professional</span>`;
    fab.setAttribute('aria-label', 'Open GitHub Pilot');

    fab.addEventListener('click', () => {
      chrome.storage.sync.get(['gh_token'], ({ gh_token }) => {
        if (!gh_token) {
          chrome.runtime.sendMessage({ type: 'OPEN_POPUP' });
          showFloatNotice('Please set up your GitHub token first — click the ✨ extension icon.');
          return;
        }
        toggleSidebar();
      });
    });

    document.body.appendChild(fab);
  }

  function toggleSidebar() {
    const existing = document.getElementById(SIDEBAR_ID);
    if (existing) {
      existing.classList.toggle('gp-sidebar-open');
      return;
    }
    injectSidebar();
  }

  function injectSidebar() {
    const overlay = document.createElement('div');
    overlay.id = SIDEBAR_ID;
    overlay.className = 'gp-sidebar-overlay';

    const iframe = document.createElement('iframe');
    iframe.src = chrome.runtime.getURL('sidebar.html') + `?username=${getUsername()}&origin=${encodeURIComponent(window.location.origin)}`;
    iframe.className = 'gp-sidebar-iframe';
    iframe.setAttribute('allow', 'clipboard-write');
    iframe.setAttribute('title', 'GitHub Pilot Sidebar');

    overlay.appendChild(iframe);
    document.body.appendChild(overlay);

    requestAnimationFrame(() => overlay.classList.add('gp-sidebar-open'));

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.classList.remove('gp-sidebar-open');
    });

    window.addEventListener('message', (e) => {
      if (e.data?.type === 'GP_CLOSE_SIDEBAR') {
        overlay.classList.remove('gp-sidebar-open');
      }
      if (e.data?.type === 'GP_GET_PROFILE_DATA') {
        const data = scrapeProfileData();
        iframe.contentWindow.postMessage({ type: 'GP_PROFILE_DATA', data }, '*');
      }
    });
  }

  function scrapeProfileData() {
    const username = getUsername();

    const bioEl = document.querySelector('[data-bio-text]') ||
                  document.querySelector('.p-note .js-user-profile-bio') ||
                  document.querySelector('.user-profile-bio');
    const bio = bioEl ? bioEl.textContent.trim() : '';

    const nameEl = document.querySelector('[itemprop="name"]') ||
                   document.querySelector('.p-name');
    const displayName = nameEl ? nameEl.textContent.trim() : username;

    const followersEl = document.querySelector('a[href$="?tab=followers"] span') ||
                        document.querySelector('.js-profile-editable-area .text-bold');
    const followers = followersEl ? followersEl.textContent.trim() : '0';

    const followingEl = document.querySelector('a[href$="?tab=following"] span');
    const following = followingEl ? followingEl.textContent.trim() : '0';

    const locationEl = document.querySelector('[itemprop="homeLocation"] span') ||
                       document.querySelector('.p-label');
    const location = locationEl ? locationEl.textContent.trim() : '';

    const websiteEl = document.querySelector('[itemprop="url"] a') ||
                      document.querySelector('.p-url a');
    const website = websiteEl ? websiteEl.href : '';

    const pinnedRepos = [];
    document.querySelectorAll('.js-pinned-items-reorder-container li, .pinned-item-list-item').forEach(el => {
      const nameEl = el.querySelector('.repo, [data-hovercard-type="repository"] span:last-child');
      const descEl = el.querySelector('.pinned-item-desc');
      const langEl = el.querySelector('[itemprop="programmingLanguage"]');
      const starsEl = el.querySelector('a[href*="stargazers"]');
      if (nameEl) {
        pinnedRepos.push({
          name: nameEl.textContent.trim(),
          description: descEl ? descEl.textContent.trim() : '',
          language: langEl ? langEl.textContent.trim() : '',
          stars: starsEl ? starsEl.textContent.trim() : '0'
        });
      }
    });

    const repoCount = document.querySelector('[href$="?tab=repositories"] .Counter') ||
                      document.querySelector('a[href$="tab=repositories"] .Counter');
    const publicRepos = repoCount ? repoCount.textContent.trim() : '0';

    const contributionText = document.querySelector('.js-yearly-contributions h2, .f4.text-normal');
    const contributions = contributionText ? contributionText.textContent.trim() : '';

    return {
      username,
      displayName,
      bio,
      followers,
      following,
      location,
      website,
      pinnedRepos,
      publicRepos,
      contributions,
      pageUrl: window.location.href,
      scrapedAt: new Date().toISOString()
    };
  }

  function showFloatNotice(msg) {
    const existing = document.getElementById('gp-float-notice');
    if (existing) existing.remove();
    const notice = document.createElement('div');
    notice.id = 'gp-float-notice';
    notice.textContent = msg;
    document.body.appendChild(notice);
    setTimeout(() => notice.remove(), 4000);
  }

  function init() {
    if (!isProfilePage()) return;
    injectFAB();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  const observer = new MutationObserver(() => {
    if (isProfilePage() && !document.getElementById(FAB_ID)) injectFAB();
  });
  observer.observe(document.body, { childList: true, subtree: false });

})();
