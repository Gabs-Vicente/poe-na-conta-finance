import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildOccurrences, cardDueMonth, createBackup, csvCell, expenseFirstMonth, formatMoneyInput, normalizeData, normalizeDateInput, parseBackup, parseBackupFile, parseMoneyInput, readStoredData, seed, validateData } from '../src/finance.ts'

const card = { id: 'card', name: 'Principal', closingDay: 25, dueDay: 5, closingDayRule: 'after' }
const cardClosing30 = { id: 'card30', name: 'Cartão dia 30', closingDay: 30, dueDay: 10, closingDayRule: 'after' }

test('calcula o mês da fatura antes, no fechamento (configurável) e depois do fechamento', () => {
  assert.equal(cardDueMonth('2026-11-13', card), '2026-11')
  assert.equal(cardDueMonth('2026-11-24', card), '2026-11')
  assert.equal(cardDueMonth('2026-11-25', card), '2026-12')
  assert.equal(cardDueMonth('2026-11-25', card, false), '2026-11')
  assert.equal(cardDueMonth('2026-11-25', { ...card, closingDayRule: 'before' }), '2026-11')
  assert.equal(cardDueMonth('2026-11-26', card), '2026-12')

  // Exemplo do cartão com fechamento no dia 30:
  assert.equal(cardDueMonth('2026-11-28', cardClosing30), '2026-11')
  assert.equal(cardDueMonth('2026-11-29', cardClosing30), '2026-11')
  assert.equal(cardDueMonth('2026-11-30', cardClosing30, true), '2026-12')
  assert.equal(cardDueMonth('2026-11-30', cardClosing30, false), '2026-11')
  assert.equal(cardDueMonth('2026-12-01', cardClosing30), '2026-12')
})

test('contabiliza compras no PIX, débito ou dinheiro diretamente no mês da compra', () => {
  assert.equal(expenseFirstMonth('2026-11-13', 'PIX', cardClosing30), '2026-11')
  assert.equal(expenseFirstMonth('2026-11-20', 'Débito', cardClosing30), '2026-11')
  assert.equal(expenseFirstMonth('2026-11-25', 'Dinheiro', cardClosing30), '2026-11')
  assert.equal(expenseFirstMonth('2026-11-30', 'PIX', card), '2026-11')
})

test('distribui compra parcelada no crédito (ex.: R$ 600 em 3x de R$ 200) para cada respectiva fatura', () => {
  const firstMonth = expenseFirstMonth('2026-11-13', 'Crédito parcelado', card)
  assert.equal(firstMonth, '2026-11')
  const expense = { id: 'parcelado-600', description: 'Compra parcelada', amount: 600, date: '2026-11-13', category: 'lazer', method: 'Crédito parcelado', cardId: card.id, installments: 3, firstMonth }
  const occurrences = buildOccurrences([expense])
  assert.deepEqual(occurrences.map(item => ({ month: item.month, value: item.value, part: item.part })), [
    { month: '2026-11', value: 200, part: 1 },
    { month: '2026-12', value: 200, part: 2 },
    { month: '2027-01', value: 200, part: 3 },
  ])
})

test('migra lançamentos existentes no crédito preservando dados e ajustando o mês da fatura', () => {
  const legacyPayload = {
    ...seed,
    expenses: [
      { id: 'legacy-credit', description: 'Compra hoje no crédito', amount: 150, date: '2026-11-13', category: 'alimentacao', method: 'Crédito à vista', cardId: 'principal', installments: 1, firstMonth: '2026-12' },
    ],
  }
  const normalized = normalizeData(legacyPayload)
  assert.equal(normalized?.expenses[0]?.firstMonth, '2026-11')
})

test('divide parcelas em centavos sem perder o valor total', () => {
  const expense = { id: 'split', description: 'Compra', amount: 10, date: '2026-11-01', category: 'misc', method: 'Crédito parcelado', installments: 3, firstMonth: '2026-11' }
  const occurrences = buildOccurrences([expense])
  assert.deepEqual(occurrences.map(item => item.value), [3.34, 3.33, 3.33])
  assert.equal(occurrences.reduce((sum, item) => sum + Math.round(item.value * 100), 0), 1000)
  assert.deepEqual(occurrences.map(item => item.month), ['2026-11', '2026-12', '2027-01'])
})

