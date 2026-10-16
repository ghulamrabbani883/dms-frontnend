# Elevate Documents

A responsive React + TypeScript document-management workspace. The interface supports OTP-style sign-in, document upload and tagging, category/date search, previews, downloads, bulk ZIP export, and a static user-creation form.

## Run locally

```bash
npm install
npm run dev
```

## Validate

```bash
npm run build
npm run lint
```

There is no separate unit-test runner configured yet. The production TypeScript/Vite build and ESLint are the current validation commands.

## Project structure

```text
src/
├── components/
│   ├── Login.tsx
│   ├── common/
│   │   └── OfflineBanner.tsx
│   └── documents/
│       ├── DocumentList.tsx
│       ├── DocumentPreview.tsx
│       ├── SearchFilters.tsx
│       └── UploadForm.tsx
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
│   ├── documents.ts
│   └── search.ts
├── utils/
├── workers/
├── App.tsx
└── main.tsx
```

## Features

- Personal and Professional categories with dependent person/department choices.
- PDF and image upload (20 MB maximum), document dates, suggested/reusable tags, and remarks.
- Search by name or tag, category, person/department, and date range.
- Virtualized document results using TanStack Virtual.
- Image/PDF preview states, individual downloads, and bulk ZIP generation in a native Web Worker using fflate.
- Optimistic upload, tag, and delete updates using TanStack Query, with rollback and visible errors when a mutation fails.
- Zod runtime validation for upload data, saved document records, tags, login input, and admin form data.
- IndexedDB document/file persistence with LocalStorage caching of up to 200 recent search results.
- Responsive workspace navigation, offline status, and API-backed OTP sign-in.

## Backend integration

OTP and authenticated document APIs use the supplied Allsoft Postman collection:

- `POST /generateOTP` and `POST /validateOTP`
- `POST /searchDocumentEntry`
- `POST /saveDocumentEntry` (multipart `file` and JSON `data`)
- `POST /documentTags`

The API host is `https://apis.allsoft.co/api/documentManagement`. The validated OTP response token is stored in browser LocalStorage and sent as the `token` request header. The search response is runtime-validated and normalized from the supplied API fields; tag suggestions accept the API's `label` field. The uploader sends `major_head`, `minor_head`, `document_date` (`DD-MM-YYYY`), `document_remarks`, tag objects, and `user_id` (from the OTP response, or the `nitin` example in the collection).

The supplied collection has no document deletion or standalone tag-update request. Those actions work as optimistic local-demo mutations when signed out; while authenticated, they fail visibly and roll back rather than pretending the server saved the change. The static administrator form also does not create backend users because no user-creation endpoint was provided.

When signed out, the app seeds sample documents into IndexedDB and persists local uploads. Authenticated searches use the backend; cached results remain available during offline network drops. No API secret is bundled.

## Deployment

The root `vercel.json` rewrites client-side routes to `index.html`. Import this repository into Vercel or run `vercel` from the project directory. No environment variables are needed.
