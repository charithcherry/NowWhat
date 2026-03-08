# WellBeing App - Full Stack Architecture & Implementation Guide

## Tech Stack Recommendation & Clarification

### **Recommended Approach: Next.js Full-Stack (Unified Solution)**

After analyzing the requirements and addressing the backend confusion, I strongly recommend using **Next.js 14+ with App Router** for both frontend and backend API routes. Here's why:

#### Benefits of Next.js Full-Stack:
- **Single codebase** - Easier maintenance and deployment
- **Built-in API routes** - Perfect for Gemini API integration and DB operations
- **Server Components** - Optimal for data fetching and SEO
- **PWA Support** - Essential for mobile camera access
- **Edge Runtime** - Fast MediaPipe processing
- **TypeScript** - Better type safety across full stack
- **Vercel Deployment** - One-click deployment with automatic scaling

### Final Tech Stack

```yaml
Frontend:
  Framework: Next.js 14+ (App Router)
  UI Library: React 18
  Styling: Tailwind CSS + Shadcn/ui
  State Management: Zustand + React Query (TanStack Query)
  Camera/MediaPipe: Browser APIs + MediaPipe JS
  Charts: Recharts
  Forms: React Hook Form + Zod
  PWA: next-pwa

Backend:
  API: Next.js API Routes (App Router)
  Database: MongoDB Atlas (existing connection)
  Auth: Clerk (recommended) or NextAuth.js
  File Storage: Vercel Blob or AWS S3

AI/ML Services:
  LLM: Google Gemini API (primary)
  OCR: Google Vision API
  Pose Detection: MediaPipe (client-side)
  Voice: ElevenLabs API

DevOps:
  Hosting: Vercel (recommended) or self-hosted
  Monitoring: Vercel Analytics + Sentry
  CI/CD: GitHub Actions
```

## Project Structure

