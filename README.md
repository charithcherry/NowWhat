# WhatNow

WhatNow is a multi-app wellness platform that combines fitness coaching, workout analytics, nutrition planning, restaurant discovery, skin and hair analysis, and a community experience into one connected system.

The codebase is organized as several independent Next.js services that share authentication, data, and navigation context across the platform.

## Architecture

The repository currently contains six user-facing services:

```text
NowWhat/
|- base/                   # Port 3000 - login, profile, landing page, AI fitness coach
|- skin-hair-analysis/     # Port 3002 - skin/hair profile, image analysis, recommendations
|- nutrition-wellness/     # Port 3003 - pantry planner, dish optimizer, recipes, insights
|- nutrition-yelp/         # Port 3004 - restaurant discovery, health scoring, food scan
|- fitness-dashboard/      # Port 3005 - workout analytics and trends
|- community/              # Port 3006 - posts, events, mood check-ins, people-like-you
|- docs/                   # Project notes, deployment docs, implementation details
```

High-level flow:

- `base` acts as the main entry point and navigation hub.
- Each module exposes its own UI and API routes.
- MongoDB stores shared user, session, and feature data.
- Gemini powers generation and image-understanding features where unstructured AI is useful.
- Deterministic backend logic handles validation, filtering, scoring, persistence, and fallbacks.

## Main Features

### Shared authentication

- Email/password registration and login
- Shared session-token authentication across all services
- Secure `httpOnly` auth cookie
- Cross-origin auth handoff routes so users can move between services without re-logging in

### AI fitness coach

- Voice-first fitness workflow in the `base` app
- User can request an exercise and generate an analyzer for it
- MediaPipe Pose-based live tracking
- Rep counting, form checks, and spoken feedback
- Session logging to MongoDB

### Fitness dashboard

- Session totals and rep totals
- Form, posture, arm-position, and visibility analytics
- Joint symmetry charts
- Daily rep timeline and trend charts
- Mood-linked motivation view

### Nutrition wellness

- Nutrition profile with goals, calorie targets, protein targets, preferences, allergies, and restrictions
- Pantry meal generation
- Authentic dish optimization with identity-preserving validation
- Recipe library with save, search, filter, duplicate, and tweak flows
- Custom recipe creation
- Wellness insight cards and session-memory summaries

### Restaurants and food scan

- Yelp restaurant search by location, category, price, and sort
- AI-generated restaurant health scoring
- Saved favorites and dining-behavior tracking
- Food image scan for calorie and macro estimates

### Skin and hair analysis

- Skin/hair profile management
- Face and scalp image analysis
- Loved products tracking
- Product recommendation generation
- Rule-based wellness insight generation
- Raw uploaded image bytes are discarded after analysis

### Community

- Discussion feed with posts, comments, tags, and upvotes
- Wellness events with RSVP
- Mood check-ins and recent mood history
- "People Like You" discovery

### Cross-module assistant

- Floating `What Now? Agent` UI in multiple apps
- Rebuilds a user context summary from recent activity across modules
- Uses backend tooling to verify personal-data questions against MongoDB instead of guessing

## Tech Stack

- Frontend: Next.js 14 App Router, React, TypeScript
- Styling: Tailwind CSS
- Database: MongoDB
- Authentication: shared opaque session tokens validated against MongoDB
- AI: Google Gemini API
- Fitness pose tracking: MediaPipe Pose
- Charts and motion: Recharts, Framer Motion
- Voice: Web Speech API, optional ElevenLabs integration
- External APIs and datasets: Yelp Fusion, Open Beauty Facts

## Authentication Model

The implemented auth flow is:

1. A user logs in through the `base` app.
2. The server creates a random opaque session token.
3. That token is stored in the MongoDB `sessions` collection with an expiry.
4. The browser receives the token in a secure `httpOnly` `auth_token` cookie.
5. When the user opens another service, an auth handoff route creates a short-lived handoff grant and sets the same session token cookie on the target origin.
6. Each service validates the cookie by looking up the session in MongoDB.
7. Logout deletes the stored session and clears the cookie.

This gives centralized session invalidation and consistent login state across services.

## Local Development

### Prerequisites

- Node.js 20+
- npm
- MongoDB connection string
- Gemini API key
- Yelp API key for `nutrition-yelp`

### 1. Install dependencies

