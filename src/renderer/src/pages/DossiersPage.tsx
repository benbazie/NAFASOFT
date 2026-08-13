import { useEffect, useMemo, useState } from 'react'
import type {
  AppConfig,
  Contract,
  Employee,
  EmployeeDocument,
  MotifSortie,
  ActeDocument
} from '../../../shared/types'
import { MOTIFS_SORTIE } from '../../../shared/types'
import type { Route } from '../App'
import { chargerConfig } from '../lib/config'
import { formatDate, initiales, todayISO } from '../lib/format'
import { imprimerDocument, nomFichierDocument } from '../lib/print'
import {
  actesDuSalarie,
  CATEGORIES_ACTE,
  completude,
  optionsDefaut,
  prochaineAction,
  type Acte,
  type OptionsActe
} from '../lib/actes'
import { PreviewFrame } from '../components/PreviewFrame'
import { Modale } from '../components/Modale'
import { Confirm } from '../components/Confirm'

type Filtre = 'tous' | 'actifs' | 'sortants' | 'incomplets'

/** Résumé d'un dossier, pour la liste. */
interface Ligne {
  e: Employee
  contrats: Contract[]
  actes: Acte[]
  pct: number
  faits: number
  total: number
  action: string
  sortant: boolean
}

function anciennete(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso + 'T00:00:00')
  const now = new Date()
  let m = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth())
  if (now.getDate() < d.getDate()) m--
  if (m < 0) return '—'
  const a = Math.floor(m / 12)
  const r = m % 12
  return a === 0 ? `${r} mois` : r === 0 ? `${a} an(s)` : `${a} an(s) ${r} mois`
}

const nomFichier = (d: { reference: string; employee_nom: string }): string =>
  nomFichierDocument([d.reference, d.employee_nom])

/**
 * Dossiers du personnel · le poste de commande administratif d'un salarié.
 *
 * La liste détaillée de tous les travailleurs ; puis, dossier ouvert, le choix
 * de l'acte, son ajustement, son aperçu et son établissement. Chaque acte
 * établi est figé et rangé au registre avec son code, réimprimable à
 * l'identique. Un registre global recense tout ce qui a été produit.
 */
