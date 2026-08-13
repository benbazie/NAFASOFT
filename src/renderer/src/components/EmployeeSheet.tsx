import { useEffect, useMemo, useState } from 'react'
import type {
  AppConfig,
  Contract,
  Employee,
  LeaveWithEmployee,
  Presence,
  StatutContrat,
  TimeEntryWithEmployee
} from '../../../shared/types'
import { CATEGORIES_CNSS, TYPES_PRESENCE } from '../../../shared/types'
import { Modale } from './Modale'
import { ContractEditor } from './ContractEditor'
import { formatDate, formatMoney, formatHeures, initiales, semaineRange, todayISO } from '../lib/format'
import { imprimerDocument } from '../lib/print'
import { fichePersonnelHtml } from '../lib/documentsRh'
import { DocumentsRhModal } from './DocumentsRhModal'
import { FormalitesCnssModal, determinerCas } from './FormalitesCnssModal'
import type { EmployeeDocument } from '../../../shared/types'
import { TYPES_PIECE } from '../../../shared/types'

type Onglet = 'identite' | 'contrats' | 'pieces' | 'temps' | 'conges'

const CLASSE_STATUT: Record<StatutContrat, string> = {
  Brouillon: 'badge-neutre',
  Signé: 'badge-succes',
  Terminé: 'badge-neutre',
  Rompu: 'badge-erreur'
}

/** Bornes du mois en cours. */
function moisCourant(): { start: string; end: string } {
  const d = new Date()
  const dernier = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  return { start: `${m}-01`, end: `${m}-${String(dernier).padStart(2, '0')}` }
}

function anciennete(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso + 'T00:00:00')
  const now = new Date()
  let mois = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth())
  if (now.getDate() < d.getDate()) mois--
  if (mois < 0) return '—'
  const ans = Math.floor(mois / 12)
  const reste = mois % 12
  if (ans === 0) return `${reste} mois`
  return reste === 0 ? `${ans} an(s)` : `${ans} an(s) et ${reste} mois`
}

const ligne = (k: string, v: React.ReactNode): JSX.Element => (
  <div className="fiche-ligne">
    <span className="k">{k}</span>
    <span className="v">{v || 'Non renseigné'}</span>
  </div>
)

/**
 * Dossier complet d'un salarié : identité, contrats successifs, temps de
 * travail du mois et congés. Sert de point d'entrée unique pour tout ce qui
 * le concerne.
 */
