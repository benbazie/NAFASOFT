import { useEffect, useMemo, useState } from 'react'
import type { DashboardPanorama } from '../../../shared/types'
import type { Route } from '../App'
import { formatDate, formatMoney } from '../lib/format'
import { Icone, type NomIcone } from '../components/Icones'
import { AnneauRepartition, BarresParts, CourbeMasse, useCompteur } from '../components/graphiques'

interface Props {
  onNavigate: (route: Route) => void
}

/** Montant compact pour les grands chiffres : 1 250 000 → « 1,25 M ». */
function compact(n: number): string {
  if (Math.abs(n) >= 1_000_000)
    return (n / 1_000_000).toLocaleString('fr-FR', { maximumFractionDigits: 2 }) + ' M'
  if (Math.abs(n) >= 10_000) return Math.round(n / 1000).toLocaleString('fr-FR') + ' k'
  return Math.round(n).toLocaleString('fr-FR')
}

/** Une intervention attendue du gestionnaire, classée par urgence. */
interface Action {
  cle: string
  gravite: 'urgent' | 'attention' | 'info'
  icone: NomIcone
  titre: string
  detail: string
  vers: Route
  compte: string
}

/**
 * Tableau de bord · le poste de pilotage de la paie.
 *
 * Il répond à trois questions, dans cet ordre : qu'est-ce qui m'expose à une
 * pénalité ou me bloque aujourd'hui ? où en suis-je dans le cycle du mois ?
 * comment se porte la masse salariale ? Les chiffres d'agrément viennent
 * après · un tableau de bord de paie sert d'abord à ne rien laisser passer.
 */