```
wellbeing-app/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # Auth group
│   │   ├── login/
│   │   │   └── page.tsx
│   │   ├── register/
│   │   │   └── page.tsx
│   │   └── layout.tsx
│   │
│   ├── (dashboard)/               # Protected routes group
│   │   ├── layout.tsx             # Dashboard layout with navigation
│   │   ├── page.tsx               # Main dashboard
│   │   │
│   │   ├── physical-fitness/     # Physical wellness module
│   │   │   ├── page.tsx           # Module homepage
│   │   │   ├── exercise-tracker/
│   │   │   │   └── page.tsx
│   │   │   ├── yoga/
│   │   │   │   └── page.tsx
│   │   │   ├── posture/
│   │   │   │   └── page.tsx
│   │   │   ├── coordination/
│   │   │   │   └── page.tsx
│   │   │   └── balance/
│   │   │       └── page.tsx
│   │   │
│   │   ├── nutrition/             # Nutrition module
│   │   │   ├── page.tsx
│   │   │   ├── meal-planner/
│   │   │   │   └── page.tsx
│   │   │   ├── menu-scanner/
│   │   │   │   └── page.tsx
│   │   │   └── pantry/
│   │   │       └── page.tsx
│   │   │
│   │   ├── skin-analyst/         # Skin analysis module
│   │   │   ├── page.tsx
│   │   │   ├── scan/
│   │   │   │   └── page.tsx
│   │   │   └── history/
│   │   │       └── page.tsx
│   │   │
│   │   ├── hair-analyst/         # Hair analysis module
│   │   │   ├── page.tsx
│   │   │   ├── scan/
│   │   │   │   └── page.tsx
│   │   │   └── products/
│   │   │       └── page.tsx
│   │   │
│   │   ├── sleep-tracker/
│   │   │   └── page.tsx
│   │   │
│   │   └── supplements/
│   │       └── page.tsx
│   │
│   ├── api/                       # API Routes
│   │   ├── auth/
│   │   │   └── [...clerk]/
│   │   │       └── route.ts
│   │   │
│   │   ├── exercises/
│   │   │   ├── route.ts           # GET, POST exercises
│   │   │   └── [id]/
│   │   │       └── route.ts       # GET, PUT, DELETE
│   │   │
│   │   ├── analysis/
│   │   │   ├── pose/
│   │   │   │   └── route.ts       # Gemini pose analysis
│   │   │   ├── skin/
│   │   │   │   └── route.ts       # Skin analysis
│   │   │   └── nutrition/
│   │   │       └── route.ts       # Meal suggestions
│   │   │
│   │   ├── sessions/
│   │   │   └── route.ts           # Workout sessions
│   │   │
│   │   └── webhooks/
│   │       └── clerk/
│   │           └── route.ts       # Clerk webhooks
│   │
│   ├── layout.tsx                 # Root layout
│   ├── page.tsx                   # Landing page
│   └── globals.css
│
├── components/
│   ├── ui/                        # Shadcn/ui components
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── dialog.tsx
│   │   └── ...
│   │
│   ├── layout/
│   │   ├── Header.tsx
│   │   ├── MobileNav.tsx         # Hamburger menu
│   │   ├── Sidebar.tsx            # Desktop sidebar
│   │   └── Footer.tsx
│   │
│   ├── camera/
│   │   ├── WebcamCapture.tsx     # Core camera component
│   │   ├── MediaPipeProvider.tsx # MediaPipe context
│   │   ├── PoseOverlay.tsx       # Pose visualization
│   │   └── VideoProcessor.tsx    # Frame processing
│   │
│   ├── fitness/
│   │   ├── ExerciseCard.tsx
│   │   ├── RepCounter.tsx
│   │   ├── FormFeedback.tsx
│   │   ├── AsymmetryIndicator.tsx
│   │   └── TempoTracker.tsx
│   │
│   ├── nutrition/
│   │   ├── MealCard.tsx
│   │   ├── PantryList.tsx
│   │   ├── MenuScanner.tsx
│   │   └── ProteinTracker.tsx
│   │
│   ├── analysis/
│   │   ├── SkinScanner.tsx
│   │   ├── HairScanner.tsx
│   │   └── AnalysisResults.tsx
│   │
│   └── dashboard/
│       ├── StatsCard.tsx
│       ├── ProgressChart.tsx
│       ├── InjuryRiskScore.tsx
│       └── HealthProfile.tsx
│
├── lib/
│   ├── db/
│   │   ├── mongodb.ts             # MongoDB connection
│   │   └── models/                # Mongoose models
│   │       ├── user.ts
│   │       ├── session.ts
│   │       ├── exercise.ts
│   │       └── ...
│   │
│   ├── services/
│   │   ├── gemini.ts              # Gemini API service
│   │   ├── vision.ts              # Google Vision OCR
│   │   ├── elevenlabs.ts         # Voice synthesis
│   │   └── storage.ts            # File storage
│   │
│   ├── mediapipe/
│   │   ├── pose.ts                # Pose detection logic
│   │   ├── hands.ts               # Hand tracking
│   │   └── exercises/
│   │       ├── bicepCurl.ts       # Exercise-specific logic
│   │       ├── shoulderRaise.ts
│   │       └── yoga.ts
│   │
│   ├── utils/
│   │   ├── calculations.ts        # Form scoring, angles
│   │   ├── validators.ts          # Zod schemas
│   │   └── constants.ts
│   │
│   └── hooks/
│       ├── useMediaPipe.ts
│       ├── useWebcam.ts
│       ├── useExerciseSession.ts
│       └── useHealthProfile.ts
│
├── store/
│   ├── useAppStore.ts             # Zustand store
│   ├── slices/
│   │   ├── exerciseSlice.ts
│   │   ├── nutritionSlice.ts
│   │   ├── profileSlice.ts
│   │   └── sessionSlice.ts
│   └── types.ts
│
├── public/
│   ├── manifest.json              # PWA manifest
│   ├── service-worker.js
│   └── assets/
│       └── reference-poses/       # Yoga reference images
│
├── middleware.ts                  # Auth middleware
├── next.config.js                 # Next.js config with PWA
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

## Component Architecture

### 1. Camera & MediaPipe Integration

```typescript
// components/camera/WebcamCapture.tsx
interface WebcamCaptureProps {
  onFrameCapture?: (imageData: ImageData) => void;
  onPoseDetected?: (pose: PoseLandmarks) => void;
  exerciseType?: ExerciseType;
  showOverlay?: boolean;
}

// Key features:
// - getUserMedia API for camera access
// - Canvas for frame extraction
// - MediaPipe pose detection (30 FPS)
// - Frame buffer for Gemini API (10 frames/analysis)
// - Privacy: local processing by default
```

### 2. State Management Architecture

```typescript
// store/useAppStore.ts
interface AppState {
  // Exercise Session
  currentExercise: Exercise | null;
  sessionData: {
    reps: number[];
    formScores: number[];
    asymmetryScores: number[];
    tempoData: TempoMeasurement[];
  };

  // Health Profile
  profile: {
    fitness: FitnessMetrics;
    nutrition: NutritionData;
    skin: SkinAnalysis;
    hair: HairAnalysis;
    sleep: SleepPattern;
  };

