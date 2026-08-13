import { useState } from 'react'
import type { AppConfig } from '../../../shared/types'
import { EntrepriseForm } from '../components/EntrepriseModal'
import { ParamsPaieForm } from '../components/ParamsPaieModal'
import { ReglagesInstallation } from '../components/ReglagesInstallation'
import { ReglagesSauvegarde } from '../components/ReglagesSauvegarde'
import { ReglagesSons } from '../components/ReglagesSons'

type Onglet = 'entreprise' | 'bareme' | 'installation' | 'sauvegarde' | 'sons'

/**
 * Module Paramètres : tous les réglages de l'installation au même endroit —
 * l'identité de l'entreprise et le modèle de contrat d'un côté, le barème
 * social et fiscal de l'autre. Réservé au concepteur et aux administrateurs.
 */
export function ParametresPage({
  onConfigSaved
}: {
  onConfigSaved?: (c: AppConfig) => void
}): JSX.Element {
  const [onglet, setOnglet] = useState<Onglet>('entreprise')

  return (
    <>
      <header className="entete-page">
        <div>
          <h1>Paramètres</h1>
          <p>
            Entreprise, barème de paie et destination de cette installation · tous les réglages
            au même endroit
          </p>
        </div>
      </header>

      <div className="page-corps">
        <div className="onglets">
          {(
            [
              ['entreprise', 'Entreprise & documents'],
              ['bareme', 'Barème & cotisations'],
              ['installation', 'Installation'],
              ['sauvegarde', 'Sauvegarde'],
              ['sons', 'Sons']
            ] as [Onglet, string][]
          ).map(([cle, label]) => (
            <button
              key={cle}
              type="button"
              className={`onglet ${onglet === cle ? 'actif' : ''}`}
              onClick={() => setOnglet(cle)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="carte" style={{ padding: 'var(--e5)' }}>
          {onglet === 'entreprise' && <EntrepriseForm onSaved={onConfigSaved} />}
          {onglet === 'bareme' && <ParamsPaieForm />}
          {onglet === 'installation' && <ReglagesInstallation />}
          {onglet === 'sauvegarde' && <ReglagesSauvegarde />}
          {onglet === 'sons' && <ReglagesSons />}
        </div>
      </div>
    </>
  )
}
