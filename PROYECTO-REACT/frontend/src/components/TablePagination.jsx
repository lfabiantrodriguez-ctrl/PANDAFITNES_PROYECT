/**
 * Paginador reutilizable de 10 en 10 para tablas y listas responsivas.
 */
export function paginateList(items, currentPage, pageSize = 10) {
  const safeList = Array.isArray(items) ? items : []
  const totalItems = safeList.length
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const safePage = Math.min(Math.max(1, currentPage), totalPages)
  const startIndex = (safePage - 1) * pageSize
  return {
    items: safeList.slice(startIndex, startIndex + pageSize),
    safePage,
    totalPages,
    totalItems,
  }
}

function getVisiblePages(safePage, totalPages) {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, i) => i + 1)
  }
  const pages = new Set([1, totalPages, safePage, safePage - 1, safePage + 1])
  const sorted = [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b)
  const result = []
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) {
      result.push(`ellipsis-${sorted[i - 1]}`)
    }
    result.push(sorted[i])
  }
  return result
}

export default function TablePagination({
  totalItems,
  currentPage,
  pageSize = 10,
  onPageChange,
  itemLabel = 'registros',
}) {
  if (!totalItems || totalItems <= 0) return null

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const safePage = Math.min(Math.max(1, currentPage), totalPages)
  const startItem = (safePage - 1) * pageSize + 1
  const endItem = Math.min(totalItems, safePage * pageSize)
  const pages = getVisiblePages(safePage, totalPages)

  const navBtnStyle = (disabled) => ({
    minWidth: '34px',
    height: '34px',
    padding: '0 10px',
    borderRadius: '10px',
    border: '1px solid #dbe4da',
    background: disabled ? '#f8faf7' : '#ffffff',
    color: disabled ? '#94a3b8' : '#111d15',
    fontSize: '0.8rem',
    fontWeight: 700,
    cursor: disabled ? 'not-allowed' : 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '4px',
    transition: 'all 0.15s ease',
  })

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        padding: '14px 18px',
        marginTop: '14px',
        background: '#ffffff',
        border: '1px solid #e3e8e2',
        borderRadius: '16px',
        boxShadow: '0 4px 14px rgba(17, 29, 21, 0.03)',
      }}
      role="navigation"
      aria-label="Paginación de tabla"
    >
      <div style={{ fontSize: '0.82rem', color: '#5f7165', fontWeight: 600 }}>
        Mostrando <strong style={{ color: '#111d15' }}>{startItem}–{endItem}</strong> de{' '}
        <strong style={{ color: '#111d15' }}>{totalItems}</strong> {itemLabel}{' '}
        <span style={{ color: '#8fa295' }}>· {pageSize} por página</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
        <button
          type="button"
          disabled={safePage <= 1}
          onClick={() => onPageChange(safePage - 1)}
          style={navBtnStyle(safePage <= 1)}
          aria-label="Página anterior"
        >
          <i className="bi bi-chevron-left"></i>
          <span className="d-none d-sm-inline">Anterior</span>
        </button>

        {pages.map((entry) => {
          if (typeof entry === 'string') {
            return (
              <span key={entry} style={{ padding: '0 4px', color: '#8fa295', fontWeight: 700 }}>
                …
              </span>
            )
          }
          const isActive = entry === safePage
          return (
            <button
              key={entry}
              type="button"
              onClick={() => onPageChange(entry)}
              aria-current={isActive ? 'page' : undefined}
              style={{
                minWidth: '34px',
                height: '34px',
                padding: '0 10px',
                borderRadius: '10px',
                border: isActive ? '1px solid #111d15' : '1px solid #dbe4da',
                background: isActive ? '#111d15' : '#ffffff',
                color: isActive ? '#c4f039' : '#111d15',
                fontSize: '0.82rem',
                fontWeight: isActive ? 800 : 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s ease',
              }}
            >
              {entry}
            </button>
          )
        })}

        <button
          type="button"
          disabled={safePage >= totalPages}
          onClick={() => onPageChange(safePage + 1)}
          style={navBtnStyle(safePage >= totalPages)}
          aria-label="Página siguiente"
        >
          <span className="d-none d-sm-inline">Siguiente</span>
          <i className="bi bi-chevron-right"></i>
        </button>
      </div>
    </div>
  )
}
