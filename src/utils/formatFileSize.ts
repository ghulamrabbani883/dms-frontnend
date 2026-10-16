export const formatFileSize = (bytes: number) => bytes < 1_000_000
  ? `${Math.max(1, Math.round(bytes / 1000))} KB`
  : `${(bytes / 1_000_000).toFixed(1)} MB`