From the repo root:

```bash
npm run setup
```

### 2. Create local env files

Copy each app's example env file to `.env.local`:

- `base/.env.local.example`
- `skin-hair-analysis/.env.local.example`
- `nutrition-wellness/.env.local.example`
- `nutrition-yelp/.env.local.example`
- `fitness-dashboard/.env.local.example`
- `community/.env.local.example`

Common variables used across apps:

```env
MONGODB_URI=...
MONGODB_DB=wellbeing_app
GEMINI_API_KEY=...
NEXT_PUBLIC_BASE_URL=http://localhost:3000
NEXT_PUBLIC_FITNESS_URL=http://localhost:3005
NEXT_PUBLIC_NUTRITION_URL=http://localhost:3003
NEXT_PUBLIC_RESTAURANTS_URL=http://localhost:3004
NEXT_PUBLIC_SKIN_URL=http://localhost:3002
NEXT_PUBLIC_COMMUNITY_URL=http://localhost:3006
```

Service-specific extras:

- `nutrition-yelp`: `YELP_API_KEY`
- `base`: optional `NEXT_PUBLIC_ELEVENLABS_API_KEY`
- `nutrition-wellness`: optional `NUTRITION_MEMORY_CRON_SECRET`

Note:

- Some env examples still include legacy `JWT_SECRET` fields from an older auth approach. Those are stale compatibility leftovers and are not the active auth mechanism described above.

### 3. Start all services

From the repo root:

```bash
npm run dev
```

This starts:

- `base` on `http://localhost:3000`
- `skin-hair-analysis` on `http://localhost:3002`
- `nutrition-wellness` on `http://localhost:3003`
- `nutrition-yelp` on `http://localhost:3004`
- `fitness-dashboard` on `http://localhost:3005`
- `community` on `http://localhost:3006`

Then open:

```text
http://localhost:3000
```

### 4. Start services individually

If needed:

```bash
cd base && npm run dev
cd skin-hair-analysis && npm run dev
cd nutrition-wellness && npm run dev
cd nutrition-yelp && npm run dev
cd fitness-dashboard && npm run dev
cd community && npm run dev
```

## Data Overview

Important collections used across the platform include:

- `users`
- `sessions`
- `user_profiles`
- `fitness_sessions`
- `fitness_exercise_biomechanics`
- `nutrition_profiles`
- `pantry_items`
- `generated_recipes`
- `saved_recipes`
- `recipe_modifications`
- `nutrition_insight_memory`
- `nutrition_sessions_summary`
- `skin_hair_profiles`
- `skin_logs`
- `hair_logs`
- `loved_products`
- `product_recommendations`
- `favorites`
- `clicks`
- `community_posts`
- `community_comments`
- `community_moods`
- `community_events`
- `community_connections`

## Deployment

Each service includes its own deployment assets, including Dockerfiles and env examples under each service's `deployment/` directory.

The current deployment docs target containerized deployment, with the broader repository plan documented in:

- `DEPLOYMENT.md`
- `base/deployment/README.md`
- `community/deployment/README.md`
- `fitness-dashboard/deployment/README.md`
- `nutrition-wellness/deployment/README.md`
- `nutrition-yelp/deployment/README.md`
- `skin-hair-analysis/deployment/README.md`

## Documentation

Additional notes live in `docs/`, including:

- `docs/HOW_TO_RUN.md`
- `docs/SESSION_NOTES.md`
- `docs/AUTH_IMPLEMENTATION.md`
- `docs/AUTHENTICATION_SUMMARY.md`

## Troubleshooting

### App-to-app navigation fails

- Check the `NEXT_PUBLIC_*_URL` variables in every app's `.env.local`.
- Make sure all apps are running on the expected localhost ports.

### Authentication fails across modules

- Confirm the `base` app can create sessions in MongoDB.
- Confirm the target service can reach the same MongoDB instance.
- Check that cross-app handoff URLs match your local ports.

### AI features fail

- Verify `GEMINI_API_KEY` is present in the app using that feature.
- `nutrition-yelp` also needs `YELP_API_KEY`.
- Many AI-backed flows include deterministic or mock fallbacks, but some features still require the upstream key to be present for full functionality.

### Build or module issues

- Re-run `npm run setup`
- Delete stale `.next` folders if necessary
- Restart the affected service
