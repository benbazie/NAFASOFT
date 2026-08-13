import { ReactNode, useEffect } from 'react'

interface ModaleProps {
  titre: string
  onClose: () => void
  children: ReactNode
  pied?: ReactNode
  large?: boolean // modale élargie (ex. éditeur + aperçu côte à côte)
}

/** Fenêtre modale générique : fond assombri, fermeture par Échap ou clic extérieur. */
export function Modale({ titre, onClose, children, pied, large }: ModaleProps): JSX.Element {
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="modale-fond" onMouseDown={onClose}>
      <div className={`modale ${large ? 'modale-large' : ''}`} onMouseDown={(e) => e.stopPropagation()}>
        <div className="modale-entete">
          <h2>{titre}</h2>
          <button className="btn-discret" onClick={onClose} aria-label="Fermer">
            ✕
          </button>
        </div>
        <div className="modale-corps">{children}</div>
        {pied && <div className="modale-pied">{pied}</div>}
      </div>
    </div>
  )
}
