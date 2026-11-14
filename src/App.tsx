import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import { buildOccurrences as calculateOccurrences, cardDueMonth as calculateCardDueMonth, createBackup, csvCell, dateKey, expenseFirstMonth, formatMoneyInput, isDate, monthKey, normalizeDateInput, parseBackupFile, parseMoneyInput, readStoredData, seed, shiftMonth as shiftMonthKey, type BackupPayload, type Card, type Category, type ClosingDayRule, type Data, type Expense, type Method, type Participant, type Recurrence } from './finance'

type ExpenseForm = { description: string; amount: string; date: string; category: string; method: Method; cardId: string; installments: string; afterClosing: boolean; shares: { participantId: string; amount: string; installment: string }[] }
type SettingEditor = { kind: 'category' | 'card' | 'participant'; id?: string; name: string; color: string; closingDay: string; dueDay: string; closingDayRule: ClosingDayRule }
type RecurrenceEditor = { id?: string; description: string; amount: string; category: string; method: Method; cardId: string; day: string }
type MainView = 'Visão geral' | 'Lançamentos' | 'Relatórios' | 'Recorrências' | 'Ajustes'
type ModalKind = 'expense' | 'recurrence' | 'settings' | 'backup' | 'easter-egg' | 'onboarding' | 'reset' | 'confirm' | 'pwa-guide'
type OnboardingStartMode = 'empty' | 'demo' | 'keep'
type ConfirmDialog = { eyebrow: string; title: string; description: string; confirmLabel: string; onConfirm: () => void }
type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }

const MODAL_CLOSE_DURATION_MS = 220
const TOAST_AUTO_DISMISS_MS = 3800
const CATEGORY_COLOR_PRESETS = [
  { color: '#6e7f72', label: 'Verde sálvia' },
  { color: '#b88b63', label: 'Terracota suave' },
  { color: '#74858b', label: 'Azul ardósia' },
  { color: '#9b8193', label: 'Malva' },
  { color: '#8b966d', label: 'Oliva' },
  { color: '#c46b5c', label: 'Coral' },
  { color: '#5b8a72', label: 'Esmeralda' },
  { color: '#6a7ba2', label: 'Índigo' },
  { color: '#c89b54', label: 'Âmbar' },
  { color: '#866f9b', label: 'Lavanda' },
  { color: '#5d8b96', label: 'Petróleo' },
  { color: '#a36877', label: 'Rosé' },
]

