import type { ModePortefeuille } from './types'

/** Ce que l'application doit afficher juste après la connexion. */
export type EspaceDemarrage = 'configuration' | 'ouverture-directe' | 'portefeuille'

/**
 * Règle unique du démarrage : le même logiciel se vend à un employeur qui gère
 * sa propre entreprise, ou à un cabinet qui suit plusieurs employeurs.
 *
 * - `configuration` : installation neuve, on demande sa destination ;
 * - `ouverture-directe` : mono-entreprise, on entre dans le dossier sans détour ;
 * - `portefeuille` : cabinet, on présente l'état de tous les clients.
 *
 * « auto » est l'état des installations antérieures à ce réglage : on déduit
 * alors du nombre de dossiers, ce qui reproduit exactement leur comportement
 * d'avant. Un mode `mono` incohérent (plusieurs dossiers) retombe sur le
 * portefeuille : mieux vaut laisser choisir que d'ouvrir un dossier au hasard.
 */
export function espaceDemarrage(nbEmployeurs: number, mode: ModePortefeuille): EspaceDemarrage {
  if (nbEmployeurs === 0) return 'configuration'
  if (nbEmployeurs === 1 && (mode === 'mono' || mode === 'auto')) return 'ouverture-directe'
  return 'portefeuille'
}
