import type React from 'react'
import { type Category, type Data, type InstallmentReliefSummary, type Method, type Occurrence } from '../finance'
import { money, monthName, shortMonthYear } from '../utils/format'

type CategoryRankingItem = Category & {
  count: number
  total: number
  prevTotal: number
  percentage: number
  diffPercent: number | null
}

type MethodReportItem = {
  method: Method
  count: number
  personalTotal: number
  grossTotal: number
  percentage: number
  isCredit: boolean
}

type ReportsViewProps = {
  data: Data
  total: number
  directPersonalTotal: number
  creditPersonalTotal: number
  directSharePercent: number
  creditSharePercent: number
  installmentOccurrences: Occurrence[]
  installmentPersonalTotal: number
  installmentSharePercent: number
  installmentRelief: InstallmentReliefSummary
  biggestPersonalExpense: Occurrence | undefined
  averagePersonalTicket: number
  reportCategoryRanking: CategoryRankingItem[]
  reportMethods: MethodReportItem[]
  categoryFilter: string
  methodFilter: string
  onCategoryFilterChange: (value: string) => void
  onMethodFilterChange: (value: string) => void
  onCardFilterChange: (value: string) => void
  personalValue: (occurrence: Occurrence) => number
  children: React.ReactNode
}

export function ReportsView({
  data,
  total,
  directPersonalTotal,
  creditPersonalTotal,
  directSharePercent,
  creditSharePercent,
  installmentOccurrences,
  installmentPersonalTotal,
  installmentSharePercent,
  installmentRelief,
  biggestPersonalExpense,
  averagePersonalTicket,
  reportCategoryRanking,
  reportMethods,
  categoryFilter,
  methodFilter,
  onCategoryFilterChange,
  onMethodFilterChange,
  onCardFilterChange,
  personalValue,
  children,
}: ReportsViewProps) {
  return (
    <section className="data-page reports-page">
      <div className="reports-kpi-grid">
        <article className="panel report-kpi-card">
          <div className="stat-top">
            <span>Imediato vs. Fatura de cartão</span>
            <span className="stat-symbol">⇄</span>
          </div>
          <div className="report-kpi-split">
            <div>
              <small>PIX, Débito e Dinheiro</small>
              <strong>{money(directPersonalTotal)}</strong>
              <span>{directSharePercent}% do mês</span>
            </div>
            <div className="right">
              <small>Cartão de crédito</small>
              <strong>{money(creditPersonalTotal)}</strong>
              <span>{creditSharePercent}% do mês</span>
            </div>
          </div>
          <div className="report-split-bar" aria-hidden="true">
            <i className="split-direct" style={{ width: `${total > 0 ? directSharePercent : 50}%` }} />
            <i className="split-credit" style={{ width: `${total > 0 ? creditSharePercent : 50}%` }} />
          </div>
        </article>
        <article className="panel report-kpi-card">
          <div className="stat-top">
            <span>Peso dos parcelamentos</span>
            <span className="stat-symbol muted">◷</span>
          </div>
          <strong>{money(installmentPersonalTotal)}</strong>
          <div className="stat-foot">
            {installmentOccurrences.length
              ? `${installmentSharePercent}% dos seus gastos vêm de ${installmentOccurrences.length} ${installmentOccurrences.length === 1 ? 'parcela ativa' : 'parcelas ativas'}`
              : 'Nenhuma parcela ativa neste mês'}
          </div>
          <div className="track report-kpi-track">
            <i style={{ width: `${Math.min(100, installmentSharePercent)}%`, background: '#6a7ba2' }} />
          </div>
        </article>
        <article className="panel report-kpi-card">
          <div className="stat-top">
            <span>Maior gasto pessoal e ticket médio</span>
            <span className="stat-symbol orange">✳</span>
          </div>
          <strong>{biggestPersonalExpense ? money(personalValue(biggestPersonalExpense)) : money(0)}</strong>
          <div className="stat-foot">
            {biggestPersonalExpense
              ? `${biggestPersonalExpense.description} · Ticket médio: ${money(averagePersonalTicket)}`
              : 'Adicione despesas para calcular o ticket médio'}
          </div>
        </article>
      </div>
      <div className="reports-panels-grid">
        <section className="panel report-panel">
          <div className="panel-head">
            <div>
              <h2>Ranking por categoria</h2>
              <p>Clique em uma categoria para filtrar a tabela abaixo.</p>
            </div>
            {categoryFilter !== 'Todas as categorias' && (
              <button type="button" className="text-btn" onClick={() => onCategoryFilterChange('Todas as categorias')}>
                Mostrar todas
              </button>
            )}
          </div>
          {reportCategoryRanking.length ? (
            <div className="report-ranking-list">
              {reportCategoryRanking.map(cat => {
                const isActive = categoryFilter === cat.id
                return (
                  <button
                    type="button"
                    key={cat.id}
                    className={`report-ranking-row ${isActive ? 'is-active' : ''}`}
                    onClick={() => onCategoryFilterChange(isActive ? 'Todas as categorias' : cat.id)}
                  >
                    <div className="report-ranking-top">
                      <span className="report-ranking-name">
                        <i className="dot" style={{ background: cat.color }} />
                        <b>{cat.name}</b>
                        <small>{cat.count} {cat.count === 1 ? 'item' : 'itens'}</small>
                      </span>
                      <span className="report-ranking-values">
                        <span className={`report-diff-badge ${cat.diffPercent !== null && cat.diffPercent > 0 ? 'is-up' : cat.diffPercent !== null && cat.diffPercent < 0 ? 'is-down' : ''}`}>
                          {cat.total === 0
                            ? 'R$ 0 neste mês'
                            : cat.diffPercent === null
                              ? 'Novo no mês'
                              : cat.diffPercent === 0
                                ? 'Igual ao mês ant.'
                                : `${cat.diffPercent > 0 ? '↑' : '↓'} ${Math.abs(cat.diffPercent)}% vs. mês ant.`}
                        </span>
                        <b>{money(cat.total)}</b>
                        <small>{cat.percentage}%</small>
                      </span>
                    </div>
                    <div className="track">
                      <i style={{ width: `${cat.total > 0 ? Math.max(4, cat.percentage) : 0}%`, background: cat.color }} />
                    </div>
                  </button>
                )
              })}
            </div>
          ) : (
            <div className="empty compact">Sem gastos registrados neste mês para ranquear categorias.</div>
          )}
        </section>
        <section className="panel report-panel">
          <div className="panel-head">
            <div>
              <h2>Por forma de pagamento</h2>
              <p>Compare gastos à vista (PIX, Débito, Dinheiro) e no Crédito.</p>
            </div>
            {methodFilter !== 'Todos os pagamentos' && (
              <button type="button" className="text-btn" onClick={() => onMethodFilterChange('Todos os pagamentos')}>
                Mostrar todos
              </button>
            )}
          </div>
          <div className="report-ranking-list">
            {reportMethods.map(item => {
              const isActive = methodFilter === item.method
              return (
                <button
                  type="button"
                  key={item.method}
                  className={`report-ranking-row ${isActive ? 'is-active' : ''}`}
                  onClick={() => {
                    const next = isActive ? 'Todos os pagamentos' : item.method
                    onMethodFilterChange(next)
                    if (next === 'PIX' || next === 'Débito' || next === 'Dinheiro') onCardFilterChange('Todos os cartões')
                  }}
                >
                  <div className="report-ranking-top">
                    <span className="report-ranking-name">
                      <span className={`method ${item.isCredit ? 'credit' : ''}`}>{item.method}</span>
                      <small>{item.count} {item.count === 1 ? 'lançamento' : 'lançamentos'}</small>
                    </span>
                    <span className="report-ranking-values">
                      {item.grossTotal > item.personalTotal && <small className="report-gross-hint">Total: {money(item.grossTotal)}</small>}
                      <b>{money(item.personalTotal)}</b>
                      <small>{item.percentage}%</small>
                    </span>
                  </div>
                  <div className="track">
                    <i style={{ width: `${item.personalTotal > 0 ? Math.max(4, item.percentage) : 0}%`, background: item.isCredit ? '#6a7ba2' : '#5b8a72' }} />
                  </div>
                </button>
              )
            })}
          </div>
        </section>
      </div>
      {installmentRelief.items.length > 0 && (
        <section className="panel installment-relief-panel">
          <div className="panel-head">
            <div>
              <h2>Fim das parcelas (alívio de fatura)</h2>
              <p>Acompanhe quando cada compra parcelada termina e quanto libera no seu orçamento mensal.</p>
            </div>
            <span className="calendar-icon">◷</span>
          </div>
          <div className="relief-milestones-bar">
            {installmentRelief.milestones.map(milestone => (
              <div className="relief-milestone-chip" key={milestone.reliefMonth}>
                <span>A partir de <b>{monthName(milestone.reliefMonth)}</b></span>
                <strong>+{money(milestone.freedPersonalAmount)}<small>/mês livres</small></strong>
                <small>{milestone.count} {milestone.count === 1 ? 'parcelamento encerrado' : 'parcelamentos encerrados'} em {shortMonthYear(milestone.lastMonth)}</small>
              </div>
            ))}
          </div>
          <div className="relief-items-grid">
            {installmentRelief.items.map(item => {
              const cat = data.categories.find(c => c.id === item.category)
              const card = data.cards.find(c => c.id === item.cardId) || data.cards[0]
              const progressPct = Math.round((item.part / item.installments) * 100)
              return (
                <div className="relief-item-card" key={item.id}>
                  <div className="relief-item-top">
                    <div>
                      <b>{item.description}</b>
                      <small>
                        {cat?.name || 'Sem categoria'}
                        {card ? ` · ${card.name}` : ''}
                      </small>
                    </div>
                    <span className={`relief-part-pill ${item.remainingAfterCurrent === 0 ? 'is-last' : ''}`}>
                      Parcela {item.part}/{item.installments}
                    </span>
                  </div>
                  <div className="track">
                    <i style={{ width: `${progressPct}%`, background: cat?.color || '#6a7ba2' }} />
                  </div>
                  <div className="relief-item-foot">
                    <span>
                      {item.remainingAfterCurrent === 0
                        ? `Última parcela neste mês (${shortMonthYear(item.lastMonth)})`
                        : `Faltam ${item.remainingAfterCurrent} ${item.remainingAfterCurrent === 1 ? 'parcela' : 'parcelas'} · Última em ${shortMonthYear(item.lastMonth)}`}
                    </span>
                    <b>Libera {money(item.personalValue)}/mês em {shortMonthYear(item.reliefMonth)}</b>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}
      {children}
    </section>
  )
}
