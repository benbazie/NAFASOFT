import { useEffect, useMemo, useState } from 'react'
import type {
  Employee,
  EmployeeInput,
  ContractType,
  CategorieCnss,
  SituationFamille,
  NatureActe,
  Qualification
} from '../../../shared/types'
import {
  CATEGORIES_CNSS,
  SITUATIONS_FAMILLE,
  NATURES_ACTE,
  GROUPES_SANGUINS,
  QUALIFICATIONS
} from '../../../shared/types'
import { Modale } from '../components/Modale'
import { Confirm } from '../components/Confirm'
import { formatDate, formatMoney, initiales } from '../lib/format'
import { chargerConfig } from '../lib/config'
import { imprimerDocument, toCsv } from '../lib/print'
import { listePersonnelHtml } from '../lib/documentsRh'
import { PreviewFrame } from '../components/PreviewFrame'
import { EmployeeSheet } from '../components/EmployeeSheet'
import type { AppConfig } from '../../../shared/types'

const CONTRATS: ContractType[] = ['CDI', 'CDD', 'Extra', 'Apprentissage', 'Stage', 'Interim']

type OngletForm = 'identite' | 'etatcivil' | 'famille' | 'emploi' | 'contact'

type ColonneTri = 'matricule' | 'nom' | 'poste' | 'type_contrat' | 'date_embauche' | 'salaire'

/** Valeur de comparaison d'un employé pour la colonne de tri demandée. */
function comparer(a: Employee, b: Employee, col: ColonneTri): number {
  const salaire = (e: Employee): number => e.salaire_mensuel ?? e.salaire_horaire ?? 0
  switch (col) {
    case 'salaire':
      return salaire(a) - salaire(b)
    case 'date_embauche':
      return (a.date_embauche ?? '').localeCompare(b.date_embauche ?? '')
    case 'matricule':
      return (a.matricule ?? '').localeCompare(b.matricule ?? '', 'fr')
    case 'poste':
      return a.poste.localeCompare(b.poste, 'fr')
    case 'type_contrat':
      return a.type_contrat.localeCompare(b.type_contrat, 'fr')
    default:
      return `${a.nom} ${a.prenom}`.localeCompare(`${b.nom} ${b.prenom}`, 'fr')
  }
}

const VIDE: EmployeeInput = {
  matricule: null,
  numero_cnss: null,
  categorie_cnss: 'P',
  cadre: false,
  sexe: null,
  date_naissance: null,
  personnes_a_charge: 0,
  photo: null,
  lieu_naissance: null,
  nationalite: null,
  cnib: null,
  nom_pere: null,
  nom_mere: null,
  nom_conjoint: null,
  nombre_enfants: 0,
  situation_famille: null,
  contact_urgence: null,
  nom: '',
  prenom: '',
  poste: '',
  type_contrat: 'CDI',
  date_embauche: null,
  date_fin_contrat: null,
  salaire_horaire: null,
  salaire_mensuel: null,
  heures_hebdo: null,
  telephone: null,
  email: null,
  adresse: null,
  statut: 'actif',
  notes: null,
  // Rubriques de la demande d'immatriculation CNSS
  acte_nature: null,
  acte_numero: null,
  acte_date: null,
  acte_lieu: null,
  nom_jeune_fille: null,
  departement_naissance: null,
  province_naissance: null,
  pays_naissance: null,
  groupe_sanguin: null,
  prenoms_pere: null,
  prenoms_mere: null,
  prenoms_conjoint: null,
  adresse_conjoint: null,
  banque: null,
  compte_bancaire: null,
  compte_ccp: null,
  province: null,
  departement: null,
  secteur: null,
  quartier: null,
  numero_rue: null,
  nom_rue: null,
  numero_lot: null,
  nom_immeuble: null,
  numero_etage: null,
  numero_porte: null,
  qualification: null
}

