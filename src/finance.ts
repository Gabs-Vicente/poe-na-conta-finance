export type Method = 'PIX' | 'Débito' | 'Dinheiro' | 'Crédito à vista' | 'Crédito parcelado'
export type ClosingDayRule = 'after' | 'before'
export type Category = { id: string; name: string; color: string }
export type Card = { id: string; name: string; closingDay: number; dueDay: number; closingDayRule?: ClosingDayRule }
export type Participant = { id: string; name: string }
export type ParticipantShare = { participantId: string; amount: number; installment?: number }
export type Expense = { id: string; description: string; amount: number; date: string; category: string; method: Method; cardId?: string; installments: number; firstMonth: string; afterClosing?: boolean; shares?: ParticipantShare[] }
export type Recurrence = { id: string; description: string; amount: number; category: string; method: Method; cardId?: string; day: number; active: boolean; generatedMonths: string[]; skippedMonths: string[] }
export type Occurrence = Expense & { part: number; month: string; value: number; allocatedShares: ParticipantShare[] }
export type InstallmentReliefItem = {
  id: string
  description: string
  category: string
  cardId?: string
  part: number
  installments: number
  remainingAfterCurrent: number
  lastMonth: string
  reliefMonth: string
  personalValue: number
  totalValue: number
}
export type InstallmentReliefMilestone = {
  lastMonth: string
  reliefMonth: string
  freedPersonalAmount: number
  freedTotalAmount: number
  count: number
  descriptions: string[]
}
export type InstallmentReliefSummary = {
  items: InstallmentReliefItem[]
  milestones: InstallmentReliefMilestone[]
}
export type Data = { categories: Category[]; cards: Card[]; participants: Participant[]; expenses: Expense[]; recurrences?: Recurrence[] }
export type BackupPreferences = {
  monthlyLimit: string
  limitNoticePercent: string
  defaultView: 'Visão geral' | 'Lançamentos' | 'Relatórios' | 'Recorrências' | 'Ajustes'
  theme: 'light' | 'dark'
  profileName?: string
  profilePhoto?: string
}
export type BackupPayload = { data: Data; preferences?: BackupPreferences }

export const seed: Data = {
  categories: [{ id: 'moradia', name: 'Moradia', color: '#6e7f72' }, { id: 'alimentacao', name: 'Alimentação', color: '#b88b63' }, { id: 'transporte', name: 'Transporte', color: '#74858b' }, { id: 'lazer', name: 'Lazer', color: '#9b8193' }, { id: 'saude', name: 'Saúde', color: '#8b966d' }],
  cards: [{ id: 'principal', name: 'Cartão principal', closingDay: 25, dueDay: 5, closingDayRule: 'after' }],
  participants: [],
  expenses: [
    { id: 'e1', description: 'Aluguel', amount: 1850, date: '2026-11-05', category: 'moradia', method: 'PIX', installments: 1, firstMonth: '2026-11' },
    { id: 'e2', description: 'Mercado da semana', amount: 286.4, date: '2026-11-08', category: 'alimentacao', method: 'Débito', installments: 1, firstMonth: '2026-11' },
    { id: 'e3', description: 'Fone bluetooth', amount: 599.9, date: '2026-11-10', category: 'lazer', method: 'Crédito parcelado', cardId: 'principal', installments: 3, firstMonth: '2026-11' },
    { id: 'e4', description: 'Conta de luz', amount: 142.7, date: '2026-11-11', category: 'moradia', method: 'PIX', installments: 1, firstMonth: '2026-11' },
    { id: 'e5', description: 'Combustível', amount: 220, date: '2026-11-12', category: 'transporte', method: 'Crédito à vista', cardId: 'principal', installments: 1, firstMonth: '2026-11' },
  ],
}

export const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
export const monthKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
export const shiftMonth = (key: string, amount: number) => {
  const [year, month] = key.split('-').map(Number)
  return monthKey(new Date(year, month - 1 + amount, 1))
}

