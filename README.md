# Margin Pilot (Arthiva Operations)

Margin Pilot is a profit-aware order and delivery operations platform tailored for Indian Direct-to-Consumer (D2C) ecommerce. Instead of evaluating orders on risk alone, it scores journeys by Expected Value (EV), automates Non-Delivery Report (NDR) rescue actions, optimizes Return-to-Origin (RTO) recovery, and supports 9 Indian vernacular languages.

---

## Features

- **Profit-Aware Journey Scoring**: Evaluates order risk, courier performance, address completeness, and margin profiles to optimize fulfillment pathways (COD, OTP verification, Prepaid incentives).
- **Delivery Rescue (NDR Management)**: Intervenes on in-transit delivery exceptions with customer-facing actions and courier communications.
- **RTO Recovery Engine**: Action queue for return shipments with automated reattempt and inventory restocking logic.
- **Vernacular Support**: Native UI and translations for 9 Indian languages (English, Hindi, Bengali, Marathi, Gujarati, Tamil, Telugu, Kannada, Malayalam).
- **Google Authentication & Firebase Sync**: Seamless sign-in with Google and cloud persistence for user workspace preferences via Cloud Firestore.

---

## Prerequisites

Before running the application locally on your laptop, ensure you have:

- **Node.js**: v20 or v22 (recommended)
- **npm**: v10+
- **Git**

---

## Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/<your-username>/arthiva_v3.git
cd arthiva_v3
```

### 2. Install Dependencies

Install all monorepo dependencies using npm:

```bash
npm install
```

### 3. Configure Environment Variables

Create a `.env` file in the project root:

```bash
touch .env
```

Add your configuration keys to `.env`:

```env
# Firebase Web API Key for Authentication & Firestore
VITE_FIREBASE_API_KEY=your_firebase_api_key_here

# Optional: Gemini API Key for server-side AI Vernacular translation
GEMINI_API_KEY=your_gemini_api_key_here

# Server Port (defaults to 3000)
PORT=3000
```

> **Note:** The `.env` file is already added to `.gitignore` and will never be tracked or pushed to Git.

### 4. Firebase Configuration

The application uses Firebase Authentication (Google Sign-In) and Cloud Firestore.

1. Ensure your Firebase configuration exists in `firebase-applet-config.json` (at root and in `artifacts/margin-pilot/src/firebase-applet-config.json`):
   ```json
   {
     "projectId": "your-firebase-project-id",
     "appId": "your-app-id",
     "apiKey": "",
     "authDomain": "your-project-id.firebaseapp.com",
     "firestoreDatabaseId": "your-database-id",
     "storageBucket": "your-project-id.firebasestorage.app",
     "messagingSenderId": "your-sender-id",
     "oAuthClientId": "your-oauth-client-id.apps.googleusercontent.com"
   }
   ```
2. In the **Firebase Console** under **Authentication > Sign-in method**:
   - Enable **Google** provider.
   - Under **Authorized domains**, ensure `localhost` and `127.0.0.1` are present.

### 5. Start the Development Server

Start the application:

```bash
npm run dev
```

Open your browser and navigate to:

```
http://localhost:3000
```

---

## Project Structure

```text
├── artifacts/
│   ├── margin-pilot/          # Main React (Vite) frontend application
│   │   ├── src/
│   │   │   ├── components/    # Reusable UI components & dialogs
│   │   │   ├── engine/        # Margin evaluation & rescue logic
│   │   │   ├── i18n/          # Locales & translation configuration
│   │   │   ├── pages/         # Dashboard, Orders, Rescue, and Recovery pages
│   │   │   ├── state/         # AuthContext & AppState (localStorage sync)
│   │   │   └── lib/           # Firebase initialization & utilities
│   │   └── vite.config.ts     # Vite configuration & dev proxy
│   └── api-server/            # Optional background API service & workers
├── lib/
│   ├── db/                    # Schema definitions
│   └── engine/                # Core scoring algorithms
├── firestore.rules            # Firestore security rules
└── package.json               # Monorepo workspaces definition
```

---

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Starts the Vite development server on port 3000 |
| `npm run build` | Builds the production bundle in `artifacts/margin-pilot/dist` |
| `npm run typecheck` | Validates TypeScript types across the monorepo |
| `npm run lint` | Runs typechecks and code verification |

---

## Troubleshooting

- **Google Sign-In shows `auth/unauthorized-domain`**: Add `localhost` to the authorized domains in your Firebase Console under **Authentication > Settings > Authorized domains**.
- **Port 3000 is already in use**: Specify a different port before starting:
  ```bash
  PORT=3001 npm run dev
  ```
