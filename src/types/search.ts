export type SearchFiltersState = {
  category: string
  minorHead: string
  tags: string[]
  from: string
  to: string
}

export const initialSearchFilters: SearchFiltersState = {
  category: '',
  minorHead: '',
  tags: [],
  from: '',
  to: '',
}
