import type { BilanPeriode, EtatComparaison } from '../../../shared/types'
import { formatMoney } from '../lib/format'

const LIBELLE_ETAT: Record<EtatComparaison, string> = {
  identique: 'Inchangé',
  modifie: 'Modifié',
  nouveau: 'Nouveau salarié',
  retire: 'Absent du calcul'
}

const CLASSE_ETAT: Record<EtatComparaison, string> = {
  identique: 'badge-succes',
  modifie: 'badge-alerte',
  nouveau: 'badge-info',
  retire: 'badge-erreur'
}

/** Montants et durées ne s'affichent pas de la même façon. */
function valeur(libelle: string, n: number): string {
  if (libelle.startsWith('Heures')) return `${n.toFixed(2)} h`
  if (libelle.startsWith('Jours')) return `${n} j`
  return formatMoney(n)
}

/**
 * Confrontation des bulletins déjà archivés avec le calcul du jour.
 * Affiché avant d'écraser une période, pour que la décision soit prise en
 * connaissance de ce qui a bougé.
 */
export function BilanArchive({
  bilan,
  onApercu,
  onImprimer,
  onEcraser,
  onFermer
}: {
  bilan: BilanPeriode
  onApercu: () => void
  onImprimer: () => void
  onEcraser: () => void
  onFermer: () => void
}): JSX.Element {
  const divergent = bilan.nb_modifies + bilan.nb_nouveaux + bilan.nb_retires
  const aVoir = bilan.comparaisons.filter((c) => c.etat !== 'identique')

  return (
    <div className={`carte encadre-bilan ${divergent > 0 ? 'diverge' : ''}`}>
      <div className="bilan-entete">
        <div>
          <strong>
            {bilan.nb_archives} bulletin(s) déjà archivé(s) pour cette période
          </strong>
          <div className="texte-petit texte-gris">
            {divergent === 0
              ? 'Le calcul du jour donne exactement les mêmes montants · rien à refaire.'
              : `${bilan.nb_modifies} modifié(s), ${bilan.nb_nouveaux} nouveau(x), ${bilan.nb_retires} disparu(s) depuis l'archivage.`}
          </div>
        </div>
        <div className="groupe" style={{ display: 'flex', gap: 'var(--e2)' }}>
          <button className="btn btn-secondaire btn-sm" onClick={onApercu}>
            Prévisualiser
          </button>
          <button className="btn btn-secondaire btn-sm" onClick={onImprimer}>
            Imprimer
          </button>
          <button
            className={`btn btn-sm ${divergent > 0 ? 'btn-primaire' : 'btn-secondaire'}`}
            onClick={onEcraser}
          >
            Écraser et réémettre
          </button>
          <button className="btn-discret btn-sm" onClick={onFermer} aria-label="Masquer">
            ✕
          </button>
        </div>
      </div>

      {aVoir.length > 0 && (
        <div className="tableau-conteneur" style={{ marginTop: 'var(--e3)' }}>
          <table>
            <thead>
              <tr>
                <th>Salarié</th>
                <th>Code</th>
                <th>État</th>
                <th>Écarts constatés</th>
              </tr>
            </thead>
            <tbody>
              {aVoir.map((c) => (
                <tr key={c.employee_id}>
                  <td className="cellule-principale">
                    {c.nom.toUpperCase()} {c.prenom}
                  </td>
                  <td className="mono texte-petit texte-gris">{c.reference ?? 'Non renseigné'}</td>
                  <td>
                    <span className={`badge ${CLASSE_ETAT[c.etat]}`}>{LIBELLE_ETAT[c.etat]}</span>
                  </td>
                  <td>
                    {c.ecarts.length === 0 ? (
                      <span className="texte-gris texte-petit">Non renseigné</span>
                    ) : (
                      <div className="liste-ecarts">
                        {c.ecarts.map((e) => (
                          <div key={e.libelle} className="ecart">
                            <span className="ecart-libelle">{e.libelle}</span>
                            <span className="ecart-avant">{valeur(e.libelle, e.avant)}</span>
                            <span className="ecart-fleche">→</span>
                            <span className="ecart-apres">{valeur(e.libelle, e.apres)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="texte-xs texte-gris" style={{ marginTop: 'var(--e2)' }}>
        Écraser supprime les bulletins archivés de la période et les réémet avec les valeurs
        du jour · les codes sont réattribués et l'opération est irréversible.
      </p>
    </div>
  )
}
