// Utilitaires de formatage et de dates, côté interface.

export function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  if (!y || !m || !d) return iso
  return `${d}/${m}/${y}`
}

// Devise : Franc CFA (FCFA / XOF) · sans sous-unité, donc sans décimales.
export const DEVISE = 'FCFA'

export function formatMoney(n: number | null): string {
  if (n == null) return '—'
  return Math.round(n).toLocaleString('fr-FR', { maximumFractionDigits: 0 }) + ' ' + DEVISE
}

export function formatHeures(n: number): string {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' h'
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

/** Nombre de jours (inclus) entre deux dates ISO. */
export function nbJours(debut: string, fin: string): number {
  const d1 = new Date(debut + 'T00:00:00')
  const d2 = new Date(fin + 'T00:00:00')
  const diff = Math.round((d2.getTime() - d1.getTime()) / 86400000)
  return diff >= 0 ? diff + 1 : 0
}

export function initiales(prenom: string, nom: string): string {
  return `${(prenom[0] ?? '').toUpperCase()}${(nom[0] ?? '').toUpperCase()}`
}

/** Retourne { start, end } (lundi-dimanche) de la semaine contenant `ref`. */
export function semaineRange(ref: Date): { start: string; end: string } {
  const day = (ref.getDay() + 6) % 7
  const monday = new Date(ref)
  monday.setDate(ref.getDate() - day)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  const fmt = (d: Date): string => {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const j = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${j}`
  }
  return { start: fmt(monday), end: fmt(sunday) }
}

export const JOURS_SEMAINE = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']

export function labelJour(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  const jour = (d.getDay() + 6) % 7
  return JOURS_SEMAINE[jour]
}
