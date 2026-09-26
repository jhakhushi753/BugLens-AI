# BugLens Dashboard

The dashboard is a React and Vite investigation workspace. It includes sample failures, an evidence intake form, structured reports, review flags, JSON export, ShopSphere failure import, and ShopSphere source export.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3001. Reports are saved in this browser's local storage. With ShopSphere running on port 8000, **Import ShopSphere** imports starter and captured failures, and **Export application** downloads the source ZIP. The current investigator uses evidence-based local rules; it does not connect to a remote AI service or database.

## Build

```bash
npm run build
```

The included Dockerfile builds and serves the dashboard on port 3001.