  // Real-time Feedback
  liveData: {
    poseQuality: number;
    currentRep: number;
    fatigueLevel: number;
    injuryRisk: number;
  };
}
```

### 3. API Layer Design

```typescript
// API Routes Structure

// POST /api/analysis/pose
interface PoseAnalysisRequest {
  frames: string[];  // Base64 encoded frames
  exerciseType: string;
  userId: string;
  timestamp: number;
}

// Response includes:
// - Form score (0-100)
// - Specific corrections
// - Asymmetry detection
// - Fatigue indicators

// POST /api/analysis/skin
interface SkinAnalysisRequest {
  image: string;  // Base64 selfie
  userId: string;
  previousAnalysis?: string;  // For comparison
}

// POST /api/nutrition/meal-suggestion
interface MealSuggestionRequest {
  pantryItems: string[];
  workoutData: WorkoutSummary;
  targetProtein: number;
  preferences: string[];
}
```

## Mobile-Responsive PWA Design

### Navigation Structure

```tsx
// Mobile: Hamburger Menu
<MobileNav>
  <MenuItem icon={Dumbbell} href="/physical-fitness">
    Physical Fitness
  </MenuItem>
  <MenuItem icon={Apple} href="/nutrition">
    Nutrition
  </MenuItem>
  <MenuItem icon={Sparkles} href="/skin-analyst">
    Skin Analyst
  </MenuItem>
  <MenuItem icon={Hair} href="/hair-analyst">
    Hair Analyst
  </MenuItem>
  <MenuItem icon={Moon} href="/sleep-tracker">
    Sleep Tracker
  </MenuItem>
  <MenuItem icon={Pill} href="/supplements">
    Supplements
  </MenuItem>
</MobileNav>

// Desktop: Sidebar + Main Content
```

### PWA Configuration

```javascript
// next.config.js
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  runtimeCaching: [
    {
      urlPattern: /^https:\/\/fonts\.(gstatic|googleapis)\.com\/.*/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'google-fonts',
        expiration: {
          maxEntries: 10,
          maxAgeSeconds: 365 * 24 * 60 * 60 // 1 year
        }
      }
    }
  ]
});

module.exports = withPWA({
  reactStrictMode: true,
  images: {
    domains: ['storage.googleapis.com']
  }
});
```

## Feature Module Architecture

### 1. Physical Fitness Module

```typescript
// Pages & Components
/physical-fitness/
  ├── ExerciseLibrary       # Browse exercises
  ├── LiveWorkout           # Camera + MediaPipe
  ├── YogaSession           # Guided yoga with form
  ├── PostureMonitor        # Background monitoring
  ├── CoordinationTests     # Reaction & hand tracking
  └── ProgressDashboard     # Stats & trends

// Core Features:
// - Real-time rep counting
// - Form quality scoring (0-100)
// - Bilateral asymmetry detection
// - Tempo/TUT tracking
// - Fatigue detection within sets
// - Injury risk calculation
```

### 2. Nutrition Module

```typescript
// Features:
// - Pantry-based meal planning
// - Restaurant menu OCR + analysis
// - Protein optimization
// - Workout-aware recommendations
// - Recipe RAG system with memory
```

### 3. Skin & Hair Analysis

```typescript
// Implementation:
// - Camera API for selfie capture
// - Gemini Vision API for analysis
// - Ingredient database integration
// - Product recommendation engine
// - Cross-correlation with nutrition
```

## Database Schema (MongoDB)

```typescript
// User Collection
{
  _id: ObjectId,
  clerkId: string,
  profile: {
    name: string,
    email: string,
    height: number,
    weight: number,
    goals: string[],
    skinType: 'dry' | 'oily' | 'combination' | 'sensitive',
    scalpType: string,
    allergies: string[],
    sensitivities: string[]
  },
  createdAt: Date,
  updatedAt: Date
}

// Exercise Session Collection
{
  _id: ObjectId,
  userId: ObjectId,
  date: Date,
  exercises: [{
    name: string,
    sets: [{
      reps: number,
      weight: number,
      formScore: number,
      asymmetryScore: number,
      fatigueScore: number,
      tempoData: {
        eccentric: number,
        concentric: number
      },
      landmarks: object  // MediaPipe data
    }]
  }],
  injuryRiskScore: number,
  duration: number
}

// Analysis Collection
{
  _id: ObjectId,
  userId: ObjectId,
  type: 'skin' | 'hair' | 'posture',
  date: Date,
  imageUrl: string,
  results: {
    scores: object,
    recommendations: string[],
    nutritionCorrelation: object
  }
}
```

## Real-time Processing Architecture

### MediaPipe Integration Flow

```
User Camera → Canvas (30 FPS) → MediaPipe Pose
                    ↓
            Frame Buffer (10 frames)
                    ↓
        [Every 2 seconds or on-demand]
                    ↓
            Gemini API Analysis
                    ↓
        Real-time UI Feedback + DB Storage