export function EmployeeSheet({
  employee,
  config,
  onClose,
  onModifier,
  onChange
}: {
  employee: Employee
  config: AppConfig | null
  onClose: () => void
  onModifier: () => void
  onChange: () => void
}): JSX.Element {
  const [onglet, setOnglet] = useState<Onglet>('identite')
  const [formalites, setFormalites] = useState(false)
  const [contrats, setContrats] = useState<Contract[]>([])
  const [conges, setConges] = useState<LeaveWithEmployee[]>([])
  const [pointages, setPointages] = useState<TimeEntryWithEmployee[]>([])
  const [presences, setPresences] = useState<Presence[]>([])
  const [editeur, setEditeur] = useState<{ contrat: Contract | null; avenantDe: Contract | null } | null>(
    null
  )
  const [pieces, setPieces] = useState<EmployeeDocument[]>([])
  const [typePiece, setTypePiece] = useState<string>(TYPES_PIECE[0])
  const [docsRh, setDocsRh] = useState(false)

  const mois = useMemo(moisCourant, [])

  async function charger(): Promise<void> {
    const [c, l, p] = await Promise.all([
      window.api.contracts.listByEmployee(employee.id),
      window.api.leaves.list(),
      window.api.presences.listByRange(mois.start, mois.end)
    ])
    setContrats(c)
    setConges(l.filter((x) => x.employee_id === employee.id))
    setPresences(p.filter((x) => x.employee_id === employee.id))
    const semaine = semaineRange(new Date())
    const t = await window.api.time.listByRange(semaine.start, semaine.end)
    setPointages(t.filter((x) => x.employee_id === employee.id))
    setPieces(await window.api.employeeDocs.listByEmployee(employee.id))
  }

  useEffect(() => {
    charger()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employee.id])

  async function joindre(): Promise<void> {
    const ajoute = await window.api.employeeDocs.attach(employee.id, typePiece, null)
    if (ajoute) charger()
  }

  const contratEnCours = contrats.find((c) => c.statut === 'Signé') ?? null
  const categorie = CATEGORIES_CNSS.find((c) => c.code === employee.categorie_cnss)

  const bilanPresences = useMemo(() => {
    const compte = new Map<string, number>()
    for (const p of presences) compte.set(p.code, (compte.get(p.code) ?? 0) + 1)
    return compte
  }, [presences])

  const heuresSemaine = useMemo(
    () => pointages.reduce((s, p) => s + p.heures_travaillees, 0),
    [pointages]
  )

  return (
    <>
      <Modale
        titre={`${employee.nom.toUpperCase()} ${employee.prenom}`}
        onClose={onClose}
        large
        pied={
          <>
            <button className="btn btn-secondaire" onClick={onClose}>
              Fermer
            </button>
            <button className="btn btn-secondaire" onClick={() => setDocsRh(true)} disabled={!config}>
              Établir un document
            </button>
            <button
              className={`btn ${employee.numero_cnss ? 'btn-secondaire' : 'btn-attention'}`}
              onClick={() => setFormalites(true)}
              disabled={!config}
              title={config ? determinerCas(employee).titre : undefined}
            >
              Formalités CNSS
            </button>
            <button
              className="btn btn-secondaire"
              disabled={!config}
              onClick={() =>
                config &&
                imprimerDocument(
                  `Fiche · ${employee.prenom} ${employee.nom}`,
                  fichePersonnelHtml(employee, config, contrats)
                )
              }
            >
              Imprimer la fiche
            </button>
            <button className="btn btn-primaire" onClick={onModifier}>
              Modifier
            </button>
          </>
        }
      >
        {/* Bandeau d'identité */}
        <div className="fiche-bandeau">
          {employee.photo ? (
            <img className="avatar avatar-lg avatar-photo" src={employee.photo} alt="" />
          ) : (
            <div className="avatar avatar-lg">{initiales(employee.prenom, employee.nom)}</div>
          )}
          <div style={{ flex: 1 }}>
            <div className="fiche-nom">
              {employee.nom.toUpperCase()} {employee.prenom}
            </div>
            <div className="fiche-poste">{employee.poste || 'Poste non précisé'}</div>
          </div>
          <div className="fiche-refs">
            <div>
              <span>Matricule</span>
              <strong>{employee.matricule || String(employee.id).padStart(4, '0')}</strong>
            </div>
            <div>
              <span>N° CNSS</span>
              <strong>{employee.numero_cnss || 'Non renseigné'}</strong>
            </div>
            <div>
              <span>Statut</span>
              <strong>
                <span className={`pastille ${employee.statut}`} />
                {employee.statut === 'actif' ? 'Actif' : 'Inactif'}
              </strong>
            </div>
          </div>
        </div>

        <div className="onglets">
          {(
            [
              ['identite', 'Identité'],
              ['contrats', `Contrats (${contrats.length})`],
              ['pieces', `Pièces jointes (${pieces.length})`],
              ['temps', 'Temps de travail'],
              ['conges', `Congés (${conges.length})`]
            ] as [Onglet, string][]
          ).map(([cle, label]) => (
            <button
              key={cle}
              className={`onglet ${onglet === cle ? 'actif' : ''}`}
              onClick={() => setOnglet(cle)}
            >
              {label}
            </button>
          ))}
        </div>

        {onglet === 'identite' && (
          <div className="fiche-colonnes">
            <section>
              <h3 className="section-titre">État civil</h3>
              {ligne('Sexe', employee.sexe === 'M' ? 'Masculin' : employee.sexe === 'F' ? 'Féminin' : null)}
              {ligne('Date de naissance', formatDate(employee.date_naissance))}
              {ligne('Téléphone', employee.telephone)}
              {ligne('Email', employee.email)}
              {ligne('Adresse', employee.adresse)}
            </section>

            <section>
              <h3 className="section-titre">Situation professionnelle</h3>
              {ligne('Type de contrat', employee.type_contrat)}
              {ligne("Date d'embauche", formatDate(employee.date_embauche))}
              {ligne('Ancienneté', anciennete(employee.date_embauche))}
              {ligne('Fin de contrat', formatDate(employee.date_fin_contrat))}
              {ligne('Heures / semaine', employee.heures_hebdo ? `${employee.heures_hebdo} h` : null)}
            </section>

            <section>
              <h3 className="section-titre">Paie &amp; cotisations</h3>
              {ligne(
                'Rémunération',
                (employee.salaire_mensuel ?? 0) > 0
                  ? `${formatMoney(employee.salaire_mensuel)} / mois`
                  : (employee.salaire_horaire ?? 0) > 0
                    ? `${formatMoney(employee.salaire_horaire)} / heure`
                    : null
              )}
              {ligne('Catégorie CNSS', categorie ? `${categorie.code} · ${categorie.libelle}` : null)}
              {ligne('Qualification', employee.cadre ? 'Cadre · abattement 20 %' : 'Employé · abattement 25 %')}
              {ligne('Personnes à charge', String(employee.personnes_a_charge))}
            </section>

            {employee.notes && (
              <section className="pleine-largeur">
                <h3 className="section-titre">Notes internes</h3>
                <p className="texte-petit">{employee.notes}</p>
              </section>
            )}
          </div>
        )}

        {onglet === 'contrats' && (
          <>
            <div className="barre-outils">
              <div className="groupe texte-petit texte-gris">
                {contratEnCours
                  ? `Contrat en cours : ${contratEnCours.reference}`
                  : 'Aucun contrat signé en cours'}
              </div>
              <button
                className="btn btn-secondaire btn-sm"
                disabled={!config}
                onClick={() => setEditeur({ contrat: null, avenantDe: null })}
              >
                + Nouveau contrat
              </button>
            </div>

            {contrats.length === 0 ? (
              <div className="carte vide">
                <div className="icone-vide">❐</div>
                <p>Aucun contrat enregistré pour ce salarié.</p>
              </div>
            ) : (
              <div className="tableau-conteneur">
                <table>
                  <thead>
                    <tr>
                      <th>Référence</th>
                      <th>Type</th>
                      <th>Période</th>
                      <th className="num">Rémunération</th>
                      <th>Statut</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {contrats.map((c) => (
                      <tr key={c.id}>
                        <td className="mono texte-petit">
                          {c.reference}
                          {c.parent_id && <div className="cellule-secondaire">renouvellement</div>}
                        </td>
                        <td>
                          <span className="badge badge-neutre">{c.type_contrat}</span>
                        </td>
                        <td className="texte-petit">
                          {formatDate(c.date_debut)} →{' '}
                          {c.date_fin ? formatDate(c.date_fin) : 'indéterminée'}
                        </td>
                        <td className="num">{formatMoney(c.salaire_montant)}</td>
                        <td>
                          <span className={`badge ${CLASSE_STATUT[c.statut]}`}>{c.statut}</span>
                        </td>
                        <td>
                          <div className="actions-cellule">
                            <button
                              className="btn-discret btn-sm"
                              onClick={() => setEditeur({ contrat: c, avenantDe: null })}
                            >
                              Ouvrir
                            </button>
                            {(c.statut === 'Signé' || c.statut === 'Terminé') && (
                              <button
                                className="btn-discret btn-sm"
                                onClick={() => setEditeur({ contrat: null, avenantDe: c })}
                              >
                                Renouveler
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {onglet === 'pieces' && (
          <>
            <div className="barre-outils">
              <div className="groupe">
                <select
                  className="selecteur"
                  value={typePiece}
                  onChange={(e) => setTypePiece(e.target.value)}
                >
                  {TYPES_PIECE.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <button className="btn btn-secondaire btn-sm" onClick={joindre}>
                  + Joindre un fichier
                </button>
              </div>
              <div className="groupe texte-petit texte-gris">
                Les fichiers sont recopiés dans l'application : ils restent disponibles même si
                l'original est déplacé.
              </div>
            </div>

            {pieces.length === 0 ? (
              <div className="carte vide">
                <div className="icone-vide">❐</div>
                <p>Aucune pièce au dossier. Joignez la CNIB, les diplômes, un certificat médical…</p>
              </div>
            ) : (
              <div className="tableau-conteneur">
                <table>
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Fichier</th>
                      <th className="num">Taille</th>
                      <th>Ajouté le</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {pieces.map((d) => (
                      <tr key={d.id}>
                        <td>
                          <span className="badge badge-neutre">{d.type}</span>
                        </td>
                        <td className="cellule-principale">{d.nom}</td>
                        <td className="num texte-gris">{(d.taille / 1024).toFixed(0)} Ko</td>
                        <td className="texte-petit texte-gris">{d.created_at.slice(0, 10)}</td>
                        <td>
                          <div className="actions-cellule">
                            <button
                              className="btn-discret btn-sm"
                              onClick={() => window.api.employeeDocs.open(d.fichier)}
                            >
                              Ouvrir
                            </button>
                            <button
                              className="btn-danger btn-sm"
                              onClick={async () => {
                                await window.api.employeeDocs.remove(d.id)
                                charger()
                              }}
                            >
                              Retirer
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {onglet === 'temps' && (
          <>
            <div className="tuiles">
              <div className="tuile">
                <span className="libelle">Heures cette semaine</span>
                <span className="valeur">{formatHeures(heuresSemaine)}</span>
                <span className="detail">{pointages.length} pointage(s)</span>
              </div>
              {TYPES_PRESENCE.filter((t) => (bilanPresences.get(t.code) ?? 0) > 0).map((t) => (
                <div className={`tuile ${t.deduit ? 'erreur' : ''}`} key={t.code}>
                  <span className="libelle">{t.label}</span>
                  <span className="valeur">{bilanPresences.get(t.code)}</span>
                  <span className="detail">jours ce mois-ci</span>
                </div>
              ))}
            </div>

            <h3 className="section-titre">Pointages de la semaine</h3>
            {pointages.length === 0 ? (
              <div className="carte vide">
                <div className="icone-vide">◷</div>
                <p>Aucun pointage cette semaine.</p>
              </div>
            ) : (
              <div className="tableau-conteneur">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Arrivée</th>
                      <th>Départ</th>
                      <th className="num">Pause</th>
                      <th className="num">Heures</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pointages.map((p) => (
                      <tr key={p.id}>
                        <td>{formatDate(p.date)}</td>
                        <td className="mono">{p.arrivee}</td>
                        <td className="mono">{p.depart ?? 'Non renseigné'}</td>
                        <td className="num">{p.pause_minutes} min</td>
                        <td className="num">
                          <strong>{formatHeures(p.heures_travaillees)}</strong>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {onglet === 'conges' && (
          <>
            {conges.length === 0 ? (
              <div className="carte vide">
                <div className="icone-vide">❋</div>
                <p>Aucune demande de congé ou d'absence enregistrée.</p>
              </div>
            ) : (
              <div className="tableau-conteneur">
                <table>
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Du</th>
                      <th>Au</th>
                      <th>Statut</th>
                      <th>Motif</th>
                    </tr>
                  </thead>
                  <tbody>
                    {conges.map((c) => (
                      <tr key={c.id}>
                        <td className="cellule-principale">{c.type}</td>
                        <td>{formatDate(c.date_debut)}</td>
                        <td>{formatDate(c.date_fin)}</td>
                        <td>
                          <span
                            className={`badge ${
                              c.statut === 'Approuvé'
                                ? 'badge-succes'
                                : c.statut === 'Refusé'
                                  ? 'badge-erreur'
                                  : 'badge-alerte'
                            }`}
                          >
                            {c.statut}
                          </span>
                        </td>
                        <td className="texte-petit texte-gris">{c.motif || 'Non renseigné'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </Modale>

      {docsRh && config && (
        <DocumentsRhModal employee={employee} config={config} onClose={() => setDocsRh(false)} />
      )}

      {formalites && config && (
        <FormalitesCnssModal
          employee={employee}
          config={config}
          onClose={() => setFormalites(false)}
        />
      )}

      {editeur && config && (
        <ContractEditor
          employee={employee}
          config={config}
          contrat={editeur.contrat}
          avenantDe={editeur.avenantDe}
          onClose={() => setEditeur(null)}
          onSaved={() => {
            setEditeur(null)
            charger()
            onChange()
          }}
        />
      )}
    </>
  )
}
