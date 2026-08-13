import { useEffect, useState } from 'react'

/**
 * Horloge et date du bandeau supérieur.
 *
 * L'heure bat à la seconde ; les chiffres sont en chasse fixe pour que la
 * largeur ne bouge pas d'une seconde à l'autre · sans quoi la barre entière
 * tressaute à chaque tic.
 */
export function Horloge(): JSX.Element {
  const [t, setT] = useState(() => new Date())

  useEffect(() => {
    const id = setInterval(() => setT(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const heure = t.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
  const jour = t.toLocaleDateString('fr-FR', { weekday: 'long' })
  const date = t.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })

  return (
    <div className="horloge" title={`${jour} ${date}`}>
      <div className="hg-cal" aria-hidden="true">
        <span className="hg-cal-mois">{t.toLocaleDateString('fr-FR', { month: 'short' })}</span>
        <span className="hg-cal-jour">{t.getDate()}</span>
      </div>
      <div className="hg-texte">
        <span className="hg-heure">{heure}</span>
        <span className="hg-date">
          {jour} {date}
        </span>
      </div>
    </div>
  )
}
