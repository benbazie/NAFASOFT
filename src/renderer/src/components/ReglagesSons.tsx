import { useState } from 'react'
import { jouer, lireReglagesSon, ecrireReglagesSon, type NomSon } from '../lib/son'
import { Icone } from './Icones'

const EXEMPLES: { nom: NomSon; libelle: string; quand: string }[] = [
  { nom: 'succes', libelle: 'Succès', quand: 'Enregistrement, calcul terminé, sauvegarde réussie' },
  { nom: 'erreur', libelle: 'Erreur', quand: 'Saisie refusée, opération impossible' },
  { nom: 'alerte', libelle: 'Alerte', quand: 'Déclaration en retard, action à confirmer' },
  { nom: 'suppression', libelle: 'Suppression', quand: 'Un enregistrement est retiré' },
  { nom: 'archive', libelle: 'Archivage', quand: 'Bulletin ou déclaration figé au registre' },
  { nom: 'bascule', libelle: 'Bascule', quand: 'Changement de dossier employeur' },
  { nom: 'clic', libelle: 'Clic', quand: 'Chaque bouton, onglet ou entrée de menu' }
]

/**
 * Réglages du retour sonore.
 *
 * Le volume s'essaie en direct : régler un son sans l'entendre revient à
 * choisir au hasard. Chaque son peut être écouté seul, avec la mention de ce
 * qui le déclenche · sinon l'utilisateur ne sait pas ce qu'il coupe.
 */
export function ReglagesSons(): JSX.Element {
  const [r, setR] = useState(lireReglagesSon)

  function maj(modif: Partial<typeof r>): void {
    const suivant = { ...r, ...modif }
    setR(suivant)
    ecrireReglagesSon(suivant)
    if (modif.volume !== undefined || modif.actif) jouer('clic')
  }

  return (
    <div className="rs">
      <div className="ri-tete">
        <h3>Retour sonore</h3>
        <p>
          Chaque action produit un son : un clic bref au moment où vous agissez, puis un son de
          résultat qui dit si l’opération a réussi ou échoué. Le clic est volontairement très
          court et discret · entendu des centaines de fois par jour, il doit se faire oublier.
          Tout se coupe d’un seul interrupteur ci-dessous.
        </p>
      </div>

      <label className="rs-bascule">
        <input
          type="checkbox"
          checked={r.actif}
          onChange={(e) => maj({ actif: e.target.checked })}
        />
        <span>
          <strong>Sons activés</strong>
          <span className="rs-sous">
            {r.actif ? 'L’application signale ses actions par un son.' : 'Silence complet.'}
          </span>
        </span>
      </label>

      <label className={`rs-volume ${r.actif ? '' : 'inactif'}`}>
        <span>Volume</span>
        <input
          type="range"
          min="0"
          max="100"
          value={Math.round(r.volume * 100)}
          disabled={!r.actif}
          onChange={(e) => maj({ volume: Number(e.target.value) / 100 })}
        />
        <span className="rs-valeur">{Math.round(r.volume * 100)} %</span>
      </label>

      <div className="rs-liste">
        {EXEMPLES.map((s) => (
          <button
            key={s.nom}
            type="button"
            className="rs-essai"
            disabled={!r.actif}
            onClick={() => jouer(s.nom)}
          >
            <Icone nom="chevron" size={14} className="rs-ico" />
            <span className="rs-corps">
              <strong>{s.libelle}</strong>
              <span>{s.quand}</span>
            </span>
            <span className="rs-ecouter">Écouter</span>
          </button>
        ))}
      </div>
    </div>
  )
}
