import type { ReactNode } from 'react'
import OfflineBanner from '../common/OfflineBanner'
import Sidebar, { type WorkspacePage } from './Sidebar'

type LayoutProps = {
  page: WorkspacePage
  online: boolean
  onNavigate: (page: WorkspacePage) => void
  onUpload: () => void
  onSignOut: () => void
  children: ReactNode
}

const pageTitles: Record<WorkspacePage, string> = {
  documents: 'Documents',
  upload: 'Upload',
  admin: 'Register',
}

const Layout = ({ page, online, onNavigate, onUpload, onSignOut, children }: LayoutProps) => (
  <div className="app-shell">
    <Sidebar page={page} onNavigate={onNavigate} />
    <main className="main-content">
      <header className="topbar">
        <div className="breadcrumbs"><span>Workspace</span><b>/</b><strong>{pageTitles[page]}</strong></div>
        <div className="topbar-actions">
          <OfflineBanner online={online} />
          <button className="button button-primary top-upload" type="button" onClick={onUpload}>
            <span aria-hidden="true">＋</span> Upload document
          </button>
          <button className="button button-outline sign-out-button" type="button" onClick={onSignOut}>
            Sign out
          </button>
        </div>
      </header>
      {children}
    </main>
  </div>
)

export default Layout