```

### Privacy-First Approach

1. **Local Processing**: MediaPipe runs entirely in browser
2. **Selective Upload**: Only send frames to Gemini when needed
3. **Data Minimization**: Store analyzed results, not raw video
4. **User Control**: Clear opt-in for cloud processing
5. **Encryption**: All stored images encrypted at rest

## API Integration Strategy

### Gemini API Usage

```typescript
// lib/services/gemini.ts
class GeminiService {
  async analyzePoseFrames(frames: string[], exercise: string) {
    // Send 10 frames for comprehensive analysis
    // Include exercise context and form criteria
    // Return structured feedback
  }

  async generateMealPlan(pantry: string[], workout: WorkoutData) {
    // Context-aware meal suggestions
    // Include user preferences and history
  }

  async analyzeSkinCondition(image: string, history: SkinHistory) {
    // Vision API for skin analysis
    // Correlation with nutrition and workout data
  }
}
```

### MongoDB Connection

```typescript
// lib/db/mongodb.ts
import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;
const options = {
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 5000,
};

let clientPromise: Promise<MongoClient>;

if (process.env.NODE_ENV === 'development') {
  // Use global variable in development
  if (!global._mongoClientPromise) {
    const client = new MongoClient(uri, options);
    global._mongoClientPromise = client.connect();
  }
  clientPromise = global._mongoClientPromise;
} else {
  // Create new client in production
  const client = new MongoClient(uri, options);
  clientPromise = client.connect();
}

export default clientPromise;
```

## Dashboard UI Implementation

Using the Doom 64 theme reference for Physical Wellness Dashboard:

```typescript
// Theme Configuration
const doomTheme = {
  colors: {
    background: '#0a0a0a',
    surface: '#1a1a1a',
    primary: '#ff6b6b',
    secondary: '#4ecdc4',
    warning: '#ffd93d',
    success: '#6bcf7f',
    text: {
      primary: '#ffffff',
      secondary: '#a0a0a0'
    }
  },
  gradients: {
    health: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    danger: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    success: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)'
  }
};

// Dashboard Components
<DashboardGrid>
  <InjuryRiskCard score={85} trend="decreasing" />
  <FormQualityCard average={92} lastSession={88} />
  <AsymmetryCard leftRight={[48, 52]} alerts={[]} />
  <ProgressChart data={sessionHistory} />
  <FatiguePattern sets={currentSession.sets} />
  <RecommendationCard suggestions={aiSuggestions} />
</DashboardGrid>
```

## Deployment Strategy

### Recommended: Vercel Deployment

```bash
# Environment Variables
MONGODB_URI=mongodb+srv://...
GEMINI_API_KEY=...
GOOGLE_VISION_API_KEY=...
CLERK_SECRET_KEY=...
ELEVENLABS_API_KEY=...
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=...
```

### Performance Optimizations

1. **Code Splitting**: Dynamic imports for heavy components
2. **Image Optimization**: Next.js Image component
3. **API Caching**: Redis or Vercel KV for frequently accessed data
4. **Edge Functions**: MediaPipe processing at edge locations
5. **Progressive Enhancement**: Core features work without JS

## Security Considerations

1. **Authentication**: Clerk for secure user management
2. **API Protection**: Rate limiting and API keys
3. **Data Encryption**: Images encrypted before storage
4. **CORS Configuration**: Strict origin policies
5. **Input Validation**: Zod schemas for all inputs
6. **Secure Headers**: CSP, HSTS, X-Frame-Options

## Summary & Next Steps

### Recommended Tech Stack (Final):
- **Full-Stack Framework**: Next.js 14+ (App Router)
- **Database**: MongoDB Atlas
- **Auth**: Clerk
- **AI Services**: Gemini API, MediaPipe (client)
- **Deployment**: Vercel

### Implementation Priority:
1. Set up Next.js project with TypeScript
2. Implement auth with Clerk
3. Create camera component with MediaPipe
4. Build exercise tracking (Phase 1)
5. Add Gemini API integration
6. Implement dashboard UI
7. Add remaining features progressively

This architecture provides:
- Unified codebase (no backend confusion)
- Excellent DX with hot reload
- Type safety across stack
- PWA for mobile camera access
- Scalable module structure
- Privacy-first design
- Production-ready deployment