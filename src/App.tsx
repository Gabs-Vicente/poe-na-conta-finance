import { useEffect, useMemo, useState } from 'react'
import './App.css'

type Method = 'PIX' | 'Débito' | 'Crédito à vista' | 'Crédito parcelado' | 'Transferência' | 'Dinheiro'
type Category = { id: string; name: string; color: string }
type Card = { id: string; name: string; closingDay: number; dueDay: number }
type Participant = { id: string; name: string }
type ParticipantShare = { participantId: string; amount: number; installment?: number }
type EntryKind = 'expense' | 'income'
type Expense = { id: string; description: string; amount: number; date: string; category: string; method: Method; cardId?: string; installments: number; firstMonth: string; kind?: EntryKind; shares?: ParticipantShare[] }
type Occurrence = Expense & { part: number; month: string; value: number; allocatedShares: ParticipantShare[] }
type Data = { categories: Category[]; cards: Card[]; participants?: Participant[]; expenses: Expense[] }
type ExpenseForm = { description: string; amount: string; date: string; category: string; method: Method; cardId: string; installments: string; kind: EntryKind; shares: { participantId: string; amount: string; installment: string }[] }
type SettingEditor = { kind: 'category' | 'card' | 'participant'; id?: string; name: string; color: string; closingDay: string; dueDay: string }

const seed: Data = {
  categories: [{ id: 'moradia', name: 'Moradia', color: '#6c7cf0' }, { id: 'alimentacao', name: 'Alimentação', color: '#f1a455' }, { id: 'transporte', name: 'Transporte', color: '#5ab89b' }, { id: 'lazer', name: 'Lazer', color: '#db77a6' }, { id: 'saude', name: 'Saúde', color: '#64a9cf' }, { id: 'renda', name: 'Renda', color: '#5ab89b' }],
  cards: [{ id: 'principal', name: 'Cartão principal', closingDay: 25, dueDay: 5 }],
  participants: [],
  expenses: [
    { id: 'e1', description: 'Aluguel', amount: 1850, date: '2026-11-05', category: 'moradia', method: 'PIX', installments: 1, firstMonth: '2026-11' },
    { id: 'e2', description: 'Mercado da semana', amount: 286.4, date: '2026-11-08', category: 'alimentacao', method: 'Débito', installments: 1, firstMonth: '2026-11' },
    { id: 'e3', description: 'Fone bluetooth', amount: 599.9, date: '2026-11-10', category: 'lazer', method: 'Crédito parcelado', cardId: 'principal', installments: 3, firstMonth: '2026-12' },
    { id: 'e4', description: 'Conta de luz', amount: 142.7, date: '2026-11-11', category: 'moradia', method: 'PIX', installments: 1, firstMonth: '2026-11' },
    { id: 'e5', description: 'Combustível', amount: 220, date: '2026-11-12', category: 'transporte', method: 'Crédito à vista', cardId: 'principal', installments: 1, firstMonth: '2026-12' },
  ],
}
const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
const shiftMonth = (key: string, amount: number) => { const [y, m] = key.split('-').map(Number); return monthKey(new Date(y, m - 1 + amount, 1)) }
const money = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const monthName = (key: string) => { const [y, m] = key.split('-').map(Number); return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(new Date(y, m - 1, 1)) }
const piePoint = (degrees: number, radius: number) => { const angle = (degrees - 90) * Math.PI / 180; return [50 + radius * Math.cos(angle), 50 + radius * Math.sin(angle)] }
const donutSlice = (start: number, end: number) => {
  const outerStart = piePoint(start, 46); const outerEnd = piePoint(end, 46)
  const innerEnd = piePoint(end, 28); const innerStart = piePoint(start, 28)
  const largeArc = end - start > 180 ? 1 : 0
  return `M ${outerStart[0]} ${outerStart[1]} A 46 46 0 ${largeArc} 1 ${outerEnd[0]} ${outerEnd[1]} L ${innerEnd[0]} ${innerEnd[1]} A 28 28 0 ${largeArc} 0 ${innerStart[0]} ${innerStart[1]} Z`
}
const readData = (): Data => { try { const raw = localStorage.getItem('conta-clara-v1'); if (!raw) return seed; const saved = JSON.parse(raw) as Data; return { ...saved, participants: saved.participants || [] } } catch { return seed } }
const buildOccurrences = (expenses: Expense[]): Occurrence[] => expenses.flatMap(expense => {
  const count = Math.max(1, Math.round(expense.installments || 1))
  const totalCents = Math.round(expense.amount * 100)
  const base = Math.floor(totalCents / count)
  const remainder = totalCents % count
  const values = Array.from({ length: count }, (_, i) => base + (i < remainder ? 1 : 0))
  const remaining = [...values]
  const allocations = (expense.shares || []).map(share => {
    const shareCents = Math.max(0, Math.round(share.amount * 100))
    if (share.installment && share.installment >= 1 && share.installment <= count) {
      const parts = Array.from({ length: count }, () => 0)
      const index = share.installment - 1
      parts[index] = Math.min(shareCents, remaining[index])
      remaining[index] -= parts[index]
      return { participantId: share.participantId, parts }
    }
    const shareBase = Math.floor(shareCents / count)
    const shareRemainder = shareCents % count
    const parts = Array.from({ length: count }, (_, i) => Math.min(shareBase + (i < shareRemainder ? 1 : 0), remaining[i]))
    parts.forEach((part, i) => { remaining[i] -= part })
    let unallocated = shareCents - parts.reduce((sum, part) => sum + part, 0)
    for (let i = 0; i < count && unallocated > 0; i++) { const extra = Math.min(unallocated, remaining[i]); parts[i] += extra; remaining[i] -= extra; unallocated -= extra }
    return { participantId: share.participantId, parts }
  })
  return values.map((value, i) => ({ ...expense, part: i + 1, month: shiftMonth(expense.firstMonth, i), value: value / 100, allocatedShares: allocations.map(share => ({ participantId: share.participantId, amount: share.parts[i] / 100 })).filter(share => share.amount > 0) }))
})
const today = new Date()

function App() {
  const [data, setData] = useState<Data>(readData)
  const [month, setMonth] = useState(monthKey(today))
  const [view, setView] = useState<'Visão geral' | 'Lançamentos' | 'Relatórios' | 'Ajustes'>('Visão geral')
  const [query, setQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('Todas as categorias')
  const [trendMode, setTrendMode] = useState<'past' | 'future' | 'custom'>('future')
  const [trendMonths, setTrendMonths] = useState(6)
  const [trendStart, setTrendStart] = useState(shiftMonth(monthKey(today), -5))
  const [trendEnd, setTrendEnd] = useState(monthKey(today))
  const [categoryPanelMode, setCategoryPanelMode] = useState<'categories' | 'transactions'>('categories')
  const [hoveredCategoryId, setHoveredCategoryId] = useState<string | null>(null)
  const [modal, setModal] = useState(false)
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null)
  const [settingsModal, setSettingsModal] = useState<SettingEditor | null>(null)
  const [form, setForm] = useState<ExpenseForm>({ description: '', amount: '', date: today.toISOString().slice(0, 10), category: '', method: 'PIX', cardId: '', installments: '1', kind: 'expense', shares: [] })
  const [shareError, setShareError] = useState('')
  useEffect(() => {
    const closeMenus = (event: MouseEvent) => {
      if (!(event.target instanceof Element) || !event.target.closest('.row-actions')) document.querySelectorAll<HTMLDetailsElement>('.row-actions[open]').forEach(menu => menu.removeAttribute('open'))
    }
    document.addEventListener('click', closeMenus)
    return () => document.removeEventListener('click', closeMenus)
  }, [])
  const save = (next: Data) => { setData(next); localStorage.setItem('conta-clara-v1', JSON.stringify(next)) }
  const occurrences = useMemo(() => buildOccurrences(data.expenses), [data.expenses])
  const current = occurrences.filter(e => e.month === month)
  const currentExpenses = current.filter(e => (e.kind || 'expense') === 'expense')
  const currentIncomes = current.filter(e => e.kind === 'income')
  const personalValue = (e: typeof occurrences[number]) => Math.max(0, e.value - e.allocatedShares.reduce((sum, share) => sum + share.amount, 0))
  const filtered = current.filter(e => e.description.toLowerCase().includes(query.toLowerCase()) && (categoryFilter === 'Todas as categorias' || e.category === categoryFilter))
  const total = currentExpenses.reduce((sum, e) => sum + personalValue(e), 0)
  const incomeTotal = currentIncomes.reduce((sum, e) => sum + personalValue(e), 0)
  const reimbursementTotal = currentExpenses.reduce((sum, e) => sum + e.allocatedShares.reduce((shareSum, share) => shareSum + share.amount, 0), 0)
  const incomePassThrough = currentIncomes.reduce((sum, e) => sum + e.allocatedShares.reduce((shareSum, share) => shareSum + share.amount, 0), 0)
  const categoryTotals = data.categories.map(c => ({ ...c, total: currentExpenses.filter(e => e.category === c.id).reduce((s, e) => s + personalValue(e), 0) })).filter(c => c.total > 0).sort((a, b) => b.total - a.total)
  const reimbursementByParticipant = (data.participants || []).map(participant => ({ participant, current: currentExpenses.reduce((sum, e) => sum + e.allocatedShares.filter(s => s.participantId === participant.id).reduce((a, s) => a + s.amount, 0), 0), future: occurrences.filter(e => e.month > month && (e.kind || 'expense') === 'expense').reduce((sum, e) => sum + e.allocatedShares.filter(s => s.participantId === participant.id).reduce((a, s) => a + s.amount, 0), 0), passThrough: currentIncomes.reduce((sum, e) => sum + e.allocatedShares.filter(s => s.participantId === participant.id).reduce((a, s) => a + s.amount, 0), 0) })).filter(x => x.current > 0 || x.future > 0 || x.passThrough > 0)
  const nextMonths = Array.from({ length: 5 }, (_, i) => shiftMonth(month, i))
  const previousMonth = shiftMonth(month, -1)
  const previousTotal = occurrences.filter(e => e.month === previousMonth && (e.kind || 'expense') === 'expense').reduce((s, e) => s + personalValue(e), 0)
  const monthChange = previousTotal ? ((total - previousTotal) / previousTotal) * 100 : null
  const upcomingTotal = occurrences.filter(e => e.month > month && (e.kind || 'expense') === 'expense').reduce((s, e) => s + personalValue(e), 0)
  const installmentTotal = currentExpenses.filter(e => e.installments > 1).reduce((s, e) => s + personalValue(e), 0)
  const customStart = trendStart <= trendEnd ? trendStart : trendEnd
  const customEnd = trendStart <= trendEnd ? trendEnd : trendStart
  const trendCount = trendMode === 'custom'
    ? Math.min(24, Math.max(1, (Number(customEnd.slice(0, 4)) - Number(customStart.slice(0, 4))) * 12 + Number(customEnd.slice(5, 7)) - Number(customStart.slice(5, 7)) + 1))
    : trendMonths
  const trendAnchor = trendMode === 'custom' ? customStart : month
  const monthlyTrend = Array.from({ length: trendCount }, (_, i) => {
    const key = shiftMonth(trendAnchor, trendMode === 'past' ? i - trendCount : trendMode === 'future' ? i : i)
    return { month: key, total: occurrences.filter(e => e.month === key && (e.kind || 'expense') === 'expense').reduce((s, e) => s + personalValue(e), 0) }
  })
  const categoryTotal = categoryTotals.reduce((sum, c) => sum + c.total, 0)
  let pieCursor = 0
  const pieSlices = categoryTotals.map(category => { const start = pieCursor; pieCursor += category.total / categoryTotal * 360; return { category, start, end: pieCursor, percentage: Math.round(category.total / categoryTotal * 100) } })
  const hoveredCategory = pieSlices.find(slice => slice.category.id === hoveredCategoryId)
  const closeActionMenu = (event: React.MouseEvent<HTMLButtonElement>, action: () => void) => { event.currentTarget.closest('details')?.removeAttribute('open'); action() }

  const addExpense = (ev: React.FormEvent) => {
    ev.preventDefault()
    const n = Number(form.installments)
    const monthOfPurchase = monthKey(new Date(`${form.date}T12:00:00`))
    const amount = Number(form.amount)
    const shares = form.shares.map(share => ({ participantId: share.participantId, amount: Number(share.amount) || 0, installment: form.kind === 'expense' && form.method === 'Crédito parcelado' && share.installment !== 'all' ? Number(share.installment) : undefined })).filter(share => share.amount > 0)
    const count = form.kind === 'expense' && form.method === 'Crédito parcelado' ? Math.max(1, n) : 1
    const totalCents = Math.round(amount * 100)
    const partValues = Array.from({ length: count }, (_, i) => Math.floor(totalCents / count) + (i < totalCents % count ? 1 : 0))
    const allocated = Array.from({ length: count }, () => 0)
    for (const share of shares) {
      const cents = Math.round(share.amount * 100)
      if (share.installment && share.installment > count) { setShareError('Uma atribuição aponta para uma parcela que não existe. Ajuste o número de parcelas ou a seleção.'); return }
      if (share.installment) allocated[share.installment - 1] += cents
      else for (let i = 0; i < count; i++) allocated[i] += Math.floor(cents / count) + (i < cents % count ? 1 : 0)
    }
    if (allocated.some((cents, i) => cents > partValues[i])) { setShareError('A soma atribuída aos participantes não pode superar o valor da parcela correspondente.'); return }
    const card = form.kind === 'expense' ? data.cards.find(c => c.id === form.cardId) : undefined
    let firstMonth = monthOfPurchase
    if (form.kind === 'expense' && form.method.startsWith('Crédito') && card) firstMonth = shiftMonth(monthOfPurchase, Number(form.date.slice(-2)) >= card.closingDay ? 1 : 0)
    const entry: Expense = { id: editingExpenseId || crypto.randomUUID(), description: form.description.trim(), amount, date: form.date, category: form.category || (form.kind === 'income' ? '' : data.categories[0]?.id || ''), method: form.method, cardId: card?.id, installments: form.kind === 'expense' && form.method === 'Crédito parcelado' ? Math.max(1, n) : 1, firstMonth, kind: form.kind, shares }
    save({ ...data, expenses: editingExpenseId ? data.expenses.map(e => e.id === editingExpenseId ? entry : e) : [entry, ...data.expenses] })
    setModal(false)
    setEditingExpenseId(null)
    setShareError('')
    setForm({ ...form, description: '', amount: '', installments: '1', shares: [] })
  }
  const editExpense = (expense: Expense) => {
    setEditingExpenseId(expense.id)
    setForm({ description: expense.description, amount: String(expense.amount), date: expense.date, category: expense.category, method: expense.method, cardId: expense.cardId || '', installments: String(expense.installments), kind: expense.kind || 'expense', shares: (expense.shares || []).map(share => ({ participantId: share.participantId, amount: String(share.amount), installment: share.installment ? String(share.installment) : 'all' })) })
    setShareError('')
    setModal(true)
  }
  const closeExpenseModal = () => { setModal(false); setEditingExpenseId(null); setShareError('') }
  const deleteExpense = (id: string) => save({ ...data, expenses: data.expenses.filter(e => e.id !== id) })
  const downloadCsv = () => {
    const rows = [['Tipo','Descrição','Valor total da parcela','Parte pessoal','A receber / parte de terceiro','Parcela','Mês','Categoria','Pagamento','Participantes'], ...current.map(e => [e.kind === 'income' ? 'Receita' : 'Despesa', e.description, e.value.toFixed(2), personalValue(e).toFixed(2), e.allocatedShares.reduce((sum, share) => sum + share.amount, 0).toFixed(2), `${e.part}/${e.installments}`, e.month, data.categories.find(c => c.id === e.category)?.name || '', e.method, e.allocatedShares.map(share => data.participants?.find(p => p.id === share.participantId)?.name || 'Participante').join(', ')])]
    const blob = new Blob(['\ufeff' + rows.map(r => r.join(';')).join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `relatorio-${month}.csv`; a.click(); URL.revokeObjectURL(url)
  }
  const openCategory = (category?: Category) => setSettingsModal({ kind: 'category', id: category?.id, name: category?.name || '', color: category?.color || '#65a987', closingDay: '25', dueDay: '5' })
  const openCard = (card?: Card) => setSettingsModal({ kind: 'card', id: card?.id, name: card?.name || '', color: '#65a987', closingDay: String(card?.closingDay || 25), dueDay: String(card?.dueDay || 5) })
  const openParticipant = (participant?: Participant) => setSettingsModal({ kind: 'participant', id: participant?.id, name: participant?.name || '', color: '#65a987', closingDay: '25', dueDay: '5' })
  const saveSetting = (ev: React.FormEvent) => {
    ev.preventDefault(); if (!settingsModal) return
    const { kind, id, name, color, closingDay, dueDay } = settingsModal
    if (kind === 'category') { const category: Category = { id: id || crypto.randomUUID(), name: name.trim(), color }; save({ ...data, categories: id ? data.categories.map(c => c.id === id ? category : c) : [...data.categories, category] }) }
    else if (kind === 'card') { const close = Number(closingDay); const due = Number(dueDay); if (close < 1 || close > 31 || due < 1 || due > 31) return; const card: Card = { id: id || crypto.randomUUID(), name: name.trim(), closingDay: close, dueDay: due }; save({ ...data, cards: id ? data.cards.map(c => c.id === id ? card : c) : [...data.cards, card] }) }
    else { const participant: Participant = { id: id || crypto.randomUUID(), name: name.trim() }; save({ ...data, participants: id ? (data.participants || []).map(p => p.id === id ? participant : p) : [...(data.participants || []), participant] }) }
    setSettingsModal(null)
  }
  const removeParticipant = (id: string) => {
    if (!window.confirm('Remover este participante e apagar suas atribuições dos lançamentos?')) return
    save({ ...data, participants: (data.participants || []).filter(p => p.id !== id), expenses: data.expenses.map(e => ({ ...e, shares: (e.shares || []).filter(share => share.participantId !== id) })) })
  }

  const transactionTable = <section className="panel transactions data-page-table">
    <div className="panel-head"><div><h2>{view === 'Relatórios' ? 'Relatório financeiro' : 'Todos os lançamentos'}</h2><p>{view === 'Relatórios' ? 'Despesas, receitas pessoais e valores atribuídos a participantes.' : 'Consulte, filtre e acompanhe suas movimentações.'}</p></div><button className="export-btn" onClick={downloadCsv}>↓ <span>Exportar CSV</span></button></div>
    <div className="data-summary"><div><span>Despesas pessoais</span><b>{money(total)}</b></div><div><span>Receitas pessoais</span><b>{money(incomeTotal)}</b></div><div><span>A receber</span><b>{money(reimbursementTotal)}</b></div><div><span>Lançamentos</span><b>{current.length}</b></div></div>
    <div className="filters"><label className="search"><span>⌕</span><input placeholder="Buscar lançamento..." value={query} onChange={e => setQuery(e.target.value)} /></label><select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}><option>Todas as categorias</option>{data.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
    <div className="table-wrap"><table><thead><tr><th>DESCRIÇÃO</th><th>CATEGORIA</th><th>DATA</th><th>PAGAMENTO</th><th className="right">PARTE PESSOAL</th><th /></tr></thead><tbody>{filtered.map(e => { const cat = data.categories.find(c => c.id === e.category); const own = personalValue(e); const shared = e.allocatedShares.reduce((sum, share) => sum + share.amount, 0); return <tr key={`${e.id}-${e.month}`}><td><div className="desc"><span className="category-icon" style={{ color: cat?.color, background: `${cat?.color}18` }}>{e.kind === 'income' ? '↗' : e.category === 'moradia' ? '⌂' : e.category === 'alimentacao' ? '◒' : e.category === 'transporte' ? '⌁' : e.category === 'lazer' ? '✧' : '＋'}</span><span><b>{e.description}</b><small>{e.kind === 'income' ? 'Receita' : e.installments > 1 ? `Parcela ${e.part} de ${e.installments}` : 'Despesa'}{shared > 0 ? ` · ${money(shared)} de terceiros` : ''}</small></span></div></td><td><span className="category-label"><i style={{ background: cat?.color }} />{cat?.name || 'Sem categoria'}</span></td><td className="date-cell">{new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${e.date}T12:00:00`))}</td><td><span className={`method ${e.kind === 'income' ? 'income-method' : e.method.startsWith('Crédito') ? 'credit' : ''}`}>{e.kind === 'income' ? `Entrada · ${e.method}` : e.method}</span></td><td className="right value">{money(own)}</td><td><details className="row-actions"><summary aria-label={`Ações para ${e.description}`} title="Ações">···</summary><div className="row-action-menu"><button onClick={event => closeActionMenu(event, () => editExpense(e))}>Editar</button><button className="danger" onClick={event => closeActionMenu(event, () => deleteExpense(e.id))}>Excluir</button></div></details></td></tr> })}</tbody></table>{!filtered.length && <div className="empty">Nenhum lançamento encontrado neste mês.</div>}</div>
    <div className="table-foot"><span>Mostrando <b>{filtered.length}</b> de <b>{current.length}</b> lançamentos</span><span>Despesas pessoais <b>{money(total)}</b> · Receitas <b>{money(incomeTotal)}</b></span></div>
  </section>

  return <div className="app-shell">
    <aside className="sidebar"><a className="brand" href="#" onClick={() => setView('Visão geral')}><span className="brand-mark">c</span><span>conta<span className="brand-light">clara</span><small>FINANÇAS PESSOAIS</small></span></a><div className="side-label">MENU</div><nav>{(['Visão geral','Lançamentos','Relatórios','Ajustes'] as const).map((v, i) => <button key={v} className={`nav-item ${view === v ? 'active' : ''}`} onClick={() => setView(v)}><span className="nav-icon">{['◫','↔','▥','⚙'][i]}</span>{v}</button>)}</nav><div className="side-bottom"><div className="privacy"><span className="lock">♧</span><div><b>Seus dados são privados</b><span>Salvos apenas neste dispositivo</span></div></div><div className="profile"><div className="avatar">GV</div><div><b>Meu espaço</b><span>Plano pessoal</span></div><span className="dots">···</span></div></div></aside>
    <main className="main"><header className="topbar"><div className="breadcrumb">Finanças <span>/</span> {view}</div><div className="top-actions"><span className="today">◷ &nbsp;{new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(today)}</span><button className="icon-btn" aria-label="Notificações">♧<i /></button><div className="avatar small">GV</div></div></header>
      <div className="content">
        <div className="heading-row"><div><div className="eyebrow">{new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }).format(today).toLocaleUpperCase('pt-BR')}</div><h1>{view}</h1><p className="subtitle">{view === 'Visão geral' ? 'Uma leitura clara dos seus gastos e compromissos.' : view === 'Lançamentos' ? 'Encontre e acompanhe cada movimentação.' : view === 'Relatórios' ? 'Entenda como seus gastos se distribuem ao longo do tempo.' : 'Personalize as categorias, cartões e participantes da sua rotina.'}</p></div>{view !== 'Ajustes' && <button className="primary" onClick={() => { setEditingExpenseId(null); setShareError(''); setForm({ description: '', amount: '', date: today.toISOString().slice(0, 10), category: data.categories[0]?.id || '', method: 'PIX', cardId: data.cards[0]?.id || '', installments: '1', kind: 'expense', shares: [] }); setModal(true) }}><span>＋</span> Novo lançamento</button>}</div>
        {view !== 'Ajustes' && <div className="monthbar"><button className="month-arrow" onClick={() => setMonth(shiftMonth(month, -1))}>‹</button><span>{monthName(month)}</span><button className="month-arrow" onClick={() => setMonth(shiftMonth(month, 1))}>›</button><button className="today-btn" onClick={() => setMonth(monthKey(today))}>Hoje</button></div>}

        {view === 'Ajustes' ? <section className="settings-grid">
          <div className="panel settings-panel"><div className="panel-head"><div><h2>Categorias</h2><p>Organize e identifique seus gastos.</p></div><button className="outline-btn" onClick={() => openCategory()}>＋ Nova categoria</button></div>{data.categories.map(c => <div className="setting-row" key={c.id}><i className="dot" style={{ background: c.color }} /><b>{c.name}</b><details className="row-actions"><summary aria-label={`Ações para a categoria ${c.name}`} title="Ações">···</summary><div className="row-action-menu"><button onClick={event => closeActionMenu(event, () => openCategory(c))}>Editar</button><button className="danger" onClick={event => closeActionMenu(event, () => save({ ...data, categories: data.categories.filter(x => x.id !== c.id) }))}>Remover</button></div></details></div>)}</div>
          <div className="panel settings-panel"><div className="panel-head"><div><h2>Cartões</h2><p>Configure fechamento e vencimento da fatura.</p></div><button className="outline-btn" onClick={() => openCard()}>＋ Novo cartão</button></div>{data.cards.map(c => <div className="setting-row" key={c.id}><span className="card-icon">▣</span><b>{c.name}</b><span className="card-days">Fecha dia {c.closingDay} · Vence dia {c.dueDay}</span><details className="row-actions"><summary aria-label={`Ações para o cartão ${c.name}`} title="Ações">···</summary><div className="row-action-menu"><button onClick={event => closeActionMenu(event, () => openCard(c))}>Editar</button><button className="danger" onClick={event => closeActionMenu(event, () => save({ ...data, cards: data.cards.filter(x => x.id !== c.id) }))}>Remover</button></div></details></div>)}</div>
          <div className="panel settings-panel"><div className="panel-head"><div><h2>Participantes</h2><p>Pessoas que podem ter parte em despesas ou receitas.</p></div><button className="outline-btn" onClick={() => openParticipant()}>＋ Novo participante</button></div>{(data.participants || []).length ? (data.participants || []).map(participant => <div className="setting-row" key={participant.id}><span className="participant-avatar">{participant.name.slice(0, 1).toUpperCase()}</span><b>{participant.name}</b><details className="row-actions"><summary aria-label={`Ações para ${participant.name}`} title="Ações">···</summary><div className="row-action-menu"><button onClick={event => closeActionMenu(event, () => openParticipant(participant))}>Editar</button><button className="danger" onClick={event => closeActionMenu(event, () => removeParticipant(participant.id))}>Remover</button></div></details></div>) : <div className="empty compact">Cadastre uma pessoa para compartilhar despesas e receitas.</div>}</div>
          <div className="panel backup"><h2>Seus dados</h2><p>Os lançamentos ficam salvos localmente neste navegador. Exporte o relatório mensal em CSV para guardar uma cópia.</p><button className="outline-btn" onClick={downloadCsv}>↓ Exportar mês em CSV</button></div>
        </section> : view === 'Visão geral' ? <>
          <section className="stats health-stats">
            <article className="stat-card balance-card"><div className="stat-top"><span>Despesas pessoais no mês</span><span className="stat-symbol">↘</span></div><strong>{money(total)}</strong><div className="stat-foot">Sua parte em {monthName(month)}</div><div className="sparkline"><svg viewBox="0 0 240 50" preserveAspectRatio="none"><path d="M0 40 C18 37 22 29 37 34 S56 31 67 30 S82 39 97 29 S118 24 129 29 S151 12 162 20 S178 29 187 19 S210 23 219 7 S233 17 240 6" fill="none" stroke="#7be1c4" strokeWidth="2" /></svg></div></article>
            <article className="stat-card"><div className="stat-top"><span>Receitas pessoais</span><span className="stat-symbol">↗</span></div><strong>{money(incomeTotal)}</strong><div className="stat-foot">Sua parte das entradas do mês</div></article>
            <article className="stat-card"><div className="stat-top"><span>A receber de terceiros</span><span className="stat-symbol orange">＋</span></div><strong>{money(reimbursementTotal)}</strong><div className="stat-foot">Despesas de terceiros neste período</div></article>
            <article className="stat-card"><div className="stat-top"><span>Parcelas pessoais</span><span className="stat-symbol purple">▤</span></div><strong>{money(installmentTotal)}</strong><div className="stat-foot">Sua parte das parcelas do mês</div></article>
            <article className="stat-card"><div className="stat-top"><span>Compromissos futuros</span><span className="stat-symbol muted">◷</span></div><strong>{money(upcomingTotal)}</strong><div className="stat-foot">Sua parte das despesas cadastradas</div></article>
          </section>
          <section className="health-grid">
            <div className="panel trend-panel"><div className="trend-panel-head"><div><h2>Ritmo dos gastos</h2><p>{trendMode === 'past' ? `${trendCount} ${trendCount === 1 ? 'mês anterior' : 'meses anteriores'} ao selecionado` : trendMode === 'future' ? `${trendCount} ${trendCount === 1 ? 'mês, incluindo o selecionado' : 'meses, incluindo o selecionado'}` : `${monthName(customStart)} a ${monthName(customEnd)}`}</p></div><span className="trend-total">{money(total)} <small>no mês atual</small></span></div>
              <div className="trend-controls"><div className="trend-tabs" role="tablist" aria-label="Período do gráfico"><button className={trendMode === 'past' ? 'selected' : ''} onClick={() => setTrendMode('past')}>Anteriores</button><button className={trendMode === 'future' ? 'selected' : ''} onClick={() => setTrendMode('future')}>Próximos</button><button className={trendMode === 'custom' ? 'selected' : ''} onClick={() => setTrendMode('custom')}>Personalizar</button></div>{trendMode === 'custom' ? <div className="trend-range"><label>De<input aria-label="Mês inicial do gráfico" type="month" value={trendStart} onChange={e => setTrendStart(e.target.value || trendStart)} /></label><label>Até<input aria-label="Mês final do gráfico" type="month" value={trendEnd} onChange={e => setTrendEnd(e.target.value || trendEnd)} /></label></div> : <label className="month-count">Meses<select value={trendMonths} onChange={e => setTrendMonths(Number(e.target.value))}><option value={3}>3 meses</option><option value={6}>6 meses</option><option value={12}>12 meses</option></select></label>}</div>
              <div className="trend-chart">{monthlyTrend.map(item => { const max = Math.max(...monthlyTrend.map(x => x.total), 1); return <div className="trend-column" key={item.month}><b>{item.total ? money(item.total) : '—'}</b><div className="bar-track"><i className={item.month === month ? 'current-bar' : ''} style={{ height: `${Math.max(item.total / max * 100, item.total ? 8 : 2)}%` }} /></div><span>{new Intl.DateTimeFormat('pt-BR', { month: 'short', year: trendCount > 12 ? '2-digit' : undefined }).format(new Date(`${item.month}-01T12:00:00`)).replace('.', '')}</span></div> })}</div><div className="trend-foot">Acompanhe a evolução das despesas registradas, sem incluir estimativas de renda.</div></div>
            <div className="panel health-insight"><div className="panel-head"><div><h2>Leitura do seu mês</h2><p>Indicadores com base nos lançamentos</p></div><span className="calendar-icon">✳</span></div>{categoryTotals.length ? <><div className="insight-number">{categoryTotals[0].name}<small>é sua maior categoria</small></div><p className="insight-copy">Ela representa <b>{total ? Math.round(categoryTotals[0].total / total * 100) : 0}%</b> dos gastos previstos no período.</p><div className="track insight-track"><i style={{ width: `${total ? categoryTotals[0].total / total * 100 : 0}%`, background: categoryTotals[0].color }} /></div><div className="health-callout"><span>↗</span><p>{monthChange === null ? 'Registre seus gastos mês a mês para criar uma comparação.' : monthChange > 0 ? `Os gastos previstos subiram ${Math.abs(monthChange).toFixed(0)}% frente ao mês anterior.` : `Os gastos previstos caíram ${Math.abs(monthChange).toFixed(0)}% frente ao mês anterior.`}</p></div></> : <div className="empty">Adicione lançamentos para ver os indicadores do mês.</div>}</div>
            <div className="panel category-panel"><div className="panel-head"><div><h2>Onde estão os gastos</h2><p>{categoryPanelMode === 'categories' ? 'Distribuição por categoria' : `${currentExpenses.length} despesas pessoais no período`}</p></div><div className="category-head-actions"><div className="category-view-toggle" aria-label="Resumo por categoria ou lançamentos"><button className={categoryPanelMode === 'categories' ? 'selected' : ''} onClick={() => setCategoryPanelMode('categories')}>Categorias</button><button className={categoryPanelMode === 'transactions' ? 'selected' : ''} onClick={() => setCategoryPanelMode('transactions')}>Lançamentos</button></div></div></div>{categoryPanelMode === 'transactions' ? currentExpenses.length ? <div className="category-transaction-list">{[...currentExpenses].sort((a, b) => b.date.localeCompare(a.date)).map(e => { const cat = data.categories.find(c => c.id === e.category); const share = e.allocatedShares.reduce((sum, item) => sum + item.amount, 0); return <div className="category-transaction" key={`${e.id}-${e.month}`}><span className="category-icon" style={{ color: cat?.color, background: `${cat?.color}18` }}>{e.category === 'moradia' ? '⌂' : e.category === 'alimentacao' ? '◒' : e.category === 'transporte' ? '⌁' : e.category === 'lazer' ? '✧' : '＋'}</span><span className="category-transaction-info"><b>{e.description}</b><small>{cat?.name || 'Sem categoria'}{share > 0 ? ` · ${money(share)} de terceiros` : ''}{e.installments > 1 ? ` · Parcela ${e.part}/${e.installments}` : ''}</small></span><b className="category-transaction-value">{money(personalValue(e))}</b></div> })}</div> : <div className="empty compact">Sem despesas neste mês.</div> : categoryTotals.length ? <div className="pie-layout"><div className="pie-chart"><svg className="pie-svg" viewBox="0 0 100 100" role="img" aria-label="Gastos pessoais por categoria"><circle cx="50" cy="50" r="37" fill="none" stroke="#e8eee9" strokeWidth="18" />{pieSlices.length === 1 ? <circle className="pie-slice" cx="50" cy="50" r="37" fill="none" stroke={pieSlices[0].category.color} strokeWidth="18" tabIndex={0} onMouseEnter={() => setHoveredCategoryId(pieSlices[0].category.id)} onMouseLeave={() => setHoveredCategoryId(null)} onFocus={() => setHoveredCategoryId(pieSlices[0].category.id)} onBlur={() => setHoveredCategoryId(null)}><title>{`${pieSlices[0].category.name}: ${money(pieSlices[0].category.total)} · ${pieSlices[0].percentage}%`}</title></circle> : pieSlices.map(slice => <path className="pie-slice" key={slice.category.id} d={donutSlice(slice.start, slice.end)} fill={slice.category.color} tabIndex={0} aria-label={`${slice.category.name}: ${money(slice.category.total)}, ${slice.percentage}%`} onMouseEnter={() => setHoveredCategoryId(slice.category.id)} onMouseLeave={() => setHoveredCategoryId(null)} onFocus={() => setHoveredCategoryId(slice.category.id)} onBlur={() => setHoveredCategoryId(null)}><title>{`${slice.category.name}: ${money(slice.category.total)} · ${slice.percentage}%`}</title></path>)}</svg><div className="pie-center"><b>{hoveredCategory ? `${hoveredCategory.percentage}%` : money(categoryTotal)}</b><small>{hoveredCategory ? hoveredCategory.category.name : 'Total pessoal'}</small></div></div><div className="pie-legend">{pieSlices.map(slice => <div key={slice.category.id}><span><i style={{ background: slice.category.color }} />{slice.category.name}</span><b>{money(slice.category.total)}</b></div>)}</div></div> : <div className="empty compact">Sem dados para este mês.</div>}</div>
            <div className="panel upcoming"><div className="panel-head"><div><h2>O que vem pela frente</h2><p>Valores pessoais já previstos</p></div><span className="calendar-icon">▦</span></div>{nextMonths.slice(1, 5).map(m => { const due = occurrences.filter(e => e.month === m && (e.kind || 'expense') === 'expense'); return <div className="upcoming-row" key={m}><span className="mini-date"><b>{m.slice(5)}</b><small>{m.slice(0, 4)}</small></span><span className="upcoming-name"><b>{monthName(m)}</b><small>{due.length} {due.length === 1 ? 'despesa' : 'despesas'}</small></span><b className="upcoming-value">{money(due.reduce((s, e) => s + personalValue(e), 0))}</b></div> })}<div className="future-note"><span>ⓘ</span> Sua parte após descontar os valores atribuídos a terceiros.</div></div>
            <div className="panel reimbursement-panel"><div className="panel-head"><div><h2>Valores de terceiros a receber</h2><p>Despesas atribuídas a cada participante</p></div><span className="stat-symbol orange">＋</span></div>{reimbursementByParticipant.length ? <>{reimbursementByParticipant.map(({ participant, current: thisMonth, future, passThrough }) => <div className="reimbursement-row" key={participant.id}><div className="reimbursement-person"><span className="participant-avatar">{participant.name.slice(0, 1).toUpperCase()}</span><b>{participant.name}</b></div><div className="reimbursement-values"><span>Neste mês <b>{money(thisMonth)}</b></span><span>Futuro <b>{money(future)}</b></span>{passThrough > 0 && <span>Parte dela em receitas <b>{money(passThrough)}</b></span>}</div></div>)}<div className="reimbursement-total"><span>Total a receber neste mês</span><b>{money(reimbursementTotal)}</b></div>{incomePassThrough > 0 && <p className="reimbursement-note">{money(incomePassThrough)} das receitas registradas pertencem aos participantes e foram excluídas das suas receitas pessoais.</p>}</> : <div className="empty compact">{(data.participants || []).length ? 'Atribua uma parte de um lançamento a um participante para acompanhar valores a receber.' : <>Cadastre uma pessoa em Ajustes para começar a controlar reembolsos. <button className="text-btn" onClick={() => setView('Ajustes')}>Gerenciar participantes →</button></>}</div>}</div>
          </section>
        </> : <section className="data-page">{transactionTable}</section>}
        <footer>Feito para trazer mais clareza ao seu dia a dia <span>✳</span><span>Seus dados ficam neste dispositivo</span></footer>
      </div>
    </main>

    {modal && <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) closeExpenseModal() }}><form className="modal expense-modal" onSubmit={addExpense}>
      <div className="modal-header"><div><span className="eyebrow">{editingExpenseId ? 'EDITAR REGISTRO' : 'NOVO REGISTRO'}</span><h2>{editingExpenseId ? 'Editar lançamento' : 'Adicionar lançamento'}</h2></div><button type="button" onClick={closeExpenseModal}>×</button></div>
      <div className="entry-kind-toggle"><button type="button" className={form.kind === 'expense' ? 'selected' : ''} onClick={() => setForm({ ...form, kind: 'expense', method: 'PIX', installments: '1', category: form.category || data.categories[0]?.id || '' })}>Despesa</button><button type="button" className={form.kind === 'income' ? 'selected' : ''} onClick={() => setForm({ ...form, kind: 'income', method: 'PIX', cardId: '', installments: '1', category: data.categories.find(c => c.id === 'renda')?.id || '' })}>Receita</button></div>
      <label>Descrição<input required autoFocus placeholder={form.kind === 'income' ? 'Ex.: salário, reembolso...' : 'Ex.: mercado, conta de luz...'} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></label>
      <div className="form-row"><label>Valor total<input required type="number" min="0.01" step="0.01" placeholder="0,00" value={form.amount} onChange={e => { setShareError(''); setForm({ ...form, amount: e.target.value }) }} /></label><label>{form.kind === 'income' ? 'Data de recebimento' : 'Data da compra'}<input required type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></label></div>
      <div className="form-row"><label>Categoria<select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>{form.kind === 'income' && <option value="">Sem categoria</option>}{data.categories.map(c => <option value={c.id} key={c.id}>{c.name}</option>)}</select></label><label>{form.kind === 'income' ? 'Forma de recebimento' : 'Forma de pagamento'}<select value={form.method} onChange={e => setForm({ ...form, method: e.target.value as Method })}>{(form.kind === 'income' ? ['PIX', 'Transferência', 'Dinheiro'] : ['PIX', 'Débito', 'Crédito à vista', 'Crédito parcelado']).map(method => <option key={method}>{method}</option>)}</select></label></div>
      {form.kind === 'expense' && form.method.startsWith('Crédito') && <label>Cartão<select value={form.cardId} onChange={e => setForm({ ...form, cardId: e.target.value })}>{data.cards.map(c => <option key={c.id} value={c.id}>{c.name} · fecha dia {c.closingDay}</option>)}</select></label>}
      {form.kind === 'expense' && form.method === 'Crédito parcelado' && <label>Número de parcelas<input type="number" min="2" max="60" value={form.installments} onChange={e => setForm({ ...form, installments: e.target.value })} /><small className="form-help">O valor será dividido automaticamente entre os meses.</small></label>}
      {(data.participants || []).length > 0 ? <fieldset className="participants-field"><legend>{form.kind === 'income' ? 'Parte da receita de outras pessoas (opcional)' : 'Dividir com participantes (opcional)'}</legend><p>{form.kind === 'income' ? 'A parte atribuída será excluída das suas receitas pessoais.' : 'A parte atribuída será descontada dos seus gastos pessoais e aparecerá como valor a receber. Em compras parceladas, você pode escolher todas as parcelas ou apenas uma.'}</p>{(data.participants || []).map(participant => { const share = form.shares.find(item => item.participantId === participant.id); return <div className="participant-share-row" key={participant.id}><label className="participant-check"><input type="checkbox" checked={Boolean(share)} onChange={e => { setShareError(''); setForm({ ...form, shares: e.target.checked ? [...form.shares, { participantId: participant.id, amount: '', installment: 'all' }] : form.shares.filter(item => item.participantId !== participant.id) }) }} /><span>{participant.name}</span></label>{share && <div className="participant-share-controls"><label className="participant-amount">Parte (R$)<input aria-label={`Valor atribuído a ${participant.name}`} type="number" min="0" max={form.amount || undefined} step="0.01" value={share.amount} onChange={e => { setShareError(''); setForm({ ...form, shares: form.shares.map(item => item.participantId === participant.id ? { ...item, amount: e.target.value } : item) }) }} /></label>{form.kind === 'expense' && form.method === 'Crédito parcelado' && <label className="participant-scope">Aplicar<select aria-label={`Parcelas atribuídas a ${participant.name}`} value={share.installment} onChange={e => setForm({ ...form, shares: form.shares.map(item => item.participantId === participant.id ? { ...item, installment: e.target.value } : item) })}><option value="all">Todas</option>{Array.from({ length: Math.max(2, Number(form.installments) || 2) }, (_, i) => <option key={i + 1} value={i + 1}>Somente {i + 1}ª</option>)}</select></label>}</div>}</div> })}{shareError && <div className="share-error" role="alert">{shareError}</div>}</fieldset> : <div className="participants-empty">Para dividir este lançamento, cadastre pessoas em <b>Ajustes → Participantes</b>.</div>}
      <div className="modal-actions"><button type="button" className="cancel-btn" onClick={closeExpenseModal}>Cancelar</button><button className="primary" type="submit">{editingExpenseId ? 'Salvar alterações' : 'Salvar lançamento'}</button></div>
    </form></div>}

    {settingsModal && <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setSettingsModal(null) }}><form className="modal settings-modal" onSubmit={saveSetting}><div className="modal-header"><div><span className="eyebrow">AJUSTES</span><h2>{settingsModal.id ? 'Editar' : 'Novo'} {settingsModal.kind === 'category' ? 'categoria' : settingsModal.kind === 'card' ? 'cartão' : 'participante'}</h2></div><button type="button" onClick={() => setSettingsModal(null)}>×</button></div><label>Nome<input required autoFocus maxLength={40} placeholder={settingsModal.kind === 'category' ? 'Ex.: Educação' : settingsModal.kind === 'card' ? 'Ex.: Cartão principal' : 'Ex.: Maria'} value={settingsModal.name} onChange={e => setSettingsModal({ ...settingsModal, name: e.target.value })} /></label>{settingsModal.kind === 'category' ? <label>Cor da categoria<div className="color-picker-row"><input aria-label="Cor da categoria" type="color" value={settingsModal.color} onChange={e => setSettingsModal({ ...settingsModal, color: e.target.value })} /><span>Escolha uma cor para identificar esta categoria.</span></div></label> : settingsModal.kind === 'card' ? <div className="form-row"><label>Dia de fechamento<input required type="number" min="1" max="31" value={settingsModal.closingDay} onChange={e => setSettingsModal({ ...settingsModal, closingDay: e.target.value })} /><small className="form-help">Compras a partir deste dia vão para o próximo ciclo.</small></label><label>Dia de vencimento<input required type="number" min="1" max="31" value={settingsModal.dueDay} onChange={e => setSettingsModal({ ...settingsModal, dueDay: e.target.value })} /></label></div> : <p className="form-help participant-modal-help">Os valores atribuídos a esta pessoa ficarão associados aos lançamentos correspondentes e serão salvos apenas neste dispositivo.</p>}<div className="modal-actions"><button type="button" className="cancel-btn" onClick={() => setSettingsModal(null)}>Cancelar</button><button className="primary" type="submit">{settingsModal.id ? 'Salvar alterações' : 'Adicionar'}</button></div></form></div>}
  </div>
}

export default App
