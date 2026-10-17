import { z } from 'zod'

export const documentSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  category: z.string().min(1),
  minorHead: z.string().min(1),
  date: z.string().date(),
  size: z.number().nonnegative(),
  mimeType: z.string().min(1),
  tags: z.array(z.string().min(1)),
  remarks: z.string(),
})

export const uploadSchema = z.object({
  file: z.instanceof(File).refine(
    (file) => file.type === 'application/pdf' || file.type.startsWith('image/'),
    'Choose a PDF or image file.',
  ).refine((file) => file.size <= 20 * 1024 * 1024, 'Files must be 20 MB or smaller.'),
  date: z.string().date(),
  category: z.enum(['Personal', 'Professional']),
  minorHead: z.string().min(1, 'Choose a name or department.'),
  tags: z.array(z.string().min(1)).max(15, 'Choose no more than 15 tags.'),
  remarks: z.string().max(500, 'Remarks must be 500 characters or fewer.'),
})

export type DocumentRecord = z.infer<typeof documentSchema>
export type UploadInput = z.infer<typeof uploadSchema>
export type StoredDocument = DocumentRecord & { fileBlob?: Blob; fileUrl?: string }

export const categories = {
  Personal: ['John Smith', 'Tom Wilson', 'Emily Chen', 'Riya Patel'],
  Professional: ['Accounts', 'Human Resources', 'Information Technology', 'Finance', 'Legal'],
} as const

const seedNames = [
  'Q3-financial-summary.pdf',
  'Team-offsite-photo.jpg',
  'Vendor-agreement.pdf',
  'Passport-scan.png',
  'Annual-leave-policy.pdf',
  'Project-atlas-brief.pdf',
  'Insurance-card.jpg',
  'Expense-receipts-oct.pdf',
  'Onboarding-checklist.pdf',
  'Design-review.png',
  'Tax-return-2025.pdf',
  'Security-audit.pdf',
  'Meeting-notes.pdf',
  'Building-access-card.jpg',
]
const seedTags = [
  ['finance', 'quarterly', '2026'],
  ['team', 'event', 'photos'],
  ['legal', 'vendor', 'signed'],
  ['personal', 'identity'],
  ['hr', 'policy', 'internal'],
  ['project-atlas', 'planning'],
  ['personal', 'insurance'],
  ['finance', 'expenses', 'receipts'],
  ['hr', 'onboarding'],
  ['design', 'review'],
  ['personal', 'tax', '2025'],
  ['security', 'audit', 'compliance'],
  ['meeting', 'product'],
  ['personal', 'access'],
]

export const demoDocuments: DocumentRecord[] = seedNames.map((name, index) => {
  const category = index % 3 === 0 ? 'Personal' : 'Professional'
  const minorHead = category === 'Personal'
    ? categories.Personal[index % categories.Personal.length]
    : categories.Professional[index % categories.Professional.length]
  const date = new Date()
  date.setDate(date.getDate() - index * 3)

  return documentSchema.parse({
    id: `demo-${index + 1}`,
    name,
    category,
    minorHead,
    date: date.toISOString().slice(0, 10),
    size: 180_000 + index * 83_500,
    mimeType: name.endsWith('.pdf') ? 'application/pdf' : `image/${name.endsWith('.png') ? 'png' : 'jpeg'}`,
    tags: seedTags[index],
    remarks: index % 2 === 0 ? 'Shared with the team' : '',
  })
})
