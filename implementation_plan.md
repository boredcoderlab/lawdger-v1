# Lawdger Implementation Plan

Lawdger is a "Legal Second Brain" for Indian advocates, built with an "Indian High Courts meets Apple" aesthetic (sleek, high-contrast dark mode, premium feel). It features a Next.js 16 & Tailwind CSS stack, one-tap voice integration for unstructured input, and AI-driven classification to automatically log notes, tasks, and calendar dates.

## Decisions Made

1. **Database**: Prisma ORM with SQLite (for fast local MVP development, easily scalable to PostgreSQL later).
2. **AI Provider**: Custom model to be trained separately later. For the MVP webapp, we will build the UI and API hooks with mocked AI responses to demonstrate the workflow.
3. **Authentication**: Deferred. We will build the framework and UI assuming a single logged-in user state, adding auth modules before launch.

## Proposed Changes

### 1. Database Schema (Prisma)

The database will be structured to support robust case management.

- **User**: `id`, `email`, `name`, `preferences`
- **Case**: `id`, `userId`, `title`, `clientName`, `courtName`, `status`, `createdAt`
- **Note**: `id`, `caseId`, `userId`, `rawTranscript`, `cleanContent`, `category` (Client Update, Next Date, Task, General Note), `createdAt`
- **Task**: `id`, `caseId`, `userId`, `description`, `status` (pending, completed), `dueDate`, `createdAt`
- **CalendarEvent**: `id`, `caseId`, `userId`, `title`, `hearingDate`, `description`
- **Payment**: `id`, `caseId`, `userId`, `amount`, `status` (pending, paid), `dueDate`

### 2. Core UI Pages

> [!TIP]
> The UI will strictly follow a high-contrast dark mode aesthetic. We'll use fonts like Inter or SF Pro, subtle glassmorphism, and minimal but impactful micro-animations for a premium feel.

- **Layout & Navigation**: A persistent side navigation or bottom bar with a prominent, glowing "Voice Input" floating action button (FAB) that is accessible from anywhere.
- **Dashboard (`/dashboard`)**:
  - *Today's Agenda*: Minimalist list of today's hearings and overdue tasks.
  - *Pending Actions*: High-priority tasks that need immediate attention.
  - *Recent Activity*: A feed of the latest notes and AI-processed logs.
- **Case Management (`/cases` & `/cases/[id]`)**:
  - *Case List*: A searchable, filterable grid/list of active matters.
  - *Case Detail*: A chronological, timeline-based view of all notes, tasks, and calendar events for a specific case.
- **Global Views (`/tasks`, `/calendar`)**:
  - Centralized views to see all tasks and hearings across all cases.
- **AI Chat Interface (`/chat`)**:
  - An "Apple Intelligence" style chat interface.

### 3. Voice Integration Workflow

> [!NOTE]
> This is the core magic of Lawdger. The voice integration is a pipeline of Audio Capture -> Transcription -> AI Processing -> Database routing.

- **Audio Capture (Frontend)**:
  - React `MediaRecorder` API to capture the user's voice.
  - A sleek recording modal with a waveform visualization and a timer to indicate active listening.
- **Transcription & AI Processing (Mocked for MVP)**:
  - Audio blob sent to a Next.js API route (`/api/voice/process`).
  - We will mock the STT and AI extraction process to immediately return a structured JSON response (Case Name, Clean Note, Category, Dates) to showcase the UI flow without needing live AI API keys.
- **Data Action**:
  - Depending on the Category, the API automatically generates the required records.

## Verification Plan

### Automated Tests
- Type checking with TypeScript.
- Prisma schema validation.

### Manual Verification
- Visual check of the "Indian High Courts meets Apple" dark mode aesthetic.
- Voice input UI test: Recording audio and verifying the mocked pipeline creates a Note, a Calendar Event, and a Task under the correct case.
