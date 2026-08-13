import {
  CONFIG_DEFAUT,
  PARAMS_PAIE_DEFAUT,
  type AppConfig,
  type PayrollSettings
} from '../../../shared/types'

const CLE = 'config'
const CLE_PAIE = 'params_paie'

/** Charge la configuration de l'entreprise, complétée par les valeurs par défaut. */
export async function chargerConfig(): Promise<AppConfig> {
  const brut = await window.api.settings.get(CLE)
  if (!brut) return { ...CONFIG_DEFAUT }
  try {
    return { ...CONFIG_DEFAUT, ...(JSON.parse(brut) as Partial<AppConfig>) }
  } catch {
    return { ...CONFIG_DEFAUT }
  }
}

export async function sauverConfig(config: AppConfig): Promise<void> {
  await window.api.settings.set(CLE, JSON.stringify(config))
}

/** Charge les paramètres sociaux et fiscaux (CNSS, IUTS, heures sup). */
export async function chargerParamsPaie(): Promise<PayrollSettings> {
  const brut = await window.api.settings.get(CLE_PAIE)
  if (!brut) return { ...PARAMS_PAIE_DEFAUT }
  try {
    return { ...PARAMS_PAIE_DEFAUT, ...(JSON.parse(brut) as Partial<PayrollSettings>) }
  } catch {
    return { ...PARAMS_PAIE_DEFAUT }
  }
}

export async function sauverParamsPaie(params: PayrollSettings): Promise<void> {
  await window.api.settings.set(CLE_PAIE, JSON.stringify(params))
}

/** Formate un montant dans la devise indiquée (sans décimale). */
export function montant(n: number, devise: string): string {
  return Math.round(n).toLocaleString('fr-FR', { maximumFractionDigits: 0 }) + ' ' + devise
}

/** Ajoute `mois` mois à une date ISO (YYYY-MM-DD) et renvoie une date ISO. */
export function ajouterMois(iso: string, mois: number): string {
  const d = new Date(iso + 'T00:00:00')
  const jour = d.getDate()
  d.setMonth(d.getMonth() + mois)
  // Corrige les débordements (ex. 31 janv. + 1 mois).
  if (d.getDate() < jour) d.setDate(0)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const j = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${j}`
}
