import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import { buildOccurrences as calculateOccurrences, cardDueMonth as calculateCardDueMonth, createBackup, csvCell, dateKey, isDate, monthKey, normalizeDateInput, parseBackupFile, parseMoneyInput, readStoredData, seed, shiftMonth as shiftMonthKey, type BackupPayload, type Card, type Category, type Data, type Expense, type Method, type Participant, type Recurrence } from './finance'

type ExpenseForm = { description: string; amount: string; date: string; category: string; method: Method; cardId: string; installments: string; shares: { participantId: string; amount: string; installment: string }[] }
type SettingEditor = { kind: 'category' | 'card' | 'participant'; id?: string; name: string; color: string; closingDay: string; dueDay: string }
type RecurrenceEditor = { id?: string; description: string; amount: string; category: string; method: Method; cardId: string; day: string }
type MainView = 'Visão geral' | 'Lançamentos' | 'Relatórios' | 'Recorrências' | 'Ajustes'
type ModalKind = 'expense' | 'recurrence' | 'settings' | 'backup' | 'easter-egg' | 'onboarding' | 'reset'
type OnboardingStartMode = 'empty' | 'demo' | 'keep'

const MODAL_CLOSE_DURATION_MS = 220

// Dicionário de senhas secretas do Konami Code (chave em minúsculas -> escrita exibida no modal)
const EASTER_EGG_SECRETS: Record<string, string> = {
  bbkart: 'Bloodborne Kart não existe e não pode te machucar',
  'ocara': 'O Caio é o cara',
  '13': 'Lulatron Ativar',
}
const getEasterEggSecret = (value: string): string | undefined => EASTER_EGG_SECRETS[value.trim().toLowerCase()]

const money = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const monthName = (key: string) => { const [y, m] = key.split('-').map(Number); return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(new Date(y, m - 1, 1)) }
const piePoint = (degrees: number, radius: number) => { const angle = (degrees - 90) * Math.PI / 180; return [50 + radius * Math.cos(angle), 50 + radius * Math.sin(angle)] }
const donutSlice = (start: number, end: number) => {
  const outerStart = piePoint(start, 46); const outerEnd = piePoint(end, 46)
  const innerEnd = piePoint(end, 28); const innerStart = piePoint(start, 28)
  const largeArc = end - start > 180 ? 1 : 0
  return `M ${outerStart[0]} ${outerStart[1]} A 46 46 0 ${largeArc} 1 ${outerEnd[0]} ${outerEnd[1]} L ${innerEnd[0]} ${innerEnd[1]} A 28 28 0 ${largeArc} 0 ${innerStart[0]} ${innerStart[1]} Z`
}
const today = new Date()
const isTouchDevice = () => typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches
const blurActiveInputOnTouch = () => {
  if (isTouchDevice() && document.activeElement instanceof HTMLInputElement) {
    document.activeElement.blur()
  }
}
const dismissKeyboardOnEnter = (event: React.KeyboardEvent<HTMLInputElement>) => {
  if (event.key === 'Enter' && isTouchDevice()) {
    event.preventDefault()
    event.currentTarget.blur()
  }
}
const profileInitials = (name: string) => name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(part => Array.from(part)[0]?.toLocaleUpperCase('pt-BR') || '').join('')
const createId = () => typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
  ? crypto.randomUUID()
  : `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`

