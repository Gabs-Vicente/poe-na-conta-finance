import type React from 'react'

export type MainView = 'Visão geral' | 'Lançamentos' | 'Relatórios' | 'Recorrências' | 'Ajustes'
export type SortOrder = 'date-desc' | 'date-asc' | 'value-desc' | 'value-asc' | 'desc-asc'

export const money = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export const monthName = (key: string) => {
  const [y, m] = key.split('-').map(Number)
  return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(new Date(y, m - 1, 1))
}

export const shortMonthYear = (key: string) => {
  const [y, m] = key.split('-').map(Number)
  return new Intl.DateTimeFormat('pt-BR', { month: 'short', year: 'numeric' }).format(new Date(y, m - 1, 1)).replace('.', '')
}

export const piePoint = (degrees: number, radius: number) => {
  const angle = (degrees - 90) * Math.PI / 180
  return [50 + radius * Math.cos(angle), 50 + radius * Math.sin(angle)]
}

export const donutSlice = (start: number, end: number) => {
  const outerStart = piePoint(start, 46)
  const outerEnd = piePoint(end, 46)
  const innerEnd = piePoint(end, 28)
  const innerStart = piePoint(start, 28)
  const largeArc = end - start > 180 ? 1 : 0
  return `M ${outerStart[0]} ${outerStart[1]} A 46 46 0 ${largeArc} 1 ${outerEnd[0]} ${outerEnd[1]} L ${innerEnd[0]} ${innerEnd[1]} A 28 28 0 ${largeArc} 0 ${innerStart[0]} ${innerStart[1]} Z`
}

export const isTouchDevice = () => typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches

export const blurActiveInputOnTouch = () => {
  if (isTouchDevice() && document.activeElement instanceof HTMLInputElement) {
    document.activeElement.blur()
  }
}

export const dismissKeyboardOnEnter = (event: React.KeyboardEvent<HTMLInputElement>) => {
  if (event.key === 'Enter' && isTouchDevice()) {
    event.preventDefault()
    event.currentTarget.blur()
  }
}

export const profileInitials = (name: string) =>
  name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(part => Array.from(part)[0]?.toLocaleUpperCase('pt-BR') || '').join('')

export const createId = () =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`

export const categorySymbol = (categoryId: string) =>
  categoryId === 'moradia' ? '⌂' : categoryId === 'alimentacao' ? '◒' : categoryId === 'transporte' ? '⌁' : categoryId === 'lazer' ? '✧' : '＋'
