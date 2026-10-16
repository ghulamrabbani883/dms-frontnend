# Smart search and upload suggestions

This note explains the two optional smart features in the app. Both run in the browser; there is no LLM account, API key, or extra backend endpoint involved.

## Natural-language document search

Use the search box above the regular filters to describe the documents you want. For example:

- `Find HR files uploaded last week`
- `Professional Finance documents from June 1 to June 30, 2026`
- `Files tagged invoice and quarterly from last month`

When you submit a phrase, the app recognizes known categories, people/departments, explicit tag phrases, and common date expressions. It converts those into the existing filters and submits a regular document search. The `chrono-node` package parses calendar dates; common relative periods such as “last week” and “this month” are handled locally as date ranges.

This is a small client-side phrase parser, not a conversational AI model. It only recognizes the categories, people, departments, and tag wording it knows. For a tag, write a phrase such as “tagged finance” or “with tag invoice”. If the parser cannot identify any supported filter, it asks you to rephrase instead of silently clearing your current filters. You can always use the category, department/person, tag, and date controls below the search box directly.

## Upload tag suggestions

Choose or drop a PDF/image file in the upload form. The `autoTag.worker.ts` Web Worker checks its filename and basic file metadata, then suggests tags based on recognizable words such as `invoice`, `contract`, or `onboarding`. Select any useful suggestion in the Tags field; suggestions are optional and can be removed or supplemented before upload.

This is deliberately a lightweight **simulation**, not OCR: it does not read document or image contents and does not send files to a third-party AI service. A filename like `vendor_invoice_2026.pdf` can suggest `finance` and `invoice`, but a vague filename may not yield suggestions. Existing `/documentTags` suggestions continue to work independently.

## Where the code lives

- `src/components/documents/NaturalLanguageSearch.tsx` renders the phrase input and applies parsed filters.
- `src/services/naturalLanguageSearch.ts` maps supported text into the existing search-filter state.
- `src/workers/autoTag.worker.ts` generates filename-based upload suggestions off the main UI thread.
- `src/components/documents/UploadForm.tsx` starts the worker when a file is selected and displays its suggestions in the shared tag input.

To add real OCR later, replace the filename inference in the worker with a browser OCR library such as Tesseract.js, keep that processing in a worker, and clearly handle language-data loading and OCR failures. Any production AI or OCR service should be reviewed for document privacy before file contents are sent off-device.