export function EmployeesPage(): JSX.Element {
  const [employes, setEmployes] = useState<Employee[]>([])
  const [recherche, setRecherche] = useState('')
  const [filtreStatut, setFiltreStatut] = useState<'tous' | 'actif' | 'inactif'>('tous')
  const [modalOuverte, setModalOuverte] = useState(false)
  const [enEdition, setEnEdition] = useState<Employee | null>(null)
  const [aSupprimer, setASupprimer] = useState<Employee | null>(null)
  const [fiche, setFiche] = useState<Employee | null>(null)
  const [filtrePoste, setFiltrePoste] = useState('tous')
  const [tri, setTri] = useState<{ col: ColonneTri; sens: 1 | -1 }>({ col: 'nom', sens: 1 })
  const [config, setConfig] = useState<AppConfig | null>(null)
  const [apercuListe, setApercuListe] = useState(false)

  async function charger(): Promise<void> {
    setEmployes(await window.api.employees.list(true))
  }

  useEffect(() => {
    charger()
    chargerConfig().then(setConfig)
  }, [])

  // Liste des postes présents, pour alimenter le filtre.
  const postes = useMemo(
    () => [...new Set(employes.map((e) => e.poste).filter(Boolean))].sort(),
    [employes]
  )

  const filtres = useMemo(() => {
    const r = recherche.trim().toLowerCase()
    const liste = employes.filter((e) => {
      if (filtreStatut !== 'tous' && e.statut !== filtreStatut) return false
      if (filtrePoste !== 'tous' && e.poste !== filtrePoste) return false
      if (!r) return true
      return (
        `${e.prenom} ${e.nom}`.toLowerCase().includes(r) ||
        e.poste.toLowerCase().includes(r) ||
        (e.matricule ?? '').toLowerCase().includes(r) ||
        (e.numero_cnss ?? '').toLowerCase().includes(r) ||
        (e.telephone ?? '').toLowerCase().includes(r) ||
        (e.email ?? '').toLowerCase().includes(r)
      )
    })
    return [...liste].sort((a, b) => comparer(a, b, tri.col) * tri.sens)
  }, [employes, recherche, filtreStatut, filtrePoste, tri])

  // Sous-titre du document : rappelle le filtre appliqué à la liste imprimée.
  const sousTitreListe = useMemo(() => {
    const parts: string[] = []
    if (filtreStatut !== 'tous') parts.push(filtreStatut === 'actif' ? 'Salariés actifs' : 'Salariés inactifs')
    if (filtrePoste !== 'tous') parts.push(`Poste : ${filtrePoste}`)
    if (recherche.trim()) parts.push(`Recherche : « ${recherche.trim()} »`)
    return parts.length ? parts.join(' · ') : 'Ensemble du personnel'
  }, [filtreStatut, filtrePoste, recherche])

  const corpsListe = useMemo(
    () => (config ? listePersonnelHtml(filtres, config, sousTitreListe) : ''),
    [filtres, config, sousTitreListe]
  )

  async function exporterListe(): Promise<void> {
    const entetes = [
      'Matricule', 'N° CNSS', 'Nom', 'Prénom', 'Sexe', 'Date de naissance', 'Lieu de naissance',
      'Nationalité', 'CNIB', 'Père', 'Mère', 'Situation famille', 'Conjoint', 'Enfants',
      'Personnes à charge', 'Emploi', 'Contrat', 'Catégorie CNSS', 'Embauche', 'Fin de contrat',
      'Salaire mensuel', 'Taux horaire', 'Heures/sem.', 'Téléphone', 'Email', 'Adresse', 'Statut'
    ]
    const lignes = filtres.map((e) => [
      e.matricule ?? '', e.numero_cnss ?? '', e.nom, e.prenom, e.sexe ?? '',
      e.date_naissance ?? '', e.lieu_naissance ?? '', e.nationalite ?? '', e.cnib ?? '',
      e.nom_pere ?? '', e.nom_mere ?? '', e.situation_famille ?? '', e.nom_conjoint ?? '',
      e.nombre_enfants, e.personnes_a_charge, e.poste, e.type_contrat, e.categorie_cnss,
      e.date_embauche ?? '', e.date_fin_contrat ?? '', e.salaire_mensuel ?? '',
      e.salaire_horaire ?? '', e.heures_hebdo ?? '', e.telephone ?? '', e.email ?? '',
      e.adresse ?? '', e.statut
    ])
    await window.api.exportCsv('liste_personnel.csv', toCsv(entetes, lignes))
  }

  function trierPar(col: ColonneTri): void {
    setTri((t) => (t.col === col ? { col, sens: t.sens === 1 ? -1 : 1 } : { col, sens: 1 }))
  }

  function ouvrirCreation(): void {
    setEnEdition(null)
    setModalOuverte(true)
  }

  function ouvrirEdition(e: Employee): void {
    setEnEdition(e)
    setModalOuverte(true)
  }

  async function supprimer(): Promise<void> {
    if (!aSupprimer) return
    await window.api.employees.remove(aSupprimer.id)
    setASupprimer(null)
    charger()
  }

  return (
    <>
      <header className="entete-page">
        <div>
          <h1>Employés</h1>
          <p>Fiches du personnel, contrats et coordonnées</p>
        </div>
        <div className="groupe" style={{ display: 'flex', gap: 'var(--e2)' }}>
          <button
            className="btn btn-secondaire"
            disabled={!config || filtres.length === 0}
            onClick={() => setApercuListe(true)}
          >
            Liste du personnel
          </button>
          <button
            className="btn btn-secondaire"
            disabled={filtres.length === 0}
            onClick={exporterListe}
          >
            Exporter
          </button>
          <button className="btn btn-primaire" onClick={ouvrirCreation}>
            + Nouvel employé
          </button>
        </div>
      </header>

      <div className="page-corps">
        <div className="barre-outils">
          <div className="groupe">
            <input
              className="recherche"
              placeholder="Rechercher un nom, poste, email…"
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
            />
            <select
              className="selecteur"
              value={filtreStatut}
              onChange={(e) => setFiltreStatut(e.target.value as typeof filtreStatut)}
            >
              <option value="tous">Tous les statuts</option>
              <option value="actif">Actifs</option>
              <option value="inactif">Inactifs</option>
            </select>
            <select
              className="selecteur"
              value={filtrePoste}
              onChange={(e) => setFiltrePoste(e.target.value)}
            >
              <option value="tous">Tous les postes</option>
              {postes.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div className="groupe texte-gris texte-petit">
            {filtres.length} employé{filtres.length > 1 ? 's' : ''}
          </div>
        </div>

        {filtres.length === 0 ? (
          <div className="carte vide">
            <div className="icone-vide">👥</div>
            <p>Aucun employé ne correspond. Ajoutez votre premier employé.</p>
          </div>
        ) : (
          <div className="tableau-conteneur">
            <table>
              <thead>
                <tr>
                  {(
                    [
                      ['matricule', 'Matricule', ''],
                      ['nom', 'Employé', ''],
                      ['poste', 'Emploi', ''],
                      ['type_contrat', 'Contrat', ''],
                      ['date_embauche', 'Embauche', ''],
                      ['salaire', 'Rémunération', 'num']
                    ] as [ColonneTri, string, string][]
                  ).map(([col, label, classe]) => (
                    <th
                      key={col}
                      className={`${classe} th-triable`}
                      onClick={() => trierPar(col)}
                      title="Trier sur cette colonne"
                    >
                      {label}
                      <span className="fleche-tri">
                        {tri.col === col ? (tri.sens === 1 ? '▲' : '▼') : ''}
                      </span>
                    </th>
                  ))}
                  <th>Statut</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtres.map((e) => (
                  <tr key={e.id}>
                    <td className="mono texte-petit texte-gris">
                      {e.matricule || String(e.id).padStart(4, '0')}
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--e3)' }}>
                        <Avatar employe={e} />
                        <div>
                          <button className="lien-fiche" onClick={() => setFiche(e)}>
                            {e.nom.toUpperCase()} {e.prenom}
                          </button>
                          {e.telephone && <div className="cellule-secondaire">{e.telephone}</div>}
                        </div>
                      </div>
                    </td>
                    <td>{e.poste || 'Non renseigné'}</td>
                    <td>
                      <span className="badge badge-neutre">{e.type_contrat}</span>
                    </td>
                    <td>{formatDate(e.date_embauche)}</td>
                    <td className="num">
                      {(e.salaire_mensuel ?? 0) > 0 ? (
                        <>
                          <div>{formatMoney(e.salaire_mensuel)}</div>
                          <div className="cellule-secondaire">par mois</div>
                        </>
                      ) : (e.salaire_horaire ?? 0) > 0 ? (
                        <>
                          <div>{formatMoney(e.salaire_horaire)}</div>
                          <div className="cellule-secondaire">par heure</div>
                        </>
                      ) : (
                        <span className="texte-gris">Non renseigné</span>
                      )}
                    </td>
                    <td>
                      <span className={`pastille ${e.statut}`} />
                      {e.statut === 'actif' ? 'Actif' : 'Inactif'}
                    </td>
                    <td>
                      <div className="actions-cellule">
                        <button className="btn-discret btn-sm" onClick={() => setFiche(e)}>
                          Dossier
                        </button>
                        <button className="btn-discret btn-sm" onClick={() => ouvrirEdition(e)}>
                          Modifier
                        </button>
                        <button className="btn-danger btn-sm" onClick={() => setASupprimer(e)}>
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

      {modalOuverte && (
        <EmployeeForm
          initial={enEdition}
          onClose={() => setModalOuverte(false)}
          onSaved={() => {
            setModalOuverte(false)
            charger()
          }}
        />
      )}

      {apercuListe && config && (
        <Modale
          titre="Liste du personnel"
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
                onClick={() => imprimerDocument('Liste du personnel', corpsListe, 'paysage')}
              >
                Imprimer / PDF
              </button>
            </>
          }
        >
          <PreviewFrame
            titre="Liste du personnel"
            corps={corpsListe}
            hauteur={560}
            orientation="paysage"
          />
        </Modale>
      )}

      {fiche && (
        <EmployeeSheet
          employee={fiche}
          config={config}
          onClose={() => setFiche(null)}
          onModifier={() => {
            const e = fiche
            setFiche(null)
            ouvrirEdition(e)
          }}
          onChange={charger}
        />
      )}

      {aSupprimer && (
        <Confirm
          titre="Supprimer l'employé"
          message={`Supprimer définitivement ${aSupprimer.prenom} ${aSupprimer.nom} ? Ses plannings, congés et pointages seront aussi supprimés.`}
          danger
          onCancel={() => setASupprimer(null)}
          onConfirm={supprimer}
        />
      )}
    </>
  )
}

function Avatar({ employe }: { employe: Employee }): JSX.Element {
  if (employe.photo) {
    return <img className="avatar avatar-photo" src={employe.photo} alt="" />
  }
  return <div className="avatar">{initiales(employe.prenom, employe.nom)}</div>
}

/**
 * Import d'un portrait. L'image est redimensionnée dans le navigateur avant
 * d'être stockée : une photo d'appareil ferait plusieurs mégaoctets en base.
 */
function ChoixPhoto({
  photo,
  onChange,
  initiales: init
}: {
  photo: string | null
  onChange: (p: string | null) => void
  initiales: string
}): JSX.Element {
  const [charge, setCharge] = useState(false)

  async function importer(): Promise<void> {
    setCharge(true)
    try {
      const brut = await window.api.files.chooseImage()
      if (brut) onChange(await redimensionner(brut, 480))
    } finally {
      setCharge(false)
    }
  }

  return (
    <div className="choix-photo">
      {photo ? (
        <img src={photo} alt="Portrait du salarié" className="photo-apercu" />
      ) : (
        <div className="photo-apercu photo-vide">{init || '👤'}</div>
      )}
      <div className="choix-photo-actions">
        <button type="button" className="btn btn-secondaire btn-sm" onClick={importer} disabled={charge}>
          {charge ? 'Import…' : photo ? 'Remplacer' : 'Choisir une photo'}
        </button>
        {photo && (
          <button type="button" className="btn-danger btn-sm" onClick={() => onChange(null)}>
            Retirer
          </button>
        )}
        <span className="aide">Format portrait recommandé · apparaît sur la fiche individuelle.</span>
      </div>
    </div>
  )
}

/** Réduit une image à `maxCote` pixels de côté et la réencode en JPEG. */
function redimensionner(dataUri: string, maxCote: number): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const echelle = Math.min(1, maxCote / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * echelle)
      canvas.height = Math.round(img.height * echelle)
      const ctx = canvas.getContext('2d')
      if (!ctx) return resolve(dataUri)
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL('image/jpeg', 0.82))
    }
    img.onerror = () => resolve(dataUri)
    img.src = dataUri
  })
}

