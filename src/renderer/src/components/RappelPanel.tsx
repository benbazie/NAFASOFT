import { useState } from 'react'
import type { MoisRappel, PayrollSettings, ResultatRappel } from '../../../shared/types'
import { formatMoney } from '../lib/format'
import { estimerPenalites } from '../../../shared/penalites'
import { Icone } from './Icones'
import { Confirm } from './Confirm'

const msg = (e: unknown): string => String((e as Error)?.message ?? e)

/** Mois précédent, au format YYYY-MM : on ne rattrape pas un mois en cours. */
function moisPrecedent(): string {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() - 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function moisMoins(n: number): string {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() - n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const LIBELLE_MOIS = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'
]

function libelle(cle: string): string {
  const [a, m] = cle.split('-')
  return `${LIBELLE_MOIS[Number(m) - 1]} ${a}`
}

/** Dernier jour d'un mois YYYY-MM. */
function finDeMois(cle: string): string {
  const [a, m] = cle.split('-').map(Number)
  return `${cle}-${String(new Date(Date.UTC(a, m, 0)).getUTCDate()).padStart(2, '0')}`
}

/**
 * Rappel des périodes passées.
 *
 * On enregistre un salarié dont le contrat court depuis des mois : il faut
 * alors reconstituer tout l'arriéré de bulletins avant de pouvoir déclarer à
 * la CNSS. Un bulletin étant mensuel, rattraper une année, c'est douze
 * bulletins · d'où le calcul mois par mois plutôt qu'un seul document couvrant
 * la période entière.
 */
export function RappelPanel({ settings }: { settings: PayrollSettings }): JSX.Element {
  const [debut, setDebut] = useState(moisMoins(12))
  const [fin, setFin] = useState(moisPrecedent())
  const [mois, setMois] = useState<MoisRappel[] | null>(null)
  const [resultat, setResultat] = useState<ResultatRappel | null>(null)
  const [erreur, setErreur] = useState('')
  const [occupe, setOccupe] = useState(false)
  const [confirmation, setConfirmation] = useState(false)

  async function analyser(): Promise<void> {
    setErreur('')
    setResultat(null)
    setOccupe(true)
    try {
      setMois(await window.api.rappel.apercu(`${debut}-01`, finDeMois(fin), settings))
    } catch (e) {
      setErreur(msg(e))
    } finally {
      setOccupe(false)
    }
  }

  async function executer(): Promise<void> {
    setConfirmation(false)
    setOccupe(true)
    try {
      setResultat(await window.api.rappel.executer(`${debut}-01`, finDeMois(fin), settings))
      setMois(await window.api.rappel.apercu(`${debut}-01`, finDeMois(fin), settings))
    } catch (e) {
      setErreur(msg(e))
    } finally {
      setOccupe(false)
    }
  }

  const aFaire = mois?.filter((m) => m.effectif > 0 && m.deja_archives === 0) ?? []

  // Un arriéré est hors délai par construction : la majoration se cumule mois
  // par mois, chacun avec sa propre ancienneté. Un total unique calculé sur la
  // période entiere sous-estimerait les mois les plus anciens.
  const majorations = (mois ?? []).reduce((total, m) => {
    if (m.cotisations <= 0) return total
    // Échéance CNSS usuelle : le 20 du mois suivant la période.
    const [a, mo] = m.cle.split('-').map(Number)
    const suivant = mo === 12 ? `${a + 1}-01` : `${a}-${String(mo + 1).padStart(2, '0')}`
    return total + estimerPenalites(`${suivant}-20`, m.cotisations, settings).majoration_retard
  }, 0)
  const totaux = mois
    ? {
        brut: mois.reduce((s, m) => s + m.brut, 0),
        cotisations: mois.reduce((s, m) => s + m.cotisations, 0),
        net: mois.reduce((s, m) => s + m.net, 0)
      }
    : null

  return (
    <div className="rp">
      <div className="rp-intro">
        <Icone nom="declarations" size={22} />
        <p>
          Un salarié dont le contrat a commencé il y a plusieurs mois n’a aucun bulletin pour
          les mois écoulés · et sans bulletin, une déclaration CNSS reste vide. Ce rappel
          reconstitue l’arriéré mois par mois. Les mois déjà archivés ne sont jamais réécrits.
        </p>
      </div>

      <div className="rp-barre">
        <label>
          Du mois de
          <input type="month" value={debut} onChange={(e) => setDebut(e.target.value)} />
        </label>
        <label>
          au mois de
          <input type="month" value={fin} onChange={(e) => setFin(e.target.value)} />
        </label>
        <button
          className="btn btn-secondaire"
          disabled={occupe || !debut || !fin || debut > fin}
          onClick={() => void analyser()}
        >
          {occupe ? 'Calcul…' : 'Analyser la période'}
        </button>
        {debut > fin && <span className="rp-alerte">Le mois de début est postérieur au mois de fin.</span>}
      </div>

      {erreur && <p className="bandeau erreur">{erreur}</p>}

      {resultat && (
        <p className="bandeau succes">
          {resultat.emis} bulletin(s) émis sur {resultat.mois} mois.
          {resultat.existants > 0 && ` ${resultat.existants} existaient déjà et n’ont pas été touchés.`}
          {resultat.emis > 0 && ' Vous pouvez maintenant générer les déclarations CNSS de ces périodes.'}
        </p>
      )}

      {mois && majorations > 0 && (
        <p className="bandeau alerte">
          Ces périodes sont hors délai : la majoration de retard cumulée est estimée à{' '}
          <strong>{formatMoney(majorations)}</strong>, au taux de{' '}
          {(settings.majoration_retard_mois * 100).toFixed(2).replace('.', ',')} % par mois entamé.
          C’est une estimation pour provisionner · la CNSS reste seule à liquider ce qui est dû,
          et ces montants ne figurent jamais sur la DRS.
        </p>
      )}

      {mois && (
        <>
          <div className="tableau-enveloppe">
            <table className="tableau rp-table">
              <thead>
                <tr>
                  <th>Mois</th>
                  <th className="num">Salariés</th>
                  <th className="num">Brut</th>
                  <th className="num">Cotisations CNSS</th>
                  <th className="num">Net à payer</th>
                  <th>État</th>
                </tr>
              </thead>
              <tbody>
                {mois.map((m) => (
                  <tr key={m.cle} className={m.effectif === 0 ? 'rp-vide' : ''}>
                    <td>{libelle(m.cle)}</td>
                    <td className="num">{m.effectif}</td>
                    <td className="num">{m.brut > 0 ? formatMoney(m.brut) : 'Non renseigné'}</td>
                    <td className="num">{m.cotisations > 0 ? formatMoney(m.cotisations) : 'Non renseigné'}</td>
                    <td className="num">{m.net > 0 ? formatMoney(m.net) : 'Non renseigné'}</td>
                    <td>
                      {m.effectif === 0 ? (
                        <span className="badge badge-neutre">Aucun salarié</span>
                      ) : m.deja_archives > 0 ? (
                        <span className="badge badge-succes">
                          {m.deja_archives} bulletin(s) archivé(s)
                        </span>
                      ) : m.brut === 0 ? (
                        <span className="badge badge-alerte">Salaire à zéro</span>
                      ) : (
                        <span className="badge badge-info">À produire</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              {totaux && (
                <tfoot>
                  <tr>
                    <td>Total sur la période</td>
                    <td className="num">Non renseigné</td>
                    <td className="num">{formatMoney(totaux.brut)}</td>
                    <td className="num">{formatMoney(totaux.cotisations)}</td>
                    <td className="num">{formatMoney(totaux.net)}</td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {mois.some((m) => m.effectif > 0 && m.brut === 0) && (
            <p className="bandeau alerte">
              Certains mois affichent un brut nul : le salarié concerné n’a pas de salaire
              mensuel sur sa fiche. Vérifiez son contrat · un montant saisi en mode
              <strong> horaire</strong> n’alimente la paie que s’il existe des heures pointées.
            </p>
          )}

          <div className="rp-actions">
            <button
              className="btn btn-primaire"
              disabled={occupe || aFaire.length === 0}
              onClick={() => setConfirmation(true)}
            >
              <Icone nom="paie" size={16} />
              {aFaire.length === 0
                ? 'Rien à rattraper sur cette période'
                : `Produire les bulletins de ${aFaire.length} mois`}
            </button>
          </div>
        </>
      )}

      {confirmation && (
        <Confirm
          titre={`Produire ${aFaire.length} mois de bulletins ?`}
          message={`Un bulletin sera archivé pour chaque salarié concerné, sur ${aFaire.length} mois · de ${libelle(aFaire[0].cle)} à ${libelle(aFaire[aFaire.length - 1].cle)}. Les bulletins figés existants ne sont pas modifiés. Une fois archivés, ils se corrigent depuis le registre.`}
          onConfirm={() => void executer()}
          onCancel={() => setConfirmation(false)}
        />
      )}
    </div>
  )
}
