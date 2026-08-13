import { useEffect, useState } from 'react'
import type { EmployeurRegistre, ModePortefeuille } from '../../../shared/types'
import { Icone } from './Icones'

const msg = (e: unknown): string => String((e as Error)?.message ?? e)

/**
 * Réglages propres à l'installation (et non à l'entreprise) : à quoi cette
 * machine sert-elle ?
 *
 * C'est le pendant durable du choix fait au premier démarrage. Il vit ici, et
 * non dans l'écran portefeuille, parce qu'une installation mono-entreprise ne
 * voit jamais cet écran · le réglage y aurait été inatteignable.
 */
export function ReglagesInstallation(): JSX.Element {
  const [mode, setMode] = useState<ModePortefeuille>('auto')
  const [employeurs, setEmployeurs] = useState<EmployeurRegistre[]>([])
  const [erreur, setErreur] = useState('')
  const [info, setInfo] = useState('')
  // Version et emplacement : les deux questions qu'on pose à un client au
  // téléphone. Les lui faire chercher dans un terminal n'est pas tenable.
  const [version, setVersion] = useState('')
  const [dossier, setDossier] = useState('')

  async function charger(): Promise<void> {
    const [m, l] = await Promise.all([
      window.api.employeurs.mode(),
      window.api.employeurs.list()
    ])
    setMode(m)
    setEmployeurs(l)
    setVersion(await window.api.employeurs.version())
    setDossier(await window.api.employeurs.dossier())
  }

  useEffect(() => {
    void charger()
  }, [])

  const plusieurs = employeurs.length > 1
  // « auto » est l'état d'une installation antérieure à ce réglage : on
  // l'affiche comme ce qu'il produit réellement, pour ne pas mentir.
  const effectif: 'mono' | 'cabinet' =
    mode === 'auto' ? (plusieurs ? 'cabinet' : 'mono') : mode

  async function choisir(m: 'mono' | 'cabinet'): Promise<void> {
    if (m === 'mono' && plusieurs) {
      setErreur(
        `Impossible : cette installation suit ${employeurs.length} employeurs. Archivez ou supprimez les dossiers en trop avant de repasser en mono-entreprise.`
      )
      return
    }
    try {
      await window.api.employeurs.setMode(m)
      setMode(m)
      setErreur('')
      setInfo(
        m === 'mono'
          ? 'Mode mono-entreprise : l’application s’ouvrira directement sur l’entreprise.'
          : 'Mode cabinet : le portefeuille s’affichera au démarrage. Redémarrez pour le voir.'
      )
      window.setTimeout(() => setInfo(''), 6000)
    } catch (e) {
      setErreur(msg(e))
    }
  }

  return (
    <div className="ri">
      <div className="ri-tete">
        <h3>À quoi sert cette installation ?</h3>
        <p>
          Le même logiciel se vend de deux façons. Ce réglage détermine ce que voit l’utilisateur
          au démarrage · il ne change aucune donnée.
        </p>
      </div>

      <div className="ri-choix">
        <button
          type="button"
          className={`ri-carte ${effectif === 'mono' ? 'actif' : ''}`}
          onClick={() => void choisir('mono')}
        >
          <span className="ric-ico">
            <Icone nom="entreprise" size={22} />
          </span>
          <span className="ric-corps">
            <strong>Une seule entreprise</strong>
            <span>
              L’application ouvre directement l’entreprise. Aucun écran de sélection, aucune
              notion de client.
            </span>
          </span>
          {effectif === 'mono' && <span className="ric-marque">Actif</span>}
        </button>

        <button
          type="button"
          className={`ri-carte ${effectif === 'cabinet' ? 'actif' : ''}`}
          onClick={() => void choisir('cabinet')}
        >
          <span className="ric-ico">
            <Icone nom="portefeuille" size={22} />
          </span>
          <span className="ric-corps">
            <strong>Cabinet · plusieurs employeurs</strong>
            <span>
              Portefeuille au démarrage, bascule d’un client à l’autre, bilan consolidé de tous
              les dossiers.
            </span>
          </span>
          {effectif === 'cabinet' && <span className="ric-marque">Actif</span>}
        </button>
      </div>

      {erreur && <p className="bandeau erreur">{erreur}</p>}
      {info && <p className="bandeau succes">{info}</p>}

      <div className="ri-etat ri-technique">
        <span className="ri-etat-lib">Cette installation</span>
        <dl>
          <dt>Version</dt>
          <dd>Nafasoft {version || '…'}</dd>
          <dt>Dossier des données</dt>
          <dd><code>{dossier || '…'}</code></dd>
        </dl>
        <p className="ri-note">
          Une mise à jour s’installe par-dessus, sans rien effacer : les données vivent dans le
          dossier ci-dessus, que ni l’installation ni la désinstallation ne touchent. Au premier
          lancement d’une nouvelle version, une copie est prise automatiquement avant toute
          migration.
        </p>
      </div>

      <div className="ri-etat">
        <span className="ri-etat-lib">
          Dossiers de cette installation ({employeurs.length})
        </span>
        <ul>
          {employeurs.map((e) => (
            <li key={e.id}>
              <span
                className="ri-pastille"
                style={{ background: e.couleur || 'var(--primaire)' }}
                aria-hidden="true"
              />
              {e.nom}
              {e.ville && <span className="ri-ville"> · {e.ville}</span>}
            </li>
          ))}
          {employeurs.length === 0 && <li className="ri-vide">Aucun dossier enregistré.</li>}
        </ul>
        {effectif === 'mono' && (
          <p className="ri-note">
            Chaque employeur possède son propre fichier de base de données : passer en mode cabinet
            n’expose jamais les données d’un client à un autre.
          </p>
        )}
      </div>
    </div>
  )
}