test('divide reembolso entre parcelas sem superar a parte correspondente', () => {
  const expense = { id: 'share', description: 'Compra', amount: 10, date: '2026-11-01', category: 'misc', method: 'Crédito parcelado', installments: 3, firstMonth: '2026-11', shares: [{ participantId: 'p1', amount: 4 }] }
  const occurrences = buildOccurrences([expense])
  assert.deepEqual(occurrences.map(item => item.allocatedShares[0]?.amount), [1.34, 1.33, 1.33])
})

test('valida dados e recupera apenas com envelope de backup suportado', () => {
  assert.equal(validateData(seed), true)
  assert.deepEqual(parseBackup(createBackup(seed)), { ...seed, recurrences: [] })
  assert.equal(parseBackup(JSON.stringify({ format: 'nexus-finance-backup', version: 2, data: seed })), null)
  const loaded = readStoredData('{invalid json')
  assert.ok(loaded.warning)
  assert.equal(loaded.data.expenses.length, seed.expenses.length)
})

test('exporta e restaura preferências de perfil em backups versão 3', () => {
  const preferences = { monthlyLimit: '1000', limitNoticePercent: '80', defaultView: 'Visão geral', theme: 'dark', profileName: 'Ana Souza', profilePhoto: 'data:image/png;base64,aGVsbG8=' }
  const parsed = parseBackupFile(createBackup(seed, preferences))
  assert.equal(parsed?.preferences?.profileName, 'Ana Souza')
  assert.equal(parsed?.preferences?.profilePhoto, preferences.profilePhoto)
  assert.equal(parsed?.preferences?.theme, 'dark')

  const invalid = JSON.parse(createBackup(seed, preferences))
  invalid.preferences.profilePhoto = 'https://example.com/avatar.png'
  assert.equal(parseBackupFile(JSON.stringify(invalid)), null)

  const defaultProfile = { ...preferences, profileName: '', profilePhoto: '' }
  assert.deepEqual(parseBackupFile(createBackup(seed, defaultProfile))?.preferences?.profileName, '')
  assert.equal(parseBackupFile(createBackup(seed, defaultProfile))?.preferences?.profilePhoto, '')
})

test('protege valores não confiáveis contra fórmulas e escapa separadores CSV', () => {
  assert.equal(csvCell('=1+1', true), '"\'=1+1"')
  assert.equal(csvCell('texto; com "aspas"'), '"texto; com ""aspas"""')
  assert.equal(csvCell(12.5), '"12.5"')
})

test('interpreta valores monetários com vírgula ou ponto e datas no formato brasileiro (Mac/Safari)', () => {
  assert.equal(formatMoneyInput('1'), '0,01')
  assert.equal(formatMoneyInput('0,015'), '0,15')
  assert.equal(formatMoneyInput('15050'), '150,50')
  assert.equal(formatMoneyInput('125050'), '1.250,50')
  assert.equal(formatMoneyInput('0,0'), '')
  assert.equal(formatMoneyInput(1850), '1.850,00')
  assert.equal(parseMoneyInput('150,50'), 150.5)
  assert.equal(parseMoneyInput('1.250,50'), 1250.5)
  assert.equal(parseMoneyInput('150.50'), 150.5)
  assert.equal(parseMoneyInput('R$ 89,90'), 89.9)
  assert.equal(normalizeDateInput('13/11/2026'), '2026-11-13')
  assert.equal(normalizeDateInput('2026-11-13'), '2026-11-13')

  const macPayload = {
    ...seed,
    expenses: [
      { id: 'mac-1', description: 'Café', amount: '18,50', date: '13/11/2026', category: '', method: 'PIX', installments: '1', firstMonth: '2026-11' },
    ],
  }
  const normalized = normalizeData(macPayload)
  assert.equal(normalized?.expenses[0]?.amount, 18.5)
  assert.equal(normalized?.expenses[0]?.date, '2026-11-13')
  assert.equal(normalized?.expenses[0]?.category, 'moradia')

  const withCorruptedNullAmount = JSON.stringify({
    ...seed,
    expenses: [
      ...seed.expenses,
      { id: 'nan-bug', description: 'Falha vírgula', amount: null, date: '2026-11-13', category: 'moradia', method: 'PIX', installments: 1, firstMonth: '2026-11' },
    ],
  })
  const recovered = readStoredData(withCorruptedNullAmount)
  assert.equal(recovered.warning, undefined)
  assert.equal(recovered.data.expenses.length, seed.expenses.length)
})
