# ✨ GitHub Pilot

> **Transform your GitHub profile into a recruiter-ready portfolio — in seconds.**
> Powered by Gemini Flash 2.5 · Chrome MV3 Extension · Zero hosting cost

---

## Table of Contents

- [What It Does](#what-it-does)
- [Prerequisites](#prerequisites)
- [Step 1 — Get Your Gemini API Key](#step-1--get-your-gemini-api-key)
- [Step 2 — Create a Fine-Grained GitHub Token](#step-2--create-a-fine-grained-github-token)
- [Step 3 — Install & Configure the Extension](#step-3--install--configure-the-extension)
- [Step 4 — Run Your First Profile Audit](#step-4--run-your-first-profile-audit)
- [Sample Prompt](#sample-prompt)
- [How It Works](#how-it-works)
- [Project Structure](#project-structure)
- [Local Backend Setup](#local-backend-setup)
- [FAQ](#faq)

---

## What It Does

GitHub Pilot injects a **✨ floating button** on any `github.com/<username>` page. One click opens a sidebar where you:

1. Describe the role you're targeting (see [Sample Prompt](#sample-prompt))
2. Watch the extension scrape your profile + repos via GitHub API
3. Review a **before / after diff** for every change — bio, README, repo descriptions, topics
4. Hit **Apply** — changes are written directly to GitHub via the API

You bring your own Gemini API key. Zero cost on the hosting side.

---

## Prerequisites

| Requirement | Notes |
|---|---|
| Google Chrome (or Chromium) | MV3 support required |
| A GitHub account | The profile you want to transform |
| A Google account | To generate a free Gemini API key |
| Python 3.10+ | For the local FastAPI backend |

---

## Step 1 — Get Your Gemini API Key

The extension uses **Gemini Flash 2.5** via Google AI Studio. The free tier is sufficient for personal use.

### 1.1 Open Google AI Studio

Go to → [https://aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)

Sign in with your Google account if prompted.

### 1.2 Create an API Key

1. Click **"Create API key"**
2. Select **"Create API key in new project"** (or choose an existing Google Cloud project)
3. Copy the generated key — it looks like:
   ```
   AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
   ```

> ⚠️ **Keep this key private.** Do not commit it to any repository. GitHub Pilot stores it locally in `chrome.storage.sync` and sends it per-request as a header — it is never logged or stored on the backend.

### 1.3 Verify the Key Works (Optional)

```bash
curl -s \
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"contents":[{"parts":[{"text":"Hello"}]}]}'
```

A valid response will contain `"candidates"` in the JSON. If you see `"API_KEY_INVALID"`, regenerate the key.

---

## Step 2 — Create a Fine-Grained GitHub Token

GitHub Pilot needs permission to **read your profile data** and **write changes** (bio, README, repo descriptions, topics). A fine-grained token lets you grant only those permissions — nothing else.

### 2.1 Open GitHub Token Settings

Go to → [https://github.com/settings/tokens?type=beta](https://github.com/settings/tokens?type=beta)

*(Settings → Developer settings → Personal access tokens → Fine-grained tokens)*

### 2.2 Click "Generate new token"

Fill in the form:

| Field | Value |
|---|---|
| **Token name** | `github-pilot-extension` (or any name you prefer) |
| **Expiration** | 90 days (recommended) or custom |
| **Resource owner** | Your GitHub username |

### 2.3 Set Repository Access

Under **"Repository access"**, select:

```
✅ Only select repositories
```

Then choose the repositories you want GitHub Pilot to be able to update (e.g. your profile README repo `<username>/<username>`).

> Alternatively, select **"All repositories"** if you want Pilot to update repo descriptions and topics across all your repos.

### 2.4 Set Permissions

Expand **"Repository permissions"** and set:

| Permission | Access Level |
|---|---|
| **Contents** | Read and write |
| **Metadata** | Read-only (auto-selected) |

Expand **"Account permissions"** and set:

| Permission | Access Level |
|---|---|
| **Profile** | Read and write |

> All other permissions should remain **No access**.

### 2.5 Generate and Copy the Token

Click **"Generate token"**. Copy the token immediately — it starts with `github_pat_` and is shown only once:

```
github_pat_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

Store it somewhere safe (password manager) before closing the page.

---

## Step 3 — Install & Configure the Extension

### 3.1 Clone the Repository

```bash
git clone https://github.com/<your-username>/github-pilot.git
cd github-pilot
```

### 3.2 Load the Extension in Chrome

1. Open Chrome and navigate to `chrome://extensions`
2. Enable **Developer mode** (toggle in the top-right corner)
3. Click **"Load unpacked"**
4. Select the `extension/` folder inside the cloned repo

The GitHub Pilot icon will appear in your Chrome toolbar.

### 3.3 Start the Local Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn app:app --reload --port 8000
```

The FastAPI server runs at `http://localhost:8000`. Keep this terminal open while using the extension.

### 3.4 Enter Your Keys in the Extension

1. Click the GitHub Pilot icon in the Chrome toolbar
2. The **Setup popup** will open
3. Paste your **GitHub Fine-Grained Token** → click Save
4. Paste your **Gemini API Key** → click Save

Both keys are stored in `chrome.storage.sync` (encrypted, local to your browser profile).

---

## Step 4 — Run Your First Profile Audit

1. Navigate to your GitHub profile: `https://github.com/<your-username>`
2. A **✨ floating button** appears in the bottom-right corner of the page
3. Click it — the **GitHub Pilot sidebar** opens
4. Paste your prompt into the text area (see [Sample Prompt](#sample-prompt) below)
5. Click **"Analyze Profile"**

The sidebar will walk you through 5 steps:

```
Step 1 → Extracting profile data
Step 2 → Sending to Gemini Flash 2.5
Step 3 → Parsing audit results
Step 4 → Generating README
Step 5 → Ready for review
```

Once complete, review each proposed change in the **before / after view**. Toggle changes on or off, then click **"Apply Selected"** to write them to GitHub.

---

## Sample Prompt

Copy and customize this prompt. Replace the placeholder sections with your actual details before pasting it into the GitHub Pilot sidebar.

```
Create a modern, professional, ATS-friendly GitHub Profile README for a
[ADD YOUR GRADUATION STREAM — e.g. B.Tech Computer Science / AI & ML]
seeking entry-level Software Developer, Backend Developer, Python Developer,
FastAPI Developer, AI/ML Engineer, and Data Analytics roles.

Design Requirements:
- Clean, modern, recruiter-friendly layout
- Professional appearance suitable for hiring managers
- ATS-friendly wording
- Focus on technical skills, projects, achievements, and impact
- Minimal emojis
- Use professional badges and GitHub widgets
- Include sections for About Me, Skills, Projects, Achievements,
  Coding Profiles, GitHub Stats, Contact Information, and Social Links

Profile Owner Details:
Name: [YOUR FULL NAME]
Education: [DEGREE, BRANCH — College Name, Graduation Year]
Career Interests:
  - Backend Development
  - Python Development
  - FastAPI Development
  - AI/ML Engineering
  - Data Analytics

Technical Skills:
  [List your languages, frameworks, tools, databases, and cloud platforms]

Projects:
  [List 2–4 projects with: name, one-line description, tech stack, impact/metrics]

Achievements:
  [Certifications, hackathons, rankings, publications, or academic awards]

Current Learning:
  [What you're actively studying or building right now]

Open To:
  - Entry-Level Software Developer Roles
  - Backend Developer Roles
  - Python Developer Roles
  - FastAPI Developer Roles
  - AI/ML Engineer Roles
  - Internships
  - Freelance Opportunities

Links:
LinkedIn:   YOUR_LINKEDIN_URL
GitHub:     YOUR_GITHUB_URL
Portfolio:  YOUR_PORTFOLIO_URL
LeetCode:   YOUR_LEETCODE_URL
GeeksforGeeks: YOUR_GFG_URL

Generate a complete professional GitHub Profile README in Markdown that
looks like a software engineer portfolio and helps attract recruiters.
```

> **Tip:** The more specific you are in the Projects and Achievements sections, the better the output. Include numbers where possible — "Reduced API response time by 40%" beats "Optimized API performance".

---

## How It Works

```
github.com/<username>
        │
        ▼
  content.js injects ✨ FAB button
        │
        ▼
  sidebar.js opens — user pastes prompt
        │
        ▼
  GitHub API + DOM scraping
  (repos, bio, pinned, topics, languages)
        │
        ▼
  POST /api/analyze  ──────────────────────────────────────────┐
  X-Gemini-Key: <user's key>                                   │
  X-GitHub-Token: <user's token>                               │
                                                               ▼
                                              FastAPI backend (localhost:8000)
                                                    │
                                                    ▼
                                          gemini.py → Gemini Flash 2.5
                                                    │
                                                    ▼
                                          readme_builder.py
                                          (badges, shields.io, sections)
                                                    │
                                                    ▼
                                          Returns: audit JSON + README markdown
        │
        ▼
  sidebar shows before / after diff
        │
        ▼
  User clicks Apply
        │
        ▼
  extension writes to GitHub API
  (PATCH /user, PUT /repos/:repo/contents/README.md,
   PUT repo descriptions, PUT topics)
```

---

## Project Structure

```
github-pilot/
├── extension/
│   ├── manifest.json          # Chrome MV3 config, permissions
│   ├── popup.html             # One-time setup: token + API key entry
│   ├── popup.js
│   ├── popup.css
│   ├── content.js             # Injects FAB button on github.com/<username>
│   ├── content.css
│   ├── sidebar.html           # 5-step workflow UI
│   ├── sidebar.js
│   ├── sidebar.css
│   └── background.js          # Service worker, audit log storage
│
├── backend/
│   ├── app.py                 # FastAPI app with CORS
│   ├── requirements.txt
│   └── routes/
│       └── analyze.py         # POST /api/analyze
│   └── services/
│       ├── gemini.py          # Gemini Flash 2.5 caller + JSON parser
│       └── readme_builder.py  # 30+ tech badges, README post-processor
│   └── prompts/
│       └── templates.py       # Audit prompt + README generation prompt
│   └── models/
│       └── schemas.py         # Pydantic models
│
└── README.md
```

---

## Local Backend Setup

```bash
# 1. Create a virtual environment
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

# 2. Install dependencies
pip install -r backend/requirements.txt

# 3. Start the server
cd backend
uvicorn app:app --reload --port 8000

# Server is now running at:
#   http://localhost:8000
#   http://localhost:8000/docs  ← Swagger UI for testing
```

The backend does **not** require any environment variables — your Gemini key is sent per-request from the extension via the `X-Gemini-Key` header.

---

## FAQ

**Q: Is my Gemini API key safe?**
Your key is stored in `chrome.storage.sync` (browser-encrypted, tied to your Chrome profile). It is sent only to your local backend as a request header and is never logged, stored in a database, or sent to any third-party server.

**Q: Is my GitHub token safe?**
Same as above. The token is stored locally and used only to call the official GitHub REST API on your behalf.

**Q: Do I need to keep the backend running?**
Yes. The FastAPI backend must be running at `localhost:8000` while you use the extension. The extension communicates with it for all AI processing.

**Q: Can I use a different Gemini model?**
The backend is configured for `gemini-2.5-flash`. You can change the model string in `backend/services/gemini.py` if you have access to other models.

**Q: The FAB button doesn't appear on my profile — why?**
Make sure you are on a page matching `github.com/<username>` (not a repo page). Also confirm the extension is enabled at `chrome://extensions` and that you are not browsing in Incognito mode without explicitly enabling the extension there.

**Q: I get a JSON parse error from Gemini — what do I do?**
The backend includes a multi-stage `extract_json()` fixer for malformed Gemini responses. If it still fails, try rephrasing your prompt to be more concise. Very long prompts can cause truncated responses.

---

## Contributing

Pull requests are welcome. For major changes, open an issue first to discuss what you'd like to change.

---

## License

MIT License — see `LICENSE` for details.
