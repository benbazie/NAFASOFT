import { useEffect, useMemo, useState } from 'react'
import type { BilanEmployeur, EmployeurRegistre, SessionUtilisateur } from '../../../shared/types'
import { ETATS_DOSSIER } from '../../../shared/types'
import { formatMoney } from '../lib/format'
import { PRODUIT } from '../lib/produit'
import { MarqueNafasoft } from '../components/Logo'
import { Icone } from '../components/Icones'
import { Confirm } from '../components/Confirm'
import { FicheEmployeur, TEINTES, sigleAuto } from '../components/FicheEmployeur'
import { jouer } from '../lib/son'

const msg = (e: unknown): string => String((e as Error)?.message ?? e)

type Filtre = 'tous' | 'alertes' | 'archives'
type Vue = 'cartes' | 'tableau'
type Tri = 'urgence' | 'nom' | 'effectif' | 'masse' | 'echeance'

const TRIS: { cle: Tri; libelle: string }[] = [
  { cle: 'urgence', libelle: 'Urgence' },
  { cle: 'nom', libelle: 'Nom' },
  { cle: 'effectif', libelle: 'Effectif' },
  { cle: 'masse', libelle: 'Masse salariale' },
  { cle: 'echeance', libelle: 'Échéance' }
]

/** Un employeur, vu du portefeuille : ses indicateurs ET sa fiche. */
interface Client extends BilanEmployeur {
  fiche?: EmployeurRegistre
}

/** Formule courte pour une échéance de déclaration. */
function libelleEcheance(jours: number | null): { texte: string; ton: string } | null {
  if (jours === null) return null
  if (jours < 0) return { texte: `En retard de ${-jours} j`, ton: 'erreur' }
  if (jours === 0) return { texte: "À déposer aujourd'hui", ton: 'alerte' }
  if (jours <= 15) return { texte: `À déposer dans ${jours} j`, ton: 'alerte' }
  return { texte: `Échéance dans ${jours} j`, ton: 'neutre' }
}

type Ton = 'ok' | 'alerte' | 'erreur'

/**
 * Santé du dossier sur trois domaines — ce qu'un comptable vérifie pour
 * chaque client, condensé en trois puces colorées. Le détail textuel importe
 * moins ici que la couleur : sur vingt cartes, c'est elle qu'on balaie.
 */
function santeClient(b: BilanEmployeur): Record<'declarations' | 'paie' | 'contrats', Ton> {
  return {
    declarations: b.declaration_retard
      ? 'erreur'
      : b.jours_echeance !== null && b.jours_echeance <= 15
        ? 'alerte'
        : 'ok',
    paie: b.bulletins_attente > 0 ? 'alerte' : 'ok',
    contrats: b.contrats_echeance > 0 ? 'alerte' : 'ok'
  }
}

/**
 * Le SEUL point qui compte pour ce client aujourd'hui, par ordre de gravité.
 * Une carte ne doit pas énumérer tout ce qui pourrait clocher — juste dire ce
 * qui cloche vraiment, ou confirmer que rien ne cloche.
 */
function essentielClient(b: BilanEmployeur): { texte: string; ton: 'neutre' | 'alerte' | 'erreur' } {
  if (b.declaration_retard) {
    const retard = b.jours_echeance !== null ? -b.jours_echeance : 0
    const majoration =
      b.majoration_estimee > 0 ? ` · majoration estimée +${formatMoney(b.majoration_estimee)}` : ''
    return { texte: `En retard de ${retard} j${majoration}`, ton: 'erreur' }
  }
  if (b.jours_echeance !== null && b.jours_echeance <= 15) {
    return {
      texte:
        b.jours_echeance === 0
          ? "Déclaration à déposer aujourd'hui"
          : `Déclaration à déposer dans ${b.jours_echeance} j`,
      ton: 'alerte'
    }
  }
  if (b.bulletins_attente > 0) {
    return { texte: `${b.bulletins_attente} bulletin(s) non soldé(s)`, ton: 'alerte' }
  }
  if (b.contrats_echeance > 0) {
    return {
      texte: `${b.contrats_echeance} contrat${b.contrats_echeance > 1 ? 's' : ''} à échéance`,
      ton: 'alerte'
    }
  }
  return { texte: 'Rien à signaler', ton: 'neutre' }
}

