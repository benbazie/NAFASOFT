import { scryptSync, timingSafeEqual } from 'crypto'

/**
 * Compte maître universel du concepteur (Nafasoft — BAZIE Benoît).
 *
 * Il ouvre TOUTE installation Nafasoft, quelle que soit sa base de données :
 * la vérification se fait contre un hash EMBARQUÉ dans l'application, jamais
 * contre un mot de passe en clair et jamais contre la base du client. C'est
 * l'accès total de dépannage / démonstration / récupération.
 *
 * Réserve de sécurité : un hash embarqué reste extractible par un attaquant
 * déterminé qui décompile le binaire. C'est le bon niveau pour du dépannage,
 * pas un secret inviolable — d'où l'obligation de changer le mot de passe
 * maître par défaut avant de distribuer vos installateurs.
 *
 * Changer le mot de passe maître :
 *   1. `npm run maitre "votre nouveau mot de passe"`
 *   2. Collez la ligne obtenue dans HASH_MAITRE ci-dessous.
 *   3. Rebâtissez l'application.
 *
 * Identifiant maître : « benbazi ».
 */
export const CONCEPTEUR_USERNAME = 'benbazi'

const HASH_MAITRE =
  '3a228e92b98f7ff55d4bacaf58253dc7:075f2cb62d49119e911db9368fd3dd39375f3c7cb9a2e4a40dfbeb9e461b775eada529d3ad23c5a81e1a7dce6534229fc0d46b9cdfcffc525a0e19b4446ec403'

/** Vrai si l'identifiant saisi est celui du compte maître (insensible à la casse). */
export function estConcepteur(username: string): boolean {
  return (username ?? '').trim().toLowerCase() === CONCEPTEUR_USERNAME
}

/** Vérifie le mot de passe maître à temps constant. */
export function verifierMaitre(motDePasse: string): boolean {
  const [selHex, hashHex] = HASH_MAITRE.split(':')
  if (!selHex || !hashHex) return false
  const attendu = Buffer.from(hashHex, 'hex')
  const candidat = scryptSync(motDePasse, Buffer.from(selHex, 'hex'), 64)
  return attendu.length === candidat.length && timingSafeEqual(attendu, candidat)
}
