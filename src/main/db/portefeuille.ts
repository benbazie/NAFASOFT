import Database from 'better-sqlite3'
import { join } from 'path'
import { existsSync } from 'fs'
import { dossierDonnees, employeursRepo } from './employeurs'
import { estimerPenalites } from '../../shared/penalites'
import { PARAMS_PAIE_DEFAUT } from '../../shared/types'
import { employeurOuvert } from './index'
import type { BilanEmployeur } from '../../shared/types'

/**
 * Bilan de tous les employeurs du portefeuille.
 *
 * Chaque base est ouverte **en lecture seule** le temps de lire quelques
 * compteurs, puis refermée : le cabinet voit l'état de tous ses clients sans
 * qu'aucune base ne reste verrouillée, et sans jamais mélanger leurs données.
 * La base de l'employeur déjà ouvert est sautée puis lue à part, pour ne pas
 * l'ouvrir deux fois.
 */
export function bilanPortefeuille(): BilanEmployeur[] {
  const auj = new Date().toISOString().slice(0, 10)
  const mois = auj.slice(0, 7)
  const ouvert = employeurOuvert()

  return employeursRepo.list(false).map((e) => {
    const base: BilanEmployeur = {
      id: e.id,
      nom: e.nom,
      ville: e.ville,
      numero_cnss: e.numero_cnss,
      couleur: e.couleur,
      logo: e.logo,
      effectif: 0,
      masse_mois: 0,
      bulletins_attente: 0,
      net_du: 0,
      declaration_retard: false,
      jours_echeance: null,
      contrats_echeance: 0,
      alertes: 0,
      majoration_estimee: 0
    }

    const chemin = join(dossierDonnees(), e.fichier)
    if (!existsSync(chemin)) return { ...base, erreur: 'base non créée' }

    let db: Database.Database | null = null
    try {
      // `readonly` évite tout verrou d'écriture ; `fileMustExist` protège
      // d'une création accidentelle de base vide au moindre chemin erroné.
      db = new Database(chemin, { readonly: true, fileMustExist: true })

      // Chaque client a SES taux : on lit son barème dans SA base, sinon un
      // cabinet chiffrerait tous ses dossiers avec le barème d'un seul.
      const params = (() => {
        try {
          const brut = db!
            .prepare(`SELECT valeur FROM settings WHERE cle = 'params_paie'`)
            .get() as { valeur: string | null } | undefined
          return brut?.valeur
            ? { ...PARAMS_PAIE_DEFAUT, ...(JSON.parse(brut.valeur) as object) }
            : { ...PARAMS_PAIE_DEFAUT }
        } catch {
          return { ...PARAMS_PAIE_DEFAUT }
        }
      })()

      const un = <T>(sql: string, ...p: unknown[]): T | undefined => {
        try {
          return db!.prepare(sql).get(...p) as T | undefined
        } catch {
          // Base d'une version antérieure : la table peut manquer.
          return undefined
        }
      }

      base.effectif =
        un<{ n: number }>(`SELECT COUNT(*) AS n FROM employees WHERE statut = 'actif'`)?.n ?? 0

      const paie = un<{ brut: number; net: number; nb: number }>(
        `SELECT COALESCE(SUM(brut),0) AS brut, COALESCE(SUM(net_a_payer),0) AS net,
                COUNT(*) AS nb
           FROM payslips WHERE substr(periode_debut, 1, 7) = ?`,
        mois
      )
      base.masse_mois = paie?.brut ?? 0

      const impayes = un<{ nb: number; net: number }>(
        `SELECT COUNT(*) AS nb, COALESCE(SUM(net_a_payer),0) AS net
           FROM payslips WHERE statut <> 'Payé'`
      )
      base.bulletins_attente = impayes?.nb ?? 0
      base.net_du = impayes?.net ?? 0

      const decl = un<{ date_limite: string; total_cotisations: number }>(
        `SELECT date_limite, total_cotisations FROM declarations
          WHERE statut <> 'Déposée' AND date_limite IS NOT NULL
          ORDER BY date_limite LIMIT 1`
      )
      if (decl?.date_limite) {
        const jours = Math.round(
          (new Date(decl.date_limite + 'T00:00:00').getTime() -
            new Date(auj + 'T00:00:00').getTime()) /
            86400000
        )
        base.jours_echeance = jours
        base.declaration_retard = jours < 0
        // Le cabinet priorise ses dépôts au coût du retard, pas à son ancienneté.
        base.majoration_estimee = estimerPenalites(
          decl.date_limite,
          Math.round(decl.total_cotisations ?? 0),
          params
        ).majoration_retard
      }

      base.contrats_echeance =
        un<{ n: number }>(
          `SELECT COUNT(*) AS n FROM employees
            WHERE statut = 'actif' AND date_fin_contrat IS NOT NULL
              AND date_fin_contrat <= date('now', '+30 day')`
        )?.n ?? 0

      base.alertes =
        (base.declaration_retard ? 1 : 0) +
        (base.bulletins_attente > 0 ? 1 : 0) +
        (base.contrats_echeance > 0 ? 1 : 0)

      return base
    } catch (err) {
      // L'employeur courant garde sa base ouverte en écriture : sur certains
      // systèmes l'ouverture concurrente échoue. On le signale sans casser la vue.
      return {
        ...base,
        erreur: e.id === ouvert ? 'employeur ouvert' : String((err as Error).message ?? err)
      }
    } finally {
      db?.close()
    }
  })
}
