import type { Employee } from '../../../shared/types'
import { todayISO } from './format'

export interface AlerteContrat {
  employee: Employee
  jours: number // jours restants avant la fin (négatif si déjà expiré)
  expire: boolean
}

/** Nombre de jours entre aujourd'hui et une date ISO (positif = futur). */
function joursRestants(iso: string): number {
  const d1 = new Date(todayISO() + 'T00:00:00').getTime()
  const d2 = new Date(iso + 'T00:00:00').getTime()
  return Math.round((d2 - d1) / 86400000)
}

/**
 * Contrats actifs ayant une date de fin dans les 30 prochains jours (ou déjà
 * dépassée). Triés du plus urgent au moins urgent.
 */
export function alertesContrats(employes: Employee[], seuilJours = 30): AlerteContrat[] {
  return employes
    .filter((e) => e.statut === 'actif' && e.date_fin_contrat)
    .map((e) => {
      const jours = joursRestants(e.date_fin_contrat as string)
      return { employee: e, jours, expire: jours < 0 }
    })
    .filter((a) => a.jours <= seuilJours)
    .sort((a, b) => a.jours - b.jours)
}
