import { useState } from 'react'
import type { EmployeurInput, EmployeurRegistre } from '../../../shared/types'
import { FORMES_JURIDIQUES, ETATS_DOSSIER } from '../../../shared/types'
import { Modale } from './Modale'
import { Icone } from './Icones'

const msg = (e: unknown): string => String((e as Error)?.message ?? e)

/** Teintes de repérage · toutes lisibles avec du texte clair par-dessus. */
export const TEINTES = [
  '#1d4ed8', '#0f766e', '#b45309', '#be123c',
  '#7c3aed', '#0369a1', '#15803d', '#96590a'
]

type Onglet = 'identite' | 'adresse' | 'representant' | 'mission'

const ONGLETS: { cle: Onglet; libelle: string; ico: 'entreprise' | 'dossiers' | 'employes' | 'portefeuille' }[] = [
  { cle: 'identite', libelle: 'Identité', ico: 'entreprise' },
  { cle: 'adresse', libelle: 'Adresse & contact', ico: 'dossiers' },
  { cle: 'representant', libelle: 'Représentant légal', ico: 'employes' },
  { cle: 'mission', libelle: 'Mission du cabinet', ico: 'portefeuille' }
]

/** Initiales d'une raison sociale, pour la pastille. */
export function sigleAuto(nom: string): string {
  const mots = nom
    .replace(/[^\p{L}\p{N} ]/gu, ' ')
    .split(/\s+/)
    .filter((m) => m.length > 1 && !/^(de|du|des|la|le|les|et|sarl|sa|sas|gie|suarl)$/i.test(m))
  const source = mots.length > 0 ? mots : [nom.trim() || '?']
  return source.slice(0, 2).map((m) => m[0].toUpperCase()).join('')
}

/**
 * Fiche d'un employeur suivi par le cabinet.
 *
 * Quatre onglets plutôt qu'une longue liste : on ne remplit pas l'identité
 * juridique et le suivi de mission au même moment, ni forcément la même
 * personne. Les champs indispensables tiennent dans le premier, le reste se
 * complète plus tard sans bloquer la création du dossier.
 */
