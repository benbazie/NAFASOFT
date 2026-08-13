import { useEffect, useMemo, useState } from 'react'
import type {
  AppConfig,
  PayrollParams,
  PayrollRow,
  PayrollSettings,
  PayslipWithEmployee,
  BilanPeriode,
  StatutBulletin
} from '../../../shared/types'
import { CONFIG_DEFAUT, PARAMS_PAIE_DEFAUT } from '../../../shared/types'
import { formatMoney, formatHeures, formatDate, todayISO } from '../lib/format'
import { imprimerDocument, toCsv } from '../lib/print'
import { chargerConfig, chargerParamsPaie } from '../lib/config'
import { bulletinHtml, type BulletinContexte } from '../lib/documents'
import { Modale } from '../components/Modale'
import { PreviewFrame } from '../components/PreviewFrame'
import { BilanArchive } from '../components/BilanArchive'
import { Confirm } from '../components/Confirm'
import { RappelPanel } from '../components/RappelPanel'
import type { Employee } from '../../../shared/types'

/** Mois courant au format YYYY-MM. */
function moisCourant(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** Bornes (1er et dernier jour) d'un mois YYYY-MM. */
function bornesMois(mois: string): { start: string; end: string } {
  const [y, m] = mois.split('-').map(Number)
  const dernier = new Date(y, m, 0).getDate()
  return { start: `${mois}-01`, end: `${mois}-${String(dernier).padStart(2, '0')}` }
}

export function PayrollPage(): JSX.Element {
  const [mois, setMois] = useState(moisCourant)
  const [rows, setRows] = useState<PayrollRow[] | null>(null)
  const [calcul, setCalcul] = useState(false)
  const [config, setConfig] = useState<AppConfig>(CONFIG_DEFAUT)
  const [settings, setSettings] = useState<PayrollSettings>(PARAMS_PAIE_DEFAUT)
  const [apercu, setApercu] = useState<PayrollRow[] | null>(null)
  const [onglet, setOnglet] = useState<'calcul' | 'registre' | 'rappel'>('calcul')
  const [employes, setEmployes] = useState<Employee[]>([])
  const [registre, setRegistre] = useState<PayslipWithEmployee[]>([])
  const [cloture, setCloture] = useState(false)
  const [message, setMessage] = useState('')
  const [bilan, setBilan] = useState<BilanPeriode | null>(null)
  const [confirmEcraser, setConfirmEcraser] = useState(false)
  const [apercuArchive, setApercuArchive] = useState<PayslipWithEmployee[] | null>(null)

  const { start, end } = useMemo(() => bornesMois(mois), [mois])

  useEffect(() => {
    chargerConfig().then(setConfig)
    chargerParamsPaie().then(setSettings)
    chargerRegistre()
    window.api.employees.list(false).then(setEmployes)
  }, [])

  async function chargerRegistre(): Promise<void> {
    setRegistre(await window.api.payslips.list())
  }

  /**
   * Clôture la période : chaque bulletin est archivé avec son code et le détail
   * du calcul figé. Un bulletin déjà émis pour la période n'est pas réécrit.
   */
  async function cloturer(): Promise<void> {
    setCloture(true)
    try {
      const r = await window.api.payslips.cloturer({ start, end, settings })
      setMessage(
        r.emis > 0
          ? `${r.emis} bulletin(s) archivé(s)${r.existants > 0 ? ` · ${r.existants} déjà émis, inchangé(s)` : ''}.`
          : 'Tous les bulletins de cette période étaient déjà archivés.'
      )
      await chargerRegistre()
    } finally {
      setCloture(false)
    }
  }

  /** Réimprime un bulletin depuis son instantané, jamais depuis un recalcul. */
  function imprimerArchive(p: PayslipWithEmployee): void {
    imprimerDocument(
      `Bulletin ${p.reference}`,
      bulletinHtml(p.donnees, {
        periode_debut: p.periode_debut,
        periode_fin: p.periode_fin,
        config,
        settings: p.parametres
      })
    )
  }

  // Un changement de période ou de barème invalide le calcul affiché.
  useEffect(() => {
    setRows(null)
  }, [mois, settings])

  async function calculer(): Promise<void> {
    setCalcul(true)
    try {
      const params: PayrollParams = { start, end, settings }
      setRows(await window.api.payroll.compute(params))
      // Si la période a déjà été clôturée, on confronte l'archive au calcul du jour.
      const b = await window.api.payslips.comparer(params)
      setBilan(b.existe ? b : null)
    } finally {
      setCalcul(false)
    }
  }

  /** Réémet toute la période après confirmation explicite. */
  async function ecraser(): Promise<void> {
    setConfirmEcraser(false)
    const r = await window.api.payslips.remplacer({ start, end, settings })
    setMessage(`${r.emis} bulletin(s) réémis pour la période.`)
    await chargerRegistre()
    setBilan(await window.api.payslips.comparer({ start, end, settings }))
  }

  /** Aperçu des bulletins tels qu'ils ont été archivés. */
  async function apercuArchives(): Promise<void> {
    setApercuArchive(await window.api.payslips.listByPeriode(start, end))
  }

  async function imprimerArchives(): Promise<void> {
    const liste = await window.api.payslips.listByPeriode(start, end)
    if (liste.length === 0) return
    imprimerDocument(
      `Bulletins archivés ${mois}`,
      liste
        .map((p) =>
          bulletinHtml(p.donnees, {
            periode_debut: p.periode_debut,
            periode_fin: p.periode_fin,
            config,
            settings: p.parametres
          })
        )
        .join('')
    )
  }

  // Ajustements effectivement repris dans le calcul : permet de vérifier d'un
  // coup d'œil que les primes et retenues du mois ont bien été intégrées.
  const nbAjustements = useMemo(
    () => (rows ? rows.reduce((t, r) => t + (r.elements?.length ?? 0), 0) : 0),
    [rows]
  )

  const totaux = useMemo(() => {
    if (!rows) return null
    return rows.reduce(
      (t, r) => ({
        brut: t.brut + r.brut_imposable,
        cnss: t.cnss + r.cnss_salarie,
        iuts: t.iuts + r.iuts,
        net: t.net + r.net_a_payer,
        cout: t.cout + r.cout_employeur
      }),
      { brut: 0, cnss: 0, iuts: 0, net: 0, cout: 0 }
    )
  }, [rows])

  const ctx: BulletinContexte = useMemo(
    () => ({ periode_debut: start, periode_fin: end, config, settings }),
    [start, end, config, settings]
  )

  const corpsApercu = useMemo(
    () => (apercu ? apercu.map((r) => bulletinHtml(r, ctx)).join('') : ''),
    [apercu, ctx]
  )

  async function exporterCsv(): Promise<void> {
    if (!rows) return
    const entetes = [
      'Matricule',
      'Nom',
      'Prénom',
      'Emploi',
      'Heures normales',
      'Heures sup.',
      "Jours d'absence",
      'Salaire brut',
      'CNSS salarié',
      'IUTS',
      'Total retenues',
      'Net à payer',
      'CNSS employeur',
      'Taxe patronale',
      'Coût employeur'
    ]
    const lignes = rows.map((r) => [
      r.matricule,
      r.nom,
      r.prenom,
      r.poste,
      r.heures_normales,
      r.heures_sup,
      r.jours_absence,
      r.brut_imposable,
      r.cnss_salarie,
      r.iuts,
      r.total_retenues,
      r.net_a_payer,
      r.cnss_employeur,
      r.taxe_patronale,
      r.cout_employeur
    ])
    await window.api.exportCsv(`livre_de_paie_${mois}.csv`, toCsv(entetes, lignes))
  }

  function imprimer(liste: PayrollRow[]): void {
    if (liste.length === 0) return
    imprimerDocument(
      `Bulletins de paie ${mois}`,
      liste.map((r) => bulletinHtml(r, ctx)).join('')
    )
  }

  return (
    <>
      <header className="entete-page">
        <div>
          <h1>Paie</h1>
          <p>Bulletins, cotisations CNSS et IUTS · net à payer par salarié</p>
        </div>
      </header>

      <div className="page-corps">
        <div className="onglets">
          <button
            className={`onglet ${onglet === 'calcul' ? 'actif' : ''}`}
            onClick={() => setOnglet('calcul')}
          >
            Calcul de la paie
          </button>
          <button
            className={`onglet ${onglet === 'registre' ? 'actif' : ''}`}
            onClick={() => setOnglet('registre')}
          >
            Registre des bulletins ({registre.length})
          </button>
          <button
            className={`onglet ${onglet === 'rappel' ? 'actif' : ''}`}
            onClick={() => setOnglet('rappel')}
          >
            Rappel des périodes passées
          </button>
        </div>

        {onglet === 'rappel' ? (
          <RappelPanel settings={settings} />
        ) : onglet === 'registre' ? (
          <RegistreBulletins
            registre={registre}
            config={config}
            onImprimer={imprimerArchive}
            onChange={chargerRegistre}
          />
        ) : (
        <>
        <div className="carte" style={{ padding: 'var(--e4)', marginBottom: 'var(--e5)' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              gap: 'var(--e3)',
              flexWrap: 'wrap'
            }}
          >
            <div className="champ" style={{ marginBottom: 0, minWidth: 190 }}>
              <label>Période de paie</label>
              <input type="month" value={mois} onChange={(e) => setMois(e.target.value)} />
            </div>
            <button className="btn btn-primaire" onClick={calculer} disabled={calcul}>
              {calcul ? 'Calcul en cours…' : 'Calculer la paie'}
            </button>
            {rows && rows.length > 0 && (
              <>
                <button className="btn btn-secondaire" onClick={() => setApercu(rows)}>
                  Prévisualiser les bulletins
                </button>
                <button className="btn btn-secondaire" onClick={() => imprimer(rows)}>
                  Imprimer / PDF
                </button>
                <button className="btn btn-secondaire" onClick={exporterCsv}>
                  Exporter le livre de paie
                </button>
                <button className="btn btn-primaire" onClick={cloturer} disabled={cloture}>
                  {cloture ? 'Archivage…' : 'Clôturer et archiver'}
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
            La clôture fige chaque bulletin avec son code : il gardera ces montants même si un
            taux ou un pointage change ensuite.
          </p>
        </div>

        {bilan && (
          <BilanArchive
            bilan={bilan}
            onApercu={apercuArchives}
            onImprimer={imprimerArchives}
            onEcraser={() => setConfirmEcraser(true)}
            onFermer={() => setBilan(null)}
          />
        )}

        {!rows ? (
          <div className="carte vide">
            <div className="icone-vide">📊</div>
            <p>Choisissez une période puis lancez le calcul de la paie.</p>
          </div>
        ) : rows.length === 0 ? (
          <div className="carte vide">
            <div className="icone-vide">👥</div>
            <p>Aucun employé actif à traiter sur cette période.</p>
          </div>
        ) : (
          <>
            {nbAjustements > 0 && (
              <div className="encart" style={{ marginBottom: 'var(--e4)' }}>
                <strong>{nbAjustements} ajustement(s)</strong> repris dans ce calcul (primes,
                indemnités, avances). Ils se modifient depuis le module
                <strong> Ajustements</strong>.
              </div>
            )}

            <div className="tuiles">
              <div className="tuile">
                <span className="libelle">Masse salariale brute</span>
                <span className="valeur">{formatMoney(totaux!.brut)}</span>
                <span className="detail">{rows.length} salarié(s)</span>
              </div>
              <div className="tuile alerte">
                <span className="libelle">Retenues salariales</span>
                <span className="valeur">{formatMoney(totaux!.cnss + totaux!.iuts)}</span>
                <span className="detail">
                  CNSS {formatMoney(totaux!.cnss)} · IUTS {formatMoney(totaux!.iuts)}
                </span>
              </div>
              <div className="tuile succes">
                <span className="libelle">Total net à payer</span>
                <span className="valeur">{formatMoney(totaux!.net)}</span>
                <span className="detail">Somme à verser aux salariés</span>
              </div>
              <div className="tuile accent">
                <span className="libelle">Coût employeur</span>
                <span className="valeur">{formatMoney(totaux!.cout)}</span>
                <span className="detail">Brut + charges patronales</span>
              </div>
            </div>

            <div className="tableau-conteneur">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 90 }}>Matricule</th>
                    <th>Salarié</th>
                    <th className="num">Heures</th>
                    <th className="num">Abs.</th>
                    <th className="num">Brut</th>
                    <th className="num">CNSS</th>
                    <th className="num">IUTS</th>
                    <th className="num">Net à payer</th>
                    <th className="num">Coût employeur</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.employee_id}>
                      <td className="mono texte-petit">{r.matricule}</td>
                      <td>
                        <div className="cellule-principale">
                          {r.nom.toUpperCase()} {r.prenom}
                        </div>
                        <div className="cellule-secondaire">{r.poste || 'Non renseigné'}</div>
                      </td>
                      <td className="num">
                        {formatHeures(r.heures_total)}
                        {r.heures_sup > 0 && (
                          <div className="cellule-secondaire">
                            dont {formatHeures(r.heures_sup)} sup.
                          </div>
                        )}
                      </td>
                      <td className="num">
                        {r.jours_absence > 0 ? (
                          <span className="badge badge-erreur">{r.jours_absence} j</span>
                        ) : (
                          <span className="texte-gris">Non renseigné</span>
                        )}
                      </td>
                      <td className="num">{formatMoney(r.brut_imposable)}</td>
                      <td className="num texte-gris">{formatMoney(r.cnss_salarie)}</td>
                      <td className="num texte-gris">{formatMoney(r.iuts)}</td>
                      <td className="num">
                        <strong>{formatMoney(r.net_a_payer)}</strong>
                      </td>
                      <td className="num texte-gris">{formatMoney(r.cout_employeur)}</td>
                      <td>
                        <div className="actions-cellule">
                          <button className="btn-discret btn-sm" onClick={() => setApercu([r])}>
                            Bulletin
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  <tr className="ligne-total">
                    <td colSpan={4}>Total · {rows.length} salarié(s)</td>
                    <td className="num">{formatMoney(totaux!.brut)}</td>
                    <td className="num">{formatMoney(totaux!.cnss)}</td>
                    <td className="num">{formatMoney(totaux!.iuts)}</td>
                    <td className="num">{formatMoney(totaux!.net)}</td>
                    <td className="num">{formatMoney(totaux!.cout)}</td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p className="texte-petit texte-gris" style={{ marginTop: 'var(--e3)' }}>
              Retenue d'absence : chaque jour d'absence non justifiée ou de congé sans solde
              retire 1/30 du salaire mensuel. Montants indicatifs à valider avec votre comptable.
            </p>
          </>
        )}
        </>
        )}
      </div>

      {apercu && (
        <Modale
          titre={
            apercu.length === 1
              ? `Bulletin · ${apercu[0].prenom} ${apercu[0].nom.toUpperCase()}`
              : `Bulletins de paie (${apercu.length})`
          }
          onClose={() => setApercu(null)}
          large
          pied={
            <>
              <button className="btn btn-secondaire" onClick={() => setApercu(null)}>
                Fermer
              </button>
              <button className="btn btn-primaire" onClick={() => imprimer(apercu)}>
                Imprimer / PDF
              </button>
            </>
          }
        >
          <PreviewFrame titre="Bulletins de paie" corps={corpsApercu} hauteur={600} />
        </Modale>
      )}

      {apercuArchive && (
        <Modale
          titre={`Bulletins archivés · ${apercuArchive.length} salarié(s)`}
          onClose={() => setApercuArchive(null)}
          large
          pied={
            <>
              <button className="btn btn-secondaire" onClick={() => setApercuArchive(null)}>
                Fermer
              </button>
              <button className="btn btn-primaire" onClick={imprimerArchives}>
                Imprimer / PDF
              </button>
            </>
          }
        >
          <PreviewFrame
            titre="Bulletins archivés"
            corps={apercuArchive
              .map((p) =>
                bulletinHtml(p.donnees, {
                  periode_debut: p.periode_debut,
                  periode_fin: p.periode_fin,
                  config,
                  settings: p.parametres
                })
              )
              .join('')}
            hauteur={600}
          />
        </Modale>
      )}

      {confirmEcraser && (
        <Confirm
          titre="Écraser les bulletins de la période"
          message={`Les ${bilan?.nb_archives ?? 0} bulletin(s) archivé(s) du ${start} au ${end} seront supprimés et réémis avec les valeurs actuelles. Les codes seront réattribués. Cette opération est irréversible.`}
          danger
          onCancel={() => setConfirmEcraser(false)}
          onConfirm={ecraser}
        />
      )}


    </>
  )
}

/** Registre des bulletins archivés : consultation, statut de paiement, réimpression. */
function RegistreBulletins({
  registre,
  config,
  onImprimer,
  onChange
}: {
  registre: PayslipWithEmployee[]
  config: AppConfig
  onImprimer: (p: PayslipWithEmployee) => void
  onChange: () => void
}): JSX.Element {
  const [recherche, setRecherche] = useState('')
  const [apercu, setApercu] = useState<PayslipWithEmployee | null>(null)
  const [edition, setEdition] = useState<PayslipWithEmployee | null>(null)
  const [aSupprimer, setASupprimer] = useState<PayslipWithEmployee | null>(null)

  async function supprimer(): Promise<void> {
    if (!aSupprimer) return
    await window.api.payslips.remove(aSupprimer.id)
    setASupprimer(null)
    onChange()
  }

  const liste = useMemo(() => {
    const r = recherche.trim().toLowerCase()
    return registre.filter(
      (p) =>
        !r ||
        `${p.reference} ${p.employee_nom} ${p.employee_prenom} ${p.periode_debut}`
          .toLowerCase()
          .includes(r)
    )
  }, [registre, recherche])

  async function basculerPaiement(p: PayslipWithEmployee): Promise<void> {
    const paye = p.statut === 'Payé'
    await window.api.payslips.setStatut(p.id, paye ? 'Émis' : 'Payé', paye ? null : todayISO())
    onChange()
  }

  if (registre.length === 0) {
    return (
      <div className="carte vide">
        <div className="icone-vide">◫</div>
        <p>
          Aucun bulletin archivé. Calculez une période puis cliquez sur
          « Clôturer et archiver ».
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="barre-outils">
        <input
          className="recherche"
          placeholder="Rechercher un code, un salarié, une période…"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
        />
        <div className="groupe texte-gris texte-petit">{liste.length} bulletin(s)</div>
      </div>

      <div className="tableau-conteneur">
        <table>
          <thead>
            <tr>
              <th>Code</th>
              <th>Salarié</th>
              <th>Période</th>
              <th className="num">Brut</th>
              <th className="num">Retenues</th>
              <th className="num">Net à payer</th>
              <th>Statut</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {liste.map((p) => (
              <tr key={p.id}>
                <td className="mono texte-petit">{p.reference}</td>
                <td>
                  <div className="cellule-principale">
                    {p.employee_nom.toUpperCase()} {p.employee_prenom}
                  </div>
                  <div className="cellule-secondaire">{p.donnees.poste || 'Non renseigné'}</div>
                </td>
                <td className="texte-petit">
                  {formatDate(p.periode_debut)} → {formatDate(p.periode_fin)}
                </td>
                <td className="num">{formatMoney(p.brut)}</td>
                <td className="num texte-gris">{formatMoney(p.total_retenues)}</td>
                <td className="num">
                  <strong>{formatMoney(p.net_a_payer)}</strong>
                </td>
                <td>
                  <span
                    className={`badge ${p.statut === 'Payé' ? 'badge-succes' : 'badge-alerte'}`}
                  >
                    {p.statut}
                  </span>
                  {p.date_paiement && (
                    <div className="cellule-secondaire">{formatDate(p.date_paiement)}</div>
                  )}
                </td>
                <td>
                  <div className="actions-cellule">
                    <button className="btn-discret btn-sm" onClick={() => setApercu(p)}>
                      Aperçu
                    </button>
                    <button className="btn-discret btn-sm" onClick={() => onImprimer(p)}>
                      Imprimer
                    </button>
                    <button className="btn-discret btn-sm" onClick={() => setEdition(p)}>
                      Modifier
                    </button>
                    <button className="btn-danger btn-sm" onClick={() => setASupprimer(p)}>
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
        Les bulletins sont réimprimés depuis leur instantané d'origine : les montants ne
        bougent pas, même si le barème a changé depuis.
      </p>

      {apercu && (
        <Modale
          titre={`Bulletin ${apercu.reference}`}
          onClose={() => setApercu(null)}
          large
          pied={
            <>
              <button className="btn btn-secondaire" onClick={() => setApercu(null)}>
                Fermer
              </button>
              <button className="btn btn-primaire" onClick={() => onImprimer(apercu)}>
                Imprimer / PDF
              </button>
            </>
          }
        >
          <PreviewFrame
            titre={apercu.reference}
            corps={bulletinHtml(apercu.donnees, {
              periode_debut: apercu.periode_debut,
              periode_fin: apercu.periode_fin,
              config,
              settings: apercu.parametres
            })}
            hauteur={600}
          />
        </Modale>
      )}

      {edition && (
        <EditionBulletin
          bulletin={edition}
          onClose={() => setEdition(null)}
          onSaved={() => {
            setEdition(null)
            onChange()
          }}
        />
      )}

      {aSupprimer && (
        <Confirm
          titre="Supprimer le bulletin"
          message={`Supprimer définitivement le bulletin ${aSupprimer.reference} de ${aSupprimer.employee_prenom} ${aSupprimer.employee_nom} ? Le salarié pourra être réintégré en clôturant à nouveau la période.`}
          danger
          onCancel={() => setASupprimer(null)}
          onConfirm={supprimer}
        />
      )}
    </>
  )
}

/**
 * Modification d'un bulletin archivé : seuls le statut et la date de paiement
 * sont modifiables. Les montants restent figés · pour les changer, il faut
 * réémettre la période depuis l'onglet de calcul.
 */
function EditionBulletin({
  bulletin,
  onClose,
  onSaved
}: {
  bulletin: PayslipWithEmployee
  onClose: () => void
  onSaved: () => void
}): JSX.Element {
  const [statut, setStatut] = useState<StatutBulletin>(bulletin.statut)
  const [date, setDate] = useState(bulletin.date_paiement ?? todayISO())
  const [enreg, setEnreg] = useState(false)

  async function enregistrer(): Promise<void> {
    setEnreg(true)
    try {
      await window.api.payslips.setStatut(bulletin.id, statut, statut === 'Émis' ? null : date)
      onSaved()
    } finally {
      setEnreg(false)
    }
  }

  return (
    <Modale
      titre={`Modifier le bulletin ${bulletin.reference}`}
      onClose={onClose}
      pied={
        <>
          <button className="btn btn-secondaire" onClick={onClose}>
            Annuler
          </button>
          <button className="btn btn-primaire" onClick={enregistrer} disabled={enreg}>
            {enreg ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </>
      }
    >
      <div className="encart" style={{ marginBottom: 'var(--e4)' }}>
        Les montants d'un bulletin émis ne se modifient pas : ils constituent la trace de ce
        qui a été remis au salarié. Pour les corriger, réémettez la période depuis l'onglet
        <strong> Calcul de la paie</strong>.
      </div>

      <div className="fiche-ligne">
        <span className="k">Salarié</span>
        <span className="v">
          {bulletin.employee_nom.toUpperCase()} {bulletin.employee_prenom}
        </span>
      </div>
      <div className="fiche-ligne">
        <span className="k">Net à payer</span>
        <span className="v">{formatMoney(bulletin.net_a_payer)}</span>
      </div>

      <div className="grille-champs" style={{ marginTop: 'var(--e4)' }}>
        <div className="champ">
          <label>Statut</label>
          <select value={statut} onChange={(e) => setStatut(e.target.value as StatutBulletin)}>
            <option value="Émis">Émis</option>
            <option value="Payé">Payé</option>
            <option value="Annulé">Annulé</option>
          </select>
        </div>
        {statut !== 'Émis' && (
          <div className="champ">
            <label>Date de paiement</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        )}
      </div>
    </Modale>
  )
}