function App() {
  const [hasExistingData, setHasExistingData] = useState(() => localStorage.getItem('conta-clara-v1') !== null)
  const [storedData] = useState(() => readStoredData(localStorage.getItem('conta-clara-v1')))
  const [data, setData] = useState<Data>(storedData.data)
  const [storageWarning, setStorageWarning] = useState(storedData.warning || '')
  const [onboardingOpen, setOnboardingOpen] = useState(() => localStorage.getItem('poe-na-conta-onboarded') !== '1')
  const [onboardingStartMode, setOnboardingStartMode] = useState<OnboardingStartMode>(() => hasExistingData ? 'keep' : 'empty')
  const [backupMessage, setBackupMessage] = useState('')
  const [pendingBackupImport, setPendingBackupImport] = useState<BackupPayload | null>(null)
  const [resetDataModalOpen, setResetDataModalOpen] = useState(false)
  const [resetConfirmText, setResetConfirmText] = useState('')
  const [resetConfirmError, setResetConfirmError] = useState(false)
  const backupInput = useRef<HTMLInputElement>(null)
  const trendChartRef = useRef<HTMLDivElement>(null)
  const [month, setMonth] = useState(monthKey(today))
  const [view, setView] = useState<MainView>(() => { const saved = localStorage.getItem('nexus-default-view'); return saved === 'Lançamentos' || saved === 'Relatórios' || saved === 'Recorrências' || saved === 'Ajustes' ? saved : 'Visão geral' })
  const [defaultView, setDefaultView] = useState<MainView>(() => { const saved = localStorage.getItem('nexus-default-view'); return saved === 'Lançamentos' || saved === 'Relatórios' || saved === 'Recorrências' || saved === 'Ajustes' ? saved : 'Visão geral' })
  const [theme, setTheme] = useState<'light' | 'dark'>(() => localStorage.getItem('nexus-theme') === 'dark' ? 'dark' : 'light')
  const [defaultTheme, setDefaultTheme] = useState<'light' | 'dark'>(() => localStorage.getItem('nexus-theme') === 'dark' ? 'dark' : 'light')
  const [profileName, setProfileName] = useState(() => localStorage.getItem('poe-na-conta-profile-name') || '')
  const [profilePhoto, setProfilePhoto] = useState(() => localStorage.getItem('poe-na-conta-profile-photo') || '')
  const [profileMessage, setProfileMessage] = useState('')
  const profilePhotoInput = useRef<HTMLInputElement>(null)
  const [monthlyLimit, setMonthlyLimit] = useState(() => localStorage.getItem('poe-na-conta-monthly-limit') || '')
  const [limitNoticePercent, setLimitNoticePercent] = useState(() => { const saved = Number(localStorage.getItem('poe-na-conta-limit-notice-percent')); return Number.isInteger(saved) && saved >= 1 && saved <= 100 ? String(saved) : '80' })
  const [query, setQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('Todas as categorias')
  const [trendYear, setTrendYear] = useState(String(today.getFullYear()))
  const [categoryPanelMode, setCategoryPanelMode] = useState<'categories' | 'transactions'>('categories')
  const [hoveredCategoryId, setHoveredCategoryId] = useState<string | null>(null)
  const [modal, setModal] = useState(false)
  const [easterEggOpen, setEasterEggOpen] = useState(false)
  const [easterEggPassword, setEasterEggPassword] = useState('')
  const [easterEggMessage, setEasterEggMessage] = useState('')
  const [easterEggError, setEasterEggError] = useState(false)
  const [easterEggShake, setEasterEggShake] = useState(false)
  const [closingModal, setClosingModal] = useState<ModalKind | null>(null)
  const modalCloseTimer = useRef<number | null>(null)
  const easterEggInputRef = useRef<HTMLInputElement>(null)
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null)
  const [settingsModal, setSettingsModal] = useState<SettingEditor | null>(null)
  const [recurrenceEditor, setRecurrenceEditor] = useState<RecurrenceEditor | null>(null)
  const [recurrenceSelection, setRecurrenceSelection] = useState<string[] | null>(null)
  const [selectedExpenseIds, setSelectedExpenseIds] = useState<string[]>([])
  const [form, setForm] = useState<ExpenseForm>(() => ({ description: '', amount: '', date: dateKey(today), category: storedData.data.categories[0]?.id || '', method: 'PIX', cardId: storedData.data.cards[0]?.id || '', installments: '1', shares: [] }))
  const [shareError, setShareError] = useState('')
  const [returnToExpenseAfterParticipant, setReturnToExpenseAfterParticipant] = useState(false)
  const normalizedFormDate = normalizeDateInput(form.date)
  const selectedFormCard = data.cards.find(card => card.id === form.cardId) || data.cards[0]
  const creditDueMonth = form.method.startsWith('Crédito') && selectedFormCard && isDate(normalizedFormDate) ? calculateCardDueMonth(normalizedFormDate, selectedFormCard) : ''
  const openNewExpenseModal = () => {
    setEditingExpenseId(null)
    setShareError('')
    setForm({
      description: '',
      amount: '',
      date: dateKey(today),
      category: data.categories[0]?.id || '',
      method: 'PIX',
      cardId: data.cards[0]?.id || '',
      installments: '1',
      shares: [],
    })
    setModal(true)
  }
  const closeModalWithAnimation = (kind: ModalKind, onClosed: () => void) => {
    if (closingModal === kind) return
    if (modalCloseTimer.current !== null) window.clearTimeout(modalCloseTimer.current)
    setClosingModal(kind)
    modalCloseTimer.current = window.setTimeout(() => {
      setClosingModal(current => current === kind ? null : current)
      modalCloseTimer.current = null
      onClosed()
    }, MODAL_CLOSE_DURATION_MS)
  }
  useEffect(() => {
    const closeMenus = (event: MouseEvent) => {
      if (!(event.target instanceof Element) || !event.target.closest('.row-actions')) document.querySelectorAll<HTMLDetailsElement>('.row-actions[open]').forEach(menu => menu.removeAttribute('open'))
    }
    document.addEventListener('click', closeMenus)
    return () => document.removeEventListener('click', closeMenus)
  }, [])
  useEffect(() => {
    const vv = window.visualViewport
    const root = document.documentElement
    const updateViewport = () => {
      if (!vv) return
      root.style.setProperty('--vvh', `${Math.round(vv.height)}px`)
      root.style.setProperty('--vvt', `${Math.round(vv.offsetTop)}px`)
      const keyboardHeight = window.innerHeight - vv.height - vv.offsetTop
      if (keyboardHeight > 110) {
        root.setAttribute('data-keyboard', 'open')
      } else {
        root.removeAttribute('data-keyboard')
      }
    }
    const onFocusIn = (event: FocusEvent) => {
      const target = event.target
      if (!(target instanceof HTMLElement) || !target.matches('input:not([type="checkbox"]):not([type="radio"]):not([type="color"]):not([type="file"]), textarea')) return
      window.setTimeout(() => {
        updateViewport()
        target.scrollIntoView({ block: 'center', behavior: 'smooth' })
      }, 160)
    }
    const onFocusOut = () => {
      window.setTimeout(updateViewport, 100)
    }
    updateViewport()
    vv?.addEventListener('resize', updateViewport)
    vv?.addEventListener('scroll', updateViewport)
    window.addEventListener('resize', updateViewport)
    document.addEventListener('focusin', onFocusIn)
    document.addEventListener('focusout', onFocusOut)
    return () => {
      vv?.removeEventListener('resize', updateViewport)
      vv?.removeEventListener('scroll', updateViewport)
      window.removeEventListener('resize', updateViewport)
      document.removeEventListener('focusin', onFocusIn)
      document.removeEventListener('focusout', onFocusOut)
      root.removeAttribute('data-keyboard')
    }
  }, [])
  useEffect(() => {
    const sequence = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'KeyB', 'KeyA']
    let position = 0
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || (event.target instanceof HTMLElement && event.target.closest('input,textarea,select,[contenteditable="true"]'))) return
      if (event.code === sequence[position]) position += 1
      else position = event.code === sequence[0] ? 1 : 0
      if (event.code.startsWith('Arrow') && position > 0) event.preventDefault()
      if (position === sequence.length) {
        event.preventDefault()
        position = 0
        if (modalCloseTimer.current !== null) {
          window.clearTimeout(modalCloseTimer.current)
          modalCloseTimer.current = null
        }
        setClosingModal(current => current === 'easter-egg' ? null : current)
        setEasterEggPassword('')
        setEasterEggMessage('')
        setEasterEggError(false)
        setEasterEggShake(false)
        setEasterEggOpen(true)
        window.requestAnimationFrame(() => easterEggInputRef.current?.focus())
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      if (modalCloseTimer.current !== null) window.clearTimeout(modalCloseTimer.current)
    }
  }, [])
  const closeSettingsModal = () => closeModalWithAnimation('settings', () => {
    setSettingsModal(null)
    if (returnToExpenseAfterParticipant) { setReturnToExpenseAfterParticipant(false); setModal(true) }
  })
  const save = (next: Data, recoveringStorage = false): boolean => {
    if (storageWarning && !recoveringStorage) {
      setBackupMessage('Importe um backup válido ou desbloqueie o armazenamento no aviso acima antes de salvar.')
      return false
    }
    try {
      localStorage.setItem('conta-clara-v1', JSON.stringify(next))
      setData(next)
      setStorageWarning('')
      return true
    } catch {
      setBackupMessage('Não foi possível salvar no navegador. Verifique o espaço disponível ou as permissões de armazenamento.')
      return false
    }
  }
  const occurrences = useMemo(() => calculateOccurrences(data.expenses.filter(e => (e as Expense & { kind?: string }).kind !== 'income')), [data.expenses])
  const current = occurrences.filter(e => e.month === month)
  const currentExpenses = current
  const personalValue = (e: typeof occurrences[number]) => Math.max(0, e.value - e.allocatedShares.reduce((sum, share) => sum + share.amount, 0))
  const owedBy = (e: typeof occurrences[number]) => { const shares = e.allocatedShares.filter(share => share.amount > 0); const names = shares.map(share => data.participants?.find(participant => participant.id === share.participantId)?.name).filter((name): name is string => Boolean(name)); const amount = shares.reduce((sum, share) => sum + share.amount, 0); return amount ? `${names.length ? names.join(', ') : 'Participante'} ${names.length === 1 ? 'deve' : 'devem'} ${money(amount)}` : '' }
  const filtered = current.filter(e => e.description.toLowerCase().includes(query.toLowerCase()) && (categoryFilter === 'Todas as categorias' || e.category === categoryFilter))
  const filteredExpenseIds = Array.from(new Set(filtered.map(e => e.id)))
  const selectedVisibleIds = filteredExpenseIds.filter(id => selectedExpenseIds.includes(id))
  const allVisibleSelected = filteredExpenseIds.length > 0 && selectedVisibleIds.length === filteredExpenseIds.length
  const total = currentExpenses.reduce((sum, e) => sum + personalValue(e), 0)
  const monthlyLimitValue = Math.max(0, Number(monthlyLimit) || 0)
  const limitNoticePercentValue = Math.min(100, Math.max(1, Number(limitNoticePercent) || 80))
  const monthlyLimitProgress = monthlyLimitValue ? total / monthlyLimitValue * 100 : 0
  const monthlyLimitNotice = monthlyLimitValue > 0 && total >= monthlyLimitValue * limitNoticePercentValue / 100
  const reimbursementTotal = currentExpenses.reduce((sum, e) => sum + e.allocatedShares.reduce((shareSum, share) => shareSum + share.amount, 0), 0)
  const categoryTotals = data.categories.map(c => ({ ...c, total: currentExpenses.filter(e => e.category === c.id).reduce((s, e) => s + personalValue(e), 0) })).filter(c => c.total > 0).sort((a, b) => b.total - a.total)
  const reimbursementByParticipant = (data.participants || []).map(participant => ({ participant, current: currentExpenses.reduce((sum, e) => sum + e.allocatedShares.filter(s => s.participantId === participant.id).reduce((a, s) => a + s.amount, 0), 0), future: occurrences.filter(e => e.month > month).reduce((sum, e) => sum + e.allocatedShares.filter(s => s.participantId === participant.id).reduce((a, s) => a + s.amount, 0), 0) })).filter(x => x.current > 0 || x.future > 0)
  const nextMonths = Array.from({ length: 5 }, (_, i) => shiftMonthKey(month, i))
  const previousMonth = shiftMonthKey(month, -1)
  const previousTotal = occurrences.filter(e => e.month === previousMonth).reduce((s, e) => s + personalValue(e), 0)
  const monthChange = previousTotal ? ((total - previousTotal) / previousTotal) * 100 : null
  const upcomingTotal = occurrences.filter(e => e.month > month).reduce((s, e) => s + personalValue(e), 0)
  const trendYears = Array.from(new Set(occurrences.map(e => e.month.slice(0, 4)))).sort((a, b) => b.localeCompare(a))
  const currentYear = String(today.getFullYear())
  const activeTrendYear = trendYears.includes(trendYear) ? trendYear : trendYears.includes(currentYear) ? currentYear : trendYears[0] || currentYear
  const monthlyTrend = Array.from({ length: 12 }, (_, i) => {
    const key = `${activeTrendYear}-${String(i + 1).padStart(2, '0')}`
    return { month: key, total: occurrences.filter(e => e.month === key).reduce((s, e) => s + personalValue(e), 0) }
  })
  const trendYearTotal = monthlyTrend.reduce((sum, item) => sum + item.total, 0)
  useEffect(() => {
    if (view !== 'Visão geral') return
    const chart = trendChartRef.current
    if (!chart) return
    const focusMonth = activeTrendYear === currentYear ? monthKey(today) : `${activeTrendYear}-01`
    const target = chart.querySelector<HTMLElement>(`[data-month="${focusMonth}"]`)
    if (target) chart.scrollTo({ left: Math.max(0, chart.scrollLeft + target.getBoundingClientRect().left - chart.getBoundingClientRect().left - (chart.clientWidth - target.offsetWidth) / 2), behavior: 'smooth' })
  }, [activeTrendYear, currentYear, view])
  const categoryTotal = categoryTotals.reduce((sum, c) => sum + c.total, 0)
  const pieSlices = categoryTotals.reduce<Array<{ category: Category & { total: number }; start: number; end: number; percentage: number }>>((slices, category) => { const start = slices.at(-1)?.end || 0; const end = start + category.total / categoryTotal * 360; return [...slices, { category, start, end, percentage: Math.round(category.total / categoryTotal * 100) }] }, [])
  const hoveredCategory = pieSlices.find(slice => slice.category.id === hoveredCategoryId)
  const closeActionMenu = (event: React.MouseEvent<HTMLButtonElement>, action: () => void) => { event.currentTarget.closest('details')?.removeAttribute('open'); action() }
  const toggleTheme = () => { const next = theme === 'dark' ? 'light' : 'dark'; localStorage.setItem('nexus-theme', next); setTheme(next); setDefaultTheme(next) }
  const closeEasterEgg = () => closeModalWithAnimation('easter-egg', () => {
    setEasterEggOpen(false)
    setEasterEggPassword('')
    setEasterEggMessage('')
    setEasterEggError(false)
    setEasterEggShake(false)
  })
  const submitEasterEgg = (event: React.FormEvent) => {
    event.preventDefault()
    const secretMessage = getEasterEggSecret(easterEggPassword)
    if (!secretMessage) {
      setEasterEggError(true)
      setEasterEggShake(false)
      window.requestAnimationFrame(() => setEasterEggShake(true))
      easterEggInputRef.current?.focus()
      return
    }
    setEasterEggError(false)
    setEasterEggShake(false)
    setEasterEggMessage(secretMessage)
  }
  const updateDefaultView = (next: MainView) => { setDefaultView(next); localStorage.setItem('nexus-default-view', next) }
  const updateDefaultTheme = (next: 'light' | 'dark') => { setDefaultTheme(next); setTheme(next); localStorage.setItem('nexus-theme', next) }
  const updateProfileName = (value: string) => { setProfileName(value); localStorage.setItem('poe-na-conta-profile-name', value) }
  const updateProfilePhoto = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024) { setProfileMessage('Escolha uma imagem PNG, JPG ou WebP de até 2 MB.'); return }
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result !== 'string') return
      try { localStorage.setItem('poe-na-conta-profile-photo', reader.result); setProfilePhoto(reader.result); setProfileMessage('Foto de perfil atualizada.') }
      catch { setProfileMessage('Não foi possível salvar essa imagem. Tente uma foto menor.') }
    }
    reader.onerror = () => setProfileMessage('Não foi possível ler a imagem selecionada.')
    reader.readAsDataURL(file)
  }
  const removeProfilePhoto = () => { localStorage.removeItem('poe-na-conta-profile-photo'); setProfilePhoto(''); setProfileMessage('Foto removida. As iniciais serão exibidas no perfil.') }
  const updateMonthlyLimit = (value: string) => { setMonthlyLimit(value); localStorage.setItem('poe-na-conta-monthly-limit', value) }
  const updateLimitNoticePercent = (value: string) => { const bounded = value === '' ? '' : String(Math.round(Math.min(100, Math.max(1, Number(value) || 80)))); setLimitNoticePercent(bounded); localStorage.setItem('poe-na-conta-limit-notice-percent', bounded) }
  const recurrences = data.recurrences || []
  const pendingRecurrences = recurrences.filter(item => item.active && !item.generatedMonths.includes(month) && !item.skippedMonths.includes(month))
  const selectedRecurrences = recurrenceSelection ?? pendingRecurrences.map(item => item.id)
  const openRecurrence = (item?: Recurrence) => setRecurrenceEditor({ id: item?.id, description: item?.description || '', amount: item ? String(item.amount) : '', category: item?.category || data.categories[0]?.id || '', method: item?.method || 'PIX', cardId: item?.cardId || data.cards[0]?.id || '', day: String(item?.day || 1) })
  const closeRecurrenceModal = () => closeModalWithAnimation('recurrence', () => setRecurrenceEditor(null))
  const saveRecurrence = (event: React.FormEvent) => {
    event.preventDefault()
    if (!recurrenceEditor) return
    const amount = parseMoneyInput(recurrenceEditor.amount)
    const day = Number(recurrenceEditor.day)
    if (!recurrenceEditor.description.trim() || !Number.isFinite(amount) || amount <= 0 || !Number.isInteger(day) || day < 1 || day > 31) return
    const previous = recurrenceEditor.id ? recurrences.find(value => value.id === recurrenceEditor.id) : undefined
    const item: Recurrence = { id: recurrenceEditor.id || createId(), description: recurrenceEditor.description.trim(), amount, category: recurrenceEditor.category || data.categories[0]?.id || '', method: recurrenceEditor.method, cardId: recurrenceEditor.method.startsWith('Crédito') ? (recurrenceEditor.cardId || data.cards[0]?.id || undefined) : undefined, day, active: previous?.active ?? true, generatedMonths: previous?.generatedMonths || [], skippedMonths: previous?.skippedMonths || [] }
    if (save({ ...data, recurrences: recurrenceEditor.id ? recurrences.map(value => value.id === item.id ? item : value) : [...recurrences, item] })) {
      closeRecurrenceModal()
    }
  }
  const confirmRecurrences = () => {
    const chosen = pendingRecurrences.filter(item => selectedRecurrences.includes(item.id))
    if (!chosen.length) return
    const generated: Expense[] = chosen.map(item => {
      const date = `${month}-${String(Math.min(item.day, new Date(Number(month.slice(0, 4)), Number(month.slice(5)) , 0).getDate())).padStart(2, '0')}`
      const card = data.cards.find(value => value.id === item.cardId) || data.cards[0]
      const firstMonth = item.method.startsWith('Crédito') && card ? calculateCardDueMonth(date, card) : month
      return { id: createId(), description: item.description, amount: item.amount, date, category: item.category, method: item.method, cardId: card?.id, installments: 1, firstMonth }
    })
    const ids = new Set(chosen.map(item => item.id))
    save({ ...data, expenses: [...generated, ...data.expenses], recurrences: recurrences.map(item => ids.has(item.id) ? { ...item, generatedMonths: [...item.generatedMonths, month] } : item) })
    setRecurrenceSelection(null)
  }
  const skipRecurrence = (id: string) => { setRecurrenceSelection(selectedRecurrences.filter(value => value !== id)); save({ ...data, recurrences: recurrences.map(item => item.id === id ? { ...item, skippedMonths: [...item.skippedMonths, month] } : item) }) }

  const addExpense = (ev: React.FormEvent) => {
    ev.preventDefault()
    const description = form.description.trim()
    if (!description) { setShareError('Informe uma descrição para o lançamento.'); return }
    const amount = parseMoneyInput(form.amount)
    if (!Number.isFinite(amount) || amount <= 0) { setShareError('Informe um valor válido maior que zero (ex.: 150,50).'); return }
    const normalizedDate = normalizeDateInput(form.date)
    if (!isDate(normalizedDate)) { setShareError('Informe uma data válida.'); return }
    const n = Math.round(Number(form.installments) || 1)
    if (form.method === 'Crédito parcelado' && (n < 2 || n > 60)) { setShareError('Informe entre 2 e 60 parcelas.'); return }
    for (const share of form.shares) {
      if (share.amount.trim() !== '') {
        const parsedShare = parseMoneyInput(share.amount)
        if (!Number.isFinite(parsedShare) || parsedShare < 0) { setShareError('Informe um valor válido para a divisão com participantes.'); return }
      }
    }
    const shares = form.shares.map(share => ({ participantId: share.participantId, amount: parseMoneyInput(share.amount) || 0, installment: form.method === 'Crédito parcelado' && share.installment !== 'all' ? Number(share.installment) : undefined })).filter(share => share.amount > 0)
    const count = form.method === 'Crédito parcelado' ? Math.max(1, n) : 1
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
    const card = form.method.startsWith('Crédito') ? (data.cards.find(c => c.id === form.cardId) || data.cards[0]) : undefined
    const firstMonth = form.method.startsWith('Crédito') && card ? calculateCardDueMonth(normalizedDate, card) : monthKey(new Date(`${normalizedDate}T12:00:00`))
    const entry: Expense = { id: editingExpenseId || createId(), description, amount, date: normalizedDate, category: form.category || data.categories[0]?.id || '', method: form.method, cardId: card?.id, installments: form.method === 'Crédito parcelado' ? Math.max(1, n) : 1, firstMonth, shares }
    if (!save({ ...data, expenses: editingExpenseId ? data.expenses.map(e => e.id === editingExpenseId ? entry : e) : [entry, ...data.expenses] })) return
    if (!editingExpenseId && firstMonth !== month) {
      setBackupMessage(`Lançamento salvo em ${monthName(firstMonth)}.`)
    }
    closeModalWithAnimation('expense', () => {
      setModal(false)
      setEditingExpenseId(null)
      setShareError('')
      setForm({ ...form, description: '', amount: '', date: normalizedDate, category: entry.category, cardId: card?.id || data.cards[0]?.id || '', installments: '1', shares: [] })
    })
  }
  const editExpense = (expense: Expense) => {
    setEditingExpenseId(expense.id)
    setForm({ description: expense.description, amount: String(expense.amount), date: expense.date, category: expense.category || data.categories[0]?.id || '', method: expense.method, cardId: expense.cardId || data.cards[0]?.id || '', installments: String(expense.installments), shares: (expense.shares || []).map(share => ({ participantId: share.participantId, amount: String(share.amount), installment: share.installment ? String(share.installment) : 'all' })) })
    setShareError('')
    setModal(true)
  }
  const closeExpenseModal = () => closeModalWithAnimation('expense', () => { setModal(false); setEditingExpenseId(null); setShareError('') })
  const deleteExpense = (id: string) => {
    if (save({ ...data, expenses: data.expenses.filter(e => e.id !== id) })) {
      setSelectedExpenseIds(current => current.filter(item => item !== id))
    }
  }
  const toggleSelectExpense = (id: string, checked: boolean) => {
    setSelectedExpenseIds(current => checked ? (current.includes(id) ? current : [...current, id]) : current.filter(item => item !== id))
  }
  const toggleSelectAllVisible = (checked: boolean) => {
    setSelectedExpenseIds(current => {
      if (checked) return Array.from(new Set([...current, ...filteredExpenseIds]))
      const visibleSet = new Set(filteredExpenseIds)
      return current.filter(id => !visibleSet.has(id))
    })
  }
  const deleteSelectedExpenses = () => {
    if (!selectedVisibleIds.length) return
    const count = selectedVisibleIds.length
    if (!window.confirm(count === 1 ? 'Excluir o lançamento selecionado?' : `Excluir os ${count} lançamentos selecionados?`)) return
    const toDelete = new Set(selectedVisibleIds)
    if (save({ ...data, expenses: data.expenses.filter(e => !toDelete.has(e.id)) })) {
      setSelectedExpenseIds(current => current.filter(id => !toDelete.has(id)))
      setBackupMessage(count === 1 ? '1 lançamento excluído.' : `${count} lançamentos excluídos.`)
    }
  }
  const downloadCsv = () => {
    const rows = [['Descrição','Valor da parcela','Parte pessoal','A receber','Parcela','Mês','Categoria','Pagamento','Participantes'], ...current.map(e => [e.description, e.value.toFixed(2), personalValue(e).toFixed(2), e.allocatedShares.reduce((sum, share) => sum + share.amount, 0).toFixed(2), `${e.part}/${e.installments}`, e.month, data.categories.find(c => c.id === e.category)?.name || '', e.method, e.allocatedShares.map(share => data.participants?.find(p => p.id === share.participantId)?.name || 'Participante').join(', ')])]
    const untrustedColumns = new Set([0, 6, 7, 8])
    const blob = new Blob(['\ufeff' + rows.map(row => row.map((cell, index) => csvCell(cell, untrustedColumns.has(index))).join(';')).join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `relatorio-${month}.csv`; a.click(); URL.revokeObjectURL(url)
  }
  const downloadBackup = () => {
    if (storageWarning) { setBackupMessage('Importe um backup válido antes de baixar uma cópia dos dados.'); return }
    const blob = new Blob([createBackup(data, { monthlyLimit, limitNoticePercent: String(limitNoticePercentValue), defaultView, theme, profileName, profilePhoto })], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `poe-na-conta-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
    setBackupMessage('Backup baixado. Guarde o arquivo em um local seguro.')
  }
  const applyBackupPayload = (payload: BackupPayload) => {
    save(payload.data, true)
    if (payload.preferences) {
      const { monthlyLimit: importedLimit, limitNoticePercent: importedPercent, defaultView: importedView, theme: importedTheme } = payload.preferences
      setMonthlyLimit(importedLimit)
      setLimitNoticePercent(importedPercent)
      setDefaultView(importedView)
      setView(importedView)
      setTheme(importedTheme)
      setDefaultTheme(importedTheme)
      localStorage.setItem('poe-na-conta-monthly-limit', importedLimit)
      localStorage.setItem('poe-na-conta-limit-notice-percent', importedPercent)
      localStorage.setItem('nexus-default-view', importedView)
      localStorage.setItem('nexus-theme', importedTheme)
      if (payload.preferences.profileName !== undefined) { setProfileName(payload.preferences.profileName); localStorage.setItem('poe-na-conta-profile-name', payload.preferences.profileName) }
      if (payload.preferences.profilePhoto !== undefined) { setProfilePhoto(payload.preferences.profilePhoto); if (payload.preferences.profilePhoto) localStorage.setItem('poe-na-conta-profile-photo', payload.preferences.profilePhoto); else localStorage.removeItem('poe-na-conta-profile-photo') }
    }
    localStorage.setItem('poe-na-conta-onboarded', '1')
    setBackupMessage('Backup importado com sucesso.')
  }
  const importBackup = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const imported = parseBackupFile(await file.text())
      if (!imported) { setBackupMessage('Este arquivo não é um backup válido do Põe na Conta.'); return }
      if (onboardingOpen) {
        applyBackupPayload(imported)
        setProfileMessage('')
        closeModalWithAnimation('onboarding', () => setOnboardingOpen(false))
        return
      }
      setPendingBackupImport(imported)
      setBackupMessage('')
    } catch {
      setBackupMessage('Não foi possível ler o arquivo selecionado.')
    } finally {
      event.target.value = ''
    }
  }
  const confirmBackupImport = () => {
    if (!pendingBackupImport) return
    applyBackupPayload(pendingBackupImport)
    closeBackupConfirmModal()
  }
  const completeOnboarding = (event: React.FormEvent) => {
    event.preventDefault()
    updateProfileName(profileName.trim())
    if (onboardingStartMode === 'empty') {
      save({ ...structuredClone(seed), expenses: [], recurrences: [] }, true)
    } else if (onboardingStartMode === 'demo') {
      save(structuredClone(seed), true)
    } else if (!localStorage.getItem('conta-clara-v1')) {
      save(data, true)
    }
    setHasExistingData(true)
    localStorage.setItem('poe-na-conta-onboarded', '1')
    setProfileMessage('')
    closeModalWithAnimation('onboarding', () => setOnboardingOpen(false))
  }
  const openResetDataModal = () => {
    setResetConfirmText('')
    setResetConfirmError(false)
    setResetDataModalOpen(true)
  }
  const closeResetDataModal = () => closeModalWithAnimation('reset', () => {
    setResetDataModalOpen(false)
    setResetConfirmText('')
    setResetConfirmError(false)
  })
  const confirmResetAllData = (event: React.FormEvent) => {
    event.preventDefault()
    if (resetConfirmText.trim().toLocaleUpperCase('pt-BR') !== 'EXCLUIR') {
      setResetConfirmError(true)
      return
    }
    const keysToRemove = [
      'conta-clara-v1',
      'poe-na-conta-onboarded',
      'poe-na-conta-profile-name',
      'poe-na-conta-profile-photo',
      'poe-na-conta-monthly-limit',
      'poe-na-conta-limit-notice-percent',
      'nexus-default-view',
      'nexus-theme',
    ]
    keysToRemove.forEach(key => localStorage.removeItem(key))
    const emptyData: Data = { ...structuredClone(seed), expenses: [], recurrences: [] }
    setHasExistingData(false)
    setData(emptyData)
    setStorageWarning('')
    setProfileName('')
    setProfilePhoto('')
    setProfileMessage('')
    setMonthlyLimit('')
    setLimitNoticePercent('80')
    setDefaultView('Visão geral')
    setView('Visão geral')
    setSelectedExpenseIds([])
    setRecurrenceSelection(null)
    setQuery('')
    setCategoryFilter('Todas as categorias')
    setOnboardingStartMode('empty')
    setBackupMessage('')
    closeModalWithAnimation('reset', () => {
      setResetDataModalOpen(false)
      setResetConfirmText('')
      setResetConfirmError(false)
      setOnboardingOpen(true)
    })
  }
  const closeBackupConfirmModal = () => closeModalWithAnimation('backup', () => setPendingBackupImport(null))
  const openCategory = (category?: Category) => setSettingsModal({ kind: 'category', id: category?.id, name: category?.name || '', color: category?.color || '#6e7f72', closingDay: '25', dueDay: '5' })
  const openCard = (card?: Card) => setSettingsModal({ kind: 'card', id: card?.id, name: card?.name || '', color: '#65a987', closingDay: String(card?.closingDay || 25), dueDay: String(card?.dueDay || 5) })
  const openParticipant = (participant?: Participant) => setSettingsModal({ kind: 'participant', id: participant?.id, name: participant?.name || '', color: '#65a987', closingDay: '25', dueDay: '5' })
  const addParticipantFromExpense = () => { setReturnToExpenseAfterParticipant(true); closeModalWithAnimation('expense', () => { setModal(false); openParticipant() }) }
  const saveSetting = (ev: React.FormEvent) => {
    ev.preventDefault(); if (!settingsModal) return
    const { kind, id, name, color, closingDay, dueDay } = settingsModal
    if (kind === 'category') { const category: Category = { id: id || createId(), name: name.trim(), color }; if (!save({ ...data, categories: id ? data.categories.map(c => c.id === id ? category : c) : [...data.categories, category] })) return }
    else if (kind === 'card') { const close = Number(closingDay); const due = Number(dueDay); if (close < 1 || close > 31 || due < 1 || due > 31) return; const card: Card = { id: id || createId(), name: name.trim(), closingDay: close, dueDay: due }; if (!save({ ...data, cards: id ? data.cards.map(c => c.id === id ? card : c) : [...data.cards, card] })) return }
    else { const participant: Participant = { id: id || createId(), name: name.trim() }; if (!save({ ...data, participants: id ? (data.participants || []).map(p => p.id === id ? participant : p) : [...(data.participants || []), participant] })) return }
    closeSettingsModal()
  }
  const removeParticipant = (id: string) => {
    if (!window.confirm('Remover este participante e apagar suas atribuições dos lançamentos?')) return
    save({ ...data, participants: (data.participants || []).filter(p => p.id !== id), expenses: data.expenses.map(e => ({ ...e, shares: (e.shares || []).filter(share => share.participantId !== id) })) })
  }

  const transactionTable = <section className="panel transactions data-page-table">
    <div className="panel-head"><div><h2>{view === 'Relatórios' ? 'Relatório de despesas' : 'Todos os lançamentos'}</h2><p>{view === 'Relatórios' ? 'Gastos pessoais e valores atribuídos a participantes.' : 'Consulte, filtre e acompanhe suas despesas.'}</p></div><button className="export-btn" aria-label="Exportar CSV" onClick={downloadCsv}>↓ <span>Exportar CSV</span></button></div>
    <div className="data-summary"><div><span>Gastos pessoais</span><b>{money(total)}</b></div><div><span>A receber</span><b>{money(reimbursementTotal)}</b></div><div><span>Lançamentos</span><b>{current.length}</b></div></div>
    <div className="filters"><label className="search"><span>⌕</span><input aria-label="Buscar lançamentos" placeholder="Buscar lançamento..." value={query} onChange={e => setQuery(e.target.value)} /></label><select aria-label="Filtrar por categoria" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}><option>Todas as categorias</option>{data.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
    {selectedVisibleIds.length > 0 && <div className="bulk-actions-bar" role="region" aria-label="Ações em massa">
      <span className="bulk-actions-count"><b>{selectedVisibleIds.length}</b> {selectedVisibleIds.length === 1 ? 'item selecionado' : 'itens selecionados'}</span>
      <div className="bulk-actions-buttons">
        <button type="button" className="cancel-btn bulk-clear-btn" onClick={() => toggleSelectAllVisible(false)}>Limpar seleção</button>
        <button type="button" className="danger-btn bulk-delete-btn" onClick={deleteSelectedExpenses}>Excluir selecionados ({selectedVisibleIds.length})</button>
      </div>
    </div>}
    <div className="table-wrap"><table><thead><tr><th className="col-select"><input type="checkbox" className="row-checkbox" aria-label="Selecionar todos os lançamentos visíveis" checked={allVisibleSelected} disabled={!filteredExpenseIds.length} onChange={e => toggleSelectAllVisible(e.target.checked)} /></th><th className="col-desc">DESCRIÇÃO</th><th className="col-category">CATEGORIA</th><th className="col-date">DATA</th><th className="col-method">PAGAMENTO</th><th className="right col-value">PARTE PESSOAL</th><th className="col-actions" /></tr></thead><tbody>{filtered.map(e => { const cat = data.categories.find(c => c.id === e.category); const own = personalValue(e); const shared = e.allocatedShares.reduce((sum, share) => sum + share.amount, 0); const debtor = owedBy(e); const shortDate = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(new Date(`${e.date}T12:00:00`)).replace('.', ''); const isSelected = selectedExpenseIds.includes(e.id); return <tr key={`${e.id}-${e.month}`} className={isSelected ? 'is-selected' : ''}><td className="col-select"><input type="checkbox" className="row-checkbox" aria-label={`Selecionar ${e.description}`} checked={isSelected} onChange={ev => toggleSelectExpense(e.id, ev.target.checked)} /></td><td className="col-desc"><div className="desc"><span className="category-icon" style={{ color: cat?.color, background: `${cat?.color}18` }}>{e.category === 'moradia' ? '⌂' : e.category === 'alimentacao' ? '◒' : e.category === 'transporte' ? '⌁' : e.category === 'lazer' ? '✧' : '＋'}</span><span className="desc-text"><b>{e.description}</b><small>{e.installments > 1 ? `Parcela ${e.part} de ${e.installments}` : 'Despesa'}{shared > 0 ? ` · ${debtor}` : ''}</small><small className="mobile-tx-meta">{shortDate} · {cat?.name || 'Sem categoria'} · {e.method}</small></span></div></td><td className="col-category"><span className="category-label"><i style={{ background: cat?.color }} />{cat?.name || 'Sem categoria'}</span></td><td className="date-cell col-date">{new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${e.date}T12:00:00`))}</td><td className="col-method"><span className={`method ${e.method.startsWith('Crédito') ? 'credit' : ''}`}>{e.method}</span></td><td className="right value col-value">{money(own)}</td><td className="col-actions"><details className="row-actions"><summary aria-label={`Ações para ${e.description}`} title="Ações">···</summary><div className={`row-action-menu ${theme === 'dark' ? 'is-dark' : 'is-light'}`}><button onClick={event => closeActionMenu(event, () => editExpense(e))}>Editar</button><button className="danger" onClick={event => closeActionMenu(event, () => deleteExpense(e.id))}>Excluir</button></div></details></td></tr> })}</tbody></table>{!filtered.length && <div className="empty">Nenhum lançamento encontrado neste mês.</div>}</div>
    <div className="table-foot"><span>Mostrando <b>{filtered.length}</b> de <b>{current.length}</b> lançamentos</span><span>Gastos pessoais <b>{money(total)}</b> · A receber <b>{money(reimbursementTotal)}</b></span></div>
  </section>

  return <div className="app-shell" data-theme={theme}>
    <input ref={backupInput} type="file" accept="application/json,.json" hidden onChange={importBackup} />
    <input ref={profilePhotoInput} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={updateProfilePhoto} />
    {backupMessage && <div className="backup-toast" role="status" aria-live="polite">{backupMessage}<button type="button" aria-label="Dispensar aviso" onClick={() => setBackupMessage('')}>×</button></div>}
    <header className="site-header"><a className="brand" href="#" onClick={() => setView('Visão geral')}><span className="brand-mark"><svg viewBox="0 0 48 48" shapeRendering="crispEdges" aria-hidden="true"><rect x="1" y="1" width="46" height="46" rx="13" fill="#20231f"/><path d="M18 6h12v3h6v6h3v6h3v12h-3v6h-6v3H18v-3h-6v-6H9v-6H6V18h3v-6h6V9h3z" fill="#986027"/><path d="M18 9h12v3h6v6h3v12h-3v6h-6v3H18v-3h-6v-6H9V18h3v-6h6z" fill="#e8b957"/><path d="M18 12h12v3h6v3h-3v3h-3v-3H18v-3h-3v-3h3z" fill="#f6d77e"/><rect x="22" y="14" width="4" height="20" fill="#80501f"/><rect x="18" y="17" width="12" height="3" fill="#80501f"/><rect x="15" y="20" width="3" height="3" fill="#80501f"/><rect x="18" y="23" width="12" height="3" fill="#80501f"/><rect x="27" y="26" width="3" height="3" fill="#80501f"/><rect x="18" y="29" width="12" height="3" fill="#80501f"/><rect x="12" y="18" width="3" height="6" fill="#f6d77e"/></svg></span><span>Põe na Conta<small>GESTÃO FINANCEIRA</small></span></a><div className="side-label">MENU</div><nav aria-label="Navegação principal">{(['Visão geral','Lançamentos','Relatórios','Recorrências'] as const).map((v, i) => <button key={v} className={`nav-item ${view === v ? 'active' : ''}`} onClick={() => setView(v)}><span className="nav-icon">{['◫','↔','▥','↻'][i]}</span><span className="nav-label">{v}</span></button>)}<button className={`nav-item mobile-settings-nav ${view === 'Ajustes' ? 'active' : ''}`} onClick={() => setView('Ajustes')}><span className="nav-icon">⚙</span><span className="nav-label">Ajustes</span></button></nav><div className="side-bottom"><button className={`theme-switch header-theme-switch ${theme === 'dark' ? 'is-dark' : ''}`} onClick={toggleTheme} aria-label={theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'}><span className="theme-switch-track" aria-hidden="true"><span className="theme-switch-thumb">{theme === 'dark' ? <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" /></svg> : <svg viewBox="0 0 24 24"><path d="M20.2 15.4A8.5 8.5 0 0 1 8.6 3.8 8.5 8.5 0 1 0 20.2 15.4Z" /></svg>}</span></span><span className="theme-switch-label">{theme === 'dark' ? 'Tema claro' : 'Tema escuro'}</span></button><div className="profile"><div className={`avatar profile-avatar ${profilePhoto ? 'has-photo' : ''}`}>{profilePhoto ? <img src={profilePhoto} alt="" /> : profileName.trim() ? profileInitials(profileName) : <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>}</div><div><b>Meu espaço</b><span>{profileName.trim() || 'Plano pessoal'}</span></div><details className="row-actions profile-actions"><summary aria-label="Abrir opções do Meu espaço" title="Opções">···</summary><div className={`row-action-menu ${theme === 'dark' ? 'is-dark' : 'is-light'}`}><button onClick={event => closeActionMenu(event, () => setView('Ajustes'))}>Preferências</button><button onClick={event => closeActionMenu(event, downloadBackup)}>Exportar backup</button><button onClick={event => closeActionMenu(event, () => backupInput.current?.click())}>Importar backup</button></div></details></div></div></header>
    <main className="main"><header className="topbar"><div className="breadcrumb">Põe na Conta <span>/</span> {view}</div><div className="top-actions"><span className="today">◷ &nbsp;{new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(today)}</span><div className={`avatar small profile-avatar ${profilePhoto ? 'has-photo' : ''}`}>{profilePhoto ? <img src={profilePhoto} alt="" /> : profileName.trim() ? profileInitials(profileName) : <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>}</div></div></header>
      <div className="content" key={view}>
        <div className="heading-row"><div><div className="eyebrow">{new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }).format(today).toLocaleUpperCase('pt-BR')}</div><h1>{view}</h1><p className="subtitle">{view === 'Visão geral' ? 'Uma leitura clara dos seus gastos e compromissos.' : view === 'Lançamentos' ? 'Encontre e acompanhe cada movimentação.' : view === 'Relatórios' ? 'Entenda como seus gastos se distribuem ao longo do tempo.' : view === 'Recorrências' ? 'Revise as despesas que se repetem antes de lançar no mês.' : 'Personalize categorias, cartões e pessoas com quem divide despesas.'}</p></div>{view !== 'Ajustes' && <button className="primary" onClick={() => view === 'Recorrências' ? openRecurrence() : openNewExpenseModal()}><span>＋</span> {view === 'Recorrências' ? 'Nova recorrência' : 'Nova despesa'}</button>}</div>
        {storageWarning && <div className="backup-warning" role="alert"><span>{storageWarning} Acesse <b>Ajustes → Seus dados</b> para importar um backup válido.</span><button type="button" className="outline-btn" onClick={() => save(data, true)}>Continuar com os dados atuais</button></div>}
        {view !== 'Ajustes' && <div className="monthbar"><button className="month-arrow" aria-label="Mês anterior" onClick={() => { setMonth(shiftMonthKey(month, -1)); setRecurrenceSelection(null) }}>‹</button><span>{monthName(month)}</span><button className="month-arrow" aria-label="Próximo mês" onClick={() => { setMonth(shiftMonthKey(month, 1)); setRecurrenceSelection(null) }}>›</button><button className="today-btn" onClick={() => { setMonth(monthKey(today)); setRecurrenceSelection(null) }}>Hoje</button></div>}
        {view !== 'Ajustes' && monthlyLimitValue > 0 && <section className={`monthly-limit ${monthlyLimitNotice ? 'is-warning' : ''}`} role="status" aria-live="polite"><div className="monthly-limit-heading"><span>Limite mensal · {monthName(month)}</span><b>{money(total)} de {money(monthlyLimitValue)}</b></div><div className="monthly-limit-track" role="progressbar" aria-label="Uso do limite mensal" aria-valuemin={0} aria-valuemax={monthlyLimitValue} aria-valuenow={Math.min(total, monthlyLimitValue)}><i style={{ width: `${Math.min(monthlyLimitProgress, 100)}%` }} /></div><p>{monthlyLimitNotice ? monthlyLimitProgress > 100 ? `Teto mensal ultrapassado: você já usou ${Math.round(monthlyLimitProgress)}% do seu limite pessoal.` : `Você atingiu ${limitNoticePercentValue}% do limite mensal que definiu.` : `Avisaremos ao atingir ${limitNoticePercentValue}% (${money(monthlyLimitValue * limitNoticePercentValue / 100)}).`}</p></section>}

        {view === 'Ajustes' ? <section className="settings-grid">
          <div className="panel settings-panel preference-panel" id="preferences-panel"><div className="panel-head"><div><h2>Preferências</h2><p>Personalize como o Põe na Conta abre e aparece.</p></div><span className="calendar-icon">⚙</span></div><div className="profile-preferences"><h3>Perfil</h3><p>Defina como seu perfil aparece neste dispositivo.</p><label>Nome<input type="text" maxLength={60} placeholder="Seu nome" value={profileName} onChange={event => updateProfileName(event.target.value)} /></label><div className="profile-photo-actions"><button type="button" className="outline-btn" onClick={() => profilePhotoInput.current?.click()}>{profilePhoto ? 'Trocar foto' : 'Adicionar foto'}</button>{profilePhoto && <button type="button" className="text-btn" onClick={removeProfilePhoto}>Remover foto</button>}</div>{profileMessage && <small className="profile-message" role="status">{profileMessage}</small>}</div><div className="preference-controls"><label>Tela ao abrir<select value={defaultView} onChange={event => updateDefaultView(event.target.value as MainView)}><option>Visão geral</option><option>Lançamentos</option><option>Relatórios</option><option>Recorrências</option><option>Ajustes</option></select></label><label>Tema padrão<select value={defaultTheme} onChange={event => updateDefaultTheme(event.target.value as 'light' | 'dark')}><option value="light">Claro</option><option value="dark">Escuro</option></select></label></div><div className="budget-preferences"><h3>Limite de gastos por mês</h3><p>O limite considera apenas sua parte das despesas; valores de participantes ficam de fora.</p><div className="budget-preference-fields"><label>Teto mensal (R$)<input type="number" min="0" step="0.01" inputMode="decimal" placeholder="Ex.: 1000" value={monthlyLimit} onChange={event => updateMonthlyLimit(event.target.value)} /></label><label>Avisar ao atingir (%)<input type="number" min="1" max="100" step="1" placeholder="80" value={limitNoticePercent} onChange={event => updateLimitNoticePercent(event.target.value)} /></label></div></div></div>
          <div className="panel settings-panel"><div className="panel-head"><div><h2>Categorias</h2><p>Organize e identifique seus gastos.</p></div><button className="outline-btn" onClick={() => openCategory()}>＋ Nova categoria</button></div>{data.categories.map(c => <div className="setting-row" key={c.id}><i className="dot" style={{ background: c.color }} /><b>{c.name}</b><details className="row-actions"><summary aria-label={`Ações para a categoria ${c.name}`} title="Ações">···</summary><div className={`row-action-menu ${theme === 'dark' ? 'is-dark' : 'is-light'}`}><button onClick={event => closeActionMenu(event, () => openCategory(c))}>Editar</button><button className="danger" onClick={event => closeActionMenu(event, () => save({ ...data, categories: data.categories.filter(x => x.id !== c.id) }))}>Remover</button></div></details></div>)}</div>
          <div className="panel settings-panel"><div className="panel-head"><div><h2>Cartões</h2><p>Configure fechamento e vencimento da fatura.</p></div><button className="outline-btn" onClick={() => openCard()}>＋ Novo cartão</button></div>{data.cards.map(c => <div className="setting-row" key={c.id}><span className="card-icon">▣</span><b>{c.name}</b><span className="card-days">Fecha dia {c.closingDay} · Vence dia {c.dueDay}</span><details className="row-actions"><summary aria-label={`Ações para o cartão ${c.name}`} title="Ações">···</summary><div className={`row-action-menu ${theme === 'dark' ? 'is-dark' : 'is-light'}`}><button onClick={event => closeActionMenu(event, () => openCard(c))}>Editar</button><button className="danger" onClick={event => closeActionMenu(event, () => save({ ...data, cards: data.cards.filter(x => x.id !== c.id) }))}>Remover</button></div></details></div>)}</div>
          <div className="panel settings-panel"><div className="panel-head"><div><h2>Participantes</h2><p>Pessoas que dividem despesas com você.</p></div><button className="outline-btn" onClick={() => openParticipant()}>＋ Novo participante</button></div>{(data.participants || []).length ? (data.participants || []).map(participant => <div className="setting-row" key={participant.id}><span className="participant-avatar">{participant.name.slice(0, 1).toUpperCase()}</span><b>{participant.name}</b><details className="row-actions"><summary aria-label={`Ações para ${participant.name}`} title="Ações">···</summary><div className={`row-action-menu ${theme === 'dark' ? 'is-dark' : 'is-light'}`}><button onClick={event => closeActionMenu(event, () => openParticipant(participant))}>Editar</button><button className="danger" onClick={event => closeActionMenu(event, () => removeParticipant(participant.id))}>Remover</button></div></details></div>) : <div className="empty compact">Adicione pessoas para acompanhar o que elas precisam reembolsar.</div>}</div>
          <div className="panel backup"><h2>Seus dados</h2><p>Os lançamentos ficam salvos localmente neste navegador. Baixe um backup completo para preservar categorias, cartões, participantes e despesas.</p><div className="backup-actions"><button className="outline-btn" onClick={downloadBackup}>Baixar backup JSON</button><button className="outline-btn" onClick={() => backupInput.current?.click()}>Importar backup</button><button className="outline-btn" onClick={downloadCsv}>↓ Exportar mês em CSV</button><button type="button" className="danger-outline-btn" onClick={openResetDataModal}>Excluir dados</button></div>{storageWarning && <p className="backup-warning" role="alert">{storageWarning}</p>}</div>
        </section> : view === 'Recorrências' ? <section className="recurrence-page">
          <div className="panel recurrence-review"><div className="panel-head"><div><h2>Revisão de {monthName(month)}</h2><p>Confirme só as cobranças que aconteceram neste mês.</p></div><span className="stat-symbol muted">↻</span></div>
            {pendingRecurrences.length ? <><div className="recurrence-review-tools"><label><input type="checkbox" checked={pendingRecurrences.every(item => selectedRecurrences.includes(item.id))} onChange={event => setRecurrenceSelection(event.target.checked ? pendingRecurrences.map(item => item.id) : [])} /> Selecionar todas</label><span>{pendingRecurrences.length} para revisar</span></div><div className="recurrence-list">{pendingRecurrences.map(item => { const category = data.categories.find(value => value.id === item.category); return <div className="recurrence-review-item" key={item.id}><input type="checkbox" aria-label={`Confirmar ${item.description}`} checked={selectedRecurrences.includes(item.id)} onChange={event => { const current = new Set(selectedRecurrences); if (event.target.checked) current.add(item.id); else current.delete(item.id); setRecurrenceSelection([...current]) }} /><span className="category-icon" style={{ color: category?.color, background: `${category?.color}18` }}>↻</span><span className="recurrence-info"><b>{item.description}</b><small>{category?.name || 'Sem categoria'} · Todo dia {item.day} · {item.method}</small></span><b className="recurrence-amount">{money(item.amount)}</b><button type="button" className="recurrence-skip" onClick={() => skipRecurrence(item.id)}>Pular</button></div> })}</div><div className="recurrence-review-footer"><span>Os lançamentos confirmados entram na lista do mês.</span><button className="primary" disabled={!selectedRecurrences.length} onClick={confirmRecurrences}>Confirmar {selectedRecurrences.length} {selectedRecurrences.length === 1 ? 'despesa' : 'despesas'}</button></div></> : <div className="empty">Nenhuma cobrança pendente para revisar neste mês.</div>}
          </div>
          <div className="panel recurrence-manage"><div className="panel-head"><div><h2>Modelos mensais</h2><p>Gerencie os valores e a frequência das despesas.</p></div><span className="recurrence-count">{recurrences.filter(item => item.active).length} ativas</span></div>{recurrences.length ? <div className="recurrence-list">{recurrences.map(item => { const category = data.categories.find(value => value.id === item.category); return <div className={`recurrence-template ${item.active ? '' : 'is-paused'}`} key={item.id}><span className="category-icon" style={{ color: category?.color, background: `${category?.color}18` }}>↻</span><span className="recurrence-info"><b>{item.description}</b><small>{category?.name || 'Sem categoria'} · Dia {item.day} · {item.active ? 'Ativa' : 'Pausada'}</small></span><b className="recurrence-amount">{money(item.amount)}</b><details className="row-actions"><summary aria-label={`Ações para ${item.description}`} title="Ações">···</summary><div className={`row-action-menu ${theme === 'dark' ? 'is-dark' : 'is-light'}`}><button onClick={event => closeActionMenu(event, () => openRecurrence(item))}>Editar</button><button onClick={event => closeActionMenu(event, () => save({ ...data, recurrences: recurrences.map(value => value.id === item.id ? { ...value, active: !value.active } : value) }))}>{item.active ? 'Pausar' : 'Reativar'}</button><button className="danger" onClick={event => closeActionMenu(event, () => { if (window.confirm(`Excluir a recorrência “${item.description}”? Os lançamentos já criados serão mantidos.`)) save({ ...data, recurrences: recurrences.filter(value => value.id !== item.id) }) })}>Excluir</button></div></details></div> })}</div> : <div className="empty">Cadastre seu primeiro modelo mensal para revisar cobranças recorrentes aqui.</div>}</div>
        </section> : view === 'Visão geral' ? <>
          <section className="stats health-stats">
            <article className="stat-card balance-card"><div className="stat-top"><span>Gastos pessoais do mês</span><span className="stat-symbol">↘</span></div><strong>{money(total)}</strong><div className="stat-foot">Sua parte em {monthName(month)}</div><div className="sparkline"><svg viewBox="0 0 240 50" preserveAspectRatio="none"><path d="M0 40 C18 37 22 29 37 34 S56 31 67 30 S82 39 97 29 S118 24 129 29 S151 12 162 20 S178 29 187 19 S210 23 219 7 S233 17 240 6" fill="none" stroke="#7be1c4" strokeWidth="2" /></svg></div></article>
            <article className="stat-card"><div className="stat-top"><span>Em relação ao mês anterior</span><span className={`stat-symbol ${monthChange !== null && monthChange > 0 ? 'orange' : 'muted'}`}>{monthChange === null ? '—' : monthChange > 0 ? '↑' : '↓'}</span></div><strong>{monthChange === null ? 'Sem histórico' : `${Math.abs(monthChange).toFixed(0)}% ${monthChange > 0 ? 'a mais' : 'a menos'}`}</strong><div className="stat-foot">{monthChange === null ? 'Sem comparação no mês anterior' : `Comparado com ${monthName(previousMonth)}`}</div></article>
            <article className="stat-card"><div className="stat-top"><span>A receber de terceiros</span><span className="stat-symbol orange">＋</span></div><strong>{money(reimbursementTotal)}</strong><div className="stat-foot">Despesas de terceiros neste mês</div></article>
            <article className="stat-card"><div className="stat-top"><span>Compromissos futuros</span><span className="stat-symbol muted">◷</span></div><strong>{money(upcomingTotal)}</strong><div className="stat-foot">Sua parte das despesas cadastradas</div></article>
          </section>
          <section className="health-grid">
            <div className="panel trend-panel"><div className="trend-panel-head"><div><h2>Ritmo dos gastos</h2><p>Despesas registradas ao longo de {activeTrendYear}</p></div><span className="trend-total">{money(trendYearTotal)} <small>no ano</small></span></div>
              <div className="trend-controls year-controls"><label className="year-select">Ano<select aria-label="Ano do ritmo de gastos" value={activeTrendYear} disabled={!trendYears.length} onChange={e => setTrendYear(e.target.value)}>{trendYears.length ? trendYears.map(year => <option value={year} key={year}>{year}</option>) : <option value={currentYear}>Sem lançamentos</option>}</select></label></div>
              <div className="trend-chart" ref={trendChartRef}>{monthlyTrend.map(item => { const max = Math.max(...monthlyTrend.map(x => x.total), 1); const label = new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(new Date(`${item.month}-01T12:00:00`)).replace('.', ''); return <div className="trend-column" key={item.month} data-month={item.month} title={`${monthName(item.month)} · ${money(item.total)}`}><b>{item.total ? new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }).format(item.total) : '—'}</b><div className="bar-track"><i className={item.month === monthKey(today) ? 'current-bar' : ''} style={{ height: `${Math.max(item.total / max * 100, item.total ? 8 : 2)}%` }} /></div><span>{label}</span></div> })}</div><div className="trend-foot">O gráfico mostra os 12 meses do ano selecionado. Anos sem lançamentos não aparecem na lista.</div></div>
            <div className="panel health-insight"><div className="panel-head"><div><h2>Leitura do seu mês</h2><p>Indicadores com base nos lançamentos</p></div><span className="calendar-icon">✳</span></div>{categoryTotals.length ? <><div className="insight-number">{categoryTotals[0].name}<small>é sua maior categoria</small></div><p className="insight-copy">Ela representa <b>{total ? Math.round(categoryTotals[0].total / total * 100) : 0}%</b> dos gastos previstos no período.</p><div className="track insight-track"><i style={{ width: `${total ? categoryTotals[0].total / total * 100 : 0}%`, background: categoryTotals[0].color }} /></div><div className="health-callout"><span>↗</span><p>{monthChange === null ? 'Registre seus gastos mês a mês para criar uma comparação.' : monthChange > 0 ? `Os gastos previstos subiram ${Math.abs(monthChange).toFixed(0)}% frente ao mês anterior.` : `Os gastos previstos caíram ${Math.abs(monthChange).toFixed(0)}% frente ao mês anterior.`}</p></div></> : <div className="empty">Adicione lançamentos para ver os indicadores do mês.</div>}</div>
            <div className="panel category-panel"><div className="panel-head"><div><h2>Onde estão os gastos</h2><p>{categoryPanelMode === 'categories' ? 'Distribuição por categoria' : `${currentExpenses.length} despesas pessoais no período`}</p></div><div className="category-head-actions"><div className="category-view-toggle" aria-label="Resumo por categoria ou lançamentos"><button className={categoryPanelMode === 'categories' ? 'selected' : ''} onClick={() => setCategoryPanelMode('categories')}>Categorias</button><button className={categoryPanelMode === 'transactions' ? 'selected' : ''} onClick={() => setCategoryPanelMode('transactions')}>Lançamentos</button></div></div></div>{categoryPanelMode === 'transactions' ? currentExpenses.length ? <div className="category-transaction-list">{[...currentExpenses].sort((a, b) => b.date.localeCompare(a.date)).map(e => { const cat = data.categories.find(c => c.id === e.category); const debtor = owedBy(e); return <div className="category-transaction" key={`${e.id}-${e.month}`}><span className="category-icon" style={{ color: cat?.color, background: `${cat?.color}18` }}>{e.category === 'moradia' ? '⌂' : e.category === 'alimentacao' ? '◒' : e.category === 'transporte' ? '⌁' : e.category === 'lazer' ? '✧' : '＋'}</span><span className="category-transaction-info"><b>{e.description}</b><small>{cat?.name || 'Sem categoria'}{debtor ? ` · ${debtor}` : ''}{e.installments > 1 ? ` · Parcela ${e.part}/${e.installments}` : ''}</small></span><b className="category-transaction-value">{money(personalValue(e))}</b></div> })}</div> : <div className="empty compact">Sem despesas neste mês.</div> : categoryTotals.length ? <div className="pie-layout"><div className="pie-chart"><svg className="pie-svg" viewBox="0 0 100 100" role="img" aria-label="Gastos pessoais por categoria"><circle cx="50" cy="50" r="37" fill="none" stroke="#e8eee9" strokeWidth="18" />{pieSlices.length === 1 ? <circle className="pie-slice" cx="50" cy="50" r="37" fill="none" stroke={pieSlices[0].category.color} strokeWidth="18" tabIndex={0} onMouseEnter={() => setHoveredCategoryId(pieSlices[0].category.id)} onMouseLeave={() => setHoveredCategoryId(null)} onFocus={() => setHoveredCategoryId(pieSlices[0].category.id)} onBlur={() => setHoveredCategoryId(null)}><title>{`${pieSlices[0].category.name}: ${money(pieSlices[0].category.total)} · ${pieSlices[0].percentage}%`}</title></circle> : pieSlices.map(slice => <path className="pie-slice" key={slice.category.id} d={donutSlice(slice.start, slice.end)} fill={slice.category.color} tabIndex={0} aria-label={`${slice.category.name}: ${money(slice.category.total)}, ${slice.percentage}%`} onMouseEnter={() => setHoveredCategoryId(slice.category.id)} onMouseLeave={() => setHoveredCategoryId(null)} onFocus={() => setHoveredCategoryId(slice.category.id)} onBlur={() => setHoveredCategoryId(null)}><title>{`${slice.category.name}: ${money(slice.category.total)} · ${slice.percentage}%`}</title></path>)}</svg><div className="pie-center"><b>{hoveredCategory ? `${hoveredCategory.percentage}%` : money(categoryTotal)}</b><small>{hoveredCategory ? hoveredCategory.category.name : 'Total pessoal'}</small></div></div><div className="pie-legend">{pieSlices.map(slice => <div key={slice.category.id}><span><i style={{ background: slice.category.color }} />{slice.category.name}</span><b>{money(slice.category.total)}</b></div>)}</div></div> : <div className="empty compact">Sem dados para este mês.</div>}</div>
            <div className="panel upcoming"><div className="panel-head"><div><h2>O que vem pela frente</h2><p>Valores pessoais já previstos</p></div><span className="calendar-icon">▦</span></div>{nextMonths.slice(1, 5).map(m => { const due = occurrences.filter(e => e.month === m); return <div className="upcoming-row" key={m}><span className="mini-date"><b>{m.slice(5)}</b><small>{m.slice(0, 4)}</small></span><span className="upcoming-name"><b>{monthName(m)}</b><small>{due.length} {due.length === 1 ? 'despesa' : 'despesas'}</small></span><b className="upcoming-value">{money(due.reduce((s, e) => s + personalValue(e), 0))}</b></div> })}<div className="future-note"><span>ⓘ</span> Sua parte após descontar os valores atribuídos a terceiros.</div></div>
            <div className="panel reimbursement-panel"><div className="panel-head"><div><h2>Quem precisa te pagar</h2><p>Reembolsos deste mês e parcelas futuras</p></div><span className="stat-symbol orange">＋</span></div>{reimbursementByParticipant.length ? <>{reimbursementByParticipant.map(({ participant, current: thisMonth, future }) => <div className="reimbursement-row" key={participant.id}><div className="reimbursement-person"><span className="participant-avatar">{participant.name.slice(0, 1).toUpperCase()}</span><b>{participant.name}</b></div><div className="reimbursement-values"><span>Neste mês <b>{money(thisMonth)}</b></span><span>Parcelas futuras <b>{money(future)}</b></span></div></div>)}<div className="reimbursement-total"><span>Total a receber neste mês</span><b>{money(reimbursementTotal)}</b></div></> : <div className="empty compact">{(data.participants || []).length ? 'Adicione a parte de alguém em uma despesa para ver aqui quanto ela deve te pagar.' : <>Cadastre uma pessoa direto em uma despesa compartilhada. <button className="text-btn" onClick={openNewExpenseModal}>Nova despesa →</button></>}</div>}</div>
          </section>
        </> : <section className="data-page">{transactionTable}</section>}
        <footer>Feito para trazer mais clareza ao seu dia a dia <span>✳</span><span>Seus dados ficam neste dispositivo</span></footer>
      </div>
    </main>

    {modal && <div className={`modal-backdrop ${closingModal === 'expense' ? 'is-closing' : ''}`} onMouseDown={e => { if (e.target === e.currentTarget) closeExpenseModal() }}><form className="modal expense-modal" role="dialog" aria-modal="true" aria-labelledby="expense-modal-title" onSubmit={addExpense}>
      <div className="modal-header"><div><span className="eyebrow">{editingExpenseId ? 'EDITAR REGISTRO' : 'NOVO REGISTRO'}</span><h2 id="expense-modal-title">{editingExpenseId ? 'Editar lançamento' : 'Adicionar lançamento'}</h2></div><button type="button" aria-label="Fechar lançamento" onClick={closeExpenseModal}>×</button></div>
      <label>Descrição<input required autoFocus={!isTouchDevice()} enterKeyHint="done" onKeyDown={dismissKeyboardOnEnter} placeholder="Ex.: mercado, conta de luz..." value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></label>
      <div className="form-row"><label>Valor total<input required type="text" inputMode="decimal" enterKeyHint="done" onKeyDown={dismissKeyboardOnEnter} placeholder="0,00" value={form.amount} onChange={e => { setShareError(''); setForm({ ...form, amount: e.target.value }) }} /></label><label>Data da compra<input required type="date" value={form.date} onFocus={blurActiveInputOnTouch} onChange={e => { setShareError(''); setForm({ ...form, date: e.target.value }) }} /></label></div>
      <div className="form-row"><label>Categoria<select value={form.category || data.categories[0]?.id || ''} onFocus={blurActiveInputOnTouch} onChange={e => setForm({ ...form, category: e.target.value })}>{data.categories.map(c => <option value={c.id} key={c.id}>{c.name}</option>)}</select></label><label>Forma de pagamento<select value={form.method} onFocus={blurActiveInputOnTouch} onChange={e => { const nextMethod = e.target.value as Method; setForm({ ...form, method: nextMethod, cardId: nextMethod.startsWith('Crédito') ? (form.cardId || data.cards[0]?.id || '') : form.cardId }) }}><option>PIX</option><option>Débito</option><option>Crédito à vista</option><option>Crédito parcelado</option></select></label></div>
      {form.method.startsWith('Crédito') && <><label>Cartão<select value={form.cardId || data.cards[0]?.id || ''} onFocus={blurActiveInputOnTouch} onChange={e => setForm({ ...form, cardId: e.target.value })}>{data.cards.map(c => <option key={c.id} value={c.id}>{c.name} · fecha dia {c.closingDay} · vence dia {c.dueDay}</option>)}</select></label>{selectedFormCard && creditDueMonth && <div className="billing-preview"><span>◷</span><div>{form.method === 'Crédito parcelado' ? 'A primeira parcela vence em' : 'Esta compra vence em'} <b>{monthName(creditDueMonth)}</b>, no dia {selectedFormCard.dueDay}.{Number(normalizedFormDate.slice(-2)) >= selectedFormCard.closingDay ? ' Como a compra cai no fechamento ou depois, ela entra no próximo ciclo.' : ' A compra entra no ciclo que está para fechar.'}</div></div>}</>}
      {form.method === 'Crédito parcelado' && <label>Número de parcelas<input type="number" min="2" max="60" enterKeyHint="done" onKeyDown={dismissKeyboardOnEnter} value={form.installments} onChange={e => setForm({ ...form, installments: e.target.value })} /><small className="form-help">O valor será dividido automaticamente entre os meses.</small></label>}
      <fieldset className="participants-field"><legend>Alguém precisa te pagar?</legend>{(data.participants || []).length ? <><p>Informe quanto essa pessoa deve. Em compras parceladas, você pode atribuir o valor a todas as parcelas ou apenas a uma.</p>{(data.participants || []).map(participant => { const share = form.shares.find(item => item.participantId === participant.id); return <div className="participant-share-row" key={participant.id}><label className="participant-check"><input type="checkbox" checked={Boolean(share)} onChange={e => { blurActiveInputOnTouch(); setShareError(''); setForm({ ...form, shares: e.target.checked ? [...form.shares, { participantId: participant.id, amount: '', installment: 'all' }] : form.shares.filter(item => item.participantId !== participant.id) }) }} /><span>{participant.name}</span></label>{share && <div className="participant-share-controls"><label className="participant-amount">Quanto? (R$)<input aria-label={`Valor que ${participant.name} deve pagar`} type="text" inputMode="decimal" enterKeyHint="done" onKeyDown={dismissKeyboardOnEnter} placeholder="0,00" value={share.amount} onChange={e => { setShareError(''); setForm({ ...form, shares: form.shares.map(item => item.participantId === participant.id ? { ...item, amount: e.target.value } : item) }) }} /></label>{form.method === 'Crédito parcelado' && <label className="participant-scope">Cobrança<select aria-label={`Parcelas de ${participant.name}`} value={share.installment} onFocus={blurActiveInputOnTouch} onChange={e => setForm({ ...form, shares: form.shares.map(item => item.participantId === participant.id ? { ...item, installment: e.target.value } : item) })}><option value="all">Todas</option>{Array.from({ length: Math.max(2, Number(form.installments) || 2) }, (_, i) => <option key={i + 1} value={i + 1}>Só {i + 1}ª parcela</option>)}</select></label>}</div>}</div> })}<button type="button" className="inline-participant-btn" onClick={addParticipantFromExpense}>＋ Adicionar outra pessoa</button></> : <div className="participants-empty">Ainda não há pessoas cadastradas. <button type="button" className="inline-participant-btn" onClick={addParticipantFromExpense}>＋ Adicionar pessoa</button></div>}{shareError && <div className="share-error" role="alert">{shareError}</div>}</fieldset>
      <div className="modal-actions"><button type="button" className="cancel-btn" onClick={closeExpenseModal}>Cancelar</button><button className="primary" type="submit">{editingExpenseId ? 'Salvar alterações' : 'Salvar lançamento'}</button></div>
    </form></div>}

    {recurrenceEditor && <div className={`modal-backdrop ${closingModal === 'recurrence' ? 'is-closing' : ''}`} onMouseDown={event => { if (event.target === event.currentTarget) closeRecurrenceModal() }}><form className="modal recurrence-modal" role="dialog" aria-modal="true" aria-labelledby="recurrence-modal-title" onSubmit={saveRecurrence}><div className="modal-header"><div><span className="eyebrow">DESPESA MENSAL</span><h2 id="recurrence-modal-title">{recurrenceEditor.id ? 'Editar recorrência' : 'Nova recorrência'}</h2></div><button type="button" aria-label="Fechar recorrência" onClick={closeRecurrenceModal}>×</button></div><label>Descrição<input required autoFocus={!isTouchDevice()} enterKeyHint="done" onKeyDown={dismissKeyboardOnEnter} maxLength={70} placeholder="Ex.: Internet, academia..." value={recurrenceEditor.description} onChange={event => setRecurrenceEditor({ ...recurrenceEditor, description: event.target.value })} /></label><div className="form-row"><label>Valor mensal<input required type="text" inputMode="decimal" enterKeyHint="done" onKeyDown={dismissKeyboardOnEnter} placeholder="0,00" value={recurrenceEditor.amount} onChange={event => setRecurrenceEditor({ ...recurrenceEditor, amount: event.target.value })} /></label><label>Dia da cobrança<input required type="number" min="1" max="31" enterKeyHint="done" onKeyDown={dismissKeyboardOnEnter} value={recurrenceEditor.day} onChange={event => setRecurrenceEditor({ ...recurrenceEditor, day: event.target.value })} /></label></div><div className="form-row"><label>Categoria<select required value={recurrenceEditor.category} onFocus={blurActiveInputOnTouch} onChange={event => setRecurrenceEditor({ ...recurrenceEditor, category: event.target.value })}>{data.categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label><label>Pagamento<select value={recurrenceEditor.method} onFocus={blurActiveInputOnTouch} onChange={event => setRecurrenceEditor({ ...recurrenceEditor, method: event.target.value as Method })}><option>PIX</option><option>Débito</option>{data.cards.length > 0 && <option>Crédito à vista</option>}</select></label></div>{recurrenceEditor.method.startsWith('Crédito') && <label>Cartão<select required value={recurrenceEditor.cardId} onFocus={blurActiveInputOnTouch} onChange={event => setRecurrenceEditor({ ...recurrenceEditor, cardId: event.target.value })}>{data.cards.map(card => <option key={card.id} value={card.id}>{card.name}</option>)}</select></label>}<p className="form-help">A recorrência só vira lançamento quando você confirma na revisão mensal. Você pode pular uma cobrança ou pausar o modelo.</p><div className="modal-actions"><button type="button" className="cancel-btn" onClick={closeRecurrenceModal}>Cancelar</button><button className="primary" type="submit">{recurrenceEditor.id ? 'Salvar alterações' : 'Criar modelo'}</button></div></form></div>}
    {settingsModal && <div className={`modal-backdrop ${closingModal === 'settings' ? 'is-closing' : ''}`} onMouseDown={e => { if (e.target === e.currentTarget) closeSettingsModal() }}><form className="modal settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-modal-title" onSubmit={saveSetting}><div className="modal-header"><div><span className="eyebrow">AJUSTES</span><h2 id="settings-modal-title">{settingsModal.id ? 'Editar' : 'Novo'} {settingsModal.kind === 'category' ? 'categoria' : settingsModal.kind === 'card' ? 'cartão' : 'participante'}</h2></div><button type="button" aria-label="Fechar ajustes" onClick={closeSettingsModal}>×</button></div><label>Nome<input required autoFocus={!isTouchDevice()} enterKeyHint="done" onKeyDown={dismissKeyboardOnEnter} maxLength={40} placeholder={settingsModal.kind === 'category' ? 'Ex.: Educação' : settingsModal.kind === 'card' ? 'Ex.: Cartão principal' : 'Ex.: Maria'} value={settingsModal.name} onChange={e => setSettingsModal({ ...settingsModal, name: e.target.value })} /></label>{settingsModal.kind === 'category' ? <label>Cor da categoria<div className="color-picker-row"><input aria-label="Cor da categoria" type="color" value={settingsModal.color} onChange={e => { const color = e.currentTarget.value; setSettingsModal(current => current ? { ...current, color } : current) }} onKeyDown={e => { if (e.key === 'Escape') e.currentTarget.blur() }} /><span>Escolha uma cor para identificar esta categoria.</span><button type="button" className="color-picker-confirm" onClick={e => e.currentTarget.parentElement?.querySelector<HTMLInputElement>('input[type="color"]')?.blur()}>OK</button></div></label> : settingsModal.kind === 'card' ? <div className="form-row"><label>Dia de fechamento<input required type="number" min="1" max="31" enterKeyHint="done" onKeyDown={dismissKeyboardOnEnter} value={settingsModal.closingDay} onChange={e => setSettingsModal({ ...settingsModal, closingDay: e.target.value })} /><small className="form-help">Compras a partir deste dia vão para o próximo ciclo.</small></label><label>Dia de vencimento<input required type="number" min="1" max="31" enterKeyHint="done" onKeyDown={dismissKeyboardOnEnter} value={settingsModal.dueDay} onChange={e => setSettingsModal({ ...settingsModal, dueDay: e.target.value })} /></label></div> : <p className="form-help participant-modal-help">Os valores atribuídos a esta pessoa ficarão associados aos lançamentos correspondentes e serão salvos apenas neste dispositivo.</p>}<div className="modal-actions"><button type="button" className="cancel-btn" onClick={closeSettingsModal}>Cancelar</button><button className="primary" type="submit">{settingsModal.id ? 'Salvar alterações' : 'Adicionar'}</button></div></form></div>}
    {pendingBackupImport && <div className={`modal-backdrop ${closingModal === 'backup' ? 'is-closing' : ''}`} onMouseDown={event => { if (event.target === event.currentTarget) closeBackupConfirmModal() }}><section className="modal backup-confirm-modal" role="dialog" aria-modal="true" aria-labelledby="backup-confirm-title"><div className="modal-header"><div><span className="eyebrow">SEUS DADOS</span><h2 id="backup-confirm-title">Importar backup?</h2></div><button type="button" aria-label="Fechar" onClick={closeBackupConfirmModal}>×</button></div><p>Esta ação vai substituir os dados salvos neste navegador.</p>{pendingBackupImport.preferences && <p>O arquivo também contém suas preferências, como tema, tela inicial, limite mensal e perfil.</p>}<div className="modal-actions"><button type="button" className="cancel-btn" onClick={closeBackupConfirmModal}>Cancelar</button><button type="button" className="primary" onClick={confirmBackupImport}>Importar e substituir</button></div></section></div>}
    {resetDataModalOpen && <div className={`modal-backdrop ${closingModal === 'reset' ? 'is-closing' : ''}`} onMouseDown={event => { if (event.target === event.currentTarget) closeResetDataModal() }}>
      <form className="modal reset-data-modal" role="dialog" aria-modal="true" aria-labelledby="reset-data-title" onSubmit={confirmResetAllData}>
        <div className="modal-header">
          <div><span className="eyebrow">ZONA DE SEGURANÇA</span><h2 id="reset-data-title">Excluir todos os dados?</h2></div>
          <button type="button" aria-label="Fechar confirmação de exclusão" onClick={closeResetDataModal}>×</button>
        </div>
        <div className="reset-warning-box" role="note">
          <b>Esta ação não pode ser desfeita.</b>
          <p>Todos os lançamentos, recorrências, categorias, cartões, participantes e o seu perfil salvos neste navegador serão apagados permanentemente, e o Põe na Conta voltará para a tela inicial de cadastro.</p>
        </div>
        <button type="button" className="outline-btn reset-backup-shortcut" onClick={downloadBackup}>↓ Baixar backup JSON antes de excluir</button>
        <label className={resetConfirmError ? 'easter-egg-field is-invalid' : 'easter-egg-field'}>
          Para confirmar, digite <b>EXCLUIR</b> abaixo
          <input
            autoFocus
            type="text"
            placeholder="Digite EXCLUIR"
            aria-invalid={resetConfirmError}
            value={resetConfirmText}
            onChange={event => {
              setResetConfirmText(event.target.value)
              if (resetConfirmError) setResetConfirmError(false)
            }}
          />
          {resetConfirmError && <small className="reset-confirm-error" role="alert">Digite exatamente a palavra EXCLUIR para liberar a limpeza dos dados.</small>}
        </label>
        <div className="modal-actions">
          <button type="button" className="cancel-btn" onClick={closeResetDataModal}>Cancelar</button>
          <button type="submit" className="danger-btn" disabled={resetConfirmText.trim().toLocaleUpperCase('pt-BR') !== 'EXCLUIR'}>Excluir tudo e recomeçar</button>
        </div>
      </form>
    </div>}
    {onboardingOpen && <div className={`modal-backdrop onboarding-backdrop ${closingModal === 'onboarding' ? 'is-closing' : ''}`}>
      <form className="modal onboarding-modal" role="dialog" aria-modal="true" aria-labelledby="onboarding-title" onSubmit={completeOnboarding}>
        <div className="onboarding-brand">
          <span className="brand-mark"><svg viewBox="0 0 48 48" shapeRendering="crispEdges" aria-hidden="true"><rect x="1" y="1" width="46" height="46" rx="13" fill="#20231f"/><path d="M18 6h12v3h6v6h3v6h3v12h-3v6h-6v3H18v-3h-6v-6H9v-6H6V18h3v-6h6V9h3z" fill="#986027"/><path d="M18 9h12v3h6v6h3v12h-3v6h-6v3H18v-3h-6v-6H9V18h3v-6h6z" fill="#e8b957"/><path d="M18 12h12v3h6v3h-3v3h-3v-3H18v-3h-3v-3h3z" fill="#f6d77e"/><rect x="22" y="14" width="4" height="20" fill="#80501f"/><rect x="18" y="17" width="12" height="3" fill="#80501f"/><rect x="15" y="20" width="3" height="3" fill="#80501f"/><rect x="18" y="23" width="12" height="3" fill="#80501f"/><rect x="27" y="26" width="3" height="3" fill="#80501f"/><rect x="18" y="29" width="12" height="3" fill="#80501f"/><rect x="12" y="18" width="3" height="6" fill="#f6d77e"/></svg></span>
          <div><span className="eyebrow">BOAS-VINDAS AO PÕE NA CONTA</span><h2 id="onboarding-title">Configure seu perfil</h2><p>Personalize como seu espaço aparece neste navegador. Tudo pode ser alterado depois em Ajustes.</p></div>
        </div>
        <div className="onboarding-profile-box">
          <div className={`avatar onboarding-avatar profile-avatar ${profilePhoto ? 'has-photo' : ''}`}>
            {profilePhoto ? <img src={profilePhoto} alt="" /> : profileName.trim() ? profileInitials(profileName) : <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>}
          </div>
          <div className="onboarding-profile-fields">
            <label>Como quer ser chamado(a)?<input autoFocus={!isTouchDevice()} type="text" enterKeyHint="done" onKeyDown={dismissKeyboardOnEnter} maxLength={60} placeholder="Ex.: Gabriel" value={profileName} onChange={event => updateProfileName(event.target.value)} /></label>
            <div className="profile-photo-actions">
              <button type="button" className="outline-btn" onClick={() => { blurActiveInputOnTouch(); profilePhotoInput.current?.click() }}>{profilePhoto ? 'Trocar foto' : 'Adicionar foto'}</button>
              {profilePhoto && <button type="button" className="text-btn" onClick={removeProfilePhoto}>Remover foto</button>}
            </div>
            {profileMessage && <small className="profile-message" role="status">{profileMessage}</small>}
          </div>
        </div>
        <div className="onboarding-section">
          <span className="onboarding-label">Aparência</span>
          <div className="onboarding-options two-cols" role="radiogroup" aria-label="Tema da interface">
            <button type="button" role="radio" aria-checked={theme === 'light'} className={`onboarding-option ${theme === 'light' ? 'is-selected' : ''}`} onClick={() => { blurActiveInputOnTouch(); updateDefaultTheme('light') }}>
              <span className="onboarding-option-icon">☀</span>
              <div><b>Tema claro</b><small>Fundo suave e leitura diurna</small></div>
            </button>
            <button type="button" role="radio" aria-checked={theme === 'dark'} className={`onboarding-option ${theme === 'dark' ? 'is-selected' : ''}`} onClick={() => { blurActiveInputOnTouch(); updateDefaultTheme('dark') }}>
              <span className="onboarding-option-icon">☾</span>
              <div><b>Tema escuro</b><small>Contraste confortável à noite</small></div>
            </button>
          </div>
        </div>
        <div className="onboarding-section">
          <span className="onboarding-label">Como deseja começar?</span>
          <div className="onboarding-options" role="radiogroup" aria-label="Dados iniciais">
            {hasExistingData && <button type="button" role="radio" aria-checked={onboardingStartMode === 'keep'} className={`onboarding-option ${onboardingStartMode === 'keep' ? 'is-selected' : ''}`} onClick={() => { blurActiveInputOnTouch(); setOnboardingStartMode('keep') }}>
              <span className="onboarding-option-icon">✓</span>
              <div><b>Manter meus lançamentos atuais</b><small>Preserva os registros que já estão salvos neste navegador.</small></div>
            </button>}
            <button type="button" role="radio" aria-checked={onboardingStartMode === 'empty'} className={`onboarding-option ${onboardingStartMode === 'empty' ? 'is-selected' : ''}`} onClick={() => { blurActiveInputOnTouch(); setOnboardingStartMode('empty') }}>
              <span className="onboarding-option-icon">✨</span>
              <div><b>Começar do zero</b><small>Conta limpa, pronta para registrar seus próprios gastos.</small></div>
            </button>
            <button type="button" role="radio" aria-checked={onboardingStartMode === 'demo'} className={`onboarding-option ${onboardingStartMode === 'demo' ? 'is-selected' : ''}`} onClick={() => { blurActiveInputOnTouch(); setOnboardingStartMode('demo') }}>
              <span className="onboarding-option-icon">◫</span>
              <div><b>Explorar com dados de exemplo</b><small>Inclui despesas fictícias para visualizar gráficos e relatórios.</small></div>
            </button>
          </div>
        </div>
        <div className="onboarding-footer">
          <button type="button" className="outline-btn" onClick={() => backupInput.current?.click()}>↑ Já tenho um backup JSON</button>
          <button type="submit" className="primary">Entrar no Põe na Conta →</button>
        </div>
        <p className="onboarding-privacy-note">🔒 Seus dados ficam salvos apenas neste navegador.</p>
      </form>
    </div>}
    {easterEggOpen && <div className={`modal-backdrop easter-egg-backdrop ${closingModal === 'easter-egg' ? 'is-closing' : ''}`} onMouseDown={event => { if (event.target === event.currentTarget) closeEasterEgg() }}>{easterEggMessage ? <section className="modal easter-egg-modal is-revealed" role="dialog" aria-modal="true" aria-labelledby="easter-egg-title"><div className="modal-header"><div><span className="eyebrow">SEGREDO DESBLOQUEADO</span><h2 id="easter-egg-title">Mensagem secreta</h2></div><button type="button" aria-label="Fechar" onClick={closeEasterEgg}>×</button></div><div className="easter-egg-reveal" role="status"><p>{easterEggMessage}</p></div><div className="modal-actions"><button type="button" className="cancel-btn" onClick={() => { setEasterEggMessage(''); setEasterEggPassword(''); setEasterEggError(false); setEasterEggShake(false); window.requestAnimationFrame(() => easterEggInputRef.current?.focus()) }}>Outra senha</button><button type="button" className="primary" onClick={closeEasterEgg}>Fechar</button></div></section> : <form className={`modal easter-egg-modal ${easterEggShake ? 'is-shaking' : ''}`} role="dialog" aria-modal="true" aria-labelledby="easter-egg-title" onSubmit={submitEasterEgg} onAnimationEnd={event => { if (event.animationName === 'nexus-modal-shake') setEasterEggShake(false) }}><div className="modal-header"><div><span className="eyebrow">SEGREDO DESBLOQUEADO</span><h2 id="easter-egg-title">Digite a senha</h2></div><button type="button" aria-label="Fechar" onClick={closeEasterEgg}>×</button></div><label className={easterEggError ? 'easter-egg-field is-invalid' : 'easter-egg-field'}>Senha<input ref={easterEggInputRef} type="password" aria-invalid={easterEggError} value={easterEggPassword} onChange={event => { setEasterEggPassword(event.target.value); if (easterEggError) setEasterEggError(false) }} placeholder="Digite a senha" /></label><div className="modal-actions"><button type="button" className="cancel-btn" onClick={closeEasterEgg}>Fechar</button><button className="primary" type="submit">Confirmar</button></div></form>}</div>}
  </div>
}

export default App
