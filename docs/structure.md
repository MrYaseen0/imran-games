# Structure — Imran Games

Repo root is this folder (`imran-games-deploy/`). It is the deploy
source: Vercel deploys by file upload from here, and the Vercel
project has no git link. There is no build step and no `node_modules`.

```
imran-games-deploy/
├── AGENTS.md               # router — read first (<200 lines)
├── README.md               # human intro (older; AGENTS.md + docs/ are current)
├── index.html              # shop (the whole storefront)
├── styles.css              # the only stylesheet
├── adminaccess/
│   └── index.html          # hidden admin panel (/adminaccess)
├── category/               # 11 generated category pages
├── products/               # 42 generated product pages
├── vendor/                 # self-hosted, pinned JS (no CDN)
│   ├── supabase-js-2.119.1.min.js
│   └── chart-4.4.1.umd.min.js
├── migrations/             # SQL applied live, dated, one fix per file
│   ├── 2026-11-19-c01-admin-flag.sql
│   ├── 2026-11-19-h03-lockout.sql
│   └── 2026-11-19-reserve-stock-race.sql
├── docs/                   # this knowledge base
│   ├── architecture.md
│   ├── security.md
│   ├── structure.md        # this file
│   ├── files.md
│   ├── design.md
│   └── CHANGELOG.md
├── build_pages.py          # generates category/ + products/ + sitemap.xml
├── products.json           # 42-product catalogue snapshot (generated data)
├── sitemap.xml             # 54 real URLs (42 products + 11 categories + home)
├── robots.txt              # allows AI crawlers (incl. OAI/ChatGPT/Perplexity/Claude bots)
├── llms.txt                # AI-readable store summary
├── supabase.sql            # reviewed schema source of truth — NOT deployed (404 live)
├── vercel.json             # redirects + security headers
├── logo.png / logo-small.png
└── <verification>.txt      # Google Search Console verification file (do not delete)
```

## Why it is organised this way

- **Flat + static on purpose.** One shop page, one admin page, one
  stylesheet. A new reader can hold the whole frontend in their head;
  there is no framework to learn and no build to break.
- **Generated pages are outputs, not hand-written.** `category/` and
  `products/` are produced by `build_pages.py` from the catalogue.
  Edit the generator or the catalogue, re-run it, deploy — never
  hand-edit a generated page and expect it to survive.
- **`vendor/` is pinned on purpose.** After M-02, app JS has zero CDN
  dependencies. Upgrading a vendor file means replacing the file and
  updating every reference to its versioned filename.
- **`migrations/` is the applied history.** Each file is one dated fix
  that was run live. `supabase.sql` is the consolidated, reviewed
  result. Keep both in sync; if they disagree, the migration that was
  actually applied wins and `supabase.sql` must be corrected.
- **`supabase.sql` stays in the repo but out of the deploy.** It
  documents the schema; serving it publicly (H-06) leaked the schema.
  `vercel.json` / deploy config excludes it.
- **`docs/` is the second layer.** `AGENTS.md` stays short and routes;
  detail lives here so no single file grows past what an agent (or a
  human) will actually read. See `AGENTS.md` for the rule.
- **Audit evidence lives outside this repo** (audit reports folder),
  not in `docs/`. This knowledge base summarises what was proved;
  it does not duplicate the full reports.