export function FicheEmployeur({
  employeur,
  onFerme,
  onEnregistre
}: {
  /** null = création d'un nouveau dossier. */
  employeur: EmployeurRegistre | null
  onFerme: () => void
  onEnregistre: () => void
}): JSX.Element {
  const [d, setD] = useState<EmployeurInput>(() =>
    employeur
      ? { ...employeur }
      : { nom: '', etat: 'actif', periodicite: 'trimestrielle', couleur: TEINTES[0] }
  )
  const [onglet, setOnglet] = useState<Onglet>('identite')
  const [erreur, setErreur] = useState('')
  const [occupe, setOccupe] = useState(false)

  function set<K extends keyof EmployeurInput>(cle: K, valeur: EmployeurInput[K]): void {
    setD((p) => ({ ...p, [cle]: valeur }))
  }

  /** Champ texte : le motif se répète assez pour mériter son raccourci. */
  const champ = (
    cle: keyof EmployeurInput,
    libelle: string,
    exemple?: string,
    large = false
  ): JSX.Element => (
    <label className={large ? 'pleine-largeur' : ''}>
      {libelle}
      <input
        value={(d[cle] as string) ?? ''}
        placeholder={exemple}
        onChange={(e) => set(cle, e.target.value as EmployeurInput[keyof EmployeurInput])}
      />
    </label>
  )

  async function enregistrer(): Promise<void> {
    setOccupe(true)
    try {
      if (employeur) await window.api.employeurs.update(employeur.id, d)
      else await window.api.employeurs.create(d)
      onEnregistre()
    } catch (e) {
      setErreur(msg(e))
      setOccupe(false)
    }
  }

  const nomValide = (d.nom ?? '').trim().length >= 2
  const teinte = d.couleur || TEINTES[0]

  return (
    <Modale
      titre={employeur ? `Dossier · ${employeur.nom}` : 'Nouveau dossier employeur'}
      onClose={onFerme}
      large
      pied={
        <>
          <button className="btn btn-secondaire" onClick={onFerme} disabled={occupe}>
            Annuler
          </button>
          <button className="btn btn-primaire" disabled={!nomValide || occupe} onClick={() => void enregistrer()}>
            {occupe ? 'Enregistrement…' : employeur ? 'Enregistrer les modifications' : 'Créer le dossier'}
          </button>
        </>
      }
    >
      <div className="fe">
        {/* Bandeau d'identité : ce qu'on est en train de créer, toujours visible. */}
        <header className="fe-tete" style={{ ['--teinte' as string]: teinte }}>
          <span className="fe-pastille" aria-hidden="true">
            {d.logo ? <img src={d.logo} alt="" /> : sigleAuto(d.nom || '?')}
          </span>
          <div className="fe-tete-corps">
            <strong>{(d.nom ?? '').trim() || 'Raison sociale du client'}</strong>
            <span>
              {[d.forme_juridique, d.ville, d.numero_cnss && `CNSS ${d.numero_cnss}`]
                .filter(Boolean)
                .join(' · ') || 'Forme juridique · Ville · N° CNSS'}
            </span>
          </div>
          <div className="fe-teintes">
            {TEINTES.map((t) => (
              <button
                key={t}
                type="button"
                className={`fe-teinte ${teinte === t ? 'actif' : ''}`}
                style={{ background: t }}
                aria-label={`Couleur de repérage ${t}`}
                aria-pressed={teinte === t}
                onClick={() => set('couleur', t)}
              />
            ))}
          </div>
        </header>

        <nav className="fe-onglets" role="tablist">
          {ONGLETS.map((o) => (
            <button
              key={o.cle}
              role="tab"
              aria-selected={onglet === o.cle}
              className={`fe-onglet ${onglet === o.cle ? 'actif' : ''}`}
              onClick={() => setOnglet(o.cle)}
            >
              <Icone nom={o.ico} size={16} />
              {o.libelle}
            </button>
          ))}
        </nav>

        {erreur && <p className="bandeau erreur">{erreur}</p>}

        <div className="fe-corps">
          {onglet === 'identite' && (
            <div className="grille-champs">
              {champ('nom', 'Raison sociale *', 'Ex. Boulangerie du Faso', true)}
              {champ('sigle', 'Sigle', 'Ex. BDF')}
              <label>
                Forme juridique
                <select
                  value={d.forme_juridique ?? ''}
                  onChange={(e) => set('forme_juridique', e.target.value)}
                >
                  <option value="">À préciser</option>
                  {FORMES_JURIDIQUES.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </label>
              {champ('rccm', 'N° RCCM', 'Ex. BF-OUA-2024-B-1234')}
              {champ('ifu', 'N° IFU', 'Ex. 00012345A')}
              {champ('numero_cnss', 'N° employeur CNSS', 'Ex. 012345 A')}
              <label>
                Date de création
                <input
                  type="date"
                  value={d.date_creation ?? ''}
                  onChange={(e) => set('date_creation', e.target.value)}
                />
              </label>
              {champ('secteur_activite', 'Secteur d’activité', 'Ex. Boulangerie-pâtisserie', true)}
            </div>
          )}

          {onglet === 'adresse' && (
            <div className="grille-champs">
              {champ('ville', 'Ville', 'Ex. Ouagadougou')}
              {champ('quartier', 'Quartier / secteur', 'Ex. Gounghin, secteur 8')}
              {champ('adresse', 'Adresse', 'Ex. Avenue de la Liberté, porte 245', true)}
              {champ('boite_postale', 'Boîte postale', 'Ex. 01 BP 1234 Ouagadougou 01')}
              {champ('telephone', 'Téléphone', 'Ex. 25 34 56 78')}
              {champ('email', 'Adresse électronique', 'Ex. contact@entreprise.bf', true)}
            </div>
          )}

          {onglet === 'representant' && (
            <>
              <p className="fe-aide">
                La personne qui signe les contrats, les certificats et les déclarations. Son nom et
                sa qualité apparaissent au bas des documents produits pour ce client.
              </p>
              <div className="grille-champs">
                {champ('representant_nom', 'Nom et prénoms', 'Ex. OUÉDRAOGO Salif', true)}
                {champ('representant_qualite', 'Qualité', 'Ex. Gérant, Directeur général')}
                {champ('representant_telephone', 'Téléphone direct', 'Ex. 70 12 34 56')}
              </div>
            </>
          )}

          {onglet === 'mission' && (
            <div className="grille-champs">
              <label>
                État du dossier
                <select value={d.etat ?? 'actif'} onChange={(e) => set('etat', e.target.value as never)}>
                  {ETATS_DOSSIER.map((x) => (
                    <option key={x.etat} value={x.etat}>
                      {x.libelle}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Périodicité de déclaration
                <select
                  value={d.periodicite ?? 'trimestrielle'}
                  onChange={(e) => set('periodicite', e.target.value as never)}
                >
                  <option value="trimestrielle">Trimestrielle</option>
                  <option value="mensuelle">Mensuelle (effectif ≥ 20)</option>
                </select>
              </label>
              {champ('contact_cabinet', 'Gestionnaire au cabinet', 'Ex. BAZIÉ Benoît')}
              <label>
                Honoraires mensuels (FCFA)
                <input
                  type="number"
                  min="0"
                  value={d.honoraires ?? ''}
                  placeholder="Ex. 75000"
                  onChange={(e) =>
                    set('honoraires', e.target.value === '' ? null : Number(e.target.value))
                  }
                />
              </label>
              <label className="pleine-largeur">
                Notes internes
                <textarea
                  rows={3}
                  value={d.notes ?? ''}
                  placeholder="Particularités du dossier, engagements, points de vigilance…"
                  onChange={(e) => set('notes', e.target.value)}
                />
              </label>
            </div>
          )}
        </div>

        {!employeur && (
          <p className="fe-note">
            <Icone nom="portefeuille" size={18} />
            <span>
              Ce client recevra <strong>sa propre base de données</strong>. Aucune information ne
              circule entre deux employeurs : salariés, salaires et déclarations restent
              hermétiquement séparés. Seule la raison sociale est obligatoire · le reste se
              complète à tout moment.
            </span>
          </p>
        )}
      </div>
    </Modale>
  )
}
