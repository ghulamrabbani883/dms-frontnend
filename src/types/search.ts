export type SearchFiltersState = {
  category: string
  minorHead: string
  search: string
  from: string
  to: string
}

export const initialSearchFilters: SearchFiltersState = {
  category: '',
  minorHead: '',
  search: '',
  from: '',
  to: '',
}
