import { useEffect, useMemo, useState } from 'react'
import type {
  AppConfig,
  ArticleContrat,
  Contract,
  ContractData,
  ContractInput,
  ContractType,
  Employee,
  ModeSalaire,
  StatutContrat
} from '../../../shared/types'
import { STATUTS_CONTRAT, ARTICLES_DEFAUT, VARIABLES_CONTRAT } from '../../../shared/types'
import { Modale } from './Modale'
import { PreviewFrame } from './PreviewFrame'
import { contratHtml, donneesContrat } from '../lib/documents'
import { imprimerDocument } from '../lib/print'
import { ajouterMois } from '../lib/config'
import { todayISO, formatMoney } from '../lib/format'

const TYPES: ContractType[] = ['CDD', 'CDI', 'Extra', 'Apprentissage', 'Stage', 'Interim']

/** Valeurs de départ : celles du contrat repris, sinon celles de la fiche salarié. */
function valeursInitiales(
  employee: Employee,
  config: AppConfig,
  contrat: Contract | null
): ContractInput {
  if (contrat) return { ...contrat }
  const debut = employee.date_embauche || todayISO()
  // Le mensuel est la norme au Burkina Faso (le SMIG lui-meme est mensuel) ;
  // l'horaire est l'exception, et ne s'impose que si un taux horaire a
  // réellement été saisi. Deduire « horaire » du seul fait que le salaire
  // mensuel est vide était un piège : un champ vide veut dire « pas encore
  // rempli », pas « payé à l'heure ». Le montant saisi partait alors en taux
  // horaire, et la paie ne trouvait plus aucun salaire à déclarer.
  const mode: ModeSalaire =
    (employee.salaire_mensuel ?? 0) > 0 || (employee.salaire_horaire ?? 0) === 0
      ? 'mensuel'
      : 'horaire'
  return {
    employee_id: employee.id,
    reference: '',
    type_contrat: employee.type_contrat,
    poste: employee.poste,
    date_debut: debut,
    date_fin: employee.date_fin_contrat || ajouterMois(debut, config.contrat_duree_mois),
    duree_mois: config.contrat_duree_mois,
    mode_salaire: mode,
    salaire_montant:
      mode === 'mensuel' ? (employee.salaire_mensuel ?? 0) : (employee.salaire_horaire ?? 0),
    heures_hebdo: employee.heures_hebdo ?? 40,
    jours_repos: config.contrat_jours_repos,
    periode_essai: config.contrat_periode_essai,
    clauses: config.contrat_clauses,
    articles: ARTICLES_DEFAUT.map((a) => ({ ...a })),
    lieu_signature: config.entreprise_ville,
    statut: 'Brouillon',
    date_signature: null,
    parent_id: null,
    motif_rupture: null
  }
}


