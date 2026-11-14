import type React from 'react'
import { type Data, type Recurrence } from '../finance'
import { money, monthName } from '../utils/format'

type RecurrencesViewProps = {
  data: Data
  month: string
  theme: 'light' | 'dark'
  recurrences: Recurrence[]
  pendingRecurrences: Recurrence[]
  selectedRecurrences: string[]
  onSelectionChange: (selected: string[]) => void
  onConfirmRecurrences: () => void
  onSkipRecurrence: (id: string) => void
  onOpenRecurrence: (item?: Recurrence) => void
  onToggleRecurrenceActive: (item: Recurrence) => void
  onDeleteRecurrence: (item: Recurrence) => void
}

export function RecurrencesView({
  data,
  month,
  theme,
  recurrences,
  pendingRecurrences,
  selectedRecurrences,
  onSelectionChange,
  onConfirmRecurrences,
  onSkipRecurrence,
  onOpenRecurrence,
  onToggleRecurrenceActive,
  onDeleteRecurrence,
}: RecurrencesViewProps) {
  const closeActionMenu = (event: React.MouseEvent<HTMLButtonElement>, action: () => void) => {
    event.currentTarget.closest('details')?.removeAttribute('open')
    action()
  }

  return (
    <section className="recurrence-page">
      <div className="panel recurrence-review">
        <div className="panel-head">
          <div>
            <h2>Revisão de {monthName(month)}</h2>
            <p>Confirme só as cobranças que aconteceram neste mês.</p>
          </div>
          <span className="stat-symbol muted">↻</span>
        </div>
        {pendingRecurrences.length ? (
          <>
            <div className="recurrence-review-tools">
              <label>
                <input
                  type="checkbox"
                  checked={pendingRecurrences.every(item => selectedRecurrences.includes(item.id))}
                  onChange={event => onSelectionChange(event.target.checked ? pendingRecurrences.map(item => item.id) : [])}
                />{' '}
                Selecionar todas
              </label>
              <span>{pendingRecurrences.length} para revisar</span>
            </div>
            <div className="recurrence-list">
              {pendingRecurrences.map(item => {
                const category = data.categories.find(value => value.id === item.category)
                return (
                  <div className="recurrence-review-item" key={item.id}>
                    <input
                      type="checkbox"
                      aria-label={`Confirmar ${item.description}`}
                      checked={selectedRecurrences.includes(item.id)}
                      onChange={event => {
                        const current = new Set(selectedRecurrences)
                        if (event.target.checked) current.add(item.id)
                        else current.delete(item.id)
                        onSelectionChange([...current])
                      }}
                    />
                    <span className="category-icon" style={{ color: category?.color, background: `${category?.color}18` }}>
                      ↻
                    </span>
                    <span className="recurrence-info">
                      <b>{item.description}</b>
                      <small>
                        {category?.name || 'Sem categoria'} · Todo dia {item.day} · {item.method}
                      </small>
                    </span>
                    <b className="recurrence-amount">{money(item.amount)}</b>
                    <button type="button" className="recurrence-skip" onClick={() => onSkipRecurrence(item.id)}>
                      Pular
                    </button>
                  </div>
                )
              })}
            </div>
            <div className="recurrence-review-footer">
              <span>Os lançamentos confirmados entram na lista do mês.</span>
              <button className="primary" disabled={!selectedRecurrences.length} onClick={onConfirmRecurrences}>
                Confirmar {selectedRecurrences.length} {selectedRecurrences.length === 1 ? 'despesa' : 'despesas'}
              </button>
            </div>
          </>
        ) : (
          <div className="empty">Nenhuma cobrança pendente para revisar neste mês.</div>
        )}
      </div>
      <div className="panel recurrence-manage">
        <div className="panel-head">
          <div>
            <h2>Modelos mensais</h2>
            <p>Gerencie os valores e a frequência das despesas.</p>
          </div>
          <span className="recurrence-count">{recurrences.filter(item => item.active).length} ativas</span>
        </div>
        {recurrences.length ? (
          <div className="recurrence-list">
            {recurrences.map(item => {
              const category = data.categories.find(value => value.id === item.category)
              return (
                <div className={`recurrence-template ${item.active ? '' : 'is-paused'}`} key={item.id}>
                  <span className="category-icon" style={{ color: category?.color, background: `${category?.color}18` }}>
                    ↻
                  </span>
                  <span className="recurrence-info">
                    <b>{item.description}</b>
                    <small>
                      {category?.name || 'Sem categoria'} · Dia {item.day} · {item.active ? 'Ativa' : 'Pausada'}
                    </small>
                  </span>
                  <b className="recurrence-amount">{money(item.amount)}</b>
                  <details className="row-actions">
                    <summary aria-label={`Ações para ${item.description}`} title="Ações">···</summary>
                    <div className={`row-action-menu ${theme === 'dark' ? 'is-dark' : 'is-light'}`}>
                      <button onClick={event => closeActionMenu(event, () => onOpenRecurrence(item))}>Editar</button>
                      <button onClick={event => closeActionMenu(event, () => onToggleRecurrenceActive(item))}>
                        {item.active ? 'Pausar' : 'Reativar'}
                      </button>
                      <button className="danger" onClick={event => closeActionMenu(event, () => onDeleteRecurrence(item))}>
                        Excluir
                      </button>
                    </div>
                  </details>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="empty">Cadastre seu primeiro modelo mensal para revisar cobranças recorrentes aqui.</div>
        )}
      </div>
    </section>
  )
}