// Dicionário de senhas secretas do Konami Code (chave em minúsculas -> escrita exibida no modal)
const EASTER_EGG_SECRETS: Record<string, string> = {
  bbkart: 'Bloodborne Kart não existe e não pode te machucar',
  'ocara': 'O Caio é o cara',
  '13': 'Lulatron Ativar',
  '67': 'Aura farmada com Sucesso',
  bleach: 'Getsuga Tensho',
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
  useEffect(() => {
    if (hasExistingData && !storedData.warning) {
      try { localStorage.setItem('conta-clara-v1', JSON.stringify(storedData.data)) } catch { /* ignore */ }
    }
  }, [hasExistingData, storedData])
  const [onboardingOpen, setOnboardingOpen] = useState(() => localStorage.getItem('poe-na-conta-onboarded') !== '1')
  const [onboardingStartMode, setOnboardingStartMode] = useState<OnboardingStartMode>(() => hasExistingData ? 'keep' : 'empty')
  const [backupMessage, setBackupMessage] = useState('')
  const [toastClosing, setToastClosing] = useState(false)
  const [toastKey, setToastKey] = useState(0)
  const [pendingBackupImport, setPendingBackupImport] = useState<BackupPayload | null>(null)
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialog | null>(null)
  const [resetDataModalOpen, setResetDataModalOpen] = useState(false)
  const [resetConfirmText, setResetConfirmText] = useState('')
  const [resetConfirmError, setResetConfirmError] = useState(false)
  const backupInput = useRef<HTMLInputElement>(null)
  const trendChartRef = useRef<HTMLDivElement>(null)
  const showToast = (message: string) => {
    if (!message) {
      setBackupMessage('')
      setToastClosing(false)
      return
    }
    setToastClosing(false)
    setBackupMessage(message)
    setToastKey(current => current + 1)
  }
  const dismissToast = () => {
    if (!backupMessage || toastClosing) return
    setToastClosing(true)
    window.setTimeout(() => {
      setBackupMessage('')
      setToastClosing(false)
    }, MODAL_CLOSE_DURATION_MS)
  }
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
  const [methodFilter, setMethodFilter] = useState('Todos os pagamentos')
  const [cardFilter, setCardFilter] = useState('Todos os cartões')
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isStandalone, setIsStandalone] = useState(() => typeof window !== 'undefined' && (window.matchMedia?.('(display-mode: standalone)').matches || (window.navigator as Navigator & { standalone?: boolean }).standalone === true))
  const [pwaBannerDismissed, setPwaBannerDismissed] = useState(() => localStorage.getItem('poe-na-conta-pwa-dismissed') === '1')
  const [pwaGuideOpen, setPwaGuideOpen] = useState(false)
  const [lastBackupAt, setLastBackupAt] = useState(() => localStorage.getItem('poe-na-conta-last-backup-at') || '')
  const [changesSinceBackup, setChangesSinceBackup] = useState(() => Number(localStorage.getItem('poe-na-conta-changes-since-backup') || '0'))
  const [backupSnoozeUntil, setBackupSnoozeUntil] = useState(() => Number(localStorage.getItem('poe-na-conta-backup-snooze-until') || '0'))
  const [nowTimestamp] = useState(() => Date.now())
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
  const [form, setForm] = useState<ExpenseForm>(() => ({ description: '', amount: '', date: dateKey(today), category: storedData.data.categories[0]?.id || '', method: 'PIX', cardId: storedData.data.cards[0]?.id || '', installments: '2', afterClosing: (storedData.data.cards[0]?.closingDayRule ?? 'after') !== 'before', shares: [] }))
  const [shareError, setShareError] = useState('')
  const [expenseErrors, setExpenseErrors] = useState<Record<string, string>>({})
  const [recurrenceErrors, setRecurrenceErrors] = useState<Record<string, string>>({})
  const [settingsErrors, setSettingsErrors] = useState<Record<string, string>>({})
  const [formShake, setFormShake] = useState<ModalKind | null>(null)
  const [returnToExpenseAfterParticipant, setReturnToExpenseAfterParticipant] = useState(false)
  const triggerFormShake = (kind: ModalKind) => {
    setFormShake(null)
    window.requestAnimationFrame(() => setFormShake(kind))
  }
  const clearFieldError = (setter: React.Dispatch<React.SetStateAction<Record<string, string>>>, key: string) => {
    setter(current => {
      if (!current[key]) return current
      const next = { ...current }
      delete next[key]
      return next
    })
  }
  const normalizedFormDate = normalizeDateInput(form.date)
  const selectedFormCard = data.cards.find(card => card.id === form.cardId) || data.cards[0]
  const isFormOnClosingDay = Boolean(form.method.startsWith('Crédito') && selectedFormCard && isDate(normalizedFormDate) && Number(normalizedFormDate.slice(-2)) === selectedFormCard.closingDay)
  const creditDueMonth = form.method.startsWith('Crédito') && selectedFormCard && isDate(normalizedFormDate) ? calculateCardDueMonth(normalizedFormDate, selectedFormCard, form.afterClosing) : ''
  const openNewExpenseModal = () => {
    const defaultCard = data.cards[0]
    setEditingExpenseId(null)
    setShareError('')
    setExpenseErrors({})
    setForm({
      description: '',
      amount: '',
      date: dateKey(today),
      category: data.categories[0]?.id || '',
      method: 'PIX',
      cardId: defaultCard?.id || '',
      installments: '2',
      afterClosing: (defaultCard?.closingDayRule ?? 'after') !== 'before',
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
    if (!backupMessage) return
    const fadeTimer = window.setTimeout(() => setToastClosing(true), TOAST_AUTO_DISMISS_MS - MODAL_CLOSE_DURATION_MS)
    const clearTimer = window.setTimeout(() => {
      setBackupMessage('')
      setToastClosing(false)
    }, TOAST_AUTO_DISMISS_MS)
    return () => {
      window.clearTimeout(fadeTimer)
      window.clearTimeout(clearTimer)
    }
  }, [backupMessage, toastKey])
  useEffect(() => {
    if (!profileMessage) return
    const timer = window.setTimeout(() => setProfileMessage(''), TOAST_AUTO_DISMISS_MS)
    return () => window.clearTimeout(timer)
  }, [profileMessage])
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
  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      setDeferredInstallPrompt(event as BeforeInstallPromptEvent)
    }
    const onAppInstalled = () => {
      setIsStandalone(true)
      setDeferredInstallPrompt(null)
      setPwaGuideOpen(false)
      showToast('Põe na Conta instalado na sua tela inicial!')
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    window.addEventListener('appinstalled', onAppInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
      window.removeEventListener('appinstalled', onAppInstalled)
    }
  }, [])
  const closePwaGuideModal = () => closeModalWithAnimation('pwa-guide', () => setPwaGuideOpen(false))
  const handleInstallPwa = async () => {
    if (deferredInstallPrompt) {
      await deferredInstallPrompt.prompt()
      const choice = await deferredInstallPrompt.userChoice
      if (choice.outcome === 'accepted') {
        setDeferredInstallPrompt(null)
        setIsStandalone(true)
      }
      return
    }
    setPwaGuideOpen(true)
  }
  const dismissPwaBanner = () => {
    setPwaBannerDismissed(true)
    localStorage.setItem('poe-na-conta-pwa-dismissed', '1')
  }
  const recordBackupCompleted = () => {
    const iso = new Date().toISOString()
    setLastBackupAt(iso)
    setChangesSinceBackup(0)
    setBackupSnoozeUntil(0)
    localStorage.setItem('poe-na-conta-last-backup-at', iso)
    localStorage.setItem('poe-na-conta-changes-since-backup', '0')
    localStorage.removeItem('poe-na-conta-backup-snooze-until')
  }
  const snoozeBackupReminder = () => {
    const until = Date.now() + 7 * 24 * 60 * 60 * 1000
    setBackupSnoozeUntil(until)
    setChangesSinceBackup(0)
    localStorage.setItem('poe-na-conta-backup-snooze-until', String(until))
    localStorage.setItem('poe-na-conta-changes-since-backup', '0')
  }
  const closeSettingsModal = () => closeModalWithAnimation('settings', () => {
    setSettingsModal(null)
    setSettingsErrors({})
    if (returnToExpenseAfterParticipant) { setReturnToExpenseAfterParticipant(false); setModal(true) }
  })
  const save = (next: Data, recoveringStorage = false, trackChange = true): boolean => {
    if (storageWarning && !recoveringStorage) {
      showToast('Importe um backup válido ou desbloqueie o armazenamento no aviso acima antes de salvar.')
      return false
    }
    try {
      localStorage.setItem('conta-clara-v1', JSON.stringify(next))
      setData(next)
      setStorageWarning('')
      if (trackChange) {
        setChangesSinceBackup(prev => {
          const updated = prev + 1
          localStorage.setItem('poe-na-conta-changes-since-backup', String(updated))
          return updated
        })
      }
      return true
    } catch {
      showToast('Não foi possível salvar no navegador. Verifique o espaço disponível ou as permissões de armazenamento.')
      return false
    }
  }
  const occurrences = useMemo(() => calculateOccurrences(data.expenses.filter(e => (e as Expense & { kind?: string }).kind !== 'income')), [data.expenses])
  const current = occurrences.filter(e => e.month === month)
  const currentExpenses = current
  const personalValue = (e: typeof occurrences[number]) => Math.max(0, e.value - e.allocatedShares.reduce((sum, share) => sum + share.amount, 0))
  const owedBy = (e: typeof occurrences[number]) => { const shares = e.allocatedShares.filter(share => share.amount > 0); const names = shares.map(share => data.participants?.find(participant => participant.id === share.participantId)?.name).filter((name): name is string => Boolean(name)); const amount = shares.reduce((sum, share) => sum + share.amount, 0); return amount ? `${names.length ? names.join(', ') : 'Participante'} ${names.length === 1 ? 'deve' : 'devem'} ${money(amount)}` : '' }
  const filtered = current.filter(e => {
    if (!e.description.toLowerCase().includes(query.toLowerCase())) return false
    if (categoryFilter !== 'Todas as categorias' && e.category !== categoryFilter) return false
    if (methodFilter === 'Crédito (todos)') {
      if (!e.method.startsWith('Crédito')) return false
    } else if (methodFilter !== 'Todos os pagamentos' && e.method !== methodFilter) {
      return false
    }
    if (cardFilter !== 'Todos os cartões') {
      const resolvedCardId = e.method.startsWith('Crédito') ? (e.cardId || data.cards[0]?.id || '') : ''
      if (resolvedCardId !== cardFilter) return false
    }
    return true
  })
  const hasActiveFilters = Boolean(query.trim()) || categoryFilter !== 'Todas as categorias' || methodFilter !== 'Todos os pagamentos' || cardFilter !== 'Todos os cartões'
  const clearAllFilters = () => {
    setQuery('')
    setCategoryFilter('Todas as categorias')
    setMethodFilter('Todos os pagamentos')
    setCardFilter('Todos os cartões')
  }
  const filteredPersonalTotal = filtered.reduce((sum, e) => sum + personalValue(e), 0)
  const filteredReimbursementTotal = filtered.reduce((sum, e) => sum + e.allocatedShares.reduce((s, sh) => s + sh.amount, 0), 0)
  const filteredInvoiceTotal = filtered.reduce((sum, e) => sum + e.value, 0)
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
  const nextMonthKey = shiftMonthKey(month, 1)
  const cardSummaries = data.cards.map(card => {
    const cardOccurrences = currentExpenses.filter(e => e.method.startsWith('Crédito') && (e.cardId || data.cards[0]?.id) === card.id)
    const nextCardOccurrences = occurrences.filter(e => e.month === nextMonthKey && e.method.startsWith('Crédito') && (e.cardId || data.cards[0]?.id) === card.id)
    const invoiceTotal = cardOccurrences.reduce((sum, e) => sum + e.value, 0)
    const personalPart = cardOccurrences.reduce((sum, e) => sum + personalValue(e), 0)
    const sharedPart = cardOccurrences.reduce((sum, e) => sum + e.allocatedShares.reduce((s, sh) => s + sh.amount, 0), 0)
    const nextInvoiceTotal = nextCardOccurrences.reduce((sum, e) => sum + e.value, 0)
    return { card, invoiceTotal, personalPart, sharedPart, count: cardOccurrences.length, nextInvoiceTotal }
  })
  const openCardTransactions = (cardId: string) => {
    setQuery('')
    setCategoryFilter('Todas as categorias')
    setMethodFilter('Crédito (todos)')
    setCardFilter(cardId)
    setView('Lançamentos')
  }
  const daysSinceBackup = lastBackupAt ? Math.max(0, Math.floor((nowTimestamp - new Date(lastBackupAt).getTime()) / 86400000)) : null
  const backupReminderMessage = !storageWarning && !onboardingOpen && data.expenses.length > 0 && nowTimestamp >= backupSnoozeUntil
    ? !lastBackupAt && changesSinceBackup >= 3
      ? 'Você já registrou novos lançamentos e ainda não baixou um backup de segurança neste dispositivo.'
      : daysSinceBackup !== null && daysSinceBackup >= 15
        ? `Faz ${daysSinceBackup} dias desde o seu último backup. Baixe uma cópia atualizada para proteger seus dados.`
        : changesSinceBackup >= 5
          ? `Você fez ${changesSinceBackup} alterações desde o último backup. Que tal baixar uma cópia atualizada?`
          : ''
    : ''
  const previousMonth = shiftMonthKey(month, -1)
  const previousMonthOccurrences = occurrences.filter(e => e.month === previousMonth)
  const previousTotal = previousMonthOccurrences.reduce((s, e) => s + personalValue(e), 0)
  const monthChange = previousTotal ? ((total - previousTotal) / previousTotal) * 100 : null
  const upcomingTotal = occurrences.filter(e => e.month > month).reduce((s, e) => s + personalValue(e), 0)
  const reportCategoryRanking = data.categories.map(category => {
    const items = currentExpenses.filter(e => e.category === category.id)
    const catTotal = items.reduce((s, e) => s + personalValue(e), 0)
    const prevCatTotal = previousMonthOccurrences.filter(e => e.category === category.id).reduce((s, e) => s + personalValue(e), 0)
    const percentage = total > 0 ? Math.round((catTotal / total) * 100) : 0
    const diffPercent = prevCatTotal > 0 ? Math.round(((catTotal - prevCatTotal) / prevCatTotal) * 100) : null
    return { ...category, count: items.length, total: catTotal, prevTotal: prevCatTotal, percentage, diffPercent }
  }).filter(c => c.total > 0 || c.prevTotal > 0).sort((a, b) => b.total - a.total || b.prevTotal - a.prevTotal)
  const reportMethods = (['PIX', 'Débito', 'Dinheiro', 'Crédito à vista', 'Crédito parcelado'] as const).map(methodName => {
    const items = currentExpenses.filter(e => e.method === methodName)
    const methodPersonal = items.reduce((s, e) => s + personalValue(e), 0)
    const methodGross = items.reduce((s, e) => s + e.value, 0)
    const percentage = total > 0 ? Math.round((methodPersonal / total) * 100) : 0
    return { method: methodName, count: items.length, personalTotal: methodPersonal, grossTotal: methodGross, percentage, isCredit: methodName.startsWith('Crédito') }
  })
  const directPersonalTotal = reportMethods.filter(m => !m.isCredit).reduce((s, m) => s + m.personalTotal, 0)
  const creditPersonalTotal = reportMethods.filter(m => m.isCredit).reduce((s, m) => s + m.personalTotal, 0)
  const directSharePercent = total > 0 ? Math.round((directPersonalTotal / total) * 100) : 0
  const creditSharePercent = total > 0 ? Math.max(0, 100 - directSharePercent) : 0
  const installmentOccurrences = currentExpenses.filter(e => e.installments > 1)
  const installmentPersonalTotal = installmentOccurrences.reduce((s, e) => s + personalValue(e), 0)
  const installmentSharePercent = total > 0 ? Math.round((installmentPersonalTotal / total) * 100) : 0
  const biggestPersonalExpense = [...currentExpenses].sort((a, b) => personalValue(b) - personalValue(a))[0]
  const averagePersonalTicket = currentExpenses.length > 0 ? total / currentExpenses.length : 0
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
  const openRecurrence = (item?: Recurrence) => {
    setRecurrenceErrors({})
    setRecurrenceEditor({ id: item?.id, description: item?.description || '', amount: item ? formatMoneyInput(item.amount) : '', category: item?.category || data.categories[0]?.id || '', method: item?.method || 'PIX', cardId: item?.cardId || data.cards[0]?.id || '', day: String(item?.day || 1) })
  }
  const closeRecurrenceModal = () => closeModalWithAnimation('recurrence', () => { setRecurrenceEditor(null); setRecurrenceErrors({}) })
  const saveRecurrence = (event: React.FormEvent) => {
    event.preventDefault()
    if (!recurrenceEditor) return
    const nextErrors: Record<string, string> = {}
    if (!recurrenceEditor.description.trim()) nextErrors.description = 'Informe uma descrição para a recorrência.'
    const amount = parseMoneyInput(recurrenceEditor.amount)
    if (!recurrenceEditor.amount.trim()) nextErrors.amount = 'Informe o valor mensal.'
    else if (!Number.isFinite(amount) || amount <= 0) nextErrors.amount = 'Informe um valor maior que zero.'
    const day = Number(recurrenceEditor.day)
    if (!recurrenceEditor.day.trim() || !Number.isInteger(day) || day < 1 || day > 31) nextErrors.day = 'Informe um dia entre 1 e 31.'
    if (Object.keys(nextErrors).length > 0) {
      setRecurrenceErrors(nextErrors)
      triggerFormShake('recurrence')
      return
    }
    setRecurrenceErrors({})
    const previous = recurrenceEditor.id ? recurrences.find(value => value.id === recurrenceEditor.id) : undefined
    const item: Recurrence = { id: recurrenceEditor.id || createId(), description: recurrenceEditor.description.trim(), amount, category: recurrenceEditor.category || data.categories[0]?.id || '', method: recurrenceEditor.method, cardId: recurrenceEditor.method.startsWith('Crédito') ? (recurrenceEditor.cardId || data.cards[0]?.id || undefined) : undefined, day, active: previous?.active ?? true, generatedMonths: previous?.generatedMonths || [], skippedMonths: previous?.skippedMonths || [] }
    if (save({ ...data, recurrences: recurrenceEditor.id ? recurrences.map(value => value.id === item.id ? item : value) : [...recurrences, item] })) {
      showToast(recurrenceEditor.id ? 'Recorrência atualizada.' : 'Recorrência criada.')
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
    if (save({ ...data, expenses: [...generated, ...data.expenses], recurrences: recurrences.map(item => ids.has(item.id) ? { ...item, generatedMonths: [...item.generatedMonths, month] } : item) })) {
      showToast(chosen.length === 1 ? '1 recorrência lançada no mês.' : `${chosen.length} recorrências lançadas no mês.`)
    }
    setRecurrenceSelection(null)
  }
  const skipRecurrence = (id: string) => { setRecurrenceSelection(selectedRecurrences.filter(value => value !== id)); save({ ...data, recurrences: recurrences.map(item => item.id === id ? { ...item, skippedMonths: [...item.skippedMonths, month] } : item) }) }

  const addExpense = (ev: React.FormEvent) => {
    ev.preventDefault()
    const nextErrors: Record<string, string> = {}
    const description = form.description.trim()
    if (!description) nextErrors.description = 'Informe uma descrição para o lançamento.'
    const amount = parseMoneyInput(form.amount)
    if (!form.amount.trim()) nextErrors.amount = 'Informe o valor da despesa.'
    else if (!Number.isFinite(amount) || amount <= 0) nextErrors.amount = 'Informe um valor maior que zero (ex.: 150,50).'
    const normalizedDate = normalizeDateInput(form.date)
    if (!form.date.trim() || !isDate(normalizedDate)) nextErrors.date = 'Informe uma data válida.'
    const rawInstallments = Number(form.installments)
    const n = Math.round(rawInstallments || 1)
    if (form.method === 'Crédito parcelado' && (!form.installments.trim() || !Number.isInteger(rawInstallments) || n < 2 || n > 60)) {
      nextErrors.installments = 'Informe entre 2 e 60 parcelas.'
    }
    for (const share of form.shares) {
      if (!share.amount.trim()) {
        nextErrors[`share-${share.participantId}`] = 'Informe o valor desta pessoa ou desmarque-a.'
      } else {
        const parsedShare = parseMoneyInput(share.amount)
        if (!Number.isFinite(parsedShare) || parsedShare <= 0) {
          nextErrors[`share-${share.participantId}`] = 'Informe um valor válido maior que zero.'
        }
      }
    }
    if (Object.keys(nextErrors).length > 0) {
      setExpenseErrors(nextErrors)
      setShareError('')
      triggerFormShake('expense')
      return
    }
    const shares = form.shares.map(share => ({ participantId: share.participantId, amount: parseMoneyInput(share.amount) || 0, installment: form.method === 'Crédito parcelado' && share.installment !== 'all' ? Number(share.installment) : undefined })).filter(share => share.amount > 0)
    const count = form.method === 'Crédito parcelado' ? Math.max(1, n) : 1
    const totalCents = Math.round(amount * 100)
    const partValues = Array.from({ length: count }, (_, i) => Math.floor(totalCents / count) + (i < totalCents % count ? 1 : 0))
    const allocated = Array.from({ length: count }, () => 0)
    for (const share of shares) {
      const cents = Math.round(share.amount * 100)
      if (share.installment && share.installment > count) { setShareError('Uma atribuição aponta para uma parcela que não existe. Ajuste o número de parcelas ou a seleção.'); triggerFormShake('expense'); return }
      if (share.installment) allocated[share.installment - 1] += cents
      else for (let i = 0; i < count; i++) allocated[i] += Math.floor(cents / count) + (i < cents % count ? 1 : 0)
    }
    if (allocated.some((cents, i) => cents > partValues[i])) { setShareError('A soma atribuída aos participantes não pode superar o valor da parcela correspondente.'); triggerFormShake('expense'); return }
    setExpenseErrors({})
    setShareError('')
    const card = form.method.startsWith('Crédito') ? (data.cards.find(c => c.id === form.cardId) || data.cards[0]) : undefined
    const onClosingDay = Boolean(card && Number(normalizedDate.slice(-2)) === card.closingDay)
    const firstMonth = expenseFirstMonth(normalizedDate, form.method, card, onClosingDay ? form.afterClosing : undefined)
    const entry: Expense = { id: editingExpenseId || createId(), description, amount, date: normalizedDate, category: form.category || data.categories[0]?.id || '', method: form.method, cardId: card?.id, installments: form.method === 'Crédito parcelado' ? Math.max(1, n) : 1, firstMonth, ...(onClosingDay ? { afterClosing: form.afterClosing } : {}), shares }
    if (!save({ ...data, expenses: editingExpenseId ? data.expenses.map(e => e.id === editingExpenseId ? entry : e) : [entry, ...data.expenses] })) return
    if (editingExpenseId) {
      showToast('Alterações salvas no lançamento.')
    } else if (firstMonth !== month) {
      showToast(`Lançamento salvo em ${monthName(firstMonth)}.`)
    } else {
      showToast('Lançamento adicionado.')
    }
    closeModalWithAnimation('expense', () => {
      setModal(false)
      setEditingExpenseId(null)
      setShareError('')
      setExpenseErrors({})
      const nextCard = card || data.cards[0]
      setForm({ ...form, description: '', amount: '', date: normalizedDate, category: entry.category, cardId: nextCard?.id || '', installments: '2', afterClosing: (nextCard?.closingDayRule ?? 'after') !== 'before', shares: [] })
    })
  }
  const editExpense = (expense: Expense) => {
    const expenseCard = data.cards.find(c => c.id === expense.cardId) || data.cards[0]
    setEditingExpenseId(expense.id)
    setForm({ description: expense.description, amount: formatMoneyInput(expense.amount), date: expense.date, category: expense.category || data.categories[0]?.id || '', method: expense.method, cardId: expense.cardId || expenseCard?.id || '', installments: String(expense.installments > 1 ? expense.installments : 2), afterClosing: expense.afterClosing ?? ((expenseCard?.closingDayRule ?? 'after') !== 'before'), shares: (expense.shares || []).map(share => ({ participantId: share.participantId, amount: formatMoneyInput(share.amount), installment: share.installment ? String(share.installment) : 'all' })) })
    setShareError('')
    setExpenseErrors({})
    setModal(true)
  }
  const closeExpenseModal = () => closeModalWithAnimation('expense', () => { setModal(false); setEditingExpenseId(null); setShareError(''); setExpenseErrors({}) })
  const closeConfirmDialog = () => closeModalWithAnimation('confirm', () => setConfirmDialog(null))
  const deleteExpense = (id: string) => {
    if (save({ ...data, expenses: data.expenses.filter(e => e.id !== id) })) {
      setSelectedExpenseIds(current => current.filter(item => item !== id))
      showToast('Lançamento excluído.')
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
    const idsToDelete = [...selectedVisibleIds]
    const count = idsToDelete.length
    setConfirmDialog({
      eyebrow: 'CONFIRMAR EXCLUSÃO',
      title: count === 1 ? 'Excluir lançamento selecionado?' : `Excluir ${count} lançamentos selecionados?`,
      description: count === 1
        ? 'O lançamento selecionado será removido permanentemente da sua lista de despesas.'
        : `Os ${count} lançamentos selecionados serão removidos permanentemente da sua lista de despesas.`,
      confirmLabel: count === 1 ? 'Excluir lançamento' : `Excluir ${count} lançamentos`,
      onConfirm: () => {
        const toDelete = new Set(idsToDelete)
        if (save({ ...data, expenses: data.expenses.filter(e => !toDelete.has(e.id)) })) {
          setSelectedExpenseIds(current => current.filter(id => !toDelete.has(id)))
          showToast(count === 1 ? '1 lançamento excluído.' : `${count} lançamentos excluídos.`)
        }
        closeConfirmDialog()
      },
    })
  }
  const downloadCsv = () => {
    const rows = [['Descrição','Valor da parcela','Parte pessoal','A receber','Parcela','Mês','Categoria','Pagamento','Participantes'], ...current.map(e => [e.description, e.value.toFixed(2), personalValue(e).toFixed(2), e.allocatedShares.reduce((sum, share) => sum + share.amount, 0).toFixed(2), `${e.part}/${e.installments}`, e.month, data.categories.find(c => c.id === e.category)?.name || '', e.method, e.allocatedShares.map(share => data.participants?.find(p => p.id === share.participantId)?.name || 'Participante').join(', ')])]
    const untrustedColumns = new Set([0, 6, 7, 8])
    const blob = new Blob(['\ufeff' + rows.map(row => row.map((cell, index) => csvCell(cell, untrustedColumns.has(index))).join(';')).join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `relatorio-${month}.csv`; a.click(); URL.revokeObjectURL(url)
    showToast('Relatório CSV exportado.')
  }
  const downloadBackup = () => {
    if (storageWarning) { showToast('Importe um backup válido antes de baixar uma cópia dos dados.'); return }
    const blob = new Blob([createBackup(data, { monthlyLimit, limitNoticePercent: String(limitNoticePercentValue), defaultView, theme, profileName, profilePhoto })], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `poe-na-conta-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
    recordBackupCompleted()
    showToast('Backup baixado. Guarde o arquivo em um local seguro.')
  }
  const applyBackupPayload = (payload: BackupPayload) => {
    save(payload.data, true, false)
    recordBackupCompleted()
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
    showToast('Backup importado com sucesso.')
  }
  const importBackup = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const imported = parseBackupFile(await file.text())
      if (!imported) { showToast('Este arquivo não é um backup válido do Põe na Conta.'); return }
      if (onboardingOpen) {
        applyBackupPayload(imported)
        setProfileMessage('')
        closeModalWithAnimation('onboarding', () => setOnboardingOpen(false))
        return
      }
      setPendingBackupImport(imported)
      showToast('')
    } catch {
      showToast('Não foi possível ler o arquivo selecionado.')
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
      save({ ...structuredClone(seed), expenses: [], recurrences: [] }, true, false)
    } else if (onboardingStartMode === 'demo') {
      save(structuredClone(seed), true, false)
    } else if (!localStorage.getItem('conta-clara-v1')) {
      save(data, true, false)
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
      triggerFormShake('reset')
      return
    }
    const keysToRemove = [
      'conta-clara-v1',
      'poe-na-conta-onboarded',
      'poe-na-conta-profile-name',
      'poe-na-conta-profile-photo',
      'poe-na-conta-monthly-limit',
      'poe-na-conta-limit-notice-percent',
      'poe-na-conta-last-backup-at',
      'poe-na-conta-changes-since-backup',
      'poe-na-conta-backup-snooze-until',
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
    setLastBackupAt('')
    setChangesSinceBackup(0)
    setBackupSnoozeUntil(0)
    setDefaultView('Visão geral')
    setView('Visão geral')
    setSelectedExpenseIds([])
    setRecurrenceSelection(null)
    setQuery('')
    setCategoryFilter('Todas as categorias')
    setMethodFilter('Todos os pagamentos')
    setCardFilter('Todos os cartões')
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
  const openCategory = (category?: Category) => { setSettingsErrors({}); setSettingsModal({ kind: 'category', id: category?.id, name: category?.name || '', color: category?.color || '#6e7f72', closingDay: '25', dueDay: '5', closingDayRule: 'after' }) }
  const openCard = (card?: Card) => { setSettingsErrors({}); setSettingsModal({ kind: 'card', id: card?.id, name: card?.name || '', color: '#65a987', closingDay: String(card?.closingDay || 25), dueDay: String(card?.dueDay || 5), closingDayRule: card?.closingDayRule || 'after' }) }
  const openParticipant = (participant?: Participant) => { setSettingsErrors({}); setSettingsModal({ kind: 'participant', id: participant?.id, name: participant?.name || '', color: '#65a987', closingDay: '25', dueDay: '5', closingDayRule: 'after' }) }
  const addParticipantFromExpense = () => { setReturnToExpenseAfterParticipant(true); closeModalWithAnimation('expense', () => { setModal(false); openParticipant() }) }
  const saveSetting = (ev: React.FormEvent) => {
    ev.preventDefault(); if (!settingsModal) return
    const { kind, id, name, color, closingDay, dueDay, closingDayRule } = settingsModal
    const nextErrors: Record<string, string> = {}
    if (!name.trim()) nextErrors.name = kind === 'category' ? 'Informe o nome da categoria.' : kind === 'card' ? 'Informe o nome do cartão.' : 'Informe o nome do participante.'
    if (kind === 'category' && !/^#[0-9a-fA-F]{6}$/.test(color.trim())) {
      nextErrors.color = 'Informe uma cor hexadecimal válida (ex.: #6E7F72).'
    }
    const close = Number(closingDay)
    const due = Number(dueDay)
    if (kind === 'card') {
      if (!closingDay.trim() || !Number.isInteger(close) || close < 1 || close > 31) nextErrors.closingDay = 'Informe um dia entre 1 e 31.'
      if (!dueDay.trim() || !Number.isInteger(due) || due < 1 || due > 31) nextErrors.dueDay = 'Informe um dia entre 1 e 31.'
    }
    if (Object.keys(nextErrors).length > 0) {
      setSettingsErrors(nextErrors)
      triggerFormShake('settings')
      return
    }
    setSettingsErrors({})
    if (kind === 'category') { const category: Category = { id: id || createId(), name: name.trim(), color: color.trim().toLowerCase() }; if (!save({ ...data, categories: id ? data.categories.map(c => c.id === id ? category : c) : [...data.categories, category] })) return; showToast(id ? 'Categoria atualizada.' : 'Categoria criada.') }
    else if (kind === 'card') {
      const card: Card = { id: id || createId(), name: name.trim(), closingDay: close, dueDay: due, closingDayRule: closingDayRule || 'after' }
      const updatedCards = id ? data.cards.map(c => c.id === id ? card : c) : [...data.cards, card]
      const updatedExpenses = data.expenses.map(e => {
        if (!e.method.startsWith('Crédito')) return e
        const txCard = updatedCards.find(c => c.id === e.cardId) || (e.cardId === undefined ? updatedCards[0] : undefined)
        if (!txCard || txCard.id !== card.id) return e
        return { ...e, firstMonth: calculateCardDueMonth(e.date, txCard, e.afterClosing) }
      })
      if (!save({ ...data, cards: updatedCards, expenses: updatedExpenses })) return
      showToast(id ? 'Cartão atualizado.' : 'Cartão criado.')
    }
    else { const participant: Participant = { id: id || createId(), name: name.trim() }; if (!save({ ...data, participants: id ? (data.participants || []).map(p => p.id === id ? participant : p) : [...(data.participants || []), participant] })) return; showToast(id ? 'Participante atualizado.' : 'Participante adicionado.') }
    closeSettingsModal()
  }
  const removeParticipant = (id: string) => {
    const participant = (data.participants || []).find(p => p.id === id)
    setConfirmDialog({
      eyebrow: 'CONFIRMAR EXCLUSÃO',
      title: participant ? `Remover ${participant.name}?` : 'Remover participante?',
      description: 'Este participante será removido e suas atribuições serão apagadas dos lançamentos.',
      confirmLabel: 'Remover participante',
      onConfirm: () => {
        if (save({ ...data, participants: (data.participants || []).filter(p => p.id !== id), expenses: data.expenses.map(e => ({ ...e, shares: (e.shares || []).filter(share => share.participantId !== id) })) })) {
          showToast('Participante removido.')
        }
        closeConfirmDialog()
      },
    })
  }

  const transactionTable = <section className="panel transactions data-page-table">
    <div className="panel-head"><div><h2>{view === 'Relatórios' ? 'Relatório de despesas' : 'Todos os lançamentos'}</h2><p>{view === 'Relatórios' ? 'Gastos pessoais e valores atribuídos a participantes.' : 'Consulte, filtre por categoria, forma de pagamento ou cartão.'}</p></div><button className="export-btn" aria-label="Exportar CSV" onClick={downloadCsv}>↓ <span>Exportar CSV</span></button></div>
    <div className="data-summary"><div><span>Gastos pessoais{hasActiveFilters ? ' (filtro)' : ''}</span><b>{money(hasActiveFilters ? filteredPersonalTotal : total)}</b></div><div><span>A receber{hasActiveFilters ? ' (filtro)' : ''}</span><b>{money(hasActiveFilters ? filteredReimbursementTotal : reimbursementTotal)}</b></div>{(cardFilter !== 'Todos os cartões' || methodFilter.startsWith('Crédito')) && <div><span>Total na fatura</span><b>{money(filteredInvoiceTotal)}</b></div>}<div><span>Lançamentos</span><b>{hasActiveFilters ? `${filtered.length} de ${current.length}` : current.length}</b></div></div>
    <div className="filters">
      <label className="search"><span>⌕</span><input aria-label="Buscar lançamentos" placeholder="Buscar lançamento..." value={query} onChange={e => setQuery(e.target.value)} /></label>
      <select aria-label="Filtrar por categoria" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}><option>Todas as categorias</option>{data.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
      <select aria-label="Filtrar por forma de pagamento" value={methodFilter} onChange={e => { const next = e.target.value; setMethodFilter(next); if (next === 'PIX' || next === 'Débito' || next === 'Dinheiro') setCardFilter('Todos os cartões') }}><option>Todos os pagamentos</option><option>PIX</option><option>Débito</option><option>Dinheiro</option><option>Crédito (todos)</option><option>Crédito à vista</option><option>Crédito parcelado</option></select>
      {data.cards.length > 0 && <select aria-label="Filtrar por cartão" value={cardFilter} onChange={e => { const next = e.target.value; setCardFilter(next); if (next !== 'Todos os cartões' && (methodFilter === 'PIX' || methodFilter === 'Débito' || methodFilter === 'Dinheiro')) setMethodFilter('Todos os pagamentos') }}><option>Todos os cartões</option>{data.cards.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>}
      {hasActiveFilters && <button type="button" className="cancel-btn filter-clear-btn" onClick={clearAllFilters}>Limpar filtros</button>}
    </div>
    {selectedVisibleIds.length > 0 && <div className="bulk-actions-bar" role="region" aria-label="Ações em massa">
      <span className="bulk-actions-count"><b>{selectedVisibleIds.length}</b> {selectedVisibleIds.length === 1 ? 'item selecionado' : 'itens selecionados'}</span>
      <div className="bulk-actions-buttons">
        <button type="button" className="cancel-btn bulk-clear-btn" onClick={() => toggleSelectAllVisible(false)}>Limpar seleção</button>
        <button type="button" className="danger-btn bulk-delete-btn" onClick={deleteSelectedExpenses}>Excluir selecionados ({selectedVisibleIds.length})</button>
      </div>
    </div>}
    <div className="table-wrap"><table><thead><tr><th className="col-select"><input type="checkbox" className="row-checkbox" aria-label="Selecionar todos os lançamentos visíveis" checked={allVisibleSelected} disabled={!filteredExpenseIds.length} onChange={e => toggleSelectAllVisible(e.target.checked)} /></th><th className="col-desc">DESCRIÇÃO</th><th className="col-category">CATEGORIA</th><th className="col-date">DATA</th><th className="col-method">PAGAMENTO</th><th className="right col-value">PARTE PESSOAL</th><th className="col-actions" /></tr></thead><tbody>{filtered.map(e => { const cat = data.categories.find(c => c.id === e.category); const txCard = e.method.startsWith('Crédito') ? (data.cards.find(c => c.id === e.cardId) || data.cards[0]) : undefined; const own = personalValue(e); const shared = e.allocatedShares.reduce((sum, share) => sum + share.amount, 0); const debtor = owedBy(e); const shortDate = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(new Date(`${e.date}T12:00:00`)).replace('.', ''); const isSelected = selectedExpenseIds.includes(e.id); return <tr key={`${e.id}-${e.month}`} className={isSelected ? 'is-selected' : ''}><td className="col-select"><input type="checkbox" className="row-checkbox" aria-label={`Selecionar ${e.description}`} checked={isSelected} onChange={ev => toggleSelectExpense(e.id, ev.target.checked)} /></td><td className="col-desc"><div className="desc"><span className="category-icon" style={{ color: cat?.color, background: `${cat?.color}18` }}>{e.category === 'moradia' ? '⌂' : e.category === 'alimentacao' ? '◒' : e.category === 'transporte' ? '⌁' : e.category === 'lazer' ? '✧' : '＋'}</span><span className="desc-text"><b>{e.description}</b><small>{e.installments > 1 ? `Parcela ${e.part} de ${e.installments}` : 'Despesa'}{shared > 0 ? ` · ${debtor}` : ''}</small><small className="mobile-tx-meta">{shortDate} · {cat?.name || 'Sem categoria'} · {e.method}{txCard ? ` (${txCard.name})` : ''}</small></span></div></td><td className="col-category"><span className="category-label"><i style={{ background: cat?.color }} />{cat?.name || 'Sem categoria'}</span></td><td className="date-cell col-date">{new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${e.date}T12:00:00`))}</td><td className="col-method"><span className={`method ${e.method.startsWith('Crédito') ? 'credit' : ''}`}>{e.method}{txCard ? ` · ${txCard.name}` : ''}</span></td><td className="right value col-value">{money(own)}</td><td className="col-actions"><details className="row-actions"><summary aria-label={`Ações para ${e.description}`} title="Ações">···</summary><div className={`row-action-menu ${theme === 'dark' ? 'is-dark' : 'is-light'}`}><button onClick={event => closeActionMenu(event, () => editExpense(e))}>Editar</button><button className="danger" onClick={event => closeActionMenu(event, () => deleteExpense(e.id))}>Excluir</button></div></details></td></tr> })}</tbody></table>{!filtered.length && <div className="empty">Nenhum lançamento encontrado neste mês.</div>}</div>
    <div className="table-foot"><span>Mostrando <b>{filtered.length}</b> de <b>{current.length}</b> lançamentos</span><span>Gastos pessoais <b>{money(hasActiveFilters ? filteredPersonalTotal : total)}</b> · A receber <b>{money(hasActiveFilters ? filteredReimbursementTotal : reimbursementTotal)}</b></span></div>
  </section>

  return <div className="app-shell" data-theme={theme}>
    <input ref={backupInput} type="file" accept="application/json,.json" hidden onChange={importBackup} />
    <input ref={profilePhotoInput} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={updateProfilePhoto} />
    {backupMessage && <div className={`backup-toast ${toastClosing ? 'is-closing' : ''}`} role="status" aria-live="polite"><span>{backupMessage}</span><button type="button" aria-label="Dispensar aviso" onClick={dismissToast}>×</button></div>}
    <header className="site-header"><a className="brand" href="#" onClick={() => setView('Visão geral')}><span className="brand-mark"><svg viewBox="0 0 48 48" shapeRendering="crispEdges" aria-hidden="true"><rect x="1" y="1" width="46" height="46" rx="13" fill="#20231f"/><path d="M18 6h12v3h6v6h3v6h3v12h-3v6h-6v3H18v-3h-6v-6H9v-6H6V18h3v-6h6V9h3z" fill="#986027"/><path d="M18 9h12v3h6v6h3v12h-3v6h-6v3H18v-3h-6v-6H9V18h3v-6h6z" fill="#e8b957"/><path d="M18 12h12v3h6v3h-3v3h-3v-3H18v-3h-3v-3h3z" fill="#f6d77e"/><rect x="22" y="14" width="4" height="20" fill="#80501f"/><rect x="18" y="17" width="12" height="3" fill="#80501f"/><rect x="15" y="20" width="3" height="3" fill="#80501f"/><rect x="18" y="23" width="12" height="3" fill="#80501f"/><rect x="27" y="26" width="3" height="3" fill="#80501f"/><rect x="18" y="29" width="12" height="3" fill="#80501f"/><rect x="12" y="18" width="3" height="6" fill="#f6d77e"/></svg></span><span>Põe na Conta<small>GESTÃO FINANCEIRA</small></span></a><div className="side-label">MENU</div><nav aria-label="Navegação principal">{(['Visão geral','Lançamentos','Relatórios','Recorrências'] as const).map((v, i) => <button key={v} className={`nav-item ${view === v ? 'active' : ''}`} onClick={() => setView(v)}><span className="nav-icon">{['◫','↔','▥','↻'][i]}</span><span className="nav-label">{v}</span></button>)}<button className={`nav-item mobile-settings-nav ${view === 'Ajustes' ? 'active' : ''}`} onClick={() => setView('Ajustes')}><span className="nav-icon">⚙</span><span className="nav-label">Ajustes</span></button></nav><div className="side-bottom"><button className={`theme-switch header-theme-switch ${theme === 'dark' ? 'is-dark' : ''}`} onClick={toggleTheme} aria-label={theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'}><span className="theme-switch-track" aria-hidden="true"><span className="theme-switch-thumb">{theme === 'dark' ? <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" /></svg> : <svg viewBox="0 0 24 24"><path d="M20.2 15.4A8.5 8.5 0 0 1 8.6 3.8 8.5 8.5 0 1 0 20.2 15.4Z" /></svg>}</span></span><span className="theme-switch-label">{theme === 'dark' ? 'Tema claro' : 'Tema escuro'}</span></button><div className="profile"><div className={`avatar profile-avatar ${profilePhoto ? 'has-photo' : ''}`}>{profilePhoto ? <img src={profilePhoto} alt="" /> : profileName.trim() ? profileInitials(profileName) : <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>}</div><div><b>Meu espaço</b><span>{profileName.trim() || 'Plano pessoal'}</span></div><details className="row-actions profile-actions"><summary aria-label="Abrir opções do Meu espaço" title="Opções">···</summary><div className={`row-action-menu ${theme === 'dark' ? 'is-dark' : 'is-light'}`}><button onClick={event => closeActionMenu(event, () => setView('Ajustes'))}>Preferências</button><button onClick={event => closeActionMenu(event, downloadBackup)}>Exportar backup</button><button onClick={event => closeActionMenu(event, () => backupInput.current?.click())}>Importar backup</button></div></details></div></div></header>
    <main className="main"><header className="topbar"><div className="breadcrumb">Põe na Conta <span>/</span> {view}</div></header>
      <div className="content" key={view}>
        <div className="heading-row"><div><div className="eyebrow">{new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }).format(today).toLocaleUpperCase('pt-BR')}</div><h1>{view}</h1><p className="subtitle">{view === 'Visão geral' ? 'Uma leitura clara dos seus gastos e compromissos.' : view === 'Lançamentos' ? 'Encontre e acompanhe cada movimentação.' : view === 'Relatórios' ? 'Entenda como seus gastos se distribuem ao longo do tempo.' : view === 'Recorrências' ? 'Revise as despesas que se repetem antes de lançar no mês.' : 'Personalize categorias, cartões e pessoas com quem divide despesas.'}</p></div>{view !== 'Ajustes' && <button className="primary" onClick={() => view === 'Recorrências' ? openRecurrence() : openNewExpenseModal()}><span>＋</span> {view === 'Recorrências' ? 'Nova recorrência' : 'Nova despesa'}</button>}</div>
        {!isStandalone && !pwaBannerDismissed && !onboardingOpen && (Boolean(deferredInstallPrompt) || isTouchDevice()) && <div className="pwa-install-banner" role="region" aria-label="Instalar aplicativo">
          <div className="pwa-install-banner-info">
            <div className="pwa-install-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24"><rect x="6" y="2" width="12" height="20" rx="2.5" /><path d="M12 7v7m-3-3 3 3 3-3M10 18h4" /></svg>
            </div>
            <div>
              <b>Instale o Põe na Conta na sua tela inicial</b>
              <span>Abra em tela cheia como um app nativo e use 100% offline a qualquer momento.</span>
            </div>
          </div>
          <div className="pwa-install-banner-actions">
            <button type="button" className="cancel-btn" onClick={dismissPwaBanner}>Agora não</button>
            <button type="button" className="primary" onClick={handleInstallPwa}>Instalar na tela inicial</button>
          </div>
        </div>}
        {backupReminderMessage && <div className="backup-reminder-banner" role="status">
          <div className="backup-reminder-info">
            <div className="backup-reminder-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="M12 4v11m-4-4 4 4 4-4M5 19h14" /></svg>
            </div>
            <div>
              <b>Lembrete de backup</b>
              <span>{backupReminderMessage}</span>
            </div>
          </div>
          <div className="backup-reminder-actions">
            <button type="button" className="cancel-btn" onClick={snoozeBackupReminder}>Lembrar depois</button>
            <button type="button" className="outline-btn" onClick={downloadBackup}>↓ Baixar backup agora</button>
          </div>
        </div>}
        {storageWarning && <div className="backup-warning" role="alert"><span>{storageWarning} Acesse <b>Ajustes → Seus dados</b> para importar um backup válido.</span><button type="button" className="outline-btn" onClick={() => save(data, true)}>Continuar com os dados atuais</button></div>}
        {view !== 'Ajustes' && <div className="monthbar"><button className="month-arrow" aria-label="Mês anterior" onClick={() => { setMonth(shiftMonthKey(month, -1)); setRecurrenceSelection(null) }}>‹</button><span>{monthName(month)}</span><button className="month-arrow" aria-label="Próximo mês" onClick={() => { setMonth(shiftMonthKey(month, 1)); setRecurrenceSelection(null) }}>›</button><button className="today-btn" onClick={() => { setMonth(monthKey(today)); setRecurrenceSelection(null) }}>Hoje</button></div>}
        {view !== 'Ajustes' && monthlyLimitValue > 0 && <section className={`monthly-limit ${monthlyLimitNotice ? 'is-warning' : ''}`} role="status" aria-live="polite"><div className="monthly-limit-heading"><span>Limite mensal · {monthName(month)}</span><b>{money(total)} de {money(monthlyLimitValue)}</b></div><div className="monthly-limit-track" role="progressbar" aria-label="Uso do limite mensal" aria-valuemin={0} aria-valuemax={monthlyLimitValue} aria-valuenow={Math.min(total, monthlyLimitValue)}><i style={{ width: `${Math.min(monthlyLimitProgress, 100)}%` }} /></div><p>{monthlyLimitNotice ? monthlyLimitProgress > 100 ? `Teto mensal ultrapassado: você já usou ${Math.round(monthlyLimitProgress)}% do seu limite pessoal.` : `Você atingiu ${limitNoticePercentValue}% do limite mensal que definiu.` : `Avisaremos ao atingir ${limitNoticePercentValue}% (${money(monthlyLimitValue * limitNoticePercentValue / 100)}).`}</p></section>}

        {view === 'Ajustes' ? <section className="settings-grid">
          <div className="panel settings-panel preference-panel" id="preferences-panel"><div className="panel-head"><div><h2>Preferências</h2><p>Personalize como o Põe na Conta abre e aparece.</p></div><span className="calendar-icon">⚙</span></div><div className="profile-preferences"><h3>Perfil</h3><p>Defina como seu perfil aparece neste dispositivo.</p><label>Nome<input type="text" maxLength={60} placeholder="Seu nome" value={profileName} onChange={event => updateProfileName(event.target.value)} /></label><div className="profile-photo-actions"><button type="button" className="outline-btn" onClick={() => profilePhotoInput.current?.click()}>{profilePhoto ? 'Trocar foto' : 'Adicionar foto'}</button>{profilePhoto && <button type="button" className="text-btn" onClick={removeProfilePhoto}>Remover foto</button>}</div>{profileMessage && <small className="profile-message" role="status">{profileMessage}</small>}</div><div className="preference-controls"><label>Tela ao abrir<select value={defaultView} onChange={event => updateDefaultView(event.target.value as MainView)}><option>Visão geral</option><option>Lançamentos</option><option>Relatórios</option><option>Recorrências</option><option>Ajustes</option></select></label><label>Tema padrão<select value={defaultTheme} onChange={event => updateDefaultTheme(event.target.value as 'light' | 'dark')}><option value="light">Claro</option><option value="dark">Escuro</option></select></label></div><div className="budget-preferences"><h3>Limite de gastos por mês</h3><p>O limite considera apenas sua parte das despesas; valores de participantes ficam de fora.</p><div className="budget-preference-fields"><label>Teto mensal<div className="money-input-wrap"><span className="money-prefix" aria-hidden="true">R$</span><input type="text" inputMode="decimal" enterKeyHint="done" onKeyDown={dismissKeyboardOnEnter} placeholder="0,00" value={monthlyLimit ? formatMoneyInput(Number(monthlyLimit)) : ''} onChange={event => { const formatted = formatMoneyInput(event.target.value); const parsed = parseMoneyInput(formatted); updateMonthlyLimit(parsed > 0 ? String(parsed) : '') }} /></div></label><label>Avisar ao atingir<div className="money-input-wrap"><input type="text" inputMode="numeric" enterKeyHint="done" onKeyDown={dismissKeyboardOnEnter} placeholder="80" value={limitNoticePercent} onChange={event => updateLimitNoticePercent(event.target.value.replace(/\D/g, '').slice(0, 3))} /><span className="money-suffix" aria-hidden="true">%</span></div></label></div></div><div className="pwa-preferences"><h3>Aplicativo neste dispositivo</h3><p>{isStandalone ? 'O Põe na Conta já está instalado em tela cheia e funcionando 100% offline neste dispositivo.' : 'Adicione o ícone à tela inicial do celular ou computador para abrir em tela cheia e usar mesmo sem internet.'}</p>{isStandalone ? <span className="pwa-status-badge">✓ Instalado · Modo tela cheia &amp; 100% offline ativo</span> : <button type="button" className="outline-btn" onClick={handleInstallPwa}>↓ Instalar na tela inicial</button>}</div></div>
          <div className="panel settings-panel"><div className="panel-head"><div><h2>Categorias</h2><p>Organize e identifique seus gastos.</p></div><button className="outline-btn" onClick={() => openCategory()}>＋ Nova categoria</button></div>{data.categories.map(c => <div className="setting-row" key={c.id}><i className="dot" style={{ background: c.color }} /><b>{c.name}</b><details className="row-actions"><summary aria-label={`Ações para a categoria ${c.name}`} title="Ações">···</summary><div className={`row-action-menu ${theme === 'dark' ? 'is-dark' : 'is-light'}`}><button onClick={event => closeActionMenu(event, () => openCategory(c))}>Editar</button><button className="danger" onClick={event => closeActionMenu(event, () => { if (save({ ...data, categories: data.categories.filter(x => x.id !== c.id) })) showToast('Categoria removida.') })}>Remover</button></div></details></div>)}</div>
          <div className="panel settings-panel"><div className="panel-head"><div><h2>Cartões</h2><p>Configure fechamento e vencimento da fatura.</p></div><button className="outline-btn" onClick={() => openCard()}>＋ Novo cartão</button></div>{data.cards.map(c => <div className="setting-row" key={c.id}><span className="card-icon">▣</span><b>{c.name}</b><span className="card-days">Fecha dia {c.closingDay} · Vence dia {c.dueDay}</span><details className="row-actions"><summary aria-label={`Ações para o cartão ${c.name}`} title="Ações">···</summary><div className={`row-action-menu ${theme === 'dark' ? 'is-dark' : 'is-light'}`}><button onClick={event => closeActionMenu(event, () => openCard(c))}>Editar</button><button className="danger" onClick={event => closeActionMenu(event, () => { if (save({ ...data, cards: data.cards.filter(x => x.id !== c.id) })) showToast('Cartão removido.') })}>Remover</button></div></details></div>)}</div>
          <div className="panel settings-panel"><div className="panel-head"><div><h2>Participantes</h2><p>Pessoas que dividem despesas com você.</p></div><button className="outline-btn" onClick={() => openParticipant()}>＋ Novo participante</button></div>{(data.participants || []).length ? (data.participants || []).map(participant => <div className="setting-row" key={participant.id}><span className="participant-avatar">{participant.name.slice(0, 1).toUpperCase()}</span><b>{participant.name}</b><details className="row-actions"><summary aria-label={`Ações para ${participant.name}`} title="Ações">···</summary><div className={`row-action-menu ${theme === 'dark' ? 'is-dark' : 'is-light'}`}><button onClick={event => closeActionMenu(event, () => openParticipant(participant))}>Editar</button><button className="danger" onClick={event => closeActionMenu(event, () => removeParticipant(participant.id))}>Remover</button></div></details></div>) : <div className="empty compact">Adicione pessoas para acompanhar o que elas precisam reembolsar.</div>}</div>
          <div className="panel backup"><h2>Seus dados</h2><p>Os lançamentos ficam salvos localmente neste navegador. Baixe um backup completo para preservar categorias, cartões, participantes e despesas.</p><div className="backup-status-row"><span>{lastBackupAt ? `✓ Último backup: ${new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(lastBackupAt))}` : '⚠ Nenhum backup baixado neste dispositivo ainda'}</span>{lastBackupAt && <small>{changesSinceBackup > 0 ? `${changesSinceBackup} ${changesSinceBackup === 1 ? 'alteração desde então' : 'alterações desde então'}` : 'Tudo atualizado'}</small>}</div><div className="backup-actions"><button className="outline-btn" onClick={downloadBackup}>Baixar backup JSON</button><button className="outline-btn" onClick={() => backupInput.current?.click()}>Importar backup</button><button className="outline-btn" onClick={downloadCsv}>↓ Exportar mês em CSV</button><button type="button" className="danger-outline-btn" onClick={openResetDataModal}>Excluir dados</button></div>{storageWarning && <p className="backup-warning" role="alert">{storageWarning}</p>}</div>
        </section> : view === 'Recorrências' ? <section className="recurrence-page">
          <div className="panel recurrence-review"><div className="panel-head"><div><h2>Revisão de {monthName(month)}</h2><p>Confirme só as cobranças que aconteceram neste mês.</p></div><span className="stat-symbol muted">↻</span></div>
            {pendingRecurrences.length ? <><div className="recurrence-review-tools"><label><input type="checkbox" checked={pendingRecurrences.every(item => selectedRecurrences.includes(item.id))} onChange={event => setRecurrenceSelection(event.target.checked ? pendingRecurrences.map(item => item.id) : [])} /> Selecionar todas</label><span>{pendingRecurrences.length} para revisar</span></div><div className="recurrence-list">{pendingRecurrences.map(item => { const category = data.categories.find(value => value.id === item.category); return <div className="recurrence-review-item" key={item.id}><input type="checkbox" aria-label={`Confirmar ${item.description}`} checked={selectedRecurrences.includes(item.id)} onChange={event => { const current = new Set(selectedRecurrences); if (event.target.checked) current.add(item.id); else current.delete(item.id); setRecurrenceSelection([...current]) }} /><span className="category-icon" style={{ color: category?.color, background: `${category?.color}18` }}>↻</span><span className="recurrence-info"><b>{item.description}</b><small>{category?.name || 'Sem categoria'} · Todo dia {item.day} · {item.method}</small></span><b className="recurrence-amount">{money(item.amount)}</b><button type="button" className="recurrence-skip" onClick={() => skipRecurrence(item.id)}>Pular</button></div> })}</div><div className="recurrence-review-footer"><span>Os lançamentos confirmados entram na lista do mês.</span><button className="primary" disabled={!selectedRecurrences.length} onClick={confirmRecurrences}>Confirmar {selectedRecurrences.length} {selectedRecurrences.length === 1 ? 'despesa' : 'despesas'}</button></div></> : <div className="empty">Nenhuma cobrança pendente para revisar neste mês.</div>}
          </div>
          <div className="panel recurrence-manage"><div className="panel-head"><div><h2>Modelos mensais</h2><p>Gerencie os valores e a frequência das despesas.</p></div><span className="recurrence-count">{recurrences.filter(item => item.active).length} ativas</span></div>{recurrences.length ? <div className="recurrence-list">{recurrences.map(item => { const category = data.categories.find(value => value.id === item.category); return <div className={`recurrence-template ${item.active ? '' : 'is-paused'}`} key={item.id}><span className="category-icon" style={{ color: category?.color, background: `${category?.color}18` }}>↻</span><span className="recurrence-info"><b>{item.description}</b><small>{category?.name || 'Sem categoria'} · Dia {item.day} · {item.active ? 'Ativa' : 'Pausada'}</small></span><b className="recurrence-amount">{money(item.amount)}</b><details className="row-actions"><summary aria-label={`Ações para ${item.description}`} title="Ações">···</summary><div className={`row-action-menu ${theme === 'dark' ? 'is-dark' : 'is-light'}`}><button onClick={event => closeActionMenu(event, () => openRecurrence(item))}>Editar</button><button onClick={event => closeActionMenu(event, () => save({ ...data, recurrences: recurrences.map(value => value.id === item.id ? { ...value, active: !value.active } : value) }))}>{item.active ? 'Pausar' : 'Reativar'}</button><button className="danger" onClick={event => closeActionMenu(event, () => setConfirmDialog({ eyebrow: 'CONFIRMAR EXCLUSÃO', title: `Excluir “${item.description}”?`, description: 'O modelo mensal será removido. Os lançamentos que já foram criados nos meses anteriores serão mantidos.', confirmLabel: 'Excluir recorrência', onConfirm: () => { if (save({ ...data, recurrences: recurrences.filter(value => value.id !== item.id) })) showToast('Recorrência excluída.'); closeConfirmDialog() } }))}>Excluir</button></div></details></div> })}</div> : <div className="empty">Cadastre seu primeiro modelo mensal para revisar cobranças recorrentes aqui.</div>}</div>
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
            <div className="panel category-panel"><div className="panel-head"><div><h2>Onde estão os gastos</h2><p>{categoryPanelMode === 'categories' ? 'Distribuição por categoria' : `${currentExpenses.length} despesas pessoais no período`}</p></div><div className="category-head-actions"><div className="category-view-toggle" aria-label="Resumo por categoria ou lançamentos"><button className={categoryPanelMode === 'categories' ? 'selected' : ''} onClick={() => setCategoryPanelMode('categories')}>Categorias</button><button className={categoryPanelMode === 'transactions' ? 'selected' : ''} onClick={() => setCategoryPanelMode('transactions')}>Lançamentos</button></div></div></div>{categoryPanelMode === 'transactions' ? currentExpenses.length ? <div className="category-transaction-list">{[...currentExpenses].sort((a, b) => b.date.localeCompare(a.date)).map(e => { const cat = data.categories.find(c => c.id === e.category); const debtor = owedBy(e); return <div className="category-transaction" key={`${e.id}-${e.month}`}><span className="category-icon" style={{ color: cat?.color, background: `${cat?.color}18` }}>{e.category === 'moradia' ? '⌂' : e.category === 'alimentacao' ? '◒' : e.category === 'transporte' ? '⌁' : e.category === 'lazer' ? '✧' : '＋'}</span><span className="category-transaction-info"><b>{e.description}</b><small>{cat?.name || 'Sem categoria'}{debtor ? ` · ${debtor}` : ''}{e.installments > 1 ? ` · Parcela ${e.part}/${e.installments}` : ''}</small></span><b className="category-transaction-value">{money(personalValue(e))}</b></div> })}</div> : <div className="empty compact">Sem despesas neste mês.</div> : categoryTotals.length ? <div className="pie-layout"><div className="pie-chart"><svg className="pie-svg" viewBox="0 0 100 100" role="img" aria-label="Gastos pessoais por categoria"><circle cx="50" cy="50" r="37" fill="none" stroke="#e8eee9" strokeWidth="18" />{pieSlices.length === 1 ? <circle className="pie-slice" cx="50" cy="50" r="37" fill="none" stroke={pieSlices[0].category.color} strokeWidth="18" style={{ stroke: pieSlices[0].category.color, strokeWidth: 18 }} tabIndex={0} aria-label={`${pieSlices[0].category.name}: ${money(pieSlices[0].category.total)}, 100%`} onMouseEnter={() => setHoveredCategoryId(pieSlices[0].category.id)} onMouseLeave={() => setHoveredCategoryId(null)} onFocus={() => setHoveredCategoryId(pieSlices[0].category.id)} onBlur={() => setHoveredCategoryId(null)}><title>{`${pieSlices[0].category.name}: ${money(pieSlices[0].category.total)} · ${pieSlices[0].percentage}%`}</title></circle> : pieSlices.map(slice => <path className="pie-slice" key={slice.category.id} d={donutSlice(slice.start, slice.end)} fill={slice.category.color} tabIndex={0} aria-label={`${slice.category.name}: ${money(slice.category.total)}, ${slice.percentage}%`} onMouseEnter={() => setHoveredCategoryId(slice.category.id)} onMouseLeave={() => setHoveredCategoryId(null)} onFocus={() => setHoveredCategoryId(slice.category.id)} onBlur={() => setHoveredCategoryId(null)}><title>{`${slice.category.name}: ${money(slice.category.total)} · ${slice.percentage}%`}</title></path>)}</svg><div className="pie-center"><b>{hoveredCategory ? `${hoveredCategory.percentage}%` : money(categoryTotal)}</b><small>{hoveredCategory ? hoveredCategory.category.name : 'Total pessoal'}</small></div></div><div className="pie-legend">{pieSlices.map(slice => <div key={slice.category.id}><span><i style={{ background: slice.category.color }} />{slice.category.name}</span><b>{money(slice.category.total)}</b></div>)}</div></div> : <div className="empty compact">Sem dados para este mês.</div>}</div>
            <div className="panel upcoming"><div className="panel-head"><div><h2>O que vem pela frente</h2><p>Valores pessoais já previstos</p></div><span className="calendar-icon">▦</span></div>{nextMonths.slice(1, 5).map(m => { const due = occurrences.filter(e => e.month === m); return <div className="upcoming-row" key={m}><span className="mini-date"><b>{m.slice(5)}</b><small>{m.slice(0, 4)}</small></span><span className="upcoming-name"><b>{monthName(m)}</b><small>{due.length} {due.length === 1 ? 'despesa' : 'despesas'}</small></span><b className="upcoming-value">{money(due.reduce((s, e) => s + personalValue(e), 0))}</b></div> })}<div className="future-note"><span>ⓘ</span> Sua parte após descontar os valores atribuídos a terceiros.</div></div>
            <div className="panel cards-summary-panel"><div className="panel-head"><div><h2>Resumo por cartão</h2><p>Faturas previstas em {monthName(month)} e fechamento</p></div><span className="calendar-icon">▣</span></div>{cardSummaries.length ? <div className="cards-summary-grid">{cardSummaries.map(({ card, invoiceTotal, personalPart, sharedPart, count, nextInvoiceTotal }) => <div className="card-summary-item" key={card.id}><div className="card-summary-top"><div className="card-summary-title"><span className="card-icon">▣</span><div><b>{card.name}</b><small>Fecha dia {card.closingDay} · Vence dia {card.dueDay}</small></div></div><button type="button" className="text-btn card-summary-link" onClick={() => openCardTransactions(card.id)}>Ver fatura →</button></div><div className="card-summary-amount"><span>Total da fatura ({count} {count === 1 ? 'item' : 'itens'})</span><strong>{money(invoiceTotal)}</strong></div><div className="card-summary-breakdown"><span>Sua parte: <b>{money(personalPart)}</b></span>{sharedPart > 0 && <span>Terceiros: <b>{money(sharedPart)}</b></span>}<span>Próx. mês: <b>{money(nextInvoiceTotal)}</b></span></div></div>)}</div> : <div className="empty compact">Nenhum cartão cadastrado. <button className="text-btn" onClick={() => { setView('Ajustes'); openCard() }}>Adicionar cartão →</button></div>}</div>
            <div className="panel reimbursement-panel"><div className="panel-head"><div><h2>Quem precisa te pagar</h2><p>Reembolsos deste mês e parcelas futuras</p></div><span className="stat-symbol orange">＋</span></div>{reimbursementByParticipant.length ? <>{reimbursementByParticipant.map(({ participant, current: thisMonth, future }) => <div className="reimbursement-row" key={participant.id}><div className="reimbursement-person"><span className="participant-avatar">{participant.name.slice(0, 1).toUpperCase()}</span><b>{participant.name}</b></div><div className="reimbursement-values"><span>Neste mês <b>{money(thisMonth)}</b></span><span>Parcelas futuras <b>{money(future)}</b></span></div></div>)}<div className="reimbursement-total"><span>Total a receber neste mês</span><b>{money(reimbursementTotal)}</b></div></> : <div className="empty compact">{(data.participants || []).length ? 'Adicione a parte de alguém em uma despesa para ver aqui quanto ela deve te pagar.' : <>Cadastre uma pessoa direto em uma despesa compartilhada. <button className="text-btn" onClick={openNewExpenseModal}>Nova despesa →</button></>}</div>}</div>
          </section>
        </> : view === 'Relatórios' ? <section className="data-page reports-page">
          <div className="reports-kpi-grid">
            <article className="panel report-kpi-card">
              <div className="stat-top"><span>Imediato vs. Fatura de cartão</span><span className="stat-symbol">⇄</span></div>
              <div className="report-kpi-split">
                <div><small>PIX, Débito e Dinheiro</small><strong>{money(directPersonalTotal)}</strong><span>{directSharePercent}% do mês</span></div>
                <div className="right"><small>Cartão de crédito</small><strong>{money(creditPersonalTotal)}</strong><span>{creditSharePercent}% do mês</span></div>
              </div>
              <div className="report-split-bar" aria-hidden="true">
                <i className="split-direct" style={{ width: `${total > 0 ? directSharePercent : 50}%` }} />
                <i className="split-credit" style={{ width: `${total > 0 ? creditSharePercent : 50}%` }} />
              </div>
            </article>
            <article className="panel report-kpi-card">
              <div className="stat-top"><span>Peso dos parcelamentos</span><span className="stat-symbol muted">◷</span></div>
              <strong>{money(installmentPersonalTotal)}</strong>
              <div className="stat-foot">{installmentOccurrences.length ? `${installmentSharePercent}% dos seus gastos vêm de ${installmentOccurrences.length} ${installmentOccurrences.length === 1 ? 'parcela ativa' : 'parcelas ativas'}` : 'Nenhuma parcela ativa neste mês'}</div>
              <div className="track report-kpi-track"><i style={{ width: `${Math.min(100, installmentSharePercent)}%`, background: '#6a7ba2' }} /></div>
            </article>
            <article className="panel report-kpi-card">
              <div className="stat-top"><span>Maior gasto pessoal e ticket médio</span><span className="stat-symbol orange">✳</span></div>
              <strong>{biggestPersonalExpense ? money(personalValue(biggestPersonalExpense)) : money(0)}</strong>
              <div className="stat-foot">{biggestPersonalExpense ? `${biggestPersonalExpense.description} · Ticket médio: ${money(averagePersonalTicket)}` : 'Adicione despesas para calcular o ticket médio'}</div>
            </article>
          </div>
          <div className="reports-panels-grid">
            <section className="panel report-panel">
              <div className="panel-head">
                <div><h2>Ranking por categoria</h2><p>Clique em uma categoria para filtrar a tabela abaixo.</p></div>
                {categoryFilter !== 'Todas as categorias' && <button type="button" className="text-btn" onClick={() => setCategoryFilter('Todas as categorias')}>Mostrar todas</button>}
              </div>
              {reportCategoryRanking.length ? <div className="report-ranking-list">
                {reportCategoryRanking.map(cat => {
                  const isActive = categoryFilter === cat.id
                  return <button type="button" key={cat.id} className={`report-ranking-row ${isActive ? 'is-active' : ''}`} onClick={() => setCategoryFilter(isActive ? 'Todas as categorias' : cat.id)}>
                    <div className="report-ranking-top">
                      <span className="report-ranking-name">
                        <i className="dot" style={{ background: cat.color }} />
                        <b>{cat.name}</b>
                        <small>{cat.count} {cat.count === 1 ? 'item' : 'itens'}</small>
                      </span>
                      <span className="report-ranking-values">
                        <span className={`report-diff-badge ${cat.diffPercent !== null && cat.diffPercent > 0 ? 'is-up' : cat.diffPercent !== null && cat.diffPercent < 0 ? 'is-down' : ''}`}>
                          {cat.total === 0 ? 'R$ 0 neste mês' : cat.diffPercent === null ? 'Novo no mês' : cat.diffPercent === 0 ? 'Igual ao mês ant.' : `${cat.diffPercent > 0 ? '↑' : '↓'} ${Math.abs(cat.diffPercent)}% vs. mês ant.`}
                        </span>
                        <b>{money(cat.total)}</b>
                        <small>{cat.percentage}%</small>
                      </span>
                    </div>
                    <div className="track"><i style={{ width: `${cat.total > 0 ? Math.max(4, cat.percentage) : 0}%`, background: cat.color }} /></div>
                  </button>
                })}
              </div> : <div className="empty compact">Sem gastos registrados neste mês para ranquear categorias.</div>}
            </section>
            <section className="panel report-panel">
              <div className="panel-head">
                <div><h2>Por forma de pagamento</h2><p>Compare gastos à vista (PIX, Débito, Dinheiro) e no Crédito.</p></div>
                {methodFilter !== 'Todos os pagamentos' && <button type="button" className="text-btn" onClick={() => setMethodFilter('Todos os pagamentos')}>Mostrar todos</button>}
              </div>
              <div className="report-ranking-list">
                {reportMethods.map(item => {
                  const isActive = methodFilter === item.method
                  return <button type="button" key={item.method} className={`report-ranking-row ${isActive ? 'is-active' : ''}`} onClick={() => { const next = isActive ? 'Todos os pagamentos' : item.method; setMethodFilter(next); if (next === 'PIX' || next === 'Débito' || next === 'Dinheiro') setCardFilter('Todos os cartões') }}>
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
                    <div className="track"><i style={{ width: `${item.personalTotal > 0 ? Math.max(4, item.percentage) : 0}%`, background: item.isCredit ? '#6a7ba2' : '#5b8a72' }} /></div>
                  </button>
                })}
              </div>
            </section>
          </div>
          {transactionTable}
        </section> : <section className="data-page">{transactionTable}</section>}
        <footer>Feito para trazer mais clareza ao seu dia a dia <span>✳</span><span>Seus dados ficam neste dispositivo</span></footer>
      </div>
    </main>

    {modal && <div className={`modal-backdrop ${closingModal === 'expense' ? 'is-closing' : ''}`} onMouseDown={e => { if (e.target === e.currentTarget) closeExpenseModal() }}><form noValidate className={`modal expense-modal ${formShake === 'expense' ? 'is-shaking' : ''}`} role="dialog" aria-modal="true" aria-labelledby="expense-modal-title" onSubmit={addExpense} onAnimationEnd={event => { if (event.animationName === 'nexus-modal-shake') setFormShake(null) }}>
      <div className="modal-header"><div><span className="eyebrow">{editingExpenseId ? 'EDITAR REGISTRO' : 'NOVO REGISTRO'}</span><h2 id="expense-modal-title">{editingExpenseId ? 'Editar lançamento' : 'Adicionar lançamento'}</h2></div><button type="button" aria-label="Fechar lançamento" onClick={closeExpenseModal}>×</button></div>
      <label className={expenseErrors.description ? 'is-invalid' : ''}>Descrição<input autoFocus={!isTouchDevice()} enterKeyHint="done" onKeyDown={dismissKeyboardOnEnter} aria-invalid={Boolean(expenseErrors.description)} placeholder="Ex.: mercado, conta de luz..." value={form.description} onChange={e => { clearFieldError(setExpenseErrors, 'description'); setForm({ ...form, description: e.target.value }) }} />{expenseErrors.description && <small className="field-error-msg" role="alert">{expenseErrors.description}</small>}</label>
      <div className="form-row"><label className={expenseErrors.amount ? 'is-invalid' : ''}>Valor total<div className="money-input-wrap"><span className="money-prefix" aria-hidden="true">R$</span><input type="text" inputMode="decimal" enterKeyHint="done" onKeyDown={dismissKeyboardOnEnter} aria-invalid={Boolean(expenseErrors.amount)} placeholder="0,00" value={form.amount} onChange={e => { clearFieldError(setExpenseErrors, 'amount'); setShareError(''); setForm({ ...form, amount: formatMoneyInput(e.target.value) }) }} /></div>{expenseErrors.amount && <small className="field-error-msg" role="alert">{expenseErrors.amount}</small>}</label><label className={expenseErrors.date ? 'is-invalid' : ''}>Data da compra<input type="date" aria-invalid={Boolean(expenseErrors.date)} value={form.date} onFocus={blurActiveInputOnTouch} onChange={e => { clearFieldError(setExpenseErrors, 'date'); setShareError(''); setForm({ ...form, date: e.target.value }) }} />{expenseErrors.date && <small className="field-error-msg" role="alert">{expenseErrors.date}</small>}</label></div>
      <div className="form-row"><label>Categoria<select value={form.category || data.categories[0]?.id || ''} onFocus={blurActiveInputOnTouch} onChange={e => setForm({ ...form, category: e.target.value })}>{data.categories.map(c => <option value={c.id} key={c.id}>{c.name}</option>)}</select></label><label>Forma de pagamento<select value={form.method} onFocus={blurActiveInputOnTouch} onChange={e => { const nextMethod = e.target.value as Method; const nextCardId = nextMethod.startsWith('Crédito') ? (form.cardId || data.cards[0]?.id || '') : form.cardId; const nextCard = data.cards.find(c => c.id === nextCardId) || data.cards[0]; clearFieldError(setExpenseErrors, 'installments'); setForm({ ...form, method: nextMethod, cardId: nextCardId, afterClosing: (nextCard?.closingDayRule ?? 'after') !== 'before' }) }}><option>PIX</option><option>Débito</option><option>Dinheiro</option><option>Crédito à vista</option><option>Crédito parcelado</option></select></label></div>
      {form.method.startsWith('Crédito') && <><label>Cartão<select value={form.cardId || data.cards[0]?.id || ''} onFocus={blurActiveInputOnTouch} onChange={e => { const nextCard = data.cards.find(c => c.id === e.target.value) || data.cards[0]; setForm({ ...form, cardId: e.target.value, afterClosing: (nextCard?.closingDayRule ?? 'after') !== 'before' }) }}>{data.cards.map(c => <option key={c.id} value={c.id}>{c.name} · fecha dia {c.closingDay} · vence dia {c.dueDay}</option>)}</select></label>{isFormOnClosingDay && selectedFormCard && <label>Compra no dia do fechamento (dia {selectedFormCard.closingDay})<select value={form.afterClosing ? 'after' : 'before'} onFocus={blurActiveInputOnTouch} onChange={e => setForm({ ...form, afterClosing: e.target.value === 'after' })}><option value="after">Após o fechamento da fatura (contabilizar no próximo mês)</option><option value="before">Antes do fechamento da fatura (contabilizar neste mês)</option></select></label>}{selectedFormCard && creditDueMonth && <div className="billing-preview"><span>◷</span><div>{form.method === 'Crédito parcelado' ? 'A 1ª parcela será contabilizada em' : 'Esta compra será contabilizada em'} <b>{monthName(creditDueMonth)}</b> (fechamento dia {selectedFormCard.closingDay} · vencimento dia {selectedFormCard.dueDay}).{Number(normalizedFormDate.slice(-2)) > selectedFormCard.closingDay ? ' Como a compra ocorreu após o fechamento, ela entra na próxima fatura.' : Number(normalizedFormDate.slice(-2)) === selectedFormCard.closingDay ? (form.afterClosing ? ' Fatura considerada fechada no momento da compra (próxima fatura).' : ' Fatura considerada aberta no momento da compra (fatura atual).') : ' Como a compra ocorreu antes do fechamento, ela entra na fatura atual.'}</div></div>}</>}
      {form.method === 'Crédito parcelado' && <label className={expenseErrors.installments ? 'is-invalid' : ''}>Número de parcelas<input type="text" inputMode="numeric" enterKeyHint="done" onKeyDown={dismissKeyboardOnEnter} aria-invalid={Boolean(expenseErrors.installments)} placeholder="2 a 60" value={form.installments} onChange={e => { clearFieldError(setExpenseErrors, 'installments'); setForm({ ...form, installments: e.target.value.replace(/\D/g, '').slice(0, 2) }) }} />{expenseErrors.installments ? <small className="field-error-msg" role="alert">{expenseErrors.installments}</small> : <small className="form-help">O valor será dividido automaticamente entre os meses.</small>}</label>}
      <fieldset className="participants-field"><legend>Alguém precisa te pagar?</legend>{(data.participants || []).length ? <><p>Informe quanto essa pessoa deve. Em compras parceladas, você pode atribuir o valor a todas as parcelas ou apenas a uma.</p>{(data.participants || []).map(participant => { const share = form.shares.find(item => item.participantId === participant.id); const shareErrorKey = `share-${participant.id}`; const participantError = expenseErrors[shareErrorKey]; return <div className="participant-share-row" key={participant.id}><label className="participant-check"><input type="checkbox" checked={Boolean(share)} onChange={e => { blurActiveInputOnTouch(); setShareError(''); clearFieldError(setExpenseErrors, shareErrorKey); setForm({ ...form, shares: e.target.checked ? [...form.shares, { participantId: participant.id, amount: '', installment: 'all' }] : form.shares.filter(item => item.participantId !== participant.id) }) }} /><span>{participant.name}</span></label>{share && <div className="participant-share-controls"><label className={`participant-amount ${participantError ? 'is-invalid' : ''}`}>Quanto?<div className="money-input-wrap compact"><span className="money-prefix" aria-hidden="true">R$</span><input aria-label={`Valor que ${participant.name} deve pagar`} aria-invalid={Boolean(participantError)} type="text" inputMode="decimal" enterKeyHint="done" onKeyDown={dismissKeyboardOnEnter} placeholder="0,00" value={share.amount} onChange={e => { clearFieldError(setExpenseErrors, shareErrorKey); setShareError(''); setForm({ ...form, shares: form.shares.map(item => item.participantId === participant.id ? { ...item, amount: formatMoneyInput(e.target.value) } : item) }) }} /></div>{participantError && <small className="field-error-msg" role="alert">{participantError}</small>}</label>{form.method === 'Crédito parcelado' && <label className="participant-scope">Cobrança<select aria-label={`Parcelas de ${participant.name}`} value={share.installment} onFocus={blurActiveInputOnTouch} onChange={e => setForm({ ...form, shares: form.shares.map(item => item.participantId === participant.id ? { ...item, installment: e.target.value } : item) })}><option value="all">Todas</option>{Array.from({ length: Math.max(2, Number(form.installments) || 2) }, (_, i) => <option key={i + 1} value={i + 1}>Só {i + 1}ª parcela</option>)}</select></label>}</div>}</div> })}<button type="button" className="inline-participant-btn" onClick={addParticipantFromExpense}>＋ Adicionar outra pessoa</button></> : <div className="participants-empty">Ainda não há pessoas cadastradas. <button type="button" className="inline-participant-btn" onClick={addParticipantFromExpense}>＋ Adicionar pessoa</button></div>}{shareError && <div className="share-error" role="alert">{shareError}</div>}</fieldset>
      <div className="modal-actions"><button type="button" className="cancel-btn" onClick={closeExpenseModal}>Cancelar</button><button className="primary" type="submit">{editingExpenseId ? 'Salvar alterações' : 'Salvar lançamento'}</button></div>
    </form></div>}

    {recurrenceEditor && <div className={`modal-backdrop ${closingModal === 'recurrence' ? 'is-closing' : ''}`} onMouseDown={event => { if (event.target === event.currentTarget) closeRecurrenceModal() }}><form noValidate className={`modal recurrence-modal ${formShake === 'recurrence' ? 'is-shaking' : ''}`} role="dialog" aria-modal="true" aria-labelledby="recurrence-modal-title" onSubmit={saveRecurrence} onAnimationEnd={event => { if (event.animationName === 'nexus-modal-shake') setFormShake(null) }}><div className="modal-header"><div><span className="eyebrow">DESPESA MENSAL</span><h2 id="recurrence-modal-title">{recurrenceEditor.id ? 'Editar recorrência' : 'Nova recorrência'}</h2></div><button type="button" aria-label="Fechar recorrência" onClick={closeRecurrenceModal}>×</button></div><label className={recurrenceErrors.description ? 'is-invalid' : ''}>Descrição<input autoFocus={!isTouchDevice()} enterKeyHint="done" onKeyDown={dismissKeyboardOnEnter} maxLength={70} aria-invalid={Boolean(recurrenceErrors.description)} placeholder="Ex.: Internet, academia..." value={recurrenceEditor.description} onChange={event => { clearFieldError(setRecurrenceErrors, 'description'); setRecurrenceEditor({ ...recurrenceEditor, description: event.target.value }) }} />{recurrenceErrors.description && <small className="field-error-msg" role="alert">{recurrenceErrors.description}</small>}</label><div className="form-row"><label className={recurrenceErrors.amount ? 'is-invalid' : ''}>Valor mensal<div className="money-input-wrap"><span className="money-prefix" aria-hidden="true">R$</span><input type="text" inputMode="decimal" enterKeyHint="done" onKeyDown={dismissKeyboardOnEnter} aria-invalid={Boolean(recurrenceErrors.amount)} placeholder="0,00" value={recurrenceEditor.amount} onChange={event => { clearFieldError(setRecurrenceErrors, 'amount'); setRecurrenceEditor({ ...recurrenceEditor, amount: formatMoneyInput(event.target.value) }) }} /></div>{recurrenceErrors.amount && <small className="field-error-msg" role="alert">{recurrenceErrors.amount}</small>}</label><label className={recurrenceErrors.day ? 'is-invalid' : ''}>Dia da cobrança<input type="text" inputMode="numeric" enterKeyHint="done" onKeyDown={dismissKeyboardOnEnter} aria-invalid={Boolean(recurrenceErrors.day)} placeholder="1 a 31" value={recurrenceEditor.day} onChange={event => { clearFieldError(setRecurrenceErrors, 'day'); setRecurrenceEditor({ ...recurrenceEditor, day: event.target.value.replace(/\D/g, '').slice(0, 2) }) }} />{recurrenceErrors.day && <small className="field-error-msg" role="alert">{recurrenceErrors.day}</small>}</label></div><div className="form-row"><label>Categoria<select value={recurrenceEditor.category} onFocus={blurActiveInputOnTouch} onChange={event => setRecurrenceEditor({ ...recurrenceEditor, category: event.target.value })}>{data.categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label><label>Pagamento<select value={recurrenceEditor.method} onFocus={blurActiveInputOnTouch} onChange={event => setRecurrenceEditor({ ...recurrenceEditor, method: event.target.value as Method })}><option>PIX</option><option>Débito</option><option>Dinheiro</option>{data.cards.length > 0 && <option>Crédito à vista</option>}</select></label></div>{recurrenceEditor.method.startsWith('Crédito') && <label>Cartão<select value={recurrenceEditor.cardId} onFocus={blurActiveInputOnTouch} onChange={event => setRecurrenceEditor({ ...recurrenceEditor, cardId: event.target.value })}>{data.cards.map(card => <option key={card.id} value={card.id}>{card.name}</option>)}</select></label>}<p className="form-help">A recorrência só vira lançamento quando você confirma na revisão mensal. Você pode pular uma cobrança ou pausar o modelo.</p><div className="modal-actions"><button type="button" className="cancel-btn" onClick={closeRecurrenceModal}>Cancelar</button><button className="primary" type="submit">{recurrenceEditor.id ? 'Salvar alterações' : 'Criar modelo'}</button></div></form></div>}
    {confirmDialog && <div className={`modal-backdrop ${closingModal === 'confirm' ? 'is-closing' : ''}`} onMouseDown={event => { if (event.target === event.currentTarget) closeConfirmDialog() }}>
      <section className="modal confirm-dialog-modal" role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title">
        <div className="modal-header">
          <div><span className="eyebrow">{confirmDialog.eyebrow}</span><h2 id="confirm-dialog-title">{confirmDialog.title}</h2></div>
          <button type="button" aria-label="Fechar confirmação" onClick={closeConfirmDialog}>×</button>
        </div>
        <p className="confirm-dialog-description">{confirmDialog.description}</p>
        <div className="modal-actions">
          <button type="button" className="cancel-btn" onClick={closeConfirmDialog}>Cancelar</button>
          <button type="button" className="danger-btn" onClick={confirmDialog.onConfirm}>{confirmDialog.confirmLabel}</button>
        </div>
      </section>
    </div>}
    {settingsModal && <div className={`modal-backdrop ${closingModal === 'settings' ? 'is-closing' : ''}`} onMouseDown={e => { if (e.target === e.currentTarget) closeSettingsModal() }}><form noValidate className={`modal settings-modal ${formShake === 'settings' ? 'is-shaking' : ''}`} role="dialog" aria-modal="true" aria-labelledby="settings-modal-title" onSubmit={saveSetting} onAnimationEnd={event => { if (event.animationName === 'nexus-modal-shake') setFormShake(null) }}><div className="modal-header"><div><span className="eyebrow">AJUSTES</span><h2 id="settings-modal-title">{settingsModal.id ? 'Editar' : 'Novo'} {settingsModal.kind === 'category' ? 'categoria' : settingsModal.kind === 'card' ? 'cartão' : 'participante'}</h2></div><button type="button" aria-label="Fechar ajustes" onClick={closeSettingsModal}>×</button></div><label className={settingsErrors.name ? 'is-invalid' : ''}>Nome<input autoFocus={!isTouchDevice()} enterKeyHint="done" onKeyDown={dismissKeyboardOnEnter} maxLength={40} aria-invalid={Boolean(settingsErrors.name)} placeholder={settingsModal.kind === 'category' ? 'Ex.: Educação' : settingsModal.kind === 'card' ? 'Ex.: Cartão principal' : 'Ex.: Maria'} value={settingsModal.name} onChange={e => { clearFieldError(setSettingsErrors, 'name'); setSettingsModal({ ...settingsModal, name: e.target.value }) }} />{settingsErrors.name && <small className="field-error-msg" role="alert">{settingsErrors.name}</small>}</label>{settingsModal.kind === 'category' ? <div className={`category-color-field ${settingsErrors.color ? 'is-invalid' : ''}`}><span className="category-color-label">Cor da categoria</span><div className="color-swatch-grid" role="radiogroup" aria-label="Paleta de cores da categoria">{CATEGORY_COLOR_PRESETS.map(preset => { const isSelected = settingsModal.color.toLowerCase() === preset.color.toLowerCase(); return <button key={preset.color} type="button" role="radio" aria-checked={isSelected} aria-label={preset.label} title={preset.label} className={`color-swatch ${isSelected ? 'is-selected' : ''}`} style={{ backgroundColor: preset.color }} onClick={() => { clearFieldError(setSettingsErrors, 'color'); setSettingsModal(current => current ? { ...current, color: preset.color } : current) }}>{isSelected && <span aria-hidden="true">✓</span>}</button> })}</div><label className={`custom-hex-row ${settingsErrors.color ? 'is-invalid' : ''}`}><span className="custom-hex-preview" style={{ backgroundColor: /^#[0-9a-fA-F]{6}$/.test(settingsModal.color) ? settingsModal.color : '#6e7f72' }} aria-hidden="true" /><span className="custom-hex-caption">Código da cor (HEX)</span><input type="text" maxLength={7} enterKeyHint="done" onKeyDown={dismissKeyboardOnEnter} aria-label="Código hexadecimal da cor" aria-invalid={Boolean(settingsErrors.color)} placeholder="#6E7F72" value={settingsModal.color.toUpperCase()} onChange={e => { clearFieldError(setSettingsErrors, 'color'); const raw = e.target.value.replace(/[^#0-9a-fA-F]/g, ''); const next = raw.startsWith('#') ? `#${raw.slice(1).replace(/#/g, '').slice(0, 6)}` : `#${raw.replace(/#/g, '').slice(0, 6)}`; setSettingsModal(current => current ? { ...current, color: next } : current) }} /></label>{settingsErrors.color && <small className="field-error-msg" role="alert">{settingsErrors.color}</small>}</div> : settingsModal.kind === 'card' ? <><div className="form-row"><label className={settingsErrors.closingDay ? 'is-invalid' : ''}>Dia de fechamento<input type="text" inputMode="numeric" enterKeyHint="done" onKeyDown={dismissKeyboardOnEnter} aria-invalid={Boolean(settingsErrors.closingDay)} placeholder="1 a 31" value={settingsModal.closingDay} onChange={e => { clearFieldError(setSettingsErrors, 'closingDay'); setSettingsModal({ ...settingsModal, closingDay: e.target.value.replace(/\D/g, '').slice(0, 2) }) }} />{settingsErrors.closingDay ? <small className="field-error-msg" role="alert">{settingsErrors.closingDay}</small> : <small className="form-help">Compras após este dia entram na próxima fatura.</small>}</label><label className={settingsErrors.dueDay ? 'is-invalid' : ''}>Dia de vencimento<input type="text" inputMode="numeric" enterKeyHint="done" onKeyDown={dismissKeyboardOnEnter} aria-invalid={Boolean(settingsErrors.dueDay)} placeholder="1 a 31" value={settingsModal.dueDay} onChange={e => { clearFieldError(setSettingsErrors, 'dueDay'); setSettingsModal({ ...settingsModal, dueDay: e.target.value.replace(/\D/g, '').slice(0, 2) }) }} />{settingsErrors.dueDay && <small className="field-error-msg" role="alert">{settingsErrors.dueDay}</small>}</label></div><label>Compras no dia do fechamento<select value={settingsModal.closingDayRule} onFocus={blurActiveInputOnTouch} onChange={e => setSettingsModal({ ...settingsModal, closingDayRule: e.target.value as ClosingDayRule })}><option value="after">Fatura já fechada (contabilizar na próxima fatura)</option><option value="before">Fatura ainda aberta (contabilizar na fatura atual)</option></select><small className="form-help">Regra padrão aplicada quando uma compra é feita no próprio dia de fechamento.</small></label></> : <p className="form-help participant-modal-help">Os valores atribuídos a esta pessoa ficarão associados aos lançamentos correspondentes e serão salvos apenas neste dispositivo.</p>}<div className="modal-actions"><button type="button" className="cancel-btn" onClick={closeSettingsModal}>Cancelar</button><button className="primary" type="submit">{settingsModal.id ? 'Salvar alterações' : 'Adicionar'}</button></div></form></div>}
    {pendingBackupImport && <div className={`modal-backdrop ${closingModal === 'backup' ? 'is-closing' : ''}`} onMouseDown={event => { if (event.target === event.currentTarget) closeBackupConfirmModal() }}><section className="modal backup-confirm-modal" role="dialog" aria-modal="true" aria-labelledby="backup-confirm-title"><div className="modal-header"><div><span className="eyebrow">SEUS DADOS</span><h2 id="backup-confirm-title">Importar backup?</h2></div><button type="button" aria-label="Fechar" onClick={closeBackupConfirmModal}>×</button></div><p>Esta ação vai substituir os dados salvos neste navegador.</p>{pendingBackupImport.preferences && <p>O arquivo também contém suas preferências, como tema, tela inicial, limite mensal e perfil.</p>}<div className="modal-actions"><button type="button" className="cancel-btn" onClick={closeBackupConfirmModal}>Cancelar</button><button type="button" className="primary" onClick={confirmBackupImport}>Importar e substituir</button></div></section></div>}
    {resetDataModalOpen && <div className={`modal-backdrop ${closingModal === 'reset' ? 'is-closing' : ''}`} onMouseDown={event => { if (event.target === event.currentTarget) closeResetDataModal() }}>
      <form noValidate className={`modal reset-data-modal ${formShake === 'reset' ? 'is-shaking' : ''}`} role="dialog" aria-modal="true" aria-labelledby="reset-data-title" onSubmit={confirmResetAllData} onAnimationEnd={event => { if (event.animationName === 'nexus-modal-shake') setFormShake(null) }}>
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
            autoFocus={!isTouchDevice()}
            type="text"
            enterKeyHint="done"
            onKeyDown={dismissKeyboardOnEnter}
            placeholder="Digite EXCLUIR"
            aria-invalid={resetConfirmError}
            value={resetConfirmText}
            onChange={event => {
              setResetConfirmText(event.target.value)
              if (resetConfirmError) setResetConfirmError(false)
            }}
          />
          {resetConfirmError && <small className="field-error-msg" role="alert">Digite exatamente a palavra EXCLUIR para liberar a limpeza dos dados.</small>}
        </label>
        <div className="modal-actions">
          <button type="button" className="cancel-btn" onClick={closeResetDataModal}>Cancelar</button>
          <button type="submit" className="danger-btn">Excluir tudo e recomeçar</button>
        </div>
      </form>
    </div>}
    {onboardingOpen && <div className={`modal-backdrop onboarding-backdrop ${closingModal === 'onboarding' ? 'is-closing' : ''}`}>
      <form noValidate className="modal onboarding-modal" role="dialog" aria-modal="true" aria-labelledby="onboarding-title" onSubmit={completeOnboarding}>
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
    {easterEggOpen && <div className={`modal-backdrop easter-egg-backdrop ${closingModal === 'easter-egg' ? 'is-closing' : ''}`} onMouseDown={event => { if (event.target === event.currentTarget) closeEasterEgg() }}>{easterEggMessage ? <section className="modal easter-egg-modal is-revealed" role="dialog" aria-modal="true" aria-labelledby="easter-egg-title"><div className="modal-header"><div><span className="eyebrow">SEGREDO DESBLOQUEADO</span><h2 id="easter-egg-title">Mensagem secreta</h2></div><button type="button" aria-label="Fechar" onClick={closeEasterEgg}>×</button></div><div className="easter-egg-reveal" role="status"><p>{easterEggMessage}</p></div><div className="modal-actions"><button type="button" className="cancel-btn" onClick={() => { setEasterEggMessage(''); setEasterEggPassword(''); setEasterEggError(false); setEasterEggShake(false); window.requestAnimationFrame(() => easterEggInputRef.current?.focus()) }}>Outra senha</button><button type="button" className="primary" onClick={closeEasterEgg}>Fechar</button></div></section> : <form noValidate className={`modal easter-egg-modal ${easterEggShake ? 'is-shaking' : ''}`} role="dialog" aria-modal="true" aria-labelledby="easter-egg-title" onSubmit={submitEasterEgg} onAnimationEnd={event => { if (event.animationName === 'nexus-modal-shake') setEasterEggShake(false) }}><div className="modal-header"><div><span className="eyebrow">SEGREDO DESBLOQUEADO</span><h2 id="easter-egg-title">Digite a senha</h2></div><button type="button" aria-label="Fechar" onClick={closeEasterEgg}>×</button></div><label className={easterEggError ? 'easter-egg-field is-invalid' : 'easter-egg-field'}>Senha<input ref={easterEggInputRef} type="password" aria-invalid={easterEggError} value={easterEggPassword} onChange={event => { setEasterEggPassword(event.target.value); if (easterEggError) setEasterEggError(false) }} placeholder="Digite a senha" />{easterEggError && <small className="field-error-msg" role="alert">Senha incorreta. Tente novamente.</small>}</label><div className="modal-actions"><button type="button" className="cancel-btn" onClick={closeEasterEgg}>Fechar</button><button className="primary" type="submit">Confirmar</button></div></form>}</div>}
    {pwaGuideOpen && <div className={`modal-backdrop ${closingModal === 'pwa-guide' ? 'is-closing' : ''}`} onMouseDown={event => { if (event.target === event.currentTarget) closePwaGuideModal() }}>
      <section className="modal pwa-guide-modal" role="dialog" aria-modal="true" aria-labelledby="pwa-guide-title">
        <div className="modal-header">
          <div><span className="eyebrow">APLICATIVO NA TELA INICIAL</span><h2 id="pwa-guide-title">Como instalar o Põe na Conta</h2></div>
          <button type="button" aria-label="Fechar instruções" onClick={closePwaGuideModal}>×</button>
        </div>
        <p className="confirm-dialog-description">Ao adicionar o ícone à tela inicial, o Põe na Conta abre em tela cheia (sem barra de endereço) e funciona 100% offline.</p>
        <div className="pwa-guide-steps">
          <div className="pwa-guide-card">
            <b>No iPhone / iPad (Safari)</b>
            <ol>
              <li>Toque no ícone <b>Compartilhar</b> (quadrado com seta para cima <b>↑</b>) na barra do Safari.</li>
              <li>Role a lista para baixo e toque em <b>Adicionar à Tela de Início</b>.</li>
              <li>Confirme tocando em <b>Adicionar</b> no canto superior direito.</li>
            </ol>
          </div>
          <div className="pwa-guide-card">
            <b>No Android (Chrome / Edge / Samsung)</b>
            <ol>
              <li>Toque no menu de três pontos (<b>⋮</b>) no canto do navegador.</li>
              <li>Selecione <b>Instalar aplicativo</b> ou <b>Adicionar à tela inicial</b>.</li>
              <li>Confirme a instalação para criar o atalho em tela cheia.</li>
            </ol>
          </div>
        </div>
        <div className="modal-actions">
          <button type="button" className="primary" onClick={closePwaGuideModal}>Entendi</button>
        </div>
      </section>
    </div>}
  </div>
}

export default App
