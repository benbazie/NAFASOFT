import { useEffect, useMemo, useState } from 'react'
import type {
  AppConfig,
  Contract,
  ContractWithEmployee,
  Employee,
  StatutContrat
} from '../../../shared/types'
import type { Route } from '../App'
import { formatDate, formatMoney } from '../lib/format'
import { chargerConfig } from '../lib/config'
import { imprimerDocument, toCsv } from '../lib/print'
import { listeContratsHtml } from '../lib/documentsRh'
import { PreviewFrame } from '../components/PreviewFrame'
import { Modale } from '../components/Modale'
import { ContractEditor } from '../components/ContractEditor'
import { Confirm } from '../components/Confirm'
import { jouer } from '../lib/son'

interface Props {
  onNavigate: (route: Route) => void
}

const CLASSE_STATUT: Record<StatutContrat, string> = {
  Brouillon: 'badge-neutre',
  Signé: 'badge-succes',
  Terminé: 'badge-neutre',
  Rompu: 'badge-erreur'
}

/** Jours restants avant le terme (négatif si dépassé). */
function joursRestants(iso: string): number {
  const today = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00').getTime()
  return Math.round((new Date(iso + 'T00:00:00').getTime() - today) / 86400000)
}

export function ContractsPage({ onNavigate }: Props): JSX.Element {
  const [contrats, setContrats] = useState<ContractWithEmployee[]>([])
  const [employes, setEmployes] = useState<Employee[]>([])
  const [config, setConfig] = useState<AppConfig | null>(null)
  const [filtre, setFiltre] = useState('')
  const [filtreStatut, setFiltreStatut] = useState<'tous' | StatutContrat>('tous')
  const [editeur, setEditeur] = useState<{
    employee: Employee
    contrat: Contract | null
    avenantDe: Contract | null
  } | null>(null)
  const [choixSalarie, setChoixSalarie] = useState(false)
  // Conséquence de la dernière suppression sur la fiche du salarié.
  const [info, setInfo] = useState('')
  const [aSupprimer, setASupprimer] = useState<ContractWithEmployee | null>(null)
  const [apercuListe, setApercuListe] = useState(false)

  async function charger(): Promise<void> {
    // Les contrats arrivés à terme passent automatiquement en « Terminé ».
    await window.api.contracts.cloturerEchus()
    setContrats(await window.api.contracts.list())
    setEmployes(await window.api.employees.list(true))
  }

  useEffect(() => {
    charger()
    chargerConfig().then(setConfig)
  }, [])

  const liste = useMemo(() => {
    const r = filtre.trim().toLowerCase()
    return contrats.filter((c) => {
      if (filtreStatut !== 'tous' && c.statut !== filtreStatut) return false
      if (!r) return true
      return `${c.reference} ${c.employee_prenom} ${c.employee_nom} ${c.poste} ${c.type_contrat}`
        .toLowerCase()
        .includes(r)
    })
  }, [contrats, filtre, filtreStatut])

  // Contrats signés arrivant à terme dans les 30 jours.
  const echeances = useMemo(
    () =>
      contrats
        .filter((c) => c.statut === 'Signé' && c.date_fin && joursRestants(c.date_fin) <= 30)
        .sort((a, b) => joursRestants(a.date_fin!) - joursRestants(b.date_fin!)),
    [contrats]
  )

  const sousTitreListe = useMemo(() => {
    const parts: string[] = []
    if (filtreStatut !== 'tous') parts.push(`Statut : ${filtreStatut}`)
    if (filtre.trim()) parts.push(`Recherche : « ${filtre.trim()} »`)
    return parts.length ? parts.join(' · ') : 'Ensemble des contrats'
  }, [filtreStatut, filtre])

  const corpsListe = useMemo(
    () => (config ? listeContratsHtml(liste, config, sousTitreListe) : ''),
    [liste, config, sousTitreListe]
  )

  async function exporterListe(): Promise<void> {
    const entetes = [
      'Référence', 'Nom', 'Prénom', 'Poste', 'Type', 'Début', 'Terme', 'Durée (mois)',
      'Montant', 'Mode', 'Période essai', 'Signé le', 'Statut', 'Renouvellement de'
    ]
    const lignes = liste.map((c) => [
      c.reference, c.employee_nom, c.employee_prenom, c.poste, c.type_contrat,
      c.date_debut, c.date_fin ?? '', c.duree_mois ?? '', c.salaire_montant, c.mode_salaire,
      c.periode_essai ?? '', c.date_signature ?? '', c.statut, c.parent_id ?? ''
    ])
    await window.api.exportCsv('registre_contrats.csv', toCsv(entetes, lignes))
  }

  async function supprimer(): Promise<void> {
    if (!aSupprimer) return
    jouer('suppression')
    // Le message dit ce qu'il est advenu de la fiche : sans lui, on croit avoir
    // retiré le salarié de la paie alors que ses conditions y demeurent.
    const r = await window.api.contracts.remove(aSupprimer.id)
    setASupprimer(null)
    setInfo(r.message)
    window.setTimeout(() => setInfo(''), 9000)
    charger()
  }

  /** Contrat encore en vigueur d'un salarié : signé et non échu. Null sinon. */
  function contratEnCours(employeeId: number): ContractWithEmployee | null {
    return (
      contrats
        .filter(
          (c) =>
            c.employee_id === employeeId &&
            c.statut === 'Signé' &&
            (!c.date_fin || joursRestants(c.date_fin) >= 0)
        )
        .sort((a, b) => b.date_debut.localeCompare(a.date_debut))[0] ?? null
    )
  }

  /** Brouillon de contrat déjà en préparation pour ce salarié, le cas échéant. */
  function brouillonEnCours(employeeId: number): ContractWithEmployee | null {
    return contrats.find((c) => c.employee_id === employeeId && c.statut === 'Brouillon') ?? null
  }

  function ouvrirNouveau(employee: Employee, avenantDe: Contract | null = null): void {
    setChoixSalarie(false)
    // Un seul contrat en vigueur à la fois : si le salarié en a déjà un valide,
    // le prochain est nécessairement un renouvellement de celui-ci · jamais un
    // contrat vierge parallèle.
    const cible = avenantDe ?? contratEnCours(employee.id)
    setEditeur({ employee, contrat: null, avenantDe: cible })
  }

  function ouvrirExistant(c: ContractWithEmployee): void {
    setChoixSalarie(false)
    const employee = employes.find((e) => e.id === c.employee_id)
    if (employee) setEditeur({ employee, contrat: c, avenantDe: null })
  }

  function renouveler(c: ContractWithEmployee): void {
    setChoixSalarie(false)
    const employee = employes.find((e) => e.id === c.employee_id)
    if (employee) setEditeur({ employee, contrat: null, avenantDe: c })
  }

  return (
    <>
      <header className="entete-page">
        <div>
          <h1>Contrats</h1>
          <p>Registre des contrats, échéances, renouvellements et documents signés</p>
        </div>
        <div className="groupe" style={{ display: 'flex', gap: 'var(--e2)' }}>
          <button
            className="btn btn-secondaire"
            disabled={!config || liste.length === 0}
            onClick={() => setApercuListe(true)}
          >
            Registre
          </button>
          <button
            className="btn btn-secondaire"
            disabled={liste.length === 0}
            onClick={exporterListe}
          >
            Exporter
          </button>
          <button
            className="btn btn-primaire"
            disabled={employes.length === 0 || !config}
            onClick={() => setChoixSalarie(true)}
          >
            + Nouveau contrat
          </button>
        </div>
      </header>

      <div className="page-corps">
        {info && <p className="bandeau info">{info}</p>}

        {echeances.length > 0 && (
          <section style={{ marginBottom: 'var(--e5)' }}>
            <h2 className="section-titre">Échéances à traiter</h2>
            <div className="liste-alertes">
              {echeances.map((c) => {
                const j = joursRestants(c.date_fin!)
                return (
                  <div key={c.id} className={`alerte-ligne ${j < 0 ? 'expire' : ''}`}>
                    <span className="ico">{j < 0 ? '⛔' : '⏳'}</span>
                    <div style={{ flex: 1 }}>
                      <strong>
                        {c.employee_nom.toUpperCase()} {c.employee_prenom}
                      </strong>
                      <span className="texte-gris">
                        {' '}
                        · {c.type_contrat} {c.reference}, {c.poste}
                      </span>
                    </div>
                    <div className="texte-petit">
                      {j < 0 ? 'Terme dépassé le ' : 'Terme le '}
                      <strong>{formatDate(c.date_fin)}</strong>
                      {j >= 0 && <> ({j} j)</>}
                    </div>
                    <button className="btn btn-sm btn-secondaire" onClick={() => renouveler(c)}>
                      Renouveler
                    </button>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        <div className="barre-outils">
          <div className="groupe">
            <input
              className="recherche"
              placeholder="Rechercher une référence, un salarié, un poste…"
              value={filtre}
              onChange={(e) => setFiltre(e.target.value)}
            />
            <select
              className="selecteur"
              value={filtreStatut}
              onChange={(e) => setFiltreStatut(e.target.value as typeof filtreStatut)}
            >
              <option value="tous">Tous les statuts</option>
              <option value="Brouillon">Brouillon</option>
              <option value="Signé">Signé</option>
              <option value="Terminé">Terminé</option>
              <option value="Rompu">Rompu</option>
            </select>
          </div>
          <div className="groupe texte-gris texte-petit">
            {liste.length} contrat(s) · {employes.length} salarié(s)
          </div>
        </div>

        {liste.length === 0 ? (
          <div className="carte vide">
            <div className="icone-vide">❐</div>
            <p>
              {contrats.length === 0
                ? "Aucun contrat enregistré. Créez le premier avec « Nouveau contrat »."
                : 'Aucun contrat ne correspond à cette recherche.'}
            </p>
            {contrats.length === 0 && employes.length === 0 && (
              <button
                className="btn btn-secondaire"
                style={{ marginTop: 'var(--e3)' }}
                onClick={() => onNavigate('employees')}
              >
                Ajouter d'abord un employé
              </button>
            )}
          </div>
        ) : (
          <div className="tableau-conteneur">
            <table>
              <thead>
                <tr>
                  <th>Référence</th>
                  <th>Salarié</th>
                  <th>Type</th>
                  <th>Début</th>
                  <th>Terme</th>
                  <th className="num">Rémunération</th>
                  <th>Statut</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {liste.map((c) => (
                  <tr key={c.id}>
                    <td className="mono texte-petit">
                      {c.reference}
                      {c.parent_id && (
                        <div className="cellule-secondaire">renouvellement</div>
                      )}
                    </td>
                    <td>
                      <div className="cellule-principale">
                        {c.employee_nom.toUpperCase()} {c.employee_prenom}
                      </div>
                      <div className="cellule-secondaire">{c.poste || 'Non renseigné'}</div>
                    </td>
                    <td>
                      <span className="badge badge-neutre">{c.type_contrat}</span>
                    </td>
                    <td>{formatDate(c.date_debut)}</td>
                    <td>{c.date_fin ? formatDate(c.date_fin) : 'Indéterminée'}</td>
                    <td className="num">
                      <div>{formatMoney(c.salaire_montant)}</div>
                      <div className="cellule-secondaire">
                        {c.mode_salaire === 'mensuel' ? 'par mois' : 'par heure'}
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${CLASSE_STATUT[c.statut]}`}>{c.statut}</span>
                    </td>
                    <td>
                      <div className="actions-cellule">
                        <button className="btn-discret btn-sm" onClick={() => ouvrirExistant(c)}>
                          Ouvrir
                        </button>
                        {(c.statut === 'Signé' || c.statut === 'Terminé') && (
                          <button className="btn-discret btn-sm" onClick={() => renouveler(c)}>
                            Renouveler
                          </button>
                        )}
                        <button className="btn-danger btn-sm" onClick={() => setASupprimer(c)}>
                          Supprimer
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {apercuListe && config && (
        <Modale
          titre="Registre des contrats"
          onClose={() => setApercuListe(false)}
          large
          pied={
            <>
              <button className="btn btn-secondaire" onClick={() => setApercuListe(false)}>
                Fermer
              </button>
              <button className="btn btn-secondaire" onClick={exporterListe}>
                Exporter en CSV
              </button>
              <button
                className="btn btn-primaire"
                onClick={() => imprimerDocument('Registre des contrats', corpsListe, 'paysage')}
              >
                Imprimer / PDF
              </button>
            </>
          }
        >
          <PreviewFrame
            titre="Registre des contrats"
            corps={corpsListe}
            hauteur={560}
            orientation="paysage"
          />
        </Modale>
      )}

      {choixSalarie && (
        <ChoixSalarie
          employes={employes}
          contratEnCours={contratEnCours}
          brouillonEnCours={brouillonEnCours}
          onNouveau={(e) => ouvrirNouveau(e)}
          onRenouveler={(c) => renouveler(c)}
          onContinuer={(c) => ouvrirExistant(c)}
          onClose={() => setChoixSalarie(false)}
        />
      )}

      {editeur && config && (
        <ContractEditor
          employee={editeur.employee}
          config={config}
          contrat={editeur.contrat}
          avenantDe={editeur.avenantDe}
          onClose={() => setEditeur(null)}
          onSaved={() => {
            setEditeur(null)
            charger()
          }}
        />
      )}


      {aSupprimer && (
        <Confirm
          titre="Supprimer le contrat"
          message={`Supprimer définitivement le contrat ${aSupprimer.reference} de ${aSupprimer.employee_prenom} ${aSupprimer.employee_nom} ? La fiche du salarié n'est pas modifiée.`}
          danger
          onCancel={() => setASupprimer(null)}
          onConfirm={supprimer}
        />
      )}
    </>
  )
}

/** Sélection du salarié pour lequel établir un nouveau contrat. */
function ChoixSalarie({
  employes,
  contratEnCours,
  brouillonEnCours,
  onNouveau,
  onRenouveler,
  onContinuer,
  onClose
}: {
  employes: Employee[]
  contratEnCours: (id: number) => ContractWithEmployee | null
  brouillonEnCours: (id: number) => ContractWithEmployee | null
  onNouveau: (e: Employee) => void
  onRenouveler: (c: ContractWithEmployee) => void
  onContinuer: (c: ContractWithEmployee) => void
  onClose: () => void
}): JSX.Element {
  const [recherche, setRecherche] = useState('')
  const liste = useMemo(() => {
    const r = recherche.trim().toLowerCase()
    return employes.filter((e) => !r || `${e.prenom} ${e.nom} ${e.poste}`.toLowerCase().includes(r))
  }, [employes, recherche])

  return (
    <div className="modale-fond" onMouseDown={onClose}>
      <div className="modale" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modale-entete">
          <h2>Pour quel salarié ?</h2>
          <button className="btn-discret" onClick={onClose} aria-label="Fermer">
            ✕
          </button>
        </div>
        <div className="modale-corps">
          <p className="texte-petit texte-gris" style={{ marginBottom: 'var(--e3)' }}>
            Un seul contrat en vigueur par salarié : ceux qui en ont déjà un ne peuvent qu'être
            renouvelés.
          </p>
          <input
            className="recherche"
            style={{ width: '100%', marginBottom: 'var(--e3)' }}
            placeholder="Rechercher un salarié…"
            autoFocus
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
          />
          <div className="tableau-conteneur" style={{ maxHeight: 320 }}>
            <table>
              <tbody>
                {liste.map((e) => {
                  const brouillon = brouillonEnCours(e.id)
                  const courant = contratEnCours(e.id)
                  return (
                    <tr key={e.id}>
                      <td>
                        <div className="cellule-principale">
                          {e.nom.toUpperCase()} {e.prenom}
                        </div>
                        <div className="cellule-secondaire">{e.poste || 'Non renseigné'}</div>
                      </td>
                      <td>
                        {brouillon ? (
                          <span className="badge badge-neutre">Brouillon · {brouillon.reference}</span>
                        ) : courant ? (
                          <span className="badge badge-succes">
                            Contrat en cours · {courant.reference}
                          </span>
                        ) : (
                          <span className="texte-petit texte-gris">Aucun contrat en cours</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {brouillon ? (
                          <button
                            className="btn btn-sm btn-secondaire"
                            onClick={() => onContinuer(brouillon)}
                          >
                            Continuer
                          </button>
                        ) : courant ? (
                          <button
                            className="btn btn-sm btn-primaire"
                            onClick={() => onRenouveler(courant)}
                          >
                            Renouveler
                          </button>
                        ) : (
                          <button
                            className="btn btn-sm btn-secondaire"
                            onClick={() => onNouveau(e)}
                          >
                            Nouveau contrat
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
