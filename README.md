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
- **Find documents:** Filter by category, person or department, reusable tag chips, and date range. Existing tag suggestions are fetched from the document-tags API.
- **Preview and download:** Preview supported PDFs and images, download individual files, and bundle current results into a ZIP generated in a Web Worker. ZIP generation reads each file in the browser; backend file hosting must allow cross-origin reads (CORS) from the app's origin.
- **Handle large result sets:** Document results are virtualized so the interface only renders the rows needed on screen.
- **Keep working through connection issues:** The app shows network status and caches recent search results locally for authenticated sessions.
- **Sign in with OTP:** Request and validate a one-time passcode through the Allsoft authentication API. The returned token is used for authenticated document requests.
- **Administration demo:** The Administration page includes a validated user-registration form. It is a static demo and does not create users on the backend.
- **Bonus smart features:** Search with plain-language phrases and get filename-based tag suggestions when uploading. See [BONUS_FEATURES_README.md](./BONUS_FEATURES_README.md) for examples, behavior, and limitations.
- **Responsive layout:** Workspace navigation and document tools adapt to smaller screens.

## Project structure

```text
src/
├── components/
│   ├── administration/
│   │   └── UserRegistration.tsx
│   ├── common/
│   │   ├── OfflineBanner.tsx
│   │   └── TagInput.tsx
│   ├── documents/
│   │   ├── DocumentList.tsx
│   │   ├── DocumentPreview.tsx
│   │   ├── NaturalLanguageSearch.tsx
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
│   ├── naturalLanguageSearch.ts
│   └── tagService.ts
├── storage/
│   ├── indexedDb.ts
│   └── searchCache.ts
├── types/
│   ├── documents.ts
│   └── search.ts
├── utils/
│   └── formatFileSize.ts
├── workers/
│   ├── autoTag.worker.ts
│   └── zip.worker.ts
├── assets/
│   ├── hero.png
│   ├── react.svg
│   └── vite.svg
├── App.css
├── App.tsx
├── index.css
└── main.tsx
```

`App.tsx` coordinates the document workflows. `Layout.tsx` and `Sidebar.tsx` provide the signed-in application shell and navigation, while focused components handle login, registration, tag entry, and document tasks. API communication is kept in `services/`, browser persistence is handled by `storage/`, shared data types and Zod schemas are in `types/`, and ZIP generation runs in `workers/zip.worker.ts`.

## Available commands

```bash
npm run dev      # Start the local development server
npm run build    # Type-check and create a production build
npm run lint     # Run ESLint
npm run preview  # Preview the production build locally
```

## API integration

The app uses the Allsoft Document Management API at `https://apis.allsoft.co/api/documentManagement` for OTP authentication, document search and upload, and tag suggestions. Enter a mobile number registered with the service; the backend determines whether OTP can be sent to that number. After successful OTP validation, the token is stored in browser LocalStorage and sent with authenticated requests.

Document search uses `POST /searchDocumentEntry` with the collection's `major_head`, `minor_head`, `from_date`, `to_date`, `tags`, `uploaded_by`, `start`, `length`, `filterId`, and `search.value` fields. The interface filters by category, person or department, selected tags, and date range; it does not expose free-text search. Selected tags are sent as `{ "tag_name": "..." }` objects, with no blank placeholders, and `search.value` is sent as an empty string. The collection example uses `length: 10`; this app requests `length: 1000` so the virtualized list can render large result sets from one response.

Search and upload tag suggestions use the separate `POST /documentTags` endpoint with `{ "term": "..." }`. Tags are selected or entered as chips in both interfaces. Search sends selected tags with the document-search request; upload sends them as `{ "tag_name": "..." }` objects with the upload request.

The browser can preview and open pre-signed file links without CORS access. Creating a ZIP from backend-hosted files requires the browser to read each file's bytes; if the file host blocks cross-origin reads, the S3 bucket must allow the deployed site origin for `GET` requests. The app reports a clear error if the browser cannot read a file for ZIP creation. Pre-signed links can expire, in which case refresh the document search to obtain a new link.

The provided API collection does not include endpoints for updating tags on existing documents or creating users. The registration form is a static demo and does not create users on the backend. Document deletion is not exposed in the interface.