export function Dashboard({ onNavigate }: Props): JSX.Element {
  const [p, setP] = useState<DashboardPanorama | null>(null)

  useEffect(() => {
    window.api.dashboard.panorama().then(setP)
  }, [])

  // ---------------------------------------------------- ce qu'il faut traiter
  // Anciennete de la derniere sauvegarde : c'est le seul point de la liste qui
  // ne parle pas de paie, et c'est aussi le seul dont l'oubli est irreparable.
  const [joursSauvegarde, setJoursSauvegarde] = useState<number | null>(null)
  useEffect(() => {
    window.api.sauvegarde.derniere().then((iso) => {
      setJoursSauvegarde(
        iso === null ? -1 : Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
      )
    })
  }, [])

  const actions = useMemo<Action[]>(() => {
    if (!p) return []
    const a: Action[] = []
    const ech = p.cotisations.prochaine_echeance

    if (ech) {
      const retard = ech.jours < 0
      a.push({
        cle: 'declaration',
        gravite: retard ? 'urgent' : ech.jours <= 15 ? 'attention' : 'info',
        icone: 'declarations',
        titre: retard
          ? `Déclaration CNSS en retard de ${Math.abs(ech.jours)} jour(s)`
          : `Déclaration CNSS à déposer dans ${ech.jours} jour(s)`,
        detail:
          `${ech.reference} · ${formatMoney(ech.montant)} · échéance ${formatDate(ech.date_limite)}` +
          (ech.majoration_estimee > 0
            ? ` · majoration estimée + ${formatMoney(ech.majoration_estimee)}`
            : ''),
        vers: 'declarations',
        compte: retard ? 'RETARD' : `J−${ech.jours}`
      })
    }

    // -1 = jamais sauvegardé ; au-delà de 30 jours on le dit franchement.
    if (joursSauvegarde !== null && (joursSauvegarde === -1 || joursSauvegarde > 30)) {
      const jamais = joursSauvegarde === -1
      a.push({
        cle: 'sauvegarde',
        gravite: jamais || joursSauvegarde > 90 ? 'urgent' : 'attention',
        icone: 'archive',
        titre: jamais ? 'Aucune sauvegarde de vos données' : `Dernière sauvegarde il y a ${joursSauvegarde} jours`,
        detail:
          'Bulletins, déclarations et dossiers du personnel ne tiennent qu’à ce poste · Paramètres › Sauvegarde',
        vers: 'parametres',
        compte: jamais ? 'JAMAIS' : `${joursSauvegarde} j`
      })
    }

    const nonSoldes = p.paie.bulletins_total - p.paie.bulletins_payes
    if (nonSoldes > 0) {
      a.push({
        cle: 'bulletins',
        gravite: 'attention',
        icone: 'paie',
        titre: `${nonSoldes} bulletin(s) non soldé(s)`,
        detail: `${formatMoney(p.paie.net_du)} restant à verser aux salariés`,
        vers: 'payroll',
        compte: String(nonSoldes)
      })
    }

    if (p.contrats.expires > 0) {
      a.push({
        cle: 'contrats-expires',
        gravite: 'urgent',
        icone: 'contrats',
        titre: `${p.contrats.expires} contrat(s) expiré(s)`,
        detail: 'À renouveler ou à clôturer sans délai',
        vers: 'contracts',
        compte: String(p.contrats.expires)
      })
    } else if (p.contrats.a_echeance > 0) {
      a.push({
        cle: 'contrats',
        gravite: 'attention',
        icone: 'contrats',
        titre: `${p.contrats.a_echeance} contrat(s) arrivent à terme`,
        detail: 'Dans les trente prochains jours',
        vers: 'contracts',
        compte: String(p.contrats.a_echeance)
      })
    }

    const nonPointes = p.pointage_jour.filter((l) => l.code === null).length
    if (nonPointes > 0) {
      a.push({
        cle: 'pointage',
        gravite: 'info',
        icone: 'pointage',
        titre: `${nonPointes} salarié(s) non pointé(s) aujourd'hui`,
        detail: 'Le pointage conditionne les retenues pour absence',
        vers: 'register',
        compte: String(nonPointes)
      })
    }

    if (p.jour.conges_en_attente > 0) {
      a.push({
        cle: 'conges',
        gravite: 'info',
        icone: 'conges',
        titre: `${p.jour.conges_en_attente} demande(s) de congé en attente`,
        detail: 'À accorder ou à refuser',
        vers: 'leaves',
        compte: String(p.jour.conges_en_attente)
      })
    }

    const rang = { urgent: 0, attention: 1, info: 2 }
    return a.sort((x, y) => rang[x.gravite] - rang[y.gravite])
  }, [p, joursSauvegarde])

  // ------------------------------------------- où en est le cycle du mois ?
  const cycle = useMemo(() => {
    if (!p) return []
    const effectif = Math.max(1, p.effectif.actifs)
    // 22 jours ouvrés de référence : sert seulement à jauger l'avancement.
    const avancement = Math.round((p.presences.saisies / (effectif * 22)) * 100)
    const bulletins = p.paie.dernier_mois?.bulletins ?? 0
    const toutDeclare = p.cotisations.declarations > 0 && p.cotisations.en_attente === 0
    return [
      {
        cle: 'pointage',
        libelle: 'Pointage',
        etat: avancement >= 90 ? 'fait' : avancement > 0 ? 'encours' : 'attente',
        note: `${p.presences.saisies} saisie(s)`,
        vers: 'register' as Route
      },
      {
        cle: 'ajustements',
        libelle: 'Primes & retenues',
        etat: p.ajustements.lignes > 0 ? 'fait' : 'attente',
        note: p.ajustements.lignes > 0 ? `${p.ajustements.lignes} ligne(s)` : 'aucune',
        vers: 'adjustments' as Route
      },
      {
        cle: 'bulletins',
        libelle: 'Bulletins',
        etat: bulletins >= effectif ? 'fait' : bulletins > 0 ? 'encours' : 'attente',
        note: `${bulletins} / ${effectif}`,
        vers: 'payroll' as Route
      },
      {
        cle: 'declaration',
        libelle: 'Déclaration CNSS',
        etat: toutDeclare ? 'fait' : p.cotisations.declarations > 0 ? 'encours' : 'attente',
        note: toutDeclare ? 'déposée' : `${p.cotisations.en_attente} en attente`,
        vers: 'declarations' as Route
      }
    ]
  }, [p])

  if (!p) {
    return (
      <div className="tb-chargement">
        <span className="tb-spin" aria-hidden="true" />
        <p>Chargement du tableau de bord…</p>
      </div>
    )
  }

  const dm = p.paie.dernier_mois
  const moisLibelle = dm?.libelle ?? p.mois_courant
  const chargesPatronales = Math.max(0, (dm?.cout_employeur ?? 0) - (dm?.brut ?? 0))

  return (
    <div className="tb">
      <header className="tb-tete">
        <div>
          <h1>Tableau de bord</h1>
          <p>
            Situation au {formatDate(p.genere_le.slice(0, 10))} · {p.effectif.actifs} salarié(s) en
            activité · masse contractuelle {formatMoney(p.effectif.masse_contractuelle)}
          </p>
        </div>
        <div className="tb-tete-actions">
          <button className="btn btn-secondaire btn-sm" onClick={() => onNavigate('payroll')}>
            Ouvrir la paie
          </button>
          <button className="btn btn-primaire btn-sm" onClick={() => onNavigate('declarations')}>
            Déclarations CNSS
          </button>
        </div>
      </header>

      {/* ------------------------------------------- 1. cycle du mois ------ */}
      <section className="tb-bloc">
        <div className="tb-bloc-tete">
          <h2>Cycle de paie · {moisLibelle}</h2>
          <span className="tb-note">les quatre étapes du mois, dans l'ordre</span>
        </div>
        <ol className="tb-cycle">
          {cycle.map((e, i) => (
            <li key={e.cle} className={`tb-etape ${e.etat}`}>
              <button onClick={() => onNavigate(e.vers)}>
                <span className="te-puce" aria-hidden="true">
                  {e.etat === 'fait' ? '✓' : i + 1}
                </span>
                <span className="te-corps">
                  <span className="te-lib">{e.libelle}</span>
                  <span className="te-note">{e.note}</span>
                </span>
              </button>
            </li>
          ))}
        </ol>
      </section>

      {/* ------------------------------------------ 3. chiffres de la paie - */}
      <section className="tb-bloc">
        <div className="tb-bloc-tete">
          <h2>Paie de {moisLibelle}</h2>
          <span className="tb-note">
            {dm ? `${dm.bulletins} bulletin(s) archivé(s)` : 'aucun bulletin archivé'}
          </span>
        </div>
        <div className="tb-kpis">
          <Kpi
            libelle="Masse brute"
            valeur={dm?.brut ?? 0}
            variation={p.paie.variation_pct}
            ton="brut"
          />
          <Kpi
            libelle="Net à payer"
            valeur={dm?.net ?? 0}
            ton="net"
            note={`${formatMoney(p.paie.net_moyen)} en moyenne`}
          />
          <Kpi
            libelle="Retenues salariales"
            valeur={dm?.retenues ?? 0}
            ton="retenue"
            note="CNSS + IUTS"
          />
          <Kpi
            libelle="Charges patronales"
            valeur={chargesPatronales}
            ton="cout"
            note={`coût total ${compact(dm?.cout_employeur ?? 0)}`}
          />
        </div>
      </section>

      {/* -------------------------------------------------- 4. analyse ----- */}
      <div className="tb-duo">
        <section className="tb-bloc">
          <div className="tb-bloc-tete">
            <h2>Masse salariale sur douze mois</h2>
            <span className="tb-note">reconstituée depuis les bulletins archivés</span>
          </div>
          <CourbeMasse mois={p.masse} formatValeur={compact} />
        </section>

        <section className="tb-bloc">
          <div className="tb-bloc-tete">
            <h2>Où va la masse</h2>
            <span className="tb-note">{moisLibelle}</span>
          </div>
          <AnneauRepartition
            centre={compact(dm?.net ?? 0)}
            legende="net à payer"
            tranches={[
              { libelle: 'Net à payer', valeur: dm?.net ?? 0, teinte: 'an-1' },
              { libelle: 'Retenues salariales', valeur: dm?.retenues ?? 0, teinte: 'an-2' },
              { libelle: 'Charges patronales', valeur: chargesPatronales, teinte: 'an-3' }
            ]}
            formatValeur={(v) => formatMoney(v)}
          />
        </section>
      </div>

      {/* -------------------------------------------------- 5. effectif ---- */}
      <div className="tb-trio">
        <section className="tb-bloc">
          <div className="tb-bloc-tete">
            <h2>Effectif</h2>
            <span className="tb-note">sur douze mois</span>
          </div>
          <div className="tb-flux">
            <span className="tf-item entree">
              <b>+{p.effectif.entrees_12m}</b> entrée(s)
            </span>
            <span className="tf-item sortie">
              <b>−{p.effectif.sorties_12m}</b> sortie(s)
            </span>
            <span className="tf-item neutre">
              <b>{(p.effectif.anciennete_moyenne_mois / 12).toFixed(1)} an</b> d'ancienneté
            </span>
          </div>
          <BarresParts parts={p.effectif.par_poste.slice(0, 5)} />
        </section>

        <section className="tb-bloc">
          <div className="tb-bloc-tete">
            <h2>Assiduité</h2>
            <span className="tb-note">{p.presences.saisies} jour(s) pointé(s)</span>
          </div>
          <div className="tb-grand">
            <span className="tg-val">{p.presences.taux_presence} %</span>
            <span className="tg-lib">de présence sur les jours saisis</span>
          </div>
          <BarresParts
            parts={[
              { cle: 'p', libelle: 'Présences', valeur: p.presences.presents },
              { cle: 'a', libelle: 'Absences', valeur: p.presences.absents },
              { cle: 'c', libelle: 'Congés', valeur: p.presences.conges },
              { cle: 'r', libelle: 'Repos', valeur: p.presences.repos }
            ]}
          />
        </section>

        <section className="tb-bloc">
          <div className="tb-bloc-tete">
            <h2>Cotisations CNSS</h2>
            <span className="tb-note">cumul de l'année</span>
          </div>
          <div className="tb-grand">
            <span className="tg-val">{compact(p.cotisations.total_annee)}</span>
            <span className="tg-lib">déclarées depuis janvier</span>
          </div>
          <div className="tb-etats">
            <span className="tbe ok">
              <b>{p.cotisations.deposees}</b> déposée(s)
            </span>
            <span className={`tbe ${p.cotisations.en_attente > 0 ? 'attente' : ''}`}>
              <b>{p.cotisations.en_attente}</b> en attente
            </span>
          </div>
          <BarresParts parts={p.effectif.par_categorie} />
        </section>
      </div>

      {/* --------------------------------------------------- 6. à traiter -- */}
      <section className="tb-bloc">
        <div className="tb-bloc-tete">
          <h2>À traiter</h2>
          <span className="tb-note">{actions.length} point(s) d'attention</span>
        </div>
        {actions.length === 0 ? (
          <div className="tb-rien">
            <Icone nom="declarations" size={24} />
            <div>
              <strong>Tout est à jour.</strong>
              <span>
                Aucune échéance dépassée, aucun bulletin en attente, aucun contrat à renouveler.
              </span>
            </div>
          </div>
        ) : (
          <div className="tb-actions">
            {actions.map((a, i) => (
              <button
                key={a.cle}
                className={`tb-action ${a.gravite}`}
                style={{ ['--retard' as string]: `${i * 55}ms` }}
                onClick={() => onNavigate(a.vers)}
              >
                <span className="ta-ico">
                  <Icone nom={a.icone} size={20} />
                </span>
                <span className="ta-corps">
                  <span className="ta-titre">{a.titre}</span>
                  <span className="ta-detail">{a.detail}</span>
                </span>
                <span className="ta-compte">{a.compte}</span>
                <Icone nom="chevron" size={16} className="ta-fleche" />
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

/** Indicateur chiffré, avec montée progressive et variation mensuelle. */
function Kpi({
  libelle,
  valeur,
  variation,
  ton,
  note
}: {
  libelle: string
  valeur: number
  variation?: number | null
  ton: string
  note?: string
}): JSX.Element {
  const anime = useCompteur(valeur)
  return (
    <div className={`tb-kpi ${ton}`}>
      <span className="kpi-lib">{libelle}</span>
      <span className="kpi-val">{formatMoney(anime)}</span>
      <span className="kpi-note">
        {variation !== undefined && variation !== null ? (
          <span className={`kpi-var ${variation >= 0 ? 'hausse' : 'baisse'}`}>
            {variation >= 0 ? '▲' : '▼'} {Math.abs(variation)} % sur un mois
          </span>
        ) : (
          note
        )}
      </span>
    </div>
  )
}
