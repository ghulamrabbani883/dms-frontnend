# Smart search and upload suggestions

This note explains the two optional smart features in the app. Both run in the browser; there is no LLM account, API key, or extra backend endpoint involved.

## Natural-language document search

Use the search box above the regular filters to describe the documents you want. For example:

- `Find HR files uploaded last week`
- `Professional Finance documents from June 1 to June 30, 2026`
- `Files tagged invoice and quarterly from last month`

When you submit a phrase, the search component recognizes known categories, people/departments, explicit tag phrases, and date expressions. It uses `chrono-node` directly to parse date phrases, then converts the results into the existing filters and submits a regular document search. Week and month phrases are expanded to ranges using the date Chrono identifies.

This is a small client-side phrase parser, not a conversational AI model. It only recognizes the categories, people, departments, and tag wording it knows. For a tag, write a phrase such as “tagged finance” or “with tag invoice”. If the parser cannot identify any supported filter, it asks you to rephrase instead of silently clearing your current filters. You can always use the category, department/person, tag, and date controls below the search box directly.

## Upload tag suggestions

Choose or drop a PDF/image file in the upload form. The app reads the document locally and suggests tags based on recognizable words such as `invoice`, `contract`, or `onboarding`. Select any useful suggestion in the Tags field; suggestions are optional and can be removed or supplemented before upload.

PDFs are read up to the first five pages. If a page contains embedded text, the app extracts that text; if it appears to be a scanned page, Tesseract.js runs English OCR on a rendered copy of the page. Images are analyzed with English OCR. The app ranks words found in the recognized file text (excluding common words) and offers up to 15 combined suggestions from document content and the `/documentTags` API. Suggestions appear only after a file is selected. A maximum of 15 tags can be added to an upload. Review OCR-generated terms before selecting them, since OCR can misread text.

No API key is needed. The document itself is processed in the browser and is not uploaded for OCR. On first use, Tesseract.js may download its OCR worker/core resources and English language data from its configured CDN; the language data is cached by the browser for later use. OCR requires a working network connection the first time and may take a few seconds, especially for large scans. If initialization, PDF reading, or OCR fails, the form reports that it could not read the content and keeps filename-based suggestions available so tags can still be entered manually.

## Where the code lives

- `src/components/documents/NaturalLanguageSearch.tsx` renders the phrase input, uses `chrono-node` to parse date phrases, and maps supported text into the existing search-filter state.
- `src/components/documents/UploadForm.tsx` coordinates file analysis and displays all generated suggestions in the shared tag input.
- `src/utils/fileToText.ts` extracts embedded PDF text and runs local OCR on images and scanned PDF pages.
- `src/utils/suggestDocumentTags.ts` maps recognized document text and filenames to tag suggestions.
- `pdfjs-dist` supplies PDF parsing/rendering, and `tesseract.js` runs OCR locally in the browser.

To support more languages, configure Tesseract.js to load the matching language data and add a language choice to the UI. Any future cloud-based AI or OCR service should be reviewed for document privacy before file contents are sent off-device.