export const formatMoneyInput = (raw: string | number): string => {
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw) || raw <= 0) return ''
    return raw.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }
  const cleanDigits = String(raw ?? '').replace(/\D/g, '').replace(/^0+/, '')
  if (!cleanDigits) return ''
  const cents = Number(cleanDigits.slice(0, 13))
  if (!Number.isFinite(cents) || cents <= 0) return ''
  return (cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export const parseMoneyInput = (raw: string | number): number => {
  if (typeof raw === 'number') return raw
  const cleaned = String(raw ?? '').trim().replace(/[R$\s]/g, '')
  if (!cleaned) return Number.NaN
  const lastComma = cleaned.lastIndexOf(',')
  const lastDot = cleaned.lastIndexOf('.')
  let normalized = cleaned
  if (lastComma > lastDot) {
    normalized = cleaned.replace(/\./g, '').replace(',', '.')
  } else if (lastDot > lastComma && lastComma !== -1) {
    normalized = cleaned.replace(/,/g, '')
  }
  return Number(normalized)
}

export const normalizeDateInput = (raw: string): string => {
  const trimmed = String(raw ?? '').trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed
  const brMatch = /^(\d{2})[/.-](\d{2})[/.-](\d{4})$/.exec(trimmed)
  if (brMatch) return `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`
  const isoSlashMatch = /^(\d{4})[/](\d{2})[/](\d{2})$/.exec(trimmed)
  if (isoSlashMatch) return `${isoSlashMatch[1]}-${isoSlashMatch[2]}-${isoSlashMatch[3]}`
  return trimmed
}

export const cardDueMonth = (purchaseDate: string, card: Card, afterClosing?: boolean) => {
  const purchaseMonth = monthKey(new Date(`${purchaseDate}T12:00:00`))
  const purchaseDay = Number(purchaseDate.slice(-2))
  if (purchaseDay < card.closingDay) return purchaseMonth
  if (purchaseDay > card.closingDay) return shiftMonth(purchaseMonth, 1)
  const closedOnClosingDay = afterClosing ?? (card.closingDayRule !== 'before')
  return shiftMonth(purchaseMonth, closedOnClosingDay ? 1 : 0)
}

export const expenseFirstMonth = (purchaseDate: string, method: Method, card?: Card, afterClosing?: boolean) => {
  if (method.startsWith('Crédito') && card) return cardDueMonth(purchaseDate, card, afterClosing)
  return monthKey(new Date(`${purchaseDate}T12:00:00`))
}

export const buildOccurrences = (expenses: Expense[]): Occurrence[] => expenses.flatMap(expense => {
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

export const occurrencePersonalValue = (occurrence: Pick<Occurrence, 'value' | 'allocatedShares'>): number =>
  Math.max(0, Math.round((occurrence.value - occurrence.allocatedShares.reduce((sum, share) => sum + share.amount, 0)) * 100) / 100)

export const buildInstallmentRelief = (occurrences: Occurrence[], currentMonth: string): InstallmentReliefSummary => {
  const activeInMonth = occurrences.filter(e => e.month === currentMonth && e.installments > 1)
  const items: InstallmentReliefItem[] = activeInMonth.map(e => {
    const lastMonth = shiftMonth(e.firstMonth, e.installments - 1)
    const reliefMonth = shiftMonth(e.firstMonth, e.installments)
    return {
      id: e.id,
      description: e.description,
      category: e.category,
      cardId: e.cardId,
      part: e.part,
      installments: e.installments,
      remainingAfterCurrent: Math.max(0, e.installments - e.part),
      lastMonth,
      reliefMonth,
      personalValue: occurrencePersonalValue(e),
      totalValue: e.value,
    }
  }).sort((a, b) => a.lastMonth.localeCompare(b.lastMonth) || b.personalValue - a.personalValue)

  const grouped = new Map<string, InstallmentReliefMilestone>()
  for (const item of items) {
    const existing = grouped.get(item.reliefMonth)
    if (existing) {
      existing.freedPersonalAmount = Math.round((existing.freedPersonalAmount + item.personalValue) * 100) / 100
      existing.freedTotalAmount = Math.round((existing.freedTotalAmount + item.totalValue) * 100) / 100
      existing.count += 1
      existing.descriptions.push(item.description)
    } else {
      grouped.set(item.reliefMonth, {
        lastMonth: item.lastMonth,
        reliefMonth: item.reliefMonth,
        freedPersonalAmount: item.personalValue,
        freedTotalAmount: item.totalValue,
        count: 1,
        descriptions: [item.description],
      })
    }
  }
  const milestones = Array.from(grouped.values()).sort((a, b) => a.reliefMonth.localeCompare(b.reliefMonth))
  return { items, milestones }
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const isText = (value: unknown): value is string => typeof value === 'string'
const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)
const isDay = (value: unknown): value is number => Number.isInteger(value) && Number(value) >= 1 && Number(value) <= 31
export const isDate = (value: unknown): value is string => {
  if (!isText(value) || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const parsed = new Date(year, month - 1, day, 12, 0, 0)
  return !Number.isNaN(parsed.getTime()) && dateKey(parsed) === value
}
const methods: Method[] = ['PIX', 'Débito', 'Dinheiro', 'Crédito à vista', 'Crédito parcelado']

const coerceInputData = (value: unknown): unknown => {
  if (!isRecord(value) || !Array.isArray(value.categories) || !Array.isArray(value.cards) || !Array.isArray(value.expenses)) return value
  const defaultCategoryId = isRecord(value.categories[0]) && isText(value.categories[0].id) ? value.categories[0].id : 'moradia'
  const expenses = value.expenses.map(item => {
    if (!isRecord(item)) return item
    const amount = typeof item.amount === 'string' ? parseMoneyInput(item.amount) : item.amount
    const date = typeof item.date === 'string' ? normalizeDateInput(item.date) : item.date
    const category = isText(item.category) && item.category.trim() ? item.category : defaultCategoryId
    const installments = typeof item.installments === 'string' ? Number(item.installments) : item.installments
    const firstMonth = isText(item.firstMonth) && /^\d{4}-\d{2}$/.test(item.firstMonth)
      ? item.firstMonth
      : isDate(date)
        ? date.slice(0, 7)
        : item.firstMonth
    const shares = Array.isArray(item.shares)
      ? item.shares.map(share => isRecord(share) ? { ...share, amount: typeof share.amount === 'string' ? parseMoneyInput(share.amount) : share.amount } : share)
      : item.shares
    return { ...item, amount, date, category, installments, firstMonth, ...(shares !== undefined ? { shares } : {}) }
  })
  const recurrences = Array.isArray(value.recurrences)
    ? value.recurrences.map(item => isRecord(item) ? { ...item, amount: typeof item.amount === 'string' ? parseMoneyInput(item.amount) : item.amount, day: typeof item.day === 'string' ? Number(item.day) : item.day } : item)
    : value.recurrences
  return { ...value, expenses, ...(recurrences !== undefined ? { recurrences } : {}) }
}

export const validateData = (value: unknown): value is Data => {
  if (!isRecord(value) || !Array.isArray(value.categories) || !Array.isArray(value.cards) || !Array.isArray(value.expenses)) return false
  const participants = value.participants === undefined ? [] : value.participants
  if (!Array.isArray(participants)) return false
  if (!value.categories.every(item => isRecord(item) && isText(item.id) && isText(item.name) && isText(item.color))) return false
  if (!value.cards.every(item => isRecord(item) && isText(item.id) && isText(item.name) && isDay(item.closingDay) && isDay(item.dueDay) && (item.closingDayRule === undefined || item.closingDayRule === 'after' || item.closingDayRule === 'before'))) return false
  if (!participants.every(item => isRecord(item) && isText(item.id) && isText(item.name))) return false
  const recurrences = value.recurrences === undefined ? [] : value.recurrences
  if (!Array.isArray(recurrences) || !recurrences.every(item => isRecord(item) && isText(item.id) && isText(item.description) && isFiniteNumber(item.amount) && item.amount > 0 && isText(item.category) && methods.includes(item.method as Method) && isDay(item.day) && typeof item.active === 'boolean' && (item.cardId === undefined || isText(item.cardId)) && Array.isArray(item.generatedMonths) && item.generatedMonths.every(isText) && Array.isArray(item.skippedMonths) && item.skippedMonths.every(isText))) return false
  return value.expenses.every(item => {
    if (!isRecord(item) || !isText(item.id) || !isText(item.description) || !isFiniteNumber(item.amount) || item.amount <= 0 || !isDate(item.date) || !isText(item.category) || !methods.includes(item.method as Method) || !Number.isInteger(item.installments) || Number(item.installments) < 1 || Number(item.installments) > 60 || !isText(item.firstMonth) || !/^\d{4}-\d{2}$/.test(item.firstMonth)) return false
    if (item.cardId !== undefined && !isText(item.cardId)) return false
    if (item.afterClosing !== undefined && typeof item.afterClosing !== 'boolean') return false
    if (item.shares !== undefined && (!Array.isArray(item.shares) || !item.shares.every(share => isRecord(share) && isText(share.participantId) && isFiniteNumber(share.amount) && share.amount >= 0 && (share.installment === undefined || (Number.isInteger(share.installment) && Number(share.installment) >= 1 && Number(share.installment) <= 60))))) return false
    return true
  })
}

export const normalizeData = (rawValue: unknown): Data | null => {
  const value = coerceInputData(rawValue)
  if (!validateData(value)) return null
  const oldSeedColors: Record<string, string> = { moradia: '#6c7cf0', alimentacao: '#f1a455', transporte: '#5ab89b', lazer: '#db77a6', saude: '#64a9cf' }
  const palette: Record<string, string> = { moradia: '#6e7f72', alimentacao: '#b88b63', transporte: '#74858b', lazer: '#9b8193', saude: '#8b966d' }
  const categories = value.categories.map(category => category.color === oldSeedColors[category.id] ? { ...category, color: palette[category.id] } : category)
  const cards = value.cards.map(card => ({ ...card, closingDayRule: card.closingDayRule ?? 'after' }))
  const expenses = value.expenses.map(expense => {
    if (!expense.method.startsWith('Crédito')) {
      const purchaseMonth = monthKey(new Date(`${expense.date}T12:00:00`))
      return expense.firstMonth === purchaseMonth ? expense : { ...expense, firstMonth: purchaseMonth }
    }
    const card = cards.find(item => item.id === expense.cardId) || (expense.cardId === undefined ? cards[0] : undefined)
    if (!card) return expense
    const expectedFirstMonth = cardDueMonth(expense.date, card, expense.afterClosing)
    return expense.firstMonth === expectedFirstMonth ? expense : { ...expense, firstMonth: expectedFirstMonth }
  })
  return { ...value, categories, cards, expenses, participants: value.participants || [], recurrences: value.recurrences || [] } as Data
}

export type StoredData = { data: Data; warning?: string }
export const readStoredData = (raw: string | null): StoredData => {
  if (!raw) return { data: structuredClone(seed) }
  try {
    const parsed: unknown = JSON.parse(raw)
    const data = normalizeData(parsed)
    if (data) return { data }
    if (isRecord(parsed) && Array.isArray(parsed.expenses)) {
      const cleanedExpenses = parsed.expenses.filter(item => isRecord(item) && item.amount !== null)
      if (cleanedExpenses.length !== parsed.expenses.length) {
        const recovered = normalizeData({ ...parsed, expenses: cleanedExpenses })
        if (recovered) return { data: recovered }
      }
    }
    return { data: structuredClone(seed), warning: 'Os dados salvos não passaram na validação. Seus dados originais continuam no navegador; importe um backup válido antes de salvar novos lançamentos.' }
  } catch {
    return { data: structuredClone(seed), warning: 'Não foi possível ler os dados salvos. Eles continuam no navegador; importe um backup válido antes de salvar novos lançamentos.' }
  }
}

export const createBackup = (data: Data, preferences?: BackupPreferences) => JSON.stringify({ format: 'nexus-finance-backup', version: preferences ? 3 : 1, exportedAt: new Date().toISOString(), data, ...(preferences ? { preferences } : {}) }, null, 2)
export const parseBackupFile = (raw: string): BackupPayload | null => {
  try {
    const backup: unknown = JSON.parse(raw)
    if (!isRecord(backup) || backup.format !== 'nexus-finance-backup' || (backup.version !== 1 && backup.version !== 2 && backup.version !== 3)) return null
    const data = normalizeData(backup.data)
    if (!data) return null
    if (backup.version === 1) return { data }
    const preferences = backup.preferences
    const views = ['Visão geral', 'Lançamentos', 'Relatórios', 'Recorrências', 'Ajustes']
    if (!isRecord(preferences) || !isText(preferences.monthlyLimit) || (preferences.monthlyLimit !== '' && (!Number.isFinite(Number(preferences.monthlyLimit)) || Number(preferences.monthlyLimit) < 0)) || !isText(preferences.limitNoticePercent) || !Number.isInteger(Number(preferences.limitNoticePercent)) || Number(preferences.limitNoticePercent) < 1 || Number(preferences.limitNoticePercent) > 100 || !views.includes(String(preferences.defaultView)) || (preferences.theme !== 'light' && preferences.theme !== 'dark') || (preferences.profileName !== undefined && !isText(preferences.profileName)) || (preferences.profilePhoto !== undefined && (!isText(preferences.profilePhoto) || preferences.profilePhoto.length > 3_000_000 || (preferences.profilePhoto !== '' && !/^data:image\/(png|jpeg|webp);base64,/.test(preferences.profilePhoto))))) return null
    return { data, preferences: { monthlyLimit: preferences.monthlyLimit, limitNoticePercent: preferences.limitNoticePercent, defaultView: preferences.defaultView as BackupPreferences['defaultView'], theme: preferences.theme as BackupPreferences['theme'], profileName: isText(preferences.profileName) ? preferences.profileName : '', profilePhoto: isText(preferences.profilePhoto) ? preferences.profilePhoto : '' } }
  } catch {
    return null
  }
}
export const parseBackup = (raw: string): Data | null => parseBackupFile(raw)?.data || null

export const csvCell = (value: string | number, untrusted = false) => {
  let text = String(value)
  if (untrusted && /^[\s]*[=+\-@]/.test(text)) text = `'${text}`
  return `"${text.replaceAll('"', '""')}"`
}