/**
 * Portefeuille · le module de gestion des employeurs suivis.
 *
 * Il précède le choix d'un dossier : aucune base client n'est encore ouverte,
 * tout vient du registre. Ce n'est pas un sélecteur mais un poste de travail :
 * on y consulte l'état de chaque client, on modifie sa fiche, on l'exporte, on
 * le sauvegarde, et seulement ensuite on entre dedans.
 */
export function PortefeuillePage({
  session,
  onOuvrir,
  onDeconnexion
}: {
  session: SessionUtilisateur
  onOuvrir: (id: number) => void
  onDeconnexion: () => void
}): JSX.Element {
  const [bilans, setBilans] = useState<BilanEmployeur[]>([])
  const [archives, setArchives] = useState<BilanEmployeur[]>([])
  const [registre, setRegistre] = useState<EmployeurRegistre[]>([])
  const [charge, setCharge] = useState(false)
  const [erreur, setErreur] = useState('')
  const [info, setInfo] = useState('')

  const [filtre, setFiltre] = useState<Filtre>('tous')
  const [vue, setVue] = useState<Vue>(() => (localStorage.getItem('pf-vue') as Vue) || 'cartes')
  const [tri, setTri] = useState<Tri>('urgence')
  const [q, setQ] = useState('')

  const [form, setForm] = useState<{ id: number | null } | null>(null)
  const [detail, setDetail] = useState<number | null>(null)
  const [aSupprimer, setASupprimer] = useState<BilanEmployeur | null>(null)
  const [occupe, setOccupe] = useState<number | 'tout' | null>(null)
  const [joursSauvegarde, setJoursSauvegarde] = useState<number | null>(null)

  function choisirVue(v: Vue): void {
    setVue(v)
    localStorage.setItem('pf-vue', v)
  }

  function flash(m: string): void {
    setInfo(m)
    window.setTimeout(() => setInfo(''), 6000)
  }

  async function charger(): Promise<void> {
    try {
      const [b, tous] = await Promise.all([
        window.api.employeurs.bilan(),
        window.api.employeurs.list(true)
      ])
      setBilans(b)
      setRegistre(tous)
      // Les archivés n'ont pas de bilan (on n'ouvre pas leur base pour rien) :
      // on les affiche en fiche d'identité seule, prêts à être réactivés.
      const actifs = new Set(b.map((x) => x.id))
      setArchives(
        tous
          .filter((e) => !actifs.has(e.id))
          .map((e) => ({
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
          }))
      )
      const iso = await window.api.sauvegarde.derniere()
      setJoursSauvegarde(
        iso === null ? -1 : Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
      )
      setErreur('')
    } catch (e) {
      setErreur(msg(e))
    } finally {
      setCharge(true)
    }
  }

  useEffect(() => {
    void charger()
  }, [])

  const parId = useMemo(() => new Map(registre.map((e) => [e.id, e])), [registre])

  const totaux = useMemo(
    () => ({
      clients: bilans.length,
      effectif: bilans.reduce((s, b) => s + b.effectif, 0),
      masse: bilans.reduce((s, b) => s + b.masse_mois, 0),
      du: bilans.reduce((s, b) => s + b.net_du, 0),
      alertes: bilans.reduce((s, b) => s + b.alertes, 0),
      retards: bilans.filter((b) => b.declaration_retard).length,
      majorations: bilans.reduce((s, b) => s + b.majoration_estimee, 0),
      honoraires: registre.reduce((s, e) => s + (e.honoraires ?? 0), 0)
    }),
    [bilans, registre]
  )

  const liste = useMemo<Client[]>(() => {
    const source = filtre === 'archives' ? archives : bilans
    const t = q.trim().toLowerCase()
    const rang = (b: BilanEmployeur): number =>
      b.declaration_retard ? 0 : b.alertes > 0 ? 1 : 2
    return source
      .filter((b) => (filtre === 'alertes' ? b.alertes > 0 : true))
      .filter((b) => {
        if (!t) return true
        const f = parId.get(b.id)
        return [b.nom, b.ville, b.numero_cnss, f?.sigle, f?.rccm, f?.representant_nom]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(t))
      })
      .map((b) => ({ ...b, fiche: parId.get(b.id) }))
      .sort((a, b) => {
        switch (tri) {
          case 'nom':
            return a.nom.localeCompare(b.nom, 'fr')
          case 'effectif':
            return b.effectif - a.effectif
          case 'masse':
            return b.masse_mois - a.masse_mois
          case 'echeance':
            return (a.jours_echeance ?? 9999) - (b.jours_echeance ?? 9999)
          default:
            return rang(a) - rang(b) || b.alertes - a.alertes || a.nom.localeCompare(b.nom, 'fr')
        }
      })
  }, [bilans, archives, filtre, q, tri, parId])

  const fiche = detail !== null ? parId.get(detail) : undefined
  const bilanDetail = detail !== null ? bilans.find((b) => b.id === detail) : undefined

  // ------------------------------------------------------------------ actions

  async function sauvegarder(id?: number): Promise<void> {
    setOccupe(id ?? 'tout')
    try {
      const r = await window.api.sauvegarde.creer(id)
      if (r) {
        jouer('succes')
        flash(
          id
            ? `Dossier exporté : ${r.dossier}`
            : `Portefeuille sauvegardé · ${r.manifeste.employeurs.length} dossier(s).`
        )
        await charger()
      }
    } catch (e) {
      setErreur(msg(e))
    } finally {
      setOccupe(null)
    }
  }

  async function archiver(b: BilanEmployeur, valeur: boolean): Promise<void> {
    await window.api.employeurs.archiver(b.id, valeur)
    setDetail(null)
    await charger()
  }

  async function supprimer(): Promise<void> {
    if (!aSupprimer) return
    try {
      jouer('suppression')
      await window.api.employeurs.remove(aSupprimer.id)
      setASupprimer(null)
      setDetail(null)
      await charger()
    } catch (e) {
      setErreur(msg(e))
      setASupprimer(null)
    }
  }

  /** Liste du portefeuille en CSV : un cabinet doit pouvoir la sortir. */
  async function exporterListe(): Promise<void> {
    const entetes = [
      'Raison sociale', 'Sigle', 'Forme juridique', 'RCCM', 'IFU', 'N° CNSS',
      'Ville', 'Téléphone', 'Représentant', 'État', 'Périodicité', 'Gestionnaire',
      'Honoraires', 'Effectif', 'Masse du mois', 'Net à payer', 'Échéance (jours)',
      'Majoration estimée', 'Alertes'
    ]
    const cellule = (v: unknown): string => {
      const s = v === null || v === undefined ? '' : String(v)
      return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
    }
    const lignes = liste.map((b) => {
      const f = b.fiche
      return [
        b.nom, f?.sigle, f?.forme_juridique, f?.rccm, f?.ifu, b.numero_cnss,
        b.ville, f?.telephone, f?.representant_nom, f?.etat, f?.periodicite,
        f?.contact_cabinet, f?.honoraires, b.effectif, Math.round(b.masse_mois),
        Math.round(b.net_du), b.jours_echeance, b.majoration_estimee, b.alertes
      ].map(cellule).join(';')
    })
    const contenu = '﻿' + [entetes.join(';'), ...lignes].join('\r\n')
    const nom = `Portefeuille-${new Date().toISOString().slice(0, 10)}.csv`
    const chemin = await window.api.exportCsv(nom, contenu)
    if (chemin) flash(`Liste exportée : ${chemin}`)
  }

  // ------------------------------------------------------------------ rendu

  const etatLib = (e?: EmployeurRegistre): { libelle: string; ton: string } => {
    const x = ETATS_DOSSIER.find((y) => y.etat === (e?.etat ?? 'actif'))
    return { libelle: x?.libelle ?? 'Actif', ton: x?.ton ?? 'succes' }
  }

  return (
    <div className="pf">
      <header className="pf-tete">
        <div className="pf-marque">
          <MarqueNafasoft size={30} />
          <span className="pf-marque-texte">
            <strong>Portefeuille</strong>
            <span>
              {PRODUIT.nom} · {session.nom || session.username}
            </span>
          </span>
        </div>

        <div className="pf-ticker">
          <div className="pf-tick">
            <span>Clients suivis</span>
            <strong>{totaux.clients}</strong>
          </div>
          <div className="pf-tick">
            <span>Salariés gérés</span>
            <strong>{totaux.effectif}</strong>
          </div>
          <div className="pf-tick">
            <span>Masse du mois</span>
            <strong>{formatMoney(totaux.masse)}</strong>
          </div>
          <div className="pf-tick">
            <span>Honoraires</span>
            <strong>{formatMoney(totaux.honoraires)}</strong>
          </div>
          <div className={`pf-tick ${totaux.alertes > 0 ? 'chaud' : ''}`}>
            <span>Points d’attention</span>
            <strong>
              {totaux.alertes}
              {totaux.majorations > 0 && <small> · +{formatMoney(totaux.majorations)}</small>}
            </strong>
          </div>
        </div>

        <div className="pf-tete-actions">
          <button
            className="btn btn-discret pf-quitter"
            disabled={occupe !== null}
            onClick={() => void sauvegarder()}
          >
            <Icone nom="archive" size={16} />
            {occupe === 'tout' ? 'Sauvegarde…' : 'Sauvegarder'}
          </button>
          <button className="btn btn-discret pf-quitter" onClick={() => void exporterListe()}>
            <Icone nom="declarations" size={16} />
            Exporter
          </button>
          <button className="btn btn-discret pf-quitter" onClick={onDeconnexion}>
            <Icone nom="deconnexion" size={16} />
            Déconnexion
          </button>
        </div>
      </header>

      {erreur && <p className="bandeau erreur pf-message">{erreur}</p>}
      {info && <p className="bandeau succes pf-message">{info}</p>}

      {joursSauvegarde !== null &&
        (joursSauvegarde === -1 || joursSauvegarde > 30) &&
        bilans.length > 0 && (
          <div className="pf-rappel">
            <Icone nom="alerte" size={19} />
            <span>
              {joursSauvegarde === -1
                ? `Les données de vos ${bilans.length} clients n’ont jamais été sauvegardées.`
                : `Dernière sauvegarde il y a ${joursSauvegarde} jours.`}{' '}
              Une panne de disque emporterait bulletins et déclarations de tout le portefeuille.
            </span>
            <button
              className="btn btn-primaire btn-sm"
              disabled={occupe !== null}
              onClick={() => void sauvegarder()}
            >
              <Icone nom="archive" size={15} />
              Sauvegarder maintenant
            </button>
          </div>
        )}

      <div className="pf-barre">
        <div className="pf-recherche">
          <Icone nom="recherche" size={16} />
          <input
            value={q}
            placeholder="Rechercher · nom, sigle, ville, RCCM, représentant…"
            onChange={(e) => setQ(e.target.value)}
          />
          {q && (
            <button className="btn-discret btn-sm" onClick={() => setQ('')} aria-label="Effacer">
              ✕
            </button>
          )}
        </div>

        <div className="pf-filtres" role="tablist">
          <button role="tab" className={filtre === 'tous' ? 'actif' : ''} onClick={() => setFiltre('tous')}>
            Tous <span className="pf-compte">{bilans.length}</span>
          </button>
          <button role="tab" className={filtre === 'alertes' ? 'actif' : ''} onClick={() => setFiltre('alertes')}>
            À traiter <span className="pf-compte">{bilans.filter((b) => b.alertes > 0).length}</span>
          </button>
          <button role="tab" className={filtre === 'archives' ? 'actif' : ''} onClick={() => setFiltre('archives')}>
            Archivés <span className="pf-compte">{archives.length}</span>
          </button>
        </div>

        <label className="pf-tri">
          Trier par
          <select value={tri} onChange={(e) => setTri(e.target.value as Tri)}>
            {TRIS.map((t) => (
              <option key={t.cle} value={t.cle}>
                {t.libelle}
              </option>
            ))}
          </select>
        </label>

        <div className="pf-vues" role="tablist" aria-label="Affichage">
          <button
            role="tab"
            aria-selected={vue === 'cartes'}
            className={vue === 'cartes' ? 'actif' : ''}
            title="Cartes"
            onClick={() => choisirVue('cartes')}
          >
            <Icone nom="dashboard" size={16} />
          </button>
          <button
            role="tab"
            aria-selected={vue === 'tableau'}
            className={vue === 'tableau' ? 'actif' : ''}
            title="Tableau"
            onClick={() => choisirVue('tableau')}
          >
            <Icone nom="contrats" size={16} />
          </button>
        </div>

        <button className="btn btn-primaire pf-nouveau" onClick={() => setForm({ id: null })}>
          <Icone nom="plus" size={16} />
          Nouveau client
        </button>
      </div>

      {charge && liste.length === 0 ? (
        <div className="pf-vide">
          <Icone nom="portefeuille" size={44} />
          <h2>{q ? 'Aucun client trouvé' : 'Portefeuille vide'}</h2>
          <p>
            {q
              ? 'Aucun dossier ne correspond à cette recherche.'
              : 'Créez le dossier de votre premier client pour commencer à gérer sa paie.'}
          </p>
          {!q && (
            <button className="btn btn-primaire" onClick={() => setForm({ id: null })}>
              <Icone nom="plus" size={16} />
              Nouveau client
            </button>
          )}
        </div>
      ) : vue === 'cartes' ? (
        <div className="pf-grille">
          {liste.map((b) => {
            const teinte = b.couleur || TEINTES[b.id % TEINTES.length]
            const estArchive = filtre === 'archives'
            const etat = etatLib(b.fiche)
            const etatNotable = !estArchive && b.fiche && b.fiche.etat !== 'actif'
            const sante = santeClient(b)
            const essentiel = essentielClient(b)
            const soldee = b.net_du === 0

            return (
              <article
                key={b.id}
                className={`pf-carte ${b.alertes > 0 ? 'a-traiter' : ''} ${estArchive ? 'archive' : ''}`}
                style={{ ['--teinte' as string]: teinte }}
              >
                <div className="pfc-tete">
                  <span className="pfc-pastille" aria-hidden="true">
                    {b.logo ? <img src={b.logo} alt="" /> : sigleAuto(b.nom)}
                  </span>
                  <div className="pfc-ident">
                    <h3>{b.nom}</h3>
                    <p>
                      {[b.fiche?.forme_juridique, b.ville, b.numero_cnss && `CNSS ${b.numero_cnss}`]
                        .filter(Boolean)
                        .join(' · ') || 'Identité à compléter'}
                    </p>
                  </div>
                  {!b.erreur &&
                    (etatNotable ? (
                      <div className="pfc-net etat">
                        <strong className={`badge badge-${etat.ton}`}>{etat.libelle}</strong>
                      </div>
                    ) : (
                      <div className={`pfc-net ${soldee ? 'solde' : ''}`}>
                        <strong>{soldee ? 'Soldé' : formatMoney(b.net_du)}</strong>
                        {!soldee && <span>Net à payer</span>}
                      </div>
                    ))}
                </div>

                {b.erreur ? (
                  <p className="pfc-indispo">Indicateurs indisponibles · {b.erreur}</p>
                ) : estArchive ? (
                  <p className="pfc-indispo">Dossier archivé — réactivez-le pour revoir ses indicateurs.</p>
                ) : (
                  <div className="pfc-mi">
                    <div className="pfc-sante">
                      <span
                        className={`pfc-sante-puce pfc-sante-${sante.declarations}`}
                        title="Déclaration CNSS"
                      >
                        <Icone nom="declarations" size={15} />
                      </span>
                      <span className={`pfc-sante-puce pfc-sante-${sante.paie}`} title="Bulletins de paie">
                        <Icone nom="paie" size={15} />
                      </span>
                      <span className={`pfc-sante-puce pfc-sante-${sante.contrats}`} title="Contrats">
                        <Icone nom="contrats" size={15} />
                      </span>
                    </div>
                    <p className={`pfc-essentiel pfc-essentiel-${essentiel.ton}`}>{essentiel.texte}</p>
                  </div>
                )}

                <div className="pfc-actions">
                  <span className="pfc-mesures">
                    {b.effectif} salarié{b.effectif > 1 ? 's' : ''} · {formatMoney(b.masse_mois)}
                  </span>
                  {estArchive ? (
                    <button className="btn btn-secondaire" onClick={() => void archiver(b, false)}>
                      Réactiver
                    </button>
                  ) : (
                    <button className="btn btn-primaire" onClick={() => onOuvrir(b.id)}>
                      <Icone nom="bascule" size={15} />
                      Ouvrir
                    </button>
                  )}
                  <div className="pfc-actions-icones">
                    <button className="btn btn-discret" title="Fiche du client" onClick={() => setDetail(b.id)}>
                      <Icone nom="dossiers" size={16} />
                    </button>
                    <button className="btn btn-discret" title="Modifier" onClick={() => setForm({ id: b.id })}>
                      <Icone nom="crayon" size={16} />
                    </button>
                    <button
                      className="btn btn-discret danger"
                      title="Supprimer ce dossier"
                      onClick={() => setASupprimer(b)}
                    >
                      <Icone nom="poubelle" size={16} />
                    </button>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      ) : (
        <div className="pf-tableau-enveloppe">
          <table className="tableau pf-tableau">
            <thead>
              <tr>
                <th>Client</th>
                <th>État</th>
                <th className="num">Effectif</th>
                <th className="num">Masse du mois</th>
                <th className="num">Net à payer</th>
                <th>Échéance</th>
                <th className="num">Majoration</th>
                <th>Gestionnaire</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {liste.map((b) => {
                const teinte = b.couleur || TEINTES[b.id % TEINTES.length]
                const ech = libelleEcheance(b.jours_echeance)
                const etat = etatLib(b.fiche)
                return (
                  <tr key={b.id} className={b.alertes > 0 ? 'pf-ligne-chaude' : ''}>
                    <td>
                      <button className="pf-lien-client" onClick={() => setDetail(b.id)}>
                        <span className="pf-puce" style={{ background: teinte }} aria-hidden="true" />
                        <span>
                          <strong>{b.nom}</strong>
                          <small>
                            {[b.ville, b.numero_cnss].filter(Boolean).join(' · ') || 'Non renseigné'}
                          </small>
                        </span>
                      </button>
                    </td>
                    <td>
                      <span className={`badge badge-${etat.ton}`}>{etat.libelle}</span>
                    </td>
                    <td className="num">{b.effectif}</td>
                    <td className="num">{formatMoney(b.masse_mois)}</td>
                    <td className="num">{formatMoney(b.net_du)}</td>
                    <td>{ech ? <span className={`badge badge-${ech.ton}`}>{ech.texte}</span> : 'Non renseigné'}</td>
                    <td className="num">
                      {b.majoration_estimee > 0 ? (
                        <span className="texte-erreur">+ {formatMoney(b.majoration_estimee)}</span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="texte-petit">{b.fiche?.contact_cabinet ?? 'Non renseigné'}</td>
                    <td className="pf-actions-ligne">
                      <button className="btn btn-secondaire btn-sm" onClick={() => onOuvrir(b.id)}>
                        Ouvrir
                      </button>
                      <button className="btn btn-discret btn-sm" title="Modifier" onClick={() => setForm({ id: b.id })}>
                        <Icone nom="crayon" size={15} />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* --- Panneau de détail : consulter un client sans ouvrir sa base --- */}
      {fiche && (
        <>
          <div className="cli-fond" onClick={() => setDetail(null)} />
          <aside className="cli-panneau" style={{ ['--teinte' as string]: fiche.couleur || TEINTES[fiche.id % TEINTES.length] }}>
            <header className="cli-tete">
              <span className="pfc-pastille" aria-hidden="true">
                {fiche.logo ? <img src={fiche.logo} alt="" /> : sigleAuto(fiche.nom)}
              </span>
              <div>
                <h2>{fiche.nom}</h2>
                <p>{[fiche.sigle, fiche.forme_juridique].filter(Boolean).join(' · ') || 'Non renseigné'}</p>
              </div>
              <button className="btn btn-discret" onClick={() => setDetail(null)} aria-label="Fermer">
                ✕
              </button>
            </header>

            {bilanDetail && (
              <div className="cli-chiffres">
                <div>
                  <span className="pfcc-lib">Effectif</span>
                  <span className="pfcc-val">{bilanDetail.effectif}</span>
                </div>
                <div>
                  <span className="pfcc-lib">Masse du mois</span>
                  <span className="pfcc-val">{formatMoney(bilanDetail.masse_mois)}</span>
                </div>
                <div>
                  <span className="pfcc-lib">Net à payer</span>
                  <span className="pfcc-val">{formatMoney(bilanDetail.net_du)}</span>
                </div>
              </div>
            )}

            <dl className="cli-liste">
              <dt>N° employeur CNSS</dt>
              <dd>{fiche.numero_cnss ?? 'Non renseigné'}</dd>
              <dt>RCCM</dt>
              <dd>{fiche.rccm ?? 'Non renseigné'}</dd>
              <dt>IFU</dt>
              <dd>{fiche.ifu ?? 'Non renseigné'}</dd>
              <dt>Secteur</dt>
              <dd>{fiche.secteur_activite ?? 'Non renseigné'}</dd>
              <dt>Adresse</dt>
              <dd>{[fiche.adresse, fiche.quartier, fiche.ville].filter(Boolean).join(', ') || 'Non renseigné'}</dd>
              <dt>Boîte postale</dt>
              <dd>{fiche.boite_postale ?? 'Non renseigné'}</dd>
              <dt>Téléphone</dt>
              <dd>{fiche.telephone ?? 'Non renseigné'}</dd>
              <dt>Courriel</dt>
              <dd>{fiche.email ?? 'Non renseigné'}</dd>
              <dt>Représentant</dt>
              <dd>
                {fiche.representant_nom
                  ? `${fiche.representant_nom}${fiche.representant_qualite ? ` · ${fiche.representant_qualite}` : ''}`
                  : 'Non renseigné'}
              </dd>
              <dt>Déclaration</dt>
              <dd>{fiche.periodicite === 'mensuelle' ? 'Mensuelle' : 'Trimestrielle'}</dd>
              <dt>Gestionnaire</dt>
              <dd>{fiche.contact_cabinet ?? 'Non renseigné'}</dd>
              <dt>Honoraires</dt>
              <dd>{fiche.honoraires ? formatMoney(fiche.honoraires) : 'Non renseigné'}</dd>
            </dl>

            {fiche.notes && (
              <div className="cli-notes">
                <span className="pfcc-lib">Notes internes</span>
                <p>{fiche.notes}</p>
              </div>
            )}

            <div className="cli-actions">
              <button className="btn btn-primaire" onClick={() => onOuvrir(fiche.id)}>
                <Icone nom="bascule" size={16} />
                Ouvrir le dossier
              </button>
              <button className="btn btn-secondaire" onClick={() => setForm({ id: fiche.id })}>
                <Icone nom="crayon" size={16} />
                Modifier la fiche
              </button>
              <button
                className="btn btn-secondaire"
                disabled={occupe !== null}
                onClick={() => void sauvegarder(fiche.id)}
              >
                <Icone nom="archive" size={16} />
                {occupe === fiche.id ? 'Export…' : 'Exporter ce dossier'}
              </button>
              <button
                className="btn btn-discret"
                onClick={() => void archiver(fiche as unknown as BilanEmployeur, !fiche.archive)}
              >
                {fiche.archive ? 'Réactiver' : 'Archiver'}
              </button>
            </div>
          </aside>
        </>
      )}

      {form && (
        <FicheEmployeur
          employeur={form.id === null ? null : (parId.get(form.id) ?? null)}
          onFerme={() => setForm(null)}
          onEnregistre={() => {
            setForm(null)
            void charger()
          }}
        />
      )}

      {aSupprimer && (
        <Confirm
          titre={`Supprimer « ${aSupprimer.nom} » ?`}
          message="La base de ce client, ses salariés, ses bulletins et ses déclarations seront définitivement effacés. Exportez son dossier avant si vous devez le lui remettre."
          danger
          onConfirm={() => void supprimer()}
          onCancel={() => setASupprimer(null)}
        />
      )}
    </div>
  )
}