export function DossiersPage({ onNavigate }: { onNavigate: (r: Route) => void }): JSX.Element {
  const [employes, setEmployes] = useState<Employee[]>([])
  const [contrats, setContrats] = useState<Contract[]>([])
  const [config, setConfig] = useState<AppConfig | null>(null)
  const [pieces, setPieces] = useState<EmployeeDocument[]>([])
  const [archives, setArchives] = useState<ActeDocument[]>([])

  const [vue, setVue] = useState<'liste' | 'registre'>('liste')
  const [ouvert, setOuvert] = useState<number | null>(null)
  const [recherche, setRecherche] = useState('')
  const [filtre, setFiltre] = useState<Filtre>('tous')

  const [acteCle, setActeCle] = useState<string | null>(null)
  const [opts, setOpts] = useState<OptionsActe | null>(null)
  const [apercu, setApercu] = useState<ActeDocument | null>(null)
  const [aSupprimer, setASupprimer] = useState<ActeDocument | null>(null)

  function rafraichirArchives(): void {
    window.api.documents.list().then(setArchives)
  }

  useEffect(() => {
    window.api.employees.list(true).then(setEmployes)
    window.api.contracts.list().then(setContrats)
    chargerConfig().then(setConfig)
    rafraichirArchives()
  }, [])

  useEffect(() => {
    if (ouvert === null) return
    window.api.employeeDocs.listByEmployee(ouvert).then(setPieces)
  }, [ouvert])

  const lignes: Ligne[] = useMemo(() => {
    if (!config) return []
    return employes.map((e) => {
      const ct = contrats.filter((c) => c.employee_id === e.id)
      const actes = actesDuSalarie(e, config, ct)
      const c = completude(actes)
      return {
        e,
        contrats: ct,
        actes,
        pct: c.pct,
        faits: c.faits,
        total: c.total,
        action: prochaineAction(actes),
        sortant:
          e.statut !== 'actif' || Boolean(e.date_fin_contrat && e.date_fin_contrat <= todayISO())
      }
    })
  }, [employes, contrats, config])

  const filtrees = useMemo(() => {
    const q = recherche.trim().toLowerCase()
    return lignes.filter((l) => {
      if (filtre === 'actifs' && l.e.statut !== 'actif') return false
      if (filtre === 'sortants' && !l.sortant) return false
      if (filtre === 'incomplets' && l.pct === 100) return false
      if (!q) return true
      return `${l.e.nom} ${l.e.prenom} ${l.e.poste} ${l.e.matricule ?? ''} ${l.e.numero_cnss ?? ''}`
        .toLowerCase()
        .includes(q)
    })
  }, [lignes, recherche, filtre])

  const stats = useMemo(() => {
    const complets = lignes.filter((l) => l.pct === 100).length
    const aFaire = lignes.reduce((t, l) => t + (l.total - l.faits), 0)
    return { total: lignes.length, complets, aFaire, etablis: archives.length }
  }, [lignes, archives])

  const dossier = lignes.find((l) => l.e.id === ouvert) ?? null

  useEffect(() => {
    if (!dossier || !config) return
    const prio =
      dossier.actes.find((a) => a.attendu && a.reserves.length > 0) ??
      dossier.actes.find((a) => a.attendu) ??
      dossier.actes[0]
    setActeCle(prio?.cle ?? null)
    setOpts(optionsDefaut(config, dossier.e))
  }, [ouvert, config])

  const acte = dossier?.actes.find((a) => a.cle === acteCle) ?? null
  const corps = useMemo(() => (acte && opts ? acte.rendre(opts) : ''), [acte, opts])
  const archivesSalarie = useMemo(
    () => (dossier ? archives.filter((d) => d.employee_id === dossier.e.id) : []),
    [archives, dossier]
  )
  const archiveDe = (a: Acte): ActeDocument | undefined =>
    dossier
      ? archives.find((d) => d.employee_id === dossier.e.id && d.reference === a.reference)
      : undefined

  function setOpt<K extends keyof OptionsActe>(cle: K, val: OptionsActe[K]): void {
    setOpts((o) => (o ? { ...o, [cle]: val } : o))
  }

  /** Fige l'acte dans le registre puis l'imprime. */
  async function etablir(a: Acte): Promise<void> {
    if (!dossier || !opts) return
    const rendu = a.rendre(opts)
    await window.api.documents.save({
      reference: a.reference,
      employee_id: dossier.e.id,
      employee_nom: `${dossier.e.nom} ${dossier.e.prenom}`.trim(),
      type_acte: a.cle,
      libelle: a.libelle,
      categorie: a.categorie,
      orientation: a.orientation,
      corps: rendu,
      options: JSON.stringify(opts)
    })
    rafraichirArchives()
    imprimerDocument(nomFichierDocument([a.reference, `${dossier.e.nom}-${dossier.e.prenom}`]), rendu, a.orientation)
  }

  /** Établit (et fige) toutes les pièces requises et complètes, en un document. */
  async function etablirDossier(): Promise<void> {
    if (!dossier || !opts) return
    const requis = dossier.actes.filter(
      (a) => a.attendu && a.reserves.length === 0 && a.orientation === 'portrait'
    )
    if (requis.length === 0) return
    for (const a of requis) {
      await window.api.documents.save({
        reference: a.reference,
        employee_id: dossier.e.id,
        employee_nom: `${dossier.e.nom} ${dossier.e.prenom}`.trim(),
        type_acte: a.cle,
        libelle: a.libelle,
        categorie: a.categorie,
        orientation: a.orientation,
        corps: a.rendre(opts),
        options: JSON.stringify(opts)
      })
    }
    rafraichirArchives()
    const corpsTotal = requis.map((a) => a.rendre(opts)).join('')
    imprimerDocument(
      nomFichierDocument(['Dossier', `${dossier.e.nom}-${dossier.e.prenom}`]),
      corpsTotal,
      'portrait'
    )
  }

  function reimprimer(d: ActeDocument): void {
    imprimerDocument(nomFichier(d), d.corps, d.orientation)
  }

  async function supprimerArchive(): Promise<void> {
    if (!aSupprimer) return
    await window.api.documents.remove(aSupprimer.id)
    setASupprimer(null)
    rafraichirArchives()
  }

  const etatActe = (a: Acte): { cls: string; texte: string } => {
    if (archiveDe(a)) return { cls: 'etabli', texte: 'établi ✓' }
    if (a.reserves.length > 0) return { cls: 'a-completer', texte: 'à compléter' }
    if (a.attendu) return { cls: 'requis', texte: 'requis' }
    return { cls: 'dispo', texte: 'disponible' }
  }

  // ============================================================ registre global
  if (vue === 'registre') {
    const q = recherche.trim().toLowerCase()
    const lignesReg = archives.filter(
      (d) =>
        !q ||
        `${d.employee_nom} ${d.libelle} ${d.reference}`.toLowerCase().includes(q)
    )
    return (
      <>
        <header className="entete-page">
          <div className="dos-fil">
            <button className="lien-bloc" onClick={() => setVue('liste')}>
              ← Dossiers
            </button>
            <span className="dos-fil-sep">/</span>
            <h1>Registre des actes</h1>
          </div>
        </header>
        <div className="page-corps">
          <div className="dos-barre">
            <input
              className="dos-recherche"
              placeholder="Rechercher (salarié, acte, code)…"
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
            />
            <span className="texte-petit">{archives.length} acte(s) établi(s)</span>
          </div>
          {lignesReg.length === 0 ? (
            <div className="carte vide">
              <div className="icone-vide">❑</div>
              <p>Aucun acte établi pour le moment.</p>
            </div>
          ) : (
            <div className="tableau-conteneur">
              <table className="dos-table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Acte</th>
                    <th>Salarié</th>
                    <th>Établi le</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {lignesReg.map((d) => (
                    <tr key={d.id}>
                      <td className="mono">{d.reference}</td>
                      <td>{d.libelle}</td>
                      <td>{d.employee_nom}</td>
                      <td className="texte-petit">{formatDate(d.updated_at.slice(0, 10))}</td>
                      <td>
                        <div className="actions-cellule">
                          <button className="btn-discret btn-sm" onClick={() => setApercu(d)}>
                            Aperçu
                          </button>
                          <button className="btn-discret btn-sm" onClick={() => reimprimer(d)}>
                            Réimprimer
                          </button>
                          <button className="btn-danger btn-sm" onClick={() => setASupprimer(d)}>
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
        {apercu && (
          <ApercuArchive doc={apercu} onClose={() => setApercu(null)} onImprimer={reimprimer} />
        )}
        {aSupprimer && (
          <Confirm
            titre="Retirer l'acte du registre"
            message={`Retirer « ${aSupprimer.libelle} » (${aSupprimer.reference}) du registre ? Le document figé sera perdu.`}
            onConfirm={supprimerArchive}
            onCancel={() => setASupprimer(null)}
          />
        )}
      </>
    )
  }

  // ================================================================= liste
  if (!dossier) {
    return (
      <>
        <header className="entete-page">
          <div>
            <h1>Dossiers du personnel</h1>
            <p>L'état administratif de chaque travailleur, et toutes ses pièces à établir</p>
          </div>
          <button className="btn btn-secondaire" onClick={() => setVue('registre')}>
            Registre des actes ▸
          </button>
        </header>

        <div className="page-corps">
          <div className="dos-stats">
            <div className="dos-stat">
              <span className="v">{stats.total}</span>
              <span className="l">salarié(s)</span>
            </div>
            <div className="dos-stat succes">
              <span className="v">{stats.complets}</span>
              <span className="l">dossier(s) complet(s)</span>
            </div>
            <div className={`dos-stat ${stats.aFaire > 0 ? 'alerte' : ''}`}>
              <span className="v">{stats.aFaire}</span>
              <span className="l">acte(s) à établir</span>
            </div>
            <div className="dos-stat accent">
              <span className="v">{stats.etablis}</span>
              <span className="l">acte(s) au registre</span>
            </div>
          </div>

          <div className="dos-barre">
            <input
              className="dos-recherche"
              placeholder="Rechercher (nom, poste, matricule, N° CNSS)…"
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
            />
            <div className="dos-filtres">
              {(
                [
                  ['tous', 'Tous'],
                  ['actifs', 'Actifs'],
                  ['sortants', 'Sortants'],
                  ['incomplets', 'Incomplets']
                ] as [Filtre, string][]
              ).map(([cle, lib]) => (
                <button
                  key={cle}
                  className={`dos-filtre ${filtre === cle ? 'actif' : ''}`}
                  onClick={() => setFiltre(cle)}
                >
                  {lib}
                </button>
              ))}
            </div>
          </div>

          {filtrees.length === 0 ? (
            <div className="carte vide">
              <div className="icone-vide">☷</div>
              <p>Aucun salarié ne correspond.</p>
            </div>
          ) : (
            <div className="tableau-conteneur">
              <table className="dos-table">
                <thead>
                  <tr>
                    <th>Salarié</th>
                    <th>Matricule</th>
                    <th>N° CNSS</th>
                    <th>Embauche</th>
                    <th>Dossier</th>
                    <th>Prochaine action</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtrees.map((l) => (
                    <tr key={l.e.id} className="dos-ligne" onClick={() => setOuvert(l.e.id)}>
                      <td>
                        <div className="dos-sal">
                          {l.e.photo ? (
                            <img className="avatar avatar-photo" src={l.e.photo} alt="" />
                          ) : (
                            <span className="avatar">{initiales(l.e.prenom, l.e.nom)}</span>
                          )}
                          <span>
                            <strong>
                              {l.e.nom.toUpperCase()} {l.e.prenom}
                            </strong>
                            <em>{l.e.poste || 'Poste non précisé'}</em>
                          </span>
                          {l.sortant && <span className="pastille sortant">Sortant</span>}
                        </div>
                      </td>
                      <td className="mono">{l.e.matricule || String(l.e.id).padStart(4, '0')}</td>
                      <td>
                        {l.e.numero_cnss ? (
                          <span className="mono">{l.e.numero_cnss}</span>
                        ) : (
                          <span className="pastille a-immat">à immatriculer</span>
                        )}
                      </td>
                      <td className="texte-petit">{formatDate(l.e.date_embauche)}</td>
                      <td>
                        <div className="dos-jauge-cell">
                          <div className="dos-barre-fond">
                            <div
                              className={`dos-barre-val ${l.pct === 100 ? 'complet' : l.pct >= 60 ? 'partiel' : 'faible'}`}
                              style={{ width: `${l.pct}%` }}
                            />
                          </div>
                          <span className="dos-jauge-txt">
                            {l.faits}/{l.total}
                          </span>
                        </div>
                      </td>
                      <td className="texte-petit">{l.action}</td>
                      <td>
                        <button className="btn btn-secondaire btn-sm">Ouvrir</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </>
    )
  }

  // ================================================================ dossier
  const e = dossier.e
  const parcours = construireParcours(e, dossier.contrats)

  return (
    <>
      <header className="entete-page">
        <div className="dos-fil">
          <button className="lien-bloc" onClick={() => setOuvert(null)}>
            ← Dossiers
          </button>
          <span className="dos-fil-sep">/</span>
          <h1>
            {e.nom.toUpperCase()} {e.prenom}
          </h1>
        </div>
      </header>

      <div className="page-corps">
        <div className="dos-tete">
          {e.photo ? (
            <img className="avatar avatar-lg avatar-photo" src={e.photo} alt="" />
          ) : (
            <div className="avatar avatar-lg">{initiales(e.prenom, e.nom)}</div>
          )}
          <div className="dos-tete-id">
            <div className="dos-tete-nom">
              {e.nom.toUpperCase()} {e.prenom}
              {dossier.sortant && <span className="pastille sortant">Sortant</span>}
            </div>
            <div className="dos-tete-poste">
              {e.poste || 'Poste non précisé'} · {e.type_contrat}
            </div>
            <div className="dos-tete-meta">
              <span>
                Matricule <b>{e.matricule || String(e.id).padStart(4, '0')}</b>
              </span>
              <span>
                N° CNSS <b>{e.numero_cnss || 'non attribué'}</b>
              </span>
              <span>
                Embauche <b>{formatDate(e.date_embauche)}</b>
              </span>
              <span>
                Ancienneté <b>{anciennete(e.date_embauche)}</b>
              </span>
            </div>
          </div>
          <div className="dos-tete-actions">
            <div className={`dos-anneau ${dossier.pct === 100 ? 'complet' : ''}`}>
              <span className="v">{dossier.pct}%</span>
              <span className="l">complet</span>
            </div>
            <button className="btn btn-primaire btn-sm" onClick={etablirDossier}>
              Établir le dossier requis
            </button>
            <button className="btn btn-secondaire btn-sm" onClick={() => onNavigate('employees')}>
              Compléter la fiche
            </button>
          </div>
        </div>

        <div className="dos-parcours">
          {parcours.map((ev, i) => (
            <div key={i} className={`dos-jalon ${ev.etat}`}>
              <span className="dos-jalon-pt" aria-hidden="true" />
              <span className="dos-jalon-date">{ev.date ? formatDate(ev.date) : 'Non renseigné'}</span>
              <span className="dos-jalon-titre">{ev.titre}</span>
              {ev.sous && <span className="dos-jalon-sous">{ev.sous}</span>}
            </div>
          ))}
        </div>

        <div className="dos-travail">
          <aside className="dos-actes">
            {CATEGORIES_ACTE.map((cat) => {
              const lot = dossier.actes.filter((a) => a.categorie === cat.cle)
              if (lot.length === 0) return null
              return (
                <div key={cat.cle} className="dos-cat">
                  <div className="dos-cat-titre">{cat.libelle}</div>
                  {lot.map((a) => {
                    const et = etatActe(a)
                    return (
                      <button
                        key={a.cle}
                        className={`dos-acte ${acteCle === a.cle ? 'actif' : ''}`}
                        onClick={() => setActeCle(a.cle)}
                      >
                        <span className="dos-acte-lib">{a.libelle}</span>
                        <span className={`dos-acte-etat ${et.cls}`}>{et.texte}</span>
                      </button>
                    )
                  })}
                </div>
              )
            })}
          </aside>

          <section className="dos-atelier">
            {!acte || !opts ? (
              <p className="vide-doux">Choisissez un acte à établir.</p>
            ) : (
              <>
                <div className="dos-atelier-tete">
                  <div>
                    <h2>{acte.libelle}</h2>
                    <p>{acte.description}</p>
                  </div>
                  <span className="dos-atelier-ref">{acte.reference}</span>
                </div>

                {archiveDe(acte) && (
                  <div className="dos-deja">
                    Déjà établi le <b>{formatDate(archiveDe(acte)!.updated_at.slice(0, 10))}</b> —
                    l'établir à nouveau remplace la copie figée.
                    <button className="lien-bloc" onClick={() => setApercu(archiveDe(acte)!)}>
                      Voir l'original
                    </button>
                  </div>
                )}

                {acte.reserves.length > 0 && (
                  <div className="dos-reserves">
                    <strong>À compléter avant d'établir :</strong>
                    <ul>
                      {acte.reserves.map((r) => (
                        <li key={r.champ}>
                          <b>{r.champ}</b> · {r.message}
                        </li>
                      ))}
                    </ul>
                    <button className="lien-bloc" onClick={() => onNavigate('employees')}>
                      Ouvrir la fiche du salarié
                    </button>
                  </div>
                )}

                {acte.champs.length > 0 && (
                  <div className="dos-editeur">
                    {acte.champs.map((ch) => (
                      <div key={ch.cle} className={`champ ${ch.aire ? 'pleine-largeur' : ''}`}>
                        <label>{ch.label}</label>
                        {ch.type === 'motif' ? (
                          <select
                            value={opts.motif}
                            onChange={(ev) => setOpt('motif', ev.target.value as MotifSortie)}
                          >
                            {MOTIFS_SORTIE.map((m) => (
                              <option key={m} value={m}>
                                {m}
                              </option>
                            ))}
                          </select>
                        ) : ch.aire ? (
                          <textarea
                            rows={2}
                            value={String(opts[ch.cle])}
                            placeholder={ch.placeholder}
                            onChange={(ev) => setOpt(ch.cle, ev.target.value)}
                          />
                        ) : (
                          <input
                            type={ch.type === 'date' ? 'date' : 'text'}
                            value={String(opts[ch.cle])}
                            placeholder={ch.placeholder}
                            onChange={(ev) => setOpt(ch.cle, ev.target.value)}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <div className="dos-apercu">
                  <PreviewFrame
                    titre={acte.libelle}
                    corps={corps}
                    hauteur={460}
                    orientation={acte.orientation}
                  />
                </div>

                <div className="dos-atelier-actions">
                  <button className="btn btn-primaire" onClick={() => etablir(acte)}>
                    Établir &amp; imprimer
                  </button>
                </div>
              </>
            )}
          </section>
        </div>

        {/* --------------------------------- actes établis du salarié ----- */}
        <section className="dos-registre-bloc">
          <div className="ds-cat-entete">
            <h2>Actes établis</h2>
            <span>Chaque acte est figé et rangé avec son code · réimpression fidèle</span>
          </div>
          {archivesSalarie.length === 0 ? (
            <p className="vide-doux">Aucun acte encore établi pour ce salarié.</p>
          ) : (
            <ul className="dos-etablis">
              {archivesSalarie.map((d) => (
                <li key={d.id}>
                  <span className="de-code">{d.reference}</span>
                  <span className="de-lib">{d.libelle}</span>
                  <span className="de-date">établi le {formatDate(d.updated_at.slice(0, 10))}</span>
                  <div className="actions-cellule">
                    <button className="btn-discret btn-sm" onClick={() => setApercu(d)}>
                      Aperçu
                    </button>
                    <button className="btn-discret btn-sm" onClick={() => reimprimer(d)}>
                      Réimprimer
                    </button>
                    <button className="btn-danger btn-sm" onClick={() => setASupprimer(d)}>
                      Retirer
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="dos-pieces-bloc">
          <div className="ds-cat-entete">
            <h2>Pièces justificatives</h2>
            <span>Originaux numérisés joints au dossier · CNIB, diplômes, certificats</span>
          </div>
          {pieces.length === 0 ? (
            <p className="vide-doux">
              Aucune pièce jointe. Elles s'ajoutent depuis l'onglet Pièces de la fiche du salarié.
            </p>
          ) : (
            <ul className="ds-pieces">
              {pieces.map((d) => (
                <li key={d.id}>
                  <span className="dp-type">{d.type}</span>
                  <span className="dp-nom">{d.nom}</span>
                  <span className="dp-notes">{d.notes || 'Non renseigné'}</span>
                  <span className="dp-date">{formatDate(d.created_at.slice(0, 10))}</span>
                  <button
                    className="btn-discret btn-sm"
                    onClick={() => window.api.employeeDocs.open(d.fichier)}
                  >
                    Ouvrir
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {apercu && (
        <ApercuArchive doc={apercu} onClose={() => setApercu(null)} onImprimer={reimprimer} />
      )}
      {aSupprimer && (
        <Confirm
          titre="Retirer l'acte du registre"
          message={`Retirer « ${aSupprimer.libelle} » (${aSupprimer.reference}) du registre ? Le document figé sera perdu.`}
          onConfirm={supprimerArchive}
          onCancel={() => setASupprimer(null)}
        />
      )}
    </>
  )
}

/** Aperçu d'un acte figé du registre, avec réimpression fidèle. */
function ApercuArchive({
  doc,
  onClose,
  onImprimer
}: {
  doc: ActeDocument
  onClose: () => void
  onImprimer: (d: ActeDocument) => void
}): JSX.Element {
  return (
    <Modale
      titre={`${doc.libelle} · ${doc.reference}`}
      onClose={onClose}
      large
      pied={
        <>
          <button className="btn btn-secondaire" onClick={onClose}>
            Fermer
          </button>
          <button className="btn btn-primaire" onClick={() => onImprimer(doc)}>
            Réimprimer / PDF
          </button>
        </>
      }
    >
      <PreviewFrame titre={doc.libelle} corps={doc.corps} hauteur={560} orientation={doc.orientation} />
    </Modale>
  )
}

/** Un jalon du parcours administratif du salarié. */
interface Jalon {
  date: string | null
  titre: string
  sous: string
  etat: 'ok' | 'attente'
}

/** Reconstitue le parcours : embauche, immatriculation, contrats, sortie. */
function construireParcours(e: Employee, contrats: Contract[]): Jalon[] {
  const jalons: Jalon[] = []
  jalons.push({ date: e.date_embauche, titre: 'Embauche', sous: e.poste || '', etat: 'ok' })
  jalons.push(
    e.numero_cnss
      ? { date: null, titre: 'Immatriculé CNSS', sous: e.numero_cnss, etat: 'ok' }
      : { date: null, titre: 'À immatriculer', sous: 'CNSS', etat: 'attente' }
  )
  for (const c of [...contrats].sort((a, b) => a.date_debut.localeCompare(b.date_debut))) {
    jalons.push({
      date: c.date_debut,
      titre: `Contrat ${c.type_contrat}`,
      sous: `${c.reference} · ${c.statut}`,
      etat: 'ok'
    })
  }
  if (e.date_fin_contrat) {
    const passe = e.date_fin_contrat <= todayISO()
    jalons.push({
      date: e.date_fin_contrat,
      titre: passe ? 'Sortie des effectifs' : 'Fin de contrat prévue',
      sous: '',
      etat: passe ? 'ok' : 'attente'
    })
  }
  return jalons
}
