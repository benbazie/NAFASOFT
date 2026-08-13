import { useEffect, useState } from 'react'
import type { EmployeurInput, ModePortefeuille } from '../../../shared/types'
import { PRODUIT } from '../lib/produit'
import { MarqueNafasoft } from '../components/Logo'
import { Icone } from '../components/Icones'

const msg = (e: unknown): string => String((e as Error)?.message ?? e)

/**
 * Première configuration de l'installation.
 *
 * C'est ici que se joue la différence entre les deux façons de vendre le
 * produit : une machine chez un employeur qui gère sa propre entreprise, ou
 * une machine chez un cabinet qui suit plusieurs employeurs. Le choix était
 * auparavant deviné du nombre de dossiers · il est désormais demandé une fois,
 * explicitement, et se retrouve dans Paramètres.
 */
export function PremierDemarrage({
  onTermine
}: {
  onTermine: (id: number) => void
}): JSX.Element {
  const [etape, setEtape] = useState<1 | 2>(1)
  const [mode, setMode] = useState<'mono' | 'cabinet'>('mono')
  const [d, setD] = useState<EmployeurInput>({ nom: '', ville: '', numero_cnss: '' })
  const [erreur, setErreur] = useState('')
  const [occupe, setOccupe] = useState(false)
  // D'où l'application conclut qu'elle est neuve. Si cet écran apparaît alors
  // que des dossiers existent, c'est ce chemin qui est en cause : un autre nom
  // d'application, un autre profil Windows, et Electron ouvre un dossier vide
  // sans qu'aucune erreur ne le signale.
  const [dossier, setDossier] = useState('')
  useEffect(() => {
    window.api.employeurs.dossier().then(setDossier)
  }, [])

  const cabinet = mode === 'cabinet'

  async function terminer(): Promise<void> {
    setOccupe(true)
    try {
      await window.api.employeurs.setMode(mode as ModePortefeuille)
      const e = await window.api.employeurs.create(d)
      onTermine(e.id)
    } catch (err) {
      setErreur(msg(err))
      setOccupe(false)
    }
  }

  return (
    <div className="pd">
      <div className="pd-boite">
        <header className="pd-tete">
          <MarqueNafasoft size={34} />
          <div>
            <h1>Configuration de {PRODUIT.nom}</h1>
            <p>
              {etape === 1
                ? 'Deux questions, une seule fois : à quoi va servir cette installation ?'
                : cabinet
                  ? 'Enregistrez votre premier client. Vous en ajouterez d’autres depuis le portefeuille.'
                  : 'Renseignez l’entreprise que vous allez gérer.'}
            </p>
          </div>
          <span className="pd-etape">Étape {etape} sur 2</span>
        </header>

        {dossier && (
          <p className="pd-chemin">
            Aucun dossier employeur trouvé dans <code>{dossier}</code>. Si vous attendiez vos
            données, c’est que l’application lit ici plutôt qu’à l’emplacement habituel · ne
            créez rien et vérifiez ce chemin.
          </p>
        )}

        {etape === 1 && (
          <>
            <div className="pd-choix">
              <button
                type="button"
                className={`pd-carte ${mode === 'mono' ? 'actif' : ''}`}
                onClick={() => setMode('mono')}
              >
                <span className="pdc-ico">
                  <Icone nom="entreprise" size={26} />
                </span>
                <strong>Une seule entreprise</strong>
                <span className="pdc-sous">
                  Le poste d’un employeur qui gère son propre personnel.
                </span>
                <ul>
                  <li>L’application s’ouvre directement sur l’entreprise</li>
                  <li>Aucun écran de sélection, aucune notion de client</li>
                  <li>Le plus simple pour un restaurant, une boutique, une PME</li>
                </ul>
              </button>

              <button
                type="button"
                className={`pd-carte ${cabinet ? 'actif' : ''}`}
                onClick={() => setMode('cabinet')}
              >
                <span className="pdc-ico">
                  <Icone nom="portefeuille" size={26} />
                </span>
                <strong>Cabinet · plusieurs employeurs</strong>
                <span className="pdc-sous">
                  Le poste d’un comptable, d’un agent CNSS ou d’un prestataire RH.
                </span>
                <ul>
                  <li>Un portefeuille au démarrage, avec l’état de chaque client</li>
                  <li>On bascule d’un employeur à l’autre en un clic</li>
                  <li>Chaque client garde sa base, totalement séparée des autres</li>
                </ul>
              </button>
            </div>

            <div className="pd-pied">
              <p className="pd-note">
                Ce choix se modifie plus tard dans <strong>Paramètres → Installation</strong>.
              </p>
              <button className="btn btn-primaire" onClick={() => setEtape(2)}>
                Continuer
                <Icone nom="chevron" size={16} />
              </button>
            </div>
          </>
        )}

        {etape === 2 && (
          <>
            <div className="grille-champs pd-form">
              <label className="pleine-largeur">
                {cabinet ? 'Raison sociale du premier client' : 'Nom de l’entreprise'}
                <input
                  value={d.nom}
                  autoFocus
                  placeholder="Ex. Boulangerie du Faso"
                  onChange={(e) => setD({ ...d, nom: e.target.value })}
                />
              </label>
              <label>
                Ville
                <input
                  value={d.ville ?? ''}
                  placeholder="Ex. Ouagadougou"
                  onChange={(e) => setD({ ...d, ville: e.target.value })}
                />
              </label>
              <label>
                N° employeur CNSS
                <input
                  value={d.numero_cnss ?? ''}
                  placeholder="Ex. 012345 A"
                  onChange={(e) => setD({ ...d, numero_cnss: e.target.value })}
                />
              </label>
            </div>

            <p className="pd-note">
              Le reste de l’identité (adresse, RCCM, IFU, logo, modèle de contrat) se complète
              ensuite dans <strong>Paramètres → Entreprise</strong>.
            </p>

            {erreur && <p className="bandeau erreur">{erreur}</p>}

            <div className="pd-pied">
              <button className="btn btn-secondaire" onClick={() => setEtape(1)} disabled={occupe}>
                Retour
              </button>
              <button
                className="btn btn-primaire"
                disabled={d.nom.trim().length < 2 || occupe}
                onClick={() => void terminer()}
              >
                {occupe ? 'Création…' : 'Créer le dossier et démarrer'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
