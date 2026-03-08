# WellBeing App - Multi-Implementation Repository

This repository contains the WellBeing wellness app with space for multiple implementations (frontend/backend variations).

## 📁 Repository Structure

```
Wats_Next/
├── .gitignore              # Git ignore rules
├── README.md               # This file
└── base/                   # Reference implementation (Next.js 14 full-stack)
    ├── src/                # Source code
    ├── docs/               # Documentation
    ├── public/             # Static assets
    ├── package.json        # Dependencies
    └── ...                 # Config files
```

## 🚀 Base Implementation

The `base/` folder contains the reference implementation using:
- **Frontend + Backend:** Next.js 14 (App Router) with TypeScript
- **Pose Detection:** MediaPipe Pose (client-side)
- **Database:** MongoDB Atlas
- **AI:** Google Gemini API
- **Styling:** Tailwind CSS with custom dark theme

### Quick Start

```bash
cd base
npm install
npm run dev
```

Open http://localhost:3000

See [base/README.md](./base/README.md) for complete documentation.

## 🎯 Features

### ✅ Completed
- **Feature 1:** Exercise Tracker (Bicep Curl with real-time form analysis)

### 🚧 Planned
- Feature 2: Nutrition Tracker
- Feature 3: Skin Analysis
- Feature 4: Hair Analysis
- Feature 5: Sleep Tracking
- Feature 6: Supplement Tracker
- And more... (see [base/docs/PLAN 1.md](./base/docs/PLAN%201.md))

## 🔧 Adding Your Own Implementation

You can add alternative implementations alongside the base:

```bash
# Example structure
Wats_Next/
├── base/                   # Reference implementation
├── backend-python/         # Your Python backend
├── frontend-vue/           # Your Vue.js frontend
└── mobile-app/             # Your React Native app
```

Each implementation can share the same project concepts while using different tech stacks.

## 📚 Documentation

All documentation is in [`base/docs/`](./base/docs/):
- Project plans and architecture
- Implementation guides
- Session summaries
- API documentation

## 🤝 Contributing

This is a personal project, but the structure allows for experimentation with different tech stacks and approaches.

## 📝 License

Private project
