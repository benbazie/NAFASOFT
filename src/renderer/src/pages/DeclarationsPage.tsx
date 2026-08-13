import { useEffect, useMemo, useState } from 'react'
import type {
  AppConfig,
  DeclarationDto,
  DeclarationRecord,
  PayrollSettings,
  StatutDeclaration
} from '../../../shared/types'
import {
  CONFIG_DEFAUT,
  PARAMS_PAIE_DEFAUT,
  CATEGORIES_CNSS,
  STATUTS_DECLARATION
} from '../../../shared/types'
import { formatMoney, formatDate, todayISO } from '../lib/format'
import { imprimerDocument, nomFichierDocument, toCsv } from '../lib/print'
import { chargerConfig, chargerParamsPaie } from '../lib/config'
import { bntsHtml, drsHtml } from '../lib/documents'
import { estimerPenalites } from '../../../shared/penalites'
import { Modale } from '../components/Modale'
import { PreviewFrame } from '../components/PreviewFrame'
import { Confirm } from '../components/Confirm'

type Periodicite = 'mensuelle' | 'trimestrielle'

function moisCourant(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** Bornes d'un mois, ou du trimestre qui le contient. */
function bornes(mois: string, periodicite: Periodicite): { start: string; end: string } {
  const [y, m] = mois.split('-').map(Number)
  if (periodicite === 'mensuelle') {
    const dernier = new Date(y, m, 0).getDate()
    return { start: `${mois}-01`, end: `${mois}-${String(dernier).padStart(2, '0')}` }
  }
  const premierMois = Math.floor((m - 1) / 3) * 3 + 1
  const dernierMois = premierMois + 2
  const dernierJour = new Date(y, dernierMois, 0).getDate()
  return {
    start: `${y}-${String(premierMois).padStart(2, '0')}-01`,
    end: `${y}-${String(dernierMois).padStart(2, '0')}-${String(dernierJour).padStart(2, '0')}`
  }
}

export function DeclarationsPage(): JSX.Element {
  const [start, setStart] = useState(() => bornes(moisCourant(), 'mensuelle').start)
  const [end, setEnd] = useState(() => bornes(moisCourant(), 'mensuelle').end)
  const [archive, setArchive] = useState<DeclarationRecord[]>([])
  const [onglet, setOnglet] = useState<'calcul' | 'registre'>('calcul')
  const [message, setMessage] = useState('')
  const [decl, setDecl] = useState<DeclarationDto | null>(null)
  const [calcul, setCalcul] = useState(false)
  const [config, setConfig] = useState<AppConfig>(CONFIG_DEFAUT)
  const [settings, setSettings] = useState<PayrollSettings>(PARAMS_PAIE_DEFAUT)
  const [apercu, setApercu] = useState<'BNTS' | 'DRS' | null>(null)

  useEffect(() => {
    chargerConfig().then(setConfig)
    chargerParamsPaie().then(setSettings)
    chargerArchive()
  }, [])

  async function chargerArchive(): Promise<void> {
    setArchive(await window.api.declarations.list())
  }

  useEffect(() => {
    setDecl(null)
    setMessage('')
  }, [start, end, settings])

  /** Applique une période prédéfinie : mois courant, mois précédent ou trimestre. */
  function appliquerPreset(preset: 'mois' | 'precedent' | 'trimestre'): void {
    const d = new Date()
    if (preset === 'precedent') d.setMonth(d.getMonth() - 1)
    const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const b = bornes(m, preset === 'trimestre' ? 'trimestrielle' : 'mensuelle')
    setStart(b.start)
    setEnd(b.end)
  }

  /** Archive la déclaration affichée, avec son code. */
  async function enregistrer(): Promise<void> {
    if (!decl) return
    const rec = await window.api.declarations.save(decl)
    setMessage(`Déclaration archivée sous la référence ${rec.reference}.`)
    chargerArchive()
  }

  async function generer(): Promise<void> {
    setCalcul(true)
    try {
      setDecl(await window.api.declarations.build({ start, end, settings }))
    } finally {
      setCalcul(false)
    }
  }

  // Déclaration déjà archivée pour exactement cette période.
  const dejaArchivee = useMemo(
    () => archive.find((a) => a.periode_debut === start && a.periode_fin === end) ?? null,
    [archive, start, end]
  )

  /** Vrai si le calcul du jour s'écarte de ce qui a été archivé. */
  const ecartArchive = useMemo(() => {
    if (!decl || !dejaArchivee) return null
    const champs: [string, number, number][] = [
      ['Effectif', dejaArchivee.effectif, decl.effectif],
      ['Masse salariale', dejaArchivee.total_salaires_bruts, decl.total_salaires_bruts],
      ['Cotisations dues', dejaArchivee.total_cotisations, decl.total_cotisations]
    ]
    return champs.filter(([, avant, apres]) => Math.abs(avant - apres) > 1)
  }, [decl, dejaArchivee])

  // Estimation des majorations : contre la date de dépôt si la déclaration a
  // été déposée, contre la date du jour sinon.
  const penalites = useMemo(
    () =>
      decl
        ? estimerPenalites(
            decl.date_limite,
            decl.total_cotisations,
            settings,
            dejaArchivee?.date_depot ?? null
          )
        : null,
    [decl, settings, dejaArchivee]
  )

  // Les deux documents sont produits à partir de la même déclaration :
  // ils ne peuvent pas diverger. En revanche, l'imprimé officiel du BNTS est en
  // paysage et celui de la DRS en portrait · ils s'impriment donc séparément.
  const corps = useMemo(() => {
    if (!decl || !apercu) return ''
    const code = dejaArchivee?.reference ?? null
    return apercu === 'BNTS' ? bntsHtml(decl, config, code) : drsHtml(decl, config, code)
  }, [decl, config, apercu])

  /**
   * Nom du document imprimé ou exporté : le code d'archivage en tête, puis le
   * formulaire concerné et la date du jour. Tant que la déclaration n'est pas
   * clôturée elle n'a pas de code : on retombe sur la période, en signalant
   * qu'il s'agit d'un tirage provisoire.
   */
  function nomDocument(quoi: 'BNTS' | 'DRS'): string {
    const code = dejaArchivee?.reference
    return code
      ? nomFichierDocument([code, quoi])
      : nomFichierDocument([quoi, 'provisoire', start, end])
  }

  function imprimer(quoi: 'BNTS' | 'DRS'): void {
    if (!decl) return
    const code = dejaArchivee?.reference ?? null
    if (quoi === 'BNTS') {
      imprimerDocument(nomDocument('BNTS'), bntsHtml(decl, config, code), 'paysage')
    } else {
      imprimerDocument(nomDocument('DRS'), drsHtml(decl, config, code), 'portrait')
    }
  }

  async function exporter(): Promise<void> {
    if (!decl) return
    const entetes = [
      'N°',
      'Matricule',
      'N° CNSS',
      'Nom',
      'Prénom',
      'Période du',
      'au',
      'Salaire brut',
      'Base CNSS',
      'Type',
      'Nature'
    ]
    const lignes = decl.lignes.map((l) => [
      l.numero,
      l.matricule,
      l.numero_cnss,
      l.nom,
      l.prenom,
      l.periode_debut,
      l.periode_fin,
      l.salaire_brut,
      l.base_cnss,
      l.categorie,
      l.nature
    ])
    await window.api.exportCsv(`${nomDocument('BNTS')}.csv`, toCsv(entetes, lignes))
  }

  const manqueNumero = !config.numero_employeur_cnss

  return (
    <>
      <header className="entete-page">
        <div>
          <h1>Déclarations CNSS</h1>
          <p>Bordereau nominatif (BNTS) et déclaration récapitulative (DRS)</p>
        </div>
      </header>

      <div className="page-corps">
        {manqueNumero && (
          <div className="alerte-ligne expire" style={{ marginBottom: 'var(--e4)' }}>
            <span className="ico">⚠</span>
            <div style={{ flex: 1 }}>
              Votre <strong>numéro employeur CNSS</strong> n'est pas renseigné : les documents
              seront imprimés avec un emplacement vide.
            </div>
          </div>
        )}

        <div className="onglets">
          <button
            className={`onglet ${onglet === 'calcul' ? 'actif' : ''}`}
            onClick={() => setOnglet('calcul')}
          >
            Établir une déclaration
          </button>
          <button
            className={`onglet ${onglet === 'registre' ? 'actif' : ''}`}
            onClick={() => setOnglet('registre')}
          >
            Registre ({archive.length})
          </button>
        </div>

        {onglet === 'registre' ? (
          <RegistreDeclarations
            archive={archive}
            config={config}
            settings={settings}
            onChange={chargerArchive}
            onApercu={(d) => {
              // La période suit la déclaration ouverte : sans cela l'onglet
              // « calcul » resterait sur une autre période et le document
              // s'afficherait sous un code qui n'est pas le sien.
              setStart(d.periode_debut)
              setEnd(d.periode_fin)
              setDecl(d.donnees)
              setOnglet('calcul')
              setApercu('DRS')
            }}
          />
        ) : (
        <>
        <div className="carte" style={{ padding: 'var(--e4)', marginBottom: 'var(--e5)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 'var(--e3)', flexWrap: 'wrap' }}>
            <div className="champ" style={{ marginBottom: 0, minWidth: 150 }}>
              <label>Du</label>
              <input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div className="champ" style={{ marginBottom: 0, minWidth: 150 }}>
              <label>Au</label>
              <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
            <div className="champ" style={{ marginBottom: 0 }}>
              <label>Périodes courantes</label>
              <div style={{ display: 'flex', gap: 'var(--e1)' }}>
                <button className="btn btn-sm btn-secondaire" onClick={() => appliquerPreset('mois')}>
                  Ce mois
                </button>
                <button
                  className="btn btn-sm btn-secondaire"
                  onClick={() => appliquerPreset('precedent')}
                >
                  Mois dernier
                </button>
                <button
                  className="btn btn-sm btn-secondaire"
                  onClick={() => appliquerPreset('trimestre')}
                >
                  Trimestre
                </button>
              </div>
            </div>
            <button className="btn btn-primaire" onClick={generer} disabled={calcul || end < start}>
              {calcul ? 'Génération…' : 'Générer la déclaration'}
            </button>
            {decl && decl.effectif > 0 && (
              <>
                <button className="btn btn-secondaire" onClick={() => setApercu('BNTS')}>
                  BNTS
                </button>
                <button className="btn btn-secondaire" onClick={() => setApercu('DRS')}>
                  DRS
                </button>
                <button className="btn btn-secondaire" onClick={exporter}>
                  Exporter le BNTS
                </button>
                <button className="btn btn-primaire" onClick={enregistrer}>
                  Archiver la déclaration
                </button>
              </>
            )}
          </div>
          {message && (
            <div className="encart" style={{ marginTop: 'var(--e3)' }}>
              {message}
            </div>
          )}
          <p className="texte-petit texte-gris" style={{ marginTop: 'var(--e2)' }}>
            Période retenue : du {formatDate(start)} au {formatDate(end)}
            {end < start && <strong> · la date de fin précède le début.</strong>} Toute période
            est déclarable, y compris incomplète.
          </p>
        </div>

        {decl && dejaArchivee && (
          <div className={`carte encadre-bilan ${ecartArchive && ecartArchive.length > 0 ? 'diverge' : ''}`}>
            <div className="bilan-entete">
              <div>
                <strong>
                  Déjà archivée sous la référence {dejaArchivee.reference} ({dejaArchivee.statut})
                </strong>
                <div className="texte-petit texte-gris">
                  {!ecartArchive || ecartArchive.length === 0
                    ? "Le calcul du jour donne les mêmes totaux que l'archive."
                    : 'Le calcul du jour diffère de la déclaration archivée.'}
                </div>
                {ecartArchive && ecartArchive.length > 0 && (
                  <div className="liste-ecarts" style={{ marginTop: 'var(--e2)' }}>
                    {ecartArchive.map(([lib, avant, apres]) => (
                      <div className="ecart" key={lib}>
                        <span className="ecart-libelle">{lib}</span>
                        <span className="ecart-avant">
                          {lib === 'Effectif' ? avant : formatMoney(avant)}
                        </span>
                        <span className="ecart-fleche">→</span>
                        <span className="ecart-apres">
                          {lib === 'Effectif' ? apres : formatMoney(apres)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="groupe" style={{ display: 'flex', gap: 'var(--e2)' }}>
                <button
                  className="btn btn-secondaire btn-sm"
                  onClick={() => {
                    setDecl(dejaArchivee.donnees)
                    setApercu('DRS')
                  }}
                >
                  Voir l'archive
                </button>
                <button className="btn btn-primaire btn-sm" onClick={enregistrer}>
                  Écraser avec le calcul du jour
                </button>
              </div>
            </div>
          </div>
        )}

        {!decl ? (
          <div className="carte vide">
            <div className="icone-vide">📑</div>
            <p>Choisissez une période puis générez la déclaration.</p>
          </div>
        ) : decl.effectif === 0 ? (
          <div className="carte vide">
            <div className="icone-vide">👥</div>
            <p>Aucun travailleur à déclarer sur cette période.</p>
          </div>
        ) : (
          <>
            <div className="tuiles">
              <div className="tuile">
                <span className="libelle">Travailleurs déclarés</span>
                <span className="valeur">{decl.effectif}</span>
                <span className="detail">{decl.mensuelle ? 'Déclaration mensuelle' : 'Déclaration trimestrielle'}</span>
              </div>
              <div className="tuile accent">
                <span className="libelle">Masse salariale brute</span>
                <span className="valeur">{formatMoney(decl.total_salaires_bruts)}</span>
                <span className="detail">Base cotisable {formatMoney(decl.total_base_cnss)}</span>
              </div>
              <div className="tuile succes">
                <span className="libelle">Cotisations dues</span>
                <span className="valeur">{formatMoney(decl.total_cotisations)}</span>
                <span className="detail">Toutes branches confondues</span>
              </div>
              <div className="tuile alerte">
                <span className="libelle">Date limite de dépôt</span>
                <span className="valeur" style={{ fontSize: 'var(--t-lg)' }}>
                  {formatDate(decl.date_limite)}
                </span>
                <span className="detail">Sous peine de majorations</span>
              </div>
            </div>

            <h2 className="section-titre">Identification de la déclaration</h2>
            <div className="carte identite-decl">
              <div className="id-champ">
                <span className="id-lib">N° de la déclaration</span>
                <span className="id-val mono">
                  {dejaArchivee ? dejaArchivee.reference : 'Non archivée'}
                </span>
              </div>
              <div className="id-champ">
                <span className="id-lib">N° employeur CNSS</span>
                <span className="id-val mono">{config.numero_employeur_cnss || 'Non renseigné'}</span>
              </div>
              <div className="id-champ">
                <span className="id-lib">Période déclarée</span>
                <span className="id-val">
                  {formatDate(decl.periode_debut)} → {formatDate(decl.periode_fin)}
                </span>
              </div>
              <div className="id-champ">
                <span className="id-lib">Périodicité</span>
                <span className="id-val">{decl.mensuelle ? 'Mensuelle' : 'Trimestrielle'}</span>
              </div>
              <div className="id-champ">
                <span className="id-lib">Date limite de dépôt</span>
                <span className="id-val">{formatDate(decl.date_limite)}</span>
              </div>
              <div className="id-champ">
                <span className="id-lib">Statut</span>
                <span className="id-val">
                  <span
                    className={`badge ${
                      dejaArchivee?.statut === 'Payée'
                        ? 'badge-succes'
                        : dejaArchivee?.statut === 'Déposée'
                          ? 'badge-info'
                          : 'badge-alerte'
                    }`}
                  >
                    {dejaArchivee?.statut ?? 'Brouillon'}
                  </span>
                </span>
              </div>
            </div>

            {penalites?.en_retard && (
              <div className="carte encart-penalites">
                <div className="pen-entete">
                  <span className="pen-ico">⚠</span>
                  <div>
                    <strong>
                      Déclaration en retard de {penalites.jours_retard} jour(s)
                    </strong>
                    <div className="texte-petit texte-gris">
                      Date limite dépassée le {formatDate(decl.date_limite)}
                      {dejaArchivee?.date_depot
                        ? ` · déposée le ${formatDate(dejaArchivee.date_depot)}`
                        : ' · non encore déposée'}
                    </div>
                  </div>
                </div>
                <table className="pen-table">
                  <tbody>
                    <tr>
                      <td>Cotisations principales</td>
                      <td className="num">{formatMoney(decl.total_cotisations)}</td>
                    </tr>
                    <tr>
                      <td>
                        Majoration de retard estimée —{' '}
                        {penalites.mois_retard} mois entamé(s) ×{' '}
                        {(settings.majoration_retard_mois * 100).toFixed(2).replace('.', ',')} %
                      </td>
                      <td className="num">+ {formatMoney(penalites.majoration_retard)}</td>
                    </tr>
                    <tr className="pen-total">
                      <td>Total estimé à régler</td>
                      <td className="num">{formatMoney(penalites.total_estime)}</td>
                    </tr>
                  </tbody>
                </table>
                <p className="texte-xs texte-gris" style={{ marginTop: 'var(--e2)' }}>
                  Estimation indicative (article 17 de la loi n° 004-2021/AN). Seule la CNSS
                  arrête le montant réellement dû : les cases « ** » du formulaire lui restent
                  réservées et sont imprimées vides.
                </p>
              </div>
            )}

            <h2 className="section-titre">Décompte des cotisations (DRS)</h2>
            <div className="tableau-conteneur" style={{ marginBottom: 'var(--e5)' }}>
              <table>
                <thead>
                  <tr>
                    <th>Branche</th>
                    {CATEGORIES_CNSS.map((c) => (
                      <th key={c.code} className="num" title={c.libelle}>
                        {c.code}
                      </th>
                    ))}
                    <th className="num">Base de cotisation</th>
                    <th className="num">Taux</th>
                    <th className="num">Cotisation due</th>
                  </tr>
                </thead>
                <tbody>
                  {decl.branches.map((b) => (
                    <tr key={b.nom}>
                      <td className="cellule-principale">{b.nom}</td>
                      {CATEGORIES_CNSS.map((c) => (
                        <td key={c.code} className="num texte-gris">
                          {b.effectifs[c.code] > 0 ? b.effectifs[c.code] : 'Non renseigné'}
                        </td>
                      ))}
                      <td className="num">{formatMoney(b.base)}</td>
                      <td className="num">{(b.taux * 100).toFixed(2).replace('.', ',')} %</td>
                      <td className="num">
                        <strong>{formatMoney(b.cotisation)}</strong>
                      </td>
                    </tr>
                  ))}
                  <tr className="ligne-total">
                    <td colSpan={CATEGORIES_CNSS.length + 3}>Total des cotisations dues</td>
                    <td className="num">{formatMoney(decl.total_cotisations)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <h2 className="section-titre">Bordereau nominatif (BNTS)</h2>
            <div className="tableau-conteneur">
              <table>
                <thead>
                  <tr>
                    <th className="num">N°</th>
                    <th>Matricule</th>
                    <th>N° CNSS</th>
                    <th>Travailleur</th>
                    <th>Période</th>
                    <th className="num">Salaire brut</th>
                    <th className="num">Base CNSS</th>
                    <th>Type</th>
                    <th>Nat.</th>
                  </tr>
                </thead>
                <tbody>
                  {decl.lignes.map((l) => (
                    <tr key={l.numero}>
                      <td className="num texte-gris">{l.numero}</td>
                      <td className="mono texte-petit">{l.matricule}</td>
                      <td className="mono texte-petit">{l.numero_cnss || 'Non renseigné'}</td>
                      <td className="cellule-principale">
                        {l.nom.toUpperCase()} {l.prenom}
                      </td>
                      <td className="texte-petit texte-gris">
                        {formatDate(l.periode_debut)} → {formatDate(l.periode_fin)}
                      </td>
                      <td className="num">{formatMoney(l.salaire_brut)}</td>
                      <td className="num">{formatMoney(l.base_cnss)}</td>
                      <td>
                        <span className="badge badge-neutre">{l.categorie}</span>
                      </td>
                      <td className="texte-gris">{l.nature}</td>
                    </tr>
                  ))}
                  <tr className="ligne-total">
                    <td colSpan={5}>Total · {decl.effectif} travailleur(s)</td>
                    <td className="num">{formatMoney(decl.total_salaires_bruts)}</td>
                    <td className="num">{formatMoney(decl.total_base_cnss)}</td>
                    <td colSpan={2}></td>
                  </tr>
                  {decl.branches.map((b) => (
                    <tr key={b.nom} className="ligne-cotisation">
                      <td colSpan={6} className="libelle-cotisation">
                        {b.nom} · {(b.taux * 100).toFixed(2).replace('.', ',')} %
                      </td>
                      <td className="num">{formatMoney(b.cotisation)}</td>
                      <td colSpan={2}></td>
                    </tr>
                  ))}
                  <tr className="ligne-a-payer">
                    <td colSpan={6}>Cotisation à payer à la CNSS</td>
                    <td className="num">{formatMoney(decl.total_cotisations)}</td>
                    <td colSpan={2}></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </>
        )}
        </>
        )}
      </div>

      {apercu && decl && (
        <Modale
          titre={`${
            apercu === 'BNTS'
              ? 'Bordereau Nominatif des Travailleurs Salariés'
              : 'Déclaration Récapitulative des Salaires'
          } · ${dejaArchivee?.reference ?? 'tirage provisoire, non archivé'}`}
          onClose={() => setApercu(null)}
          large
          pied={
            <>
              <button className="btn btn-secondaire" onClick={() => setApercu(null)}>
                Fermer
              </button>
              <button
                className="btn btn-secondaire"
                onClick={() => setApercu(apercu === 'BNTS' ? 'DRS' : 'BNTS')}
              >
                Voir {apercu === 'BNTS' ? 'la DRS' : 'le BNTS'}
              </button>
              <button className="btn btn-primaire" onClick={() => imprimer(apercu)}>
                Imprimer / PDF
              </button>
            </>
          }
        >
          <PreviewFrame
            titre={apercu}
            corps={corps}
            hauteur={600}
            orientation={apercu === 'BNTS' ? 'paysage' : 'portrait'}
          />
        </Modale>
      )}

    </>
  )
}

/** Registre des déclarations archivées : suivi du dépôt et réimpression. */
/**
 * Majoration encourue par une déclaration archivée mais pas encore déposée.
 * Elle grossit tant que le dépôt n'a pas eu lieu : c'est précisément ce que le
 * registre doit montrer, sinon rien ne distingue un retard d'un mois d'un
 * retard d'un an.
 */
function cellulePenalite(d: DeclarationRecord, settings: PayrollSettings): JSX.Element {
  if (d.statut === 'Déposée' || d.statut === 'Payée') {
    return <span className="texte-gris">Non renseigné</span>
  }
  const e = estimerPenalites(d.date_limite, d.total_cotisations, settings, d.date_depot ?? null)
  if (!e.en_retard) return <span className="texte-gris">dans les délais</span>
  return (
    <span
      className="texte-erreur"
      title={`${e.mois_retard} mois entamé(s) × ${(settings.majoration_retard_mois * 100)
        .toFixed(2)
        .replace('.', ',')} % · estimation, la CNSS reste seule à liquider`}
    >
      + {formatMoney(e.majoration_retard)}
    </span>
  )
}

function RegistreDeclarations({
  archive,
  config,
  settings,
  onChange,
  onApercu
}: {
  archive: DeclarationRecord[]
  config: AppConfig
  settings: PayrollSettings
  onChange: () => void
  onApercu: (d: DeclarationRecord) => void
}): JSX.Element {
  const [aSupprimer, setASupprimer] = useState<DeclarationRecord | null>(null)

  async function supprimer(): Promise<void> {
    if (!aSupprimer) return
    await window.api.declarations.remove(aSupprimer.id)
    setASupprimer(null)
    onChange()
  }
  async function changerStatut(d: DeclarationRecord, statut: StatutDeclaration): Promise<void> {
    await window.api.declarations.setStatut(
      d.id,
      statut,
      statut === 'Brouillon' ? null : (d.date_depot ?? todayISO())
    )
    onChange()
  }

  if (archive.length === 0) {
    return (
      <div className="carte vide">
        <div className="icone-vide">❑</div>
        <p>Aucune déclaration archivée. Établissez-en une puis archivez-la.</p>
      </div>
    )
  }

  return (
    <>
      <div className="tableau-conteneur">
        <table>
          <thead>
            <tr>
              <th>Référence</th>
              <th>Période</th>
              <th>Type</th>
              <th className="num">Effectif</th>
              <th className="num">Masse salariale</th>
              <th className="num">Cotisations dues</th>
              <th>Échéance</th>
              <th className="num">Majoration estimée</th>
              <th>Statut</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {archive.map((d) => (
              <tr key={d.id}>
                <td className="mono texte-petit">{d.reference}</td>
                <td className="texte-petit">
                  {formatDate(d.periode_debut)} → {formatDate(d.periode_fin)}
                </td>
                <td>
                  <span className="badge badge-neutre">
                    {d.mensuelle ? 'Mensuelle' : 'Trimestrielle'}
                  </span>
                </td>
                <td className="num">{d.effectif}</td>
                <td className="num">{formatMoney(d.total_salaires_bruts)}</td>
                <td className="num">
                  <strong>{formatMoney(d.total_cotisations)}</strong>
                </td>
                <td className="texte-petit">{d.date_limite ? formatDate(d.date_limite) : 'Non renseigné'}</td>
                <td className="num">{cellulePenalite(d, settings)}</td>
                <td>
                  <select
                    className="selecteur"
                    style={{ padding: '2px 6px', fontSize: 'var(--t-sm)' }}
                    value={d.statut}
                    onChange={(e) => changerStatut(d, e.target.value as StatutDeclaration)}
                  >
                    {STATUTS_DECLARATION.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                  {d.date_depot && (
                    <div className="cellule-secondaire">déposée le {formatDate(d.date_depot)}</div>
                  )}
                </td>
                <td>
                  <div className="actions-cellule">
                    <button className="btn-discret btn-sm" onClick={() => onApercu(d)}>
                      Aperçu
                    </button>
                    <button
                      className="btn-discret btn-sm"
                      onClick={() =>
                        imprimerDocument(
                          nomFichierDocument([d.reference, 'BNTS']),
                          bntsHtml(d.donnees, config, d.reference),
                          'paysage'
                        )
                      }
                    >
                      BNTS
                    </button>
                    <button
                      className="btn-discret btn-sm"
                      onClick={() =>
                        imprimerDocument(
                          nomFichierDocument([d.reference, 'DRS']),
                          drsHtml(d.donnees, config, d.reference),
                          'portrait'
                        )
                      }
                    >
                      DRS
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

      <p className="texte-petit texte-gris" style={{ marginTop: 'var(--e3)' }}>
        Les documents sont réimprimés depuis l'instantané archivé : ils restent identiques à ce
        qui a été déposé, quels que soient les changements survenus depuis.
      </p>

      {aSupprimer && (
        <Confirm
          titre="Supprimer la déclaration"
          message={`Supprimer définitivement la déclaration ${aSupprimer.reference} (du ${aSupprimer.periode_debut} au ${aSupprimer.periode_fin}) ? Elle pourra être réétablie depuis l'onglet de calcul.`}
          danger
          onCancel={() => setASupprimer(null)}
          onConfirm={supprimer}
        />
      )}
    </>
  )
}
