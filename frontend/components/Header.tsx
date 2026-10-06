export default function Header() {
  return (
    <header className="app-header">
      <div className="header-inner">
        <span className="brand-mark" aria-hidden="true">PA</span>
        <span className="brand-name">Codebase</span>
        <span className="header-divider" aria-hidden="true" />
        <span className="header-context">Repository workspace</span>
        <span className="header-meta" title="Repositories are inspected in read-only mode and are never executed">
          <span className="status-dot" aria-hidden="true" />
          Read-only workspace
        </span>
      </div>
    </header>
  );
}