export function ContractEditor({
  employee,
  config,
  contrat,
  avenantDe,
  onClose,
  onSaved
}: {
  employee: Employee
  config: AppConfig
  /** Contrat existant à modifier, ou null pour en créer un. */
  contrat?: Contract | null
  /** Contrat que le nouveau prolonge (renouvellement / avenant). */
  avenantDe?: Contract | null
  onClose: () => void
  onSaved: () => void
}): JSX.Element {
  const [d, setD] = useState<ContractInput>(() => {
    const base = valeursInitiales(employee, config, contrat ?? null)
    if (!contrat && avenantDe) {
      // Un renouvellement reprend les conditions et démarre au lendemain du terme.
      const debut = avenantDe.date_fin ? ajouterMois(avenantDe.date_fin, 0) : todayISO()
      return {
        ...base,
        type_contrat: avenantDe.type_contrat,
        poste: avenantDe.poste,
        mode_salaire: avenantDe.mode_salaire,
        salaire_montant: avenantDe.salaire_montant,
        heures_hebdo: avenantDe.heures_hebdo,
        jours_repos: avenantDe.jours_repos,
        clauses: avenantDe.clauses,
        date_debut: debut,
        date_fin: ajouterMois(debut, avenantDe.duree_mois ?? config.contrat_duree_mois),
        duree_mois: avenantDe.duree_mois ?? config.contrat_duree_mois,
        periode_essai: '', // pas de nouvelle période d'essai sur un renouvellement
        parent_id: avenantDe.id
      }
    }
    return base
  })
  const [enreg, setEnreg] = useState(false)
  const [onglet, setOnglet] = useState<'conditions' | 'articles'>('conditions')

  function set<K extends keyof ContractInput>(cle: K, val: ContractInput[K]): void {
    setD((prev) => ({ ...prev, [cle]: val }))
  }

  const estCDI = d.type_contrat === 'CDI'

  // Attribue une référence dès que le type change, tant que le contrat n'est pas enregistré.
  useEffect(() => {
    if (contrat) return
    const annee = d.date_debut.slice(0, 4)
    window.api.contracts.nextReference(d.type_contrat, annee).then((r) => set('reference', r))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d.type_contrat, d.date_debut.slice(0, 4)])

  // Recalcule le terme quand la durée ou le début change (sans objet pour un CDI).
  useEffect(() => {
    if (estCDI) {
      setD((prev) => ({ ...prev, date_fin: null, duree_mois: null }))
      return
    }
    setD((prev) => ({
      ...prev,
      date_fin: ajouterMois(prev.date_debut, prev.duree_mois ?? 3)
    }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d.date_debut, d.duree_mois, estCDI])

  const donnees = useMemo(() => donneesContrat(d, employee, config), [d, employee, config])
  const corps = useMemo(() => contratHtml(donnees, config), [donnees, config])

  // --- Manipulation des articles ---
  function majArticle(index: number, champ: keyof ArticleContrat, valeur: string): void {
    setD((prev) => ({
      ...prev,
      articles: prev.articles.map((a, i) => (i === index ? { ...a, [champ]: valeur } : a))
    }))
  }

  function ajouterArticle(): void {
    setD((prev) => ({
      ...prev,
      articles: [...prev.articles, { titre: 'Nouvel article', contenu: '' }]
    }))
  }

  function supprimerArticle(index: number): void {
    setD((prev) => ({ ...prev, articles: prev.articles.filter((_, i) => i !== index) }))
  }

  /** Déplace un article d'un cran vers le haut (-1) ou vers le bas (+1). */
  function deplacerArticle(index: number, sens: -1 | 1): void {
    setD((prev) => {
      const cible = index + sens
      if (cible < 0 || cible >= prev.articles.length) return prev
      const copie = [...prev.articles]
      ;[copie[index], copie[cible]] = [copie[cible], copie[index]]
      return { ...prev, articles: copie }
    })
  }

  function retablirArticles(): void {
    setD((prev) => ({ ...prev, articles: ARTICLES_DEFAUT.map((a) => ({ ...a })) }))
  }

  async function enregistrer(): Promise<void> {
    setEnreg(true)
    try {
      if (contrat) await window.api.contracts.update(contrat.id, d)
      else await window.api.contracts.create(d)
      onSaved()
    } finally {
      setEnreg(false)
    }
  }

  const titre = contrat
    ? `Contrat ${contrat.reference} · ${employee.prenom} ${employee.nom}`
    : avenantDe
      ? `Renouvellement du contrat ${avenantDe.reference}`
      : `Nouveau contrat · ${employee.prenom} ${employee.nom}`

  return (
    <Modale
      titre={titre}
      onClose={onClose}
      large
      pied={
        <>
          <button className="btn btn-secondaire" onClick={onClose}>
            Annuler
          </button>
          <button
            className="btn btn-secondaire"
            onClick={() =>
              imprimerDocument(`Contrat · ${employee.prenom} ${employee.nom}`, corps)
            }
          >
            Imprimer / PDF
          </button>
          <button className="btn btn-primaire" onClick={enregistrer} disabled={enreg}>
            {enreg ? 'Enregistrement…' : 'Enregistrer le contrat'}
          </button>
        </>
      }
    >
      <div className="editeur-doc">
        <div className="formulaire-colonne">
          <div className="onglets">
            <button
              className={`onglet ${onglet === 'conditions' ? 'actif' : ''}`}
              onClick={() => setOnglet('conditions')}
            >
              Conditions
            </button>
            <button
              className={`onglet ${onglet === 'articles' ? 'actif' : ''}`}
              onClick={() => setOnglet('articles')}
            >
              Articles ({d.articles.length})
            </button>
          </div>

          {onglet === 'articles' ? (
            <>
              <div className="encart" style={{ marginBottom: 'var(--e3)' }}>
                Insérez des variables entre doubles accolades : elles sont remplacées à
                l'impression par les valeurs du contrat, et restent donc justes si vous
                modifiez le salaire ou les dates.
                <div className="liste-variables">
                  {VARIABLES_CONTRAT.map((v) => (
                    <code key={v.cle} title={v.description}>{`{{${v.cle}}}`}</code>
                  ))}
                </div>
              </div>

              <div className="liste-articles">
                {d.articles.map((a, i) => (
                  <div className="article-carte" key={i}>
                    <div className="article-entete">
                      <span className="article-num">Article {i + 1}</span>
                      <div className="article-actions">
                        <button
                          className="btn-discret btn-sm"
                          title="Monter"
                          disabled={i === 0}
                          onClick={() => deplacerArticle(i, -1)}
                        >
                          ↑
                        </button>
                        <button
                          className="btn-discret btn-sm"
                          title="Descendre"
                          disabled={i === d.articles.length - 1}
                          onClick={() => deplacerArticle(i, 1)}
                        >
                          ↓
                        </button>
                        <button
                          className="btn-danger btn-sm"
                          title="Supprimer cet article"
                          onClick={() => supprimerArticle(i)}
                        >
                          Supprimer
                        </button>
                      </div>
                    </div>
                    <input
                      className="article-titre"
                      value={a.titre}
                      placeholder="Intitulé de l'article"
                      onChange={(e) => majArticle(i, 'titre', e.target.value)}
                    />
                    <textarea
                      className="article-contenu"
                      rows={4}
                      value={a.contenu}
                      placeholder="Texte de l'article…"
                      onChange={(e) => majArticle(i, 'contenu', e.target.value)}
                    />
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 'var(--e2)', marginTop: 'var(--e3)' }}>
                <button className="btn btn-secondaire" onClick={ajouterArticle}>
                  + Ajouter un article
                </button>
                <button className="btn btn-discret" onClick={retablirArticles}>
                  Rétablir la trame standard
                </button>
              </div>
            </>
          ) : (
            <>
          {d.statut === 'Signé' && (
            <div className="encart" style={{ marginBottom: 'var(--e4)' }}>
              À l'enregistrement, les conditions de ce contrat (poste, salaire, dates, heures)
              seront <strong>reportées sur la fiche du salarié</strong> et serviront de base à
              la paie.
            </div>
          )}

          <div className="grille-champs">
            <div className="champ">
              <label>Référence</label>
              <input value={d.reference} onChange={(e) => set('reference', e.target.value)} />
            </div>
            <div className="champ">
              <label>Statut</label>
              <select
                value={d.statut}
                onChange={(e) => set('statut', e.target.value as StatutContrat)}
              >
                {STATUTS_CONTRAT.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="champ">
              <label>Type de contrat</label>
              <select
                value={d.type_contrat}
                onChange={(e) => set('type_contrat', e.target.value as ContractType)}
              >
                {TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="champ">
              <label>Poste</label>
              <input value={d.poste} onChange={(e) => set('poste', e.target.value)} />
            </div>
            <div className="champ">
              <label>Date de début</label>
              <input
                type="date"
                value={d.date_debut}
                onChange={(e) => set('date_debut', e.target.value)}
              />
            </div>
            <div className="champ">
              <label>Durée (mois)</label>
              <input
                type="number"
                min="1"
                disabled={estCDI}
                value={d.duree_mois ?? ''}
                onChange={(e) => set('duree_mois', Number(e.target.value) || 1)}
              />
              {estCDI && <span className="aide">Sans objet pour un CDI</span>}
            </div>
            <div className="champ">
              <label>Date de fin</label>
              <input
                type="date"
                disabled={estCDI}
                value={d.date_fin ?? ''}
                onChange={(e) => set('date_fin', e.target.value || null)}
              />
            </div>
            <div className="champ">
              <label>Période d'essai</label>
              <input
                value={d.periode_essai}
                onChange={(e) => set('periode_essai', e.target.value)}
              />
            </div>
            <div className="champ">
              <label>Mode de salaire</label>
              <select
                value={d.mode_salaire}
                onChange={(e) => set('mode_salaire', e.target.value as ModeSalaire)}
              >
                <option value="mensuel">Mensuel</option>
                <option value="horaire">Horaire</option>
              </select>
            </div>
            <div className="champ">
              <label>
                Montant ({config.devise}){' '}
                <span className="champ-unite">
                  {d.mode_salaire === 'mensuel' ? 'par mois' : 'par heure'}
                </span>
              </label>
              <input
                type="number"
                min="0"
                value={d.salaire_montant}
                onChange={(e) => set('salaire_montant', Number(e.target.value) || 0)}
              />
              {/* Un montant mensuel saisi dans la case « horaire » donne un
                  salaire absurde que rien ne signalait : la paie se contentait
                  de tomber a zero. On montre ce que le taux implique. */}
              {d.mode_salaire === 'horaire' && d.salaire_montant > 0 && (
                <p
                  className={`champ-aide ${
                    d.salaire_montant * (d.heures_hebdo || 40) * (52 / 12) > 2_000_000
                      ? 'attention'
                      : ''
                  }`}
                >
                  Soit environ{' '}
                  {formatMoney(
                    Math.round(d.salaire_montant * (d.heures_hebdo || 40) * (52 / 12))
                  )}{' '}
                  par mois.
                  {d.salaire_montant * (d.heures_hebdo || 40) * (52 / 12) > 2_000_000 &&
                    ' Vouliez-vous saisir un salaire mensuel ?'}
                </p>
              )}
            </div>
            <div className="champ">
              <label>Heures / semaine</label>
              <input
                type="number"
                min="0"
                value={d.heures_hebdo}
                onChange={(e) => set('heures_hebdo', Number(e.target.value) || 0)}
              />
            </div>
            <div className="champ">
              <label>Repos hebdomadaire (jours)</label>
              <input
                type="number"
                min="0"
                max="7"
                value={d.jours_repos}
                onChange={(e) => set('jours_repos', Number(e.target.value) || 0)}
              />
            </div>
            <div className="champ">
              <label>Date de signature</label>
              <input
                type="date"
                value={d.date_signature ?? ''}
                onChange={(e) => set('date_signature', e.target.value || null)}
              />
            </div>
            <div className="champ">
              <label>Lieu de signature</label>
              <input
                value={d.lieu_signature}
                onChange={(e) => set('lieu_signature', e.target.value)}
              />
            </div>
            {d.statut === 'Rompu' && (
              <div className="champ pleine-largeur">
                <label>Motif de la rupture</label>
                <input
                  value={d.motif_rupture ?? ''}
                  onChange={(e) => set('motif_rupture', e.target.value || null)}
                />
              </div>
            )}
            <div className="champ pleine-largeur">
              <label>Dispositions particulières</label>
              <textarea
                rows={3}
                value={d.clauses}
                placeholder="Une disposition par ligne · elles s'ajoutent en fin de contrat."
                onChange={(e) => set('clauses', e.target.value)}
              />
            </div>
          </div>
            </>
          )}
        </div>

        <div className="apercu-colonne">
          <PreviewFrame titre="Contrat" corps={corps} hauteur={560} />
        </div>
      </div>
    </Modale>
  )
}
