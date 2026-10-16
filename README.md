# Elevate Documents

Elevate Documents is a responsive document-management interface built with React and TypeScript. It brings document upload, tagging, search, preview, and download together in one workspace. Sign in with a mobile number registered with the Allsoft service to access documents. The app does not show documents until sign-in succeeds.

## Get started

Fork this repository on GitHub, then clone your fork:

```bash
git clone https://github.com/<your-username>/dms-frontnend.git
cd dms-frontnend
npm i
npm run dev
```

Open the local URL printed by Vite (usually `http://localhost:5173`). To stop the development server, press `Ctrl+C` in the terminal.

## Features

- **Upload and organize documents:** Upload PDF and image files with a document date, Personal or Professional category, a related person or department, reusable tags, and remarks.
- **Find documents:** Search by name or tags and narrow results by category, person or department, and date range. Search input is debounced to avoid unnecessary updates while typing.
- **Preview and download:** Preview supported PDFs and images, download individual files, or download the current results as a ZIP. ZIP creation runs in a Web Worker.
- **Handle large result sets:** Document results are virtualized so the interface only renders the rows needed on screen.
- **Keep working through connection issues:** The app shows network status and caches recent search results locally for authenticated sessions.
- **Sign in with OTP:** Request and validate a one-time passcode through the Allsoft authentication API. The returned token is used for authenticated document requests.
- **Administration demo:** The Administration page includes a validated user-registration form. It is a static demo and does not create users on the backend.
- **Responsive layout:** Workspace navigation and document tools adapt to smaller screens.

## Project structure

```text
src/
├── components/
│   ├── administration/
│   │   └── UserRegistration.tsx
│   ├── common/
│   │   └── OfflineBanner.tsx
│   ├── documents/
│   │   ├── DocumentList.tsx
│   │   ├── DocumentPreview.tsx
│   │   ├── SearchFilters.tsx
│   │   └── UploadForm.tsx
│   ├── layout/
│   │   ├── Layout.tsx
│   │   └── Sidebar.tsx
│   └── login/
│       └── Login.tsx
├── hooks/
│   ├── useDebounce.ts
│   └── useNetworkStatus.ts
├── services/
│   ├── api.ts
│   ├── authService.ts
│   ├── documentService.ts
│   └── tagService.ts
├── storage/
│   ├── indexedDb.ts
│   └── searchCache.ts
├── types/
├── utils/
├── workers/
├── App.tsx
└── main.tsx
```

`App.tsx` coordinates the document workflows. `Layout.tsx` and `Sidebar.tsx` provide the signed-in application shell and navigation, while focused components handle login, registration, and document tasks. API communication is kept in `services/`, browser persistence is handled by `storage/`, and Zod schemas validate API data and form input at runtime.

## Available commands

```bash
npm run dev      # Start the local development server
npm run build    # Type-check and create a production build
npm run lint     # Run ESLint
npm run preview  # Preview the production build locally
```

## API integration

The app uses the Allsoft Document Management API at `https://apis.allsoft.co/api/documentManagement` for OTP authentication, document search and upload, and tag suggestions. Enter a mobile number registered with the service; the backend determines whether OTP can be sent to that number. After successful OTP validation, the token is stored in browser LocalStorage and sent with authenticated requests.

The provided API collection does not include endpoints for deleting documents, updating document tags, or creating users. Those actions are therefore not represented as successful backend operations: demo-mode changes are local, while unsupported authenticated mutations report an error and roll back.

## Deployment

The included `vercel.json` rewrites client-side routes to `index.html`. Import the repository into Vercel or run the Vercel CLI from the project directory to deploy.
