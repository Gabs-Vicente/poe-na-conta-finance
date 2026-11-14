import type React from 'react'
import { type Data, type Expense, type Occurrence } from '../finance'
import { categorySymbol, money, type MainView, type SortOrder } from '../utils/format'

type TransactionsTableProps = {
  view: MainView
  theme: 'light' | 'dark'
  data: Data
  current: Occurrence[]
  filtered: Occurrence[]
  total: number
  reimbursementTotal: number
  filteredPersonalTotal: number
  filteredReimbursementTotal: number
  filteredInvoiceTotal: number
  hasActiveFilters: boolean
  query: string
  categoryFilter: string
  methodFilter: string
  cardFilter: string
  sortOrder: SortOrder
  selectedExpenseIds: string[]
  selectedVisibleIds: string[]
  allVisibleSelected: boolean
  filteredExpenseIds: string[]
  onQueryChange: (value: string) => void
  onCategoryFilterChange: (value: string) => void
  onMethodFilterChange: (value: string) => void
  onCardFilterChange: (value: string) => void
  onSortOrderChange: (value: SortOrder) => void
  onClearAllFilters: () => void
  onToggleSelectAllVisible: (checked: boolean) => void
  onToggleSelectExpense: (id: string, checked: boolean) => void
  onDeleteSelectedExpenses: () => void
  onDownloadCsv: () => void
  onEditExpense: (expense: Expense) => void
  onDuplicateExpense: (expense: Expense) => void
  onDeleteExpense: (id: string) => void
  personalValue: (occurrence: Occurrence) => number
  owedBy: (occurrence: Occurrence) => string
}

