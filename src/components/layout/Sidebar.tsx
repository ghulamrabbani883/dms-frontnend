export type WorkspacePage = 'documents' | 'upload' | 'admin'

type SidebarProps = {
  page: WorkspacePage
  onNavigate: (page: WorkspacePage) => void
}

const navigationItems: { page: WorkspacePage; label: string; icon: string }[] = [
  { page: 'documents', label: 'Documents', icon: '▤' },
  { page: 'upload', label: 'Upload files', icon: '＋' },
  { page: 'admin', label: 'Register', icon: '♙' },
]

const Sidebar = ({ page, onNavigate }: SidebarProps) => (
  <aside className="sidebar">
    <a
      className="brand"
      href="#"
      onClick={(event) => {
        event.preventDefault()
        onNavigate('documents')
      }}
    >
      <span className="brand-mark"><span /></span>
      <span>elevate<span className="brand-period">.</span><small>DOCUMENTS</small></span>
    </a>
    <div className="workspace-label">WORKSPACE</div>
    <nav className="side-nav" aria-label="Main navigation">
      {navigationItems.map((item) => (
        <button
          className={page === item.page ? 'nav-item active' : 'nav-item'}
          key={item.page}
          type="button"
          aria-current={page === item.page ? 'page' : undefined}
          onClick={() => onNavigate(item.page)}
        >
          <span className="nav-icon" aria-hidden="true">{item.icon}</span>
          {item.label}
        </button>
      ))}
    </nav>
  </aside>
)

export default Sidebar