// ---------------------------- Formulaire ----------------------------

function EmployeeForm({
  initial,
  onClose,
  onSaved
}: {
  initial: Employee | null
  onClose: () => void
  onSaved: () => void
}): JSX.Element {
  const [form, setForm] = useState<EmployeeInput>(() => {
    if (!initial) return { ...VIDE }
    // Copie structurelle plutot que champ par champ : ajouter une rubrique a
    // la fiche n'oblige plus a penser a la recopier ici. Seules les colonnes
    // tenues par la base sont ecartees.
    const { id: _id, created_at: _c, updated_at: _u, ...reste } = initial
    return reste
  })
  const [ongletForm, setOngletForm] = useState<OngletForm>('identite')
  const [erreurs, setErreurs] = useState<Record<string, string>>({})
  const [enregistrement, setEnregistrement] = useState(false)

  function set<K extends keyof EmployeeInput>(cle: K, val: EmployeeInput[K]): void {
    setForm((f) => ({ ...f, [cle]: val }))
  }

  function valider(): boolean {
    const e: Record<string, string> = {}
    if (!form.nom.trim()) e.nom = 'Le nom est obligatoire'
    if (!form.prenom.trim()) e.prenom = 'Le prénom est obligatoire'
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Email invalide'
    setErreurs(e)
    return Object.keys(e).length === 0
  }

  async function enregistrer(): Promise<void> {
    if (!valider()) return
    setEnregistrement(true)
    try {
      if (initial) await window.api.employees.update(initial.id, form)
      else await window.api.employees.create(form)
      onSaved()
    } finally {
      setEnregistrement(false)
    }
  }

  const nombre = (v: string): number | null => (v === '' ? null : Number(v))

  return (
    <Modale
      titre={initial ? 'Modifier un employé' : 'Nouvel employé'}
      onClose={onClose}
      pied={
        <>
          <button className="btn btn-secondaire" onClick={onClose}>
            Annuler
          </button>
          <button className="btn btn-primaire" onClick={enregistrer} disabled={enregistrement}>
            {enregistrement ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </>
      }
    >
      <div className="onglets">
        {(
          [
            ['identite', 'Identité'],
            ['etatcivil', 'État civil CNSS'],
            ['famille', 'Filiation & famille'],
            ['emploi', 'Emploi & paie'],
            ['contact', 'Coordonnées']
          ] as [OngletForm, string][]
        ).map(([cle, label]) => (
          <button
            key={cle}
            type="button"
            className={`onglet ${ongletForm === cle ? 'actif' : ''}`}
            onClick={() => setOngletForm(cle)}
          >
            {label}
          </button>
        ))}
      </div>

      {ongletForm === 'identite' && (
        <>
          <ChoixPhoto
            photo={form.photo}
            onChange={(p) => set('photo', p)}
            initiales={initiales(form.prenom, form.nom)}
          />
          <div className="grille-champs">
            <div className="champ">
              <label>Prénom(s) *</label>
              <input value={form.prenom} onChange={(e) => set('prenom', e.target.value)} />
              {erreurs.prenom && <span className="erreur-champ">{erreurs.prenom}</span>}
            </div>
            <div className="champ">
              <label>Nom *</label>
              <input value={form.nom} onChange={(e) => set('nom', e.target.value)} />
              {erreurs.nom && <span className="erreur-champ">{erreurs.nom}</span>}
            </div>
            <div className="champ">
              <label>Sexe</label>
              <select
                value={form.sexe ?? ''}
                onChange={(e) => set('sexe', (e.target.value || null) as 'M' | 'F' | null)}
              >
                <option value="">Non précisé</option>
                <option value="M">Masculin</option>
                <option value="F">Féminin</option>
              </select>
            </div>
            <div className="champ">
              <label>Date de naissance</label>
              <input
                type="date"
                value={form.date_naissance ?? ''}
                onChange={(e) => set('date_naissance', e.target.value || null)}
              />
            </div>
            <div className="champ">
              <label>Lieu de naissance</label>
              <input
                value={form.lieu_naissance ?? ''}
                placeholder="ex. Koudougou"
                onChange={(e) => set('lieu_naissance', e.target.value || null)}
              />
            </div>
            <div className="champ">
              <label>Nationalité</label>
              <input
                value={form.nationalite ?? ''}
                placeholder="Burkinabè"
                onChange={(e) => set('nationalite', e.target.value || null)}
              />
            </div>
            <div className="champ">
              <label>N° CNIB / pièce d'identité</label>
              <input value={form.cnib ?? ''} onChange={(e) => set('cnib', e.target.value || null)} />
            </div>
          </div>
        </>
      )}

      {ongletForm === 'etatcivil' && (
        <>
          <p className="note-champs">
            Ces rubriques sont celles de la demande d'immatriculation CNSS. Renseignées ici, elles
            sortent pré-remplies sur l'imprimé ; laissées vides, elles y restent en cases blanches.
          </p>

          <h3 className="section-titre">Acte de naissance</h3>
          <div className="grille-champs">
            <div className="champ">
              <label>Nature de l'acte</label>
              <select
                value={form.acte_nature ?? ''}
                onChange={(e) => set('acte_nature', (e.target.value || null) as NatureActe | null)}
              >
                <option value="">Non précisée</option>
                {NATURES_ACTE.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
            <div className="champ">
              <label>N° de l'acte</label>
              <input
                value={form.acte_numero ?? ''}
                onChange={(e) => set('acte_numero', e.target.value || null)}
              />
            </div>
            <div className="champ">
              <label>Date d'établissement</label>
              <input
                type="date"
                value={form.acte_date ?? ''}
                onChange={(e) => set('acte_date', e.target.value || null)}
              />
            </div>
            <div className="champ">
              <label>Lieu d'établissement</label>
              <input
                value={form.acte_lieu ?? ''} placeholder="ex. Kongoussi"
                onChange={(e) => set('acte_lieu', e.target.value || null)}
              />
            </div>
          </div>

          <h3 className="section-titre">Naissance</h3>
          <div className="grille-champs">
            <div className="champ">
              <label>Nom de jeune fille</label>
              <input
                value={form.nom_jeune_fille ?? ''}
                onChange={(e) => set('nom_jeune_fille', e.target.value || null)}
              />
            </div>
            <div className="champ">
              <label>Département de naissance</label>
              <input
                value={form.departement_naissance ?? ''}
                onChange={(e) => set('departement_naissance', e.target.value || null)}
              />
            </div>
            <div className="champ">
              <label>Province de naissance</label>
              <input
                value={form.province_naissance ?? ''}
                onChange={(e) => set('province_naissance', e.target.value || null)}
              />
            </div>
            <div className="champ">
              <label>Pays de naissance</label>
              <input
                value={form.pays_naissance ?? ''} placeholder="Burkina Faso"
                onChange={(e) => set('pays_naissance', e.target.value || null)}
              />
            </div>
            <div className="champ">
              <label>Groupe sanguin</label>
              <select
                value={form.groupe_sanguin ?? ''}
                onChange={(e) => set('groupe_sanguin', e.target.value || null)}
              >
                <option value="">Non précisé</option>
                {GROUPES_SANGUINS.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <h3 className="section-titre">Coordonnées bancaires</h3>
          <div className="grille-champs">
            <div className="champ">
              <label>Banque</label>
              <input
                value={form.banque ?? ''}
                onChange={(e) => set('banque', e.target.value || null)}
              />
            </div>
            <div className="champ">
              <label>N° de compte bancaire</label>
              <input
                value={form.compte_bancaire ?? ''}
                onChange={(e) => set('compte_bancaire', e.target.value || null)}
              />
            </div>
            <div className="champ">
              <label>N° de compte CCP</label>
              <input
                value={form.compte_ccp ?? ''}
                onChange={(e) => set('compte_ccp', e.target.value || null)}
              />
            </div>
          </div>

          <h3 className="section-titre">Domicile · découpage administratif</h3>
          <div className="grille-champs">
            <div className="champ">
              <label>Province</label>
              <input
                value={form.province ?? ''}
                onChange={(e) => set('province', e.target.value || null)}
              />
            </div>
            <div className="champ">
              <label>Département</label>
              <input
                value={form.departement ?? ''}
                onChange={(e) => set('departement', e.target.value || null)}
              />
            </div>
            <div className="champ">
              <label>Secteur</label>
              <input
                value={form.secteur ?? ''}
                onChange={(e) => set('secteur', e.target.value || null)}
              />
            </div>
            <div className="champ">
              <label>Quartier</label>
              <input
                value={form.quartier ?? ''}
                onChange={(e) => set('quartier', e.target.value || null)}
              />
            </div>
            <div className="champ">
              <label>N° de rue</label>
              <input
                value={form.numero_rue ?? ''}
                onChange={(e) => set('numero_rue', e.target.value || null)}
              />
            </div>
            <div className="champ">
              <label>Nom de rue</label>
              <input
                value={form.nom_rue ?? ''}
                onChange={(e) => set('nom_rue', e.target.value || null)}
              />
            </div>
            <div className="champ">
              <label>N° de lot</label>
              <input
                value={form.numero_lot ?? ''}
                onChange={(e) => set('numero_lot', e.target.value || null)}
              />
            </div>
            <div className="champ">
              <label>Nom de l'immeuble</label>
              <input
                value={form.nom_immeuble ?? ''}
                onChange={(e) => set('nom_immeuble', e.target.value || null)}
              />
            </div>
            <div className="champ">
              <label>N° étage</label>
              <input
                value={form.numero_etage ?? ''}
                onChange={(e) => set('numero_etage', e.target.value || null)}
              />
            </div>
            <div className="champ">
              <label>N° porte</label>
              <input
                value={form.numero_porte ?? ''}
                onChange={(e) => set('numero_porte', e.target.value || null)}
              />
            </div>
          </div>
        </>
      )}

      {ongletForm === 'famille' && (
        <>
          <h3 className="section-titre">Filiation</h3>
          <div className="grille-champs">
            <div className="champ">
              <label>Nom du père</label>
              <input
                value={form.nom_pere ?? ''}
                onChange={(e) => set('nom_pere', e.target.value || null)}
              />
            </div>
            <div className="champ">
              <label>Prénoms du père</label>
              <input
                value={form.prenoms_pere ?? ''}
                onChange={(e) => set('prenoms_pere', e.target.value || null)}
              />
            </div>
            <div className="champ">
              <label>Nom de la mère</label>
              <input
                value={form.nom_mere ?? ''}
                onChange={(e) => set('nom_mere', e.target.value || null)}
              />
            </div>
            <div className="champ">
              <label>Prénoms de la mère</label>
              <input
                value={form.prenoms_mere ?? ''}
                onChange={(e) => set('prenoms_mere', e.target.value || null)}
              />
            </div>

          </div>

          <h3 className="section-titre">Situation matrimoniale</h3>
          <div className="grille-champs">
            <div className="champ">
              <label>Situation de famille</label>
              <select
                value={form.situation_famille ?? ''}
                onChange={(e) =>
                  set('situation_famille', (e.target.value || null) as SituationFamille | null)
                }
              >
                <option value="">Non précisée</option>
                {SITUATIONS_FAMILLE.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="champ">
              <label>Nom du conjoint</label>
              <input
                value={form.nom_conjoint ?? ''}
                onChange={(e) => set('nom_conjoint', e.target.value || null)}
              />
            </div>
            <div className="champ">
              <label>Prénoms du conjoint</label>
              <input
                value={form.prenoms_conjoint ?? ''}
                onChange={(e) => set('prenoms_conjoint', e.target.value || null)}
              />
            </div>
            <div className="champ">
              <label>Adresse du conjoint</label>
              <input
                value={form.adresse_conjoint ?? ''}
                onChange={(e) => set('adresse_conjoint', e.target.value || null)}
              />
            </div>
            <div className="champ">
              <label>Nombre d'enfants</label>
              <input
                type="number"
                min="0"
                value={form.nombre_enfants}
                onChange={(e) => set('nombre_enfants', Number(e.target.value) || 0)}
              />
            </div>
            <div className="champ">
              <label>Personnes à charge (fiscales)</label>
              <input
                type="number"
                min="0"
                max="4"
                value={form.personnes_a_charge}
                onChange={(e) => set('personnes_a_charge', Number(e.target.value) || 0)}
              />
              <span className="aide">4 au maximum · réduction d'impôt IUTS</span>
            </div>
            <div className="champ pleine-largeur">
              <label>Personne à prévenir en cas d'urgence</label>
              <input
                value={form.contact_urgence ?? ''}
                placeholder="Nom et téléphone"
                onChange={(e) => set('contact_urgence', e.target.value || null)}
              />
            </div>
          </div>
        </>
      )}

      {ongletForm === 'emploi' && (
        <>
          <h3 className="section-titre">Identifiants</h3>
          <div className="grille-champs">
            <div className="champ">
              <label>Matricule interne</label>
              <input
                value={form.matricule ?? ''}
                placeholder="ex. 0007"
                onChange={(e) => set('matricule', e.target.value || null)}
              />
              <span className="aide">Colonne 1 du BNTS</span>
            </div>
            <div className="champ">
              <label>N° immatriculation CNSS</label>
              <input
                value={form.numero_cnss ?? ''}
                placeholder="ex. 0112458 A"
                onChange={(e) => set('numero_cnss', e.target.value || null)}
              />
              <span className="aide">Colonne 2 du BNTS</span>
            </div>
            <div className="champ">
              <label>Catégorie CNSS</label>
              <select
                value={form.categorie_cnss}
                onChange={(e) => set('categorie_cnss', e.target.value as CategorieCnss)}
              >
                {CATEGORIES_CNSS.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} · {c.libelle}
                  </option>
                ))}
              </select>
              <span className="aide">Détermine les branches cotisées</span>
            </div>
            <div className="champ">
              <label>Statut fiscal (IUTS)</label>
              <select
                value={form.cadre ? '1' : '0'}
                onChange={(e) => set('cadre', e.target.value === '1')}
              >
                <option value="0">Employé / ouvrier · abattement 25 %</option>
                <option value="1">Cadre moyen ou supérieur · abattement 20 %</option>
              </select>
              <span className="aide">Détermine l'abattement appliqué à l'impôt</span>
            </div>
            <div className="champ">
              <label>Qualification professionnelle (CNSS)</label>
              <select
                value={form.qualification ?? ''}
                onChange={(e) =>
                  set('qualification', (e.target.value || null) as Qualification | null)
                }
              >
                <option value="">Non précisée</option>
                {QUALIFICATIONS.map((q) => (
                  <option key={q} value={q}>
                    {q}
                  </option>
                ))}
              </select>
              <span className="aide">Reportée sur la demande d'immatriculation</span>
            </div>
          </div>

          <h3 className="section-titre">Emploi</h3>
          <div className="encart" style={{ marginBottom: 'var(--e4)' }}>
            Ces valeurs sont reprises automatiquement dès qu'un contrat est signé depuis
            l'onglet <strong>Contrats</strong> du dossier.
          </div>
          <div className="grille-champs">
            <div className="champ">
              <label>Poste occupé</label>
              <input
                value={form.poste}
                placeholder="ex. Chef cuisinier"
                onChange={(e) => set('poste', e.target.value)}
              />
            </div>
            <div className="champ">
              <label>Type de contrat</label>
              <select
                value={form.type_contrat}
                onChange={(e) => set('type_contrat', e.target.value as ContractType)}
              >
                {CONTRATS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="champ">
              <label>Date d'embauche</label>
              <input
                type="date"
                value={form.date_embauche ?? ''}
                onChange={(e) => set('date_embauche', e.target.value || null)}
              />
            </div>
            <div className="champ">
              <label>Fin de contrat (si CDD)</label>
              <input
                type="date"
                value={form.date_fin_contrat ?? ''}
                onChange={(e) => set('date_fin_contrat', e.target.value || null)}
              />
            </div>
            <div className="champ">
              <label>Statut</label>
              <select
                value={form.statut}
                onChange={(e) => set('statut', e.target.value as 'actif' | 'inactif')}
              >
                <option value="actif">Actif</option>
                <option value="inactif">Inactif</option>
              </select>
            </div>
            <div className="champ">
              <label>Heures / semaine</label>
              <input
                type="number"
                step="0.5"
                min="0"
                value={form.heures_hebdo ?? ''}
                onChange={(e) => set('heures_hebdo', nombre(e.target.value))}
              />
            </div>
          </div>

          <h3 className="section-titre">Rémunération</h3>
          <div className="grille-champs">
            <div className="champ">
              <label>Salaire mensuel brut (FCFA)</label>
              <input
                type="number"
                step="1"
                min="0"
                placeholder="ex. 90000"
                value={form.salaire_mensuel ?? ''}
                onChange={(e) => set('salaire_mensuel', nombre(e.target.value))}
              />
            </div>
            <div className="champ">
              <label>Taux horaire brut (FCFA)</label>
              <input
                type="number"
                step="1"
                min="0"
                placeholder="si payé à l'heure"
                value={form.salaire_horaire ?? ''}
                onChange={(e) => set('salaire_horaire', nombre(e.target.value))}
              />
            </div>
          </div>
        </>
      )}

      {ongletForm === 'contact' && (
        <div className="grille-champs">
          <div className="champ">
            <label>Téléphone</label>
            <input
              value={form.telephone ?? ''}
              onChange={(e) => set('telephone', e.target.value || null)}
            />
          </div>
          <div className="champ">
            <label>Adresse électronique</label>
            <input value={form.email ?? ''} onChange={(e) => set('email', e.target.value || null)} />
            {erreurs.email && <span className="erreur-champ">{erreurs.email}</span>}
          </div>
          <div className="champ pleine-largeur">
            <label>Adresse de résidence</label>
            <input
              value={form.adresse ?? ''}
              onChange={(e) => set('adresse', e.target.value || null)}
            />
          </div>
          <div className="champ pleine-largeur">
            <label>Notes internes</label>
            <textarea value={form.notes ?? ''} onChange={(e) => set('notes', e.target.value || null)} />
          </div>
        </div>
      )}
    </Modale>
  )
}
