import { createContext, useContext } from 'react'
import type { SessionUtilisateur } from '../../../shared/types'

/** Session courante, fournie par App à tout l'arbre de l'espace de travail. */
export const SessionContexte = createContext<SessionUtilisateur | null>(null)

/**
 * Accès à la session et aux droits qui en découlent.
 * `peutRegler` : accès aux réglages (entreprise, barème) · concepteur et
 * administrateur uniquement. L'utilisateur ordinaire ne les voit pas.
 */
export function useSession(): { session: SessionUtilisateur | null; peutRegler: boolean } {
  const session = useContext(SessionContexte)
  return { session, peutRegler: session ? session.role !== 'utilisateur' : false }
}