export function TransactionsTable({
  view,
  theme,
  data,
  current,
  filtered,
  total,
  reimbursementTotal,
  filteredPersonalTotal,
  filteredReimbursementTotal,
  filteredInvoiceTotal,
  hasActiveFilters,
  query,
  categoryFilter,
  methodFilter,
  cardFilter,
  sortOrder,
  selectedExpenseIds,
  selectedVisibleIds,
  allVisibleSelected,
  filteredExpenseIds,
  onQueryChange,
  onCategoryFilterChange,
  onMethodFilterChange,
  onCardFilterChange,
  onSortOrderChange,
  onClearAllFilters,
  onToggleSelectAllVisible,
  onToggleSelectExpense,
  onDeleteSelectedExpenses,
  onDownloadCsv,
  onEditExpense,
  onDuplicateExpense,
  onDeleteExpense,
  personalValue,
  owedBy,
}: TransactionsTableProps) {
  const closeActionMenu = (event: React.MouseEvent<HTMLButtonElement>, action: () => void) => {
    event.currentTarget.closest('details')?.removeAttribute('open')
    action()
  }

  const toggleColumnSort = (column: 'desc' | 'date' | 'value') => {
    if (column === 'date') {
      onSortOrderChange(sortOrder === 'date-desc' ? 'date-asc' : 'date-desc')
    } else if (column === 'value') {
      onSortOrderChange(sortOrder === 'value-desc' ? 'value-asc' : 'value-desc')
    } else {
      onSortOrderChange(sortOrder === 'desc-asc' ? 'date-desc' : 'desc-asc')
    }
  }

  return (
    <section className="panel transactions data-page-table">
      <div className="panel-head">
        <div>
          <h2>{view === 'Relatórios' ? 'Relatório de despesas' : 'Todos os lançamentos'}</h2>
          <p>{view === 'Relatórios' ? 'Gastos pessoais e valores atribuídos a participantes.' : 'Consulte, ordene ou filtre por categoria, forma de pagamento ou cartão.'}</p>
        </div>
        <button className="export-btn" aria-label="Exportar CSV" onClick={onDownloadCsv}>
          ↓ <span>Exportar CSV</span>
        </button>
      </div>
      <div className="data-summary">
        <div>
          <span>Gastos pessoais{hasActiveFilters ? ' (filtro)' : ''}</span>
          <b>{money(hasActiveFilters ? filteredPersonalTotal : total)}</b>
        </div>
        <div>
          <span>A receber{hasActiveFilters ? ' (filtro)' : ''}</span>
          <b>{money(hasActiveFilters ? filteredReimbursementTotal : reimbursementTotal)}</b>
        </div>
        {(cardFilter !== 'Todos os cartões' || methodFilter.startsWith('Crédito')) && (
          <div>
            <span>Total na fatura</span>
            <b>{money(filteredInvoiceTotal)}</b>
          </div>
        )}
        <div>
          <span>Lançamentos</span>
          <b>{hasActiveFilters ? `${filtered.length} de ${current.length}` : current.length}</b>
        </div>
      </div>
      <div className="filters">
        <label className="search">
          <span>⌕</span>
          <input aria-label="Buscar lançamentos" placeholder="Buscar lançamento..." value={query} onChange={e => onQueryChange(e.target.value)} />
        </label>
        <select aria-label="Filtrar por categoria" value={categoryFilter} onChange={e => onCategoryFilterChange(e.target.value)}>
          <option>Todas as categorias</option>
          {data.categories.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select
          aria-label="Filtrar por forma de pagamento"
          value={methodFilter}
          onChange={e => {
            const next = e.target.value
            onMethodFilterChange(next)
            if (next === 'PIX' || next === 'Débito' || next === 'Dinheiro') onCardFilterChange('Todos os cartões')
          }}
        >
          <option>Todos os pagamentos</option>
          <option>PIX</option>
          <option>Débito</option>
          <option>Dinheiro</option>
          <option>Crédito (todos)</option>
          <option>Crédito à vista</option>
          <option>Crédito parcelado</option>
        </select>
        {data.cards.length > 0 && (
          <select
            aria-label="Filtrar por cartão"
            value={cardFilter}
            onChange={e => {
              const next = e.target.value
              onCardFilterChange(next)
              if (next !== 'Todos os cartões' && (methodFilter === 'PIX' || methodFilter === 'Débito' || methodFilter === 'Dinheiro')) {
                onMethodFilterChange('Todos os pagamentos')
              }
            }}
          >
            <option>Todos os cartões</option>
            {data.cards.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        )}
        <select aria-label="Ordenar lançamentos" value={sortOrder} onChange={e => onSortOrderChange(e.target.value as SortOrder)}>
          <option value="date-desc">Ordenar: Mais recentes</option>
          <option value="date-asc">Ordenar: Mais antigos</option>
          <option value="value-desc">Ordenar: Maior valor</option>
          <option value="value-asc">Ordenar: Menor valor</option>
          <option value="desc-asc">Ordenar: Descrição (A–Z)</option>
        </select>
        {(hasActiveFilters || sortOrder !== 'date-desc') && (
          <button type="button" className="cancel-btn filter-clear-btn" onClick={onClearAllFilters}>
            Limpar filtros
          </button>
        )}
      </div>
      {selectedVisibleIds.length > 0 && (
        <div className="bulk-actions-bar" role="region" aria-label="Ações em massa">
          <span className="bulk-actions-count">
            <b>{selectedVisibleIds.length}</b> {selectedVisibleIds.length === 1 ? 'item selecionado' : 'itens selecionados'}
          </span>
          <div className="bulk-actions-buttons">
            <button type="button" className="cancel-btn bulk-clear-btn" onClick={() => onToggleSelectAllVisible(false)}>
              Limpar seleção
            </button>
            <button type="button" className="danger-btn bulk-delete-btn" onClick={onDeleteSelectedExpenses}>
              Excluir selecionados ({selectedVisibleIds.length})
            </button>
          </div>
        </div>
      )}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th className="col-select">
                <input
                  type="checkbox"
                  className="row-checkbox"
                  aria-label="Selecionar todos os lançamentos visíveis"
                  checked={allVisibleSelected}
                  disabled={!filteredExpenseIds.length}
                  onChange={e => onToggleSelectAllVisible(e.target.checked)}
                />
              </th>
              <th className="col-desc">
                <button type="button" className={`th-sort-btn ${sortOrder === 'desc-asc' ? 'is-sorted' : ''}`} onClick={() => toggleColumnSort('desc')}>
                  DESCRIÇÃO {sortOrder === 'desc-asc' ? '↑' : ''}
                </button>
              </th>
              <th className="col-category">CATEGORIA</th>
              <th className="col-date">
                <button type="button" className={`th-sort-btn ${sortOrder.startsWith('date-') ? 'is-sorted' : ''}`} onClick={() => toggleColumnSort('date')}>
                  DATA {sortOrder === 'date-desc' ? '↓' : sortOrder === 'date-asc' ? '↑' : ''}
                </button>
              </th>
              <th className="col-method">PAGAMENTO</th>
              <th className="right col-value">
                <button type="button" className={`th-sort-btn right ${sortOrder.startsWith('value-') ? 'is-sorted' : ''}`} onClick={() => toggleColumnSort('value')}>
                  PARTE PESSOAL {sortOrder === 'value-desc' ? '↓' : sortOrder === 'value-asc' ? '↑' : ''}
                </button>
              </th>
              <th className="col-actions" />
            </tr>
          </thead>
          <tbody>
            {filtered.map(e => {
              const cat = data.categories.find(c => c.id === e.category)
              const txCard = e.method.startsWith('Crédito') ? (data.cards.find(c => c.id === e.cardId) || data.cards[0]) : undefined
              const own = personalValue(e)
              const shared = e.allocatedShares.reduce((sum, share) => sum + share.amount, 0)
              const debtor = owedBy(e)
              const shortDate = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(new Date(`${e.date}T12:00:00`)).replace('.', '')
              const isSelected = selectedExpenseIds.includes(e.id)
              return (
                <tr key={`${e.id}-${e.month}`} className={isSelected ? 'is-selected' : ''}>
                  <td className="col-select">
                    <input
                      type="checkbox"
                      className="row-checkbox"
                      aria-label={`Selecionar ${e.description}`}
                      checked={isSelected}
                      onChange={ev => onToggleSelectExpense(e.id, ev.target.checked)}
                    />
                  </td>
                  <td className="col-desc">
                    <div className="desc">
                      <span className="category-icon" style={{ color: cat?.color, background: `${cat?.color}18` }}>
                        {categorySymbol(e.category)}
                      </span>
                      <span className="desc-text">
                        <b>{e.description}</b>
                        <small>
                          {e.installments > 1 ? `Parcela ${e.part} de ${e.installments}` : 'Despesa'}
                          {shared > 0 ? ` · ${debtor}` : ''}
                        </small>
                        <small className="mobile-tx-meta">
                          {shortDate} · {cat?.name || 'Sem categoria'} · {e.method}
                          {txCard ? ` (${txCard.name})` : ''}
                        </small>
                      </span>
                    </div>
                  </td>
                  <td className="col-category">
                    <span className="category-label">
                      <i style={{ background: cat?.color }} />
                      {cat?.name || 'Sem categoria'}
                    </span>
                  </td>
                  <td className="date-cell col-date">
                    {new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${e.date}T12:00:00`))}
                  </td>
                  <td className="col-method">
                    <span className={`method ${e.method.startsWith('Crédito') ? 'credit' : ''}`}>
                      {e.method}
                      {txCard ? ` · ${txCard.name}` : ''}
                    </span>
                  </td>
                  <td className="right value col-value">{money(own)}</td>
                  <td className="col-actions">
                    <details className="row-actions">
                      <summary aria-label={`Ações para ${e.description}`} title="Ações">···</summary>
                      <div className={`row-action-menu ${theme === 'dark' ? 'is-dark' : 'is-light'}`}>
                        <button onClick={event => closeActionMenu(event, () => onEditExpense(e))}>Editar</button>
                        <button onClick={event => closeActionMenu(event, () => onDuplicateExpense(e))}>Duplicar</button>
                        <button className="danger" onClick={event => closeActionMenu(event, () => onDeleteExpense(e.id))}>Excluir</button>
                      </div>
                    </details>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {!filtered.length && <div className="empty">Nenhum lançamento encontrado neste mês.</div>}
      </div>
      <div className="table-foot">
        <span>
          Mostrando <b>{filtered.length}</b> de <b>{current.length}</b> lançamentos
        </span>
        <span>
          Gastos pessoais <b>{money(hasActiveFilters ? filteredPersonalTotal : total)}</b> · A receber <b>{money(hasActiveFilters ? filteredReimbursementTotal : reimbursementTotal)}</b>
        </span>
      </div>
    </section>
  )
}
