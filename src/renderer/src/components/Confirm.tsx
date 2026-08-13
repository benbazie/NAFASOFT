import { Modale } from './Modale'

interface ConfirmProps {
  titre: string
  message: string
  onConfirm: () => void
  onCancel: () => void
  danger?: boolean
}

/** Boîte de confirmation (suppressions, actions irréversibles). */
export function Confirm({ titre, message, onConfirm, onCancel, danger }: ConfirmProps): JSX.Element {
  return (
    <Modale
      titre={titre}
      onClose={onCancel}
      pied={
        <>
          <button className="btn btn-secondaire" onClick={onCancel}>
            Annuler
          </button>
          <button
            className={danger ? 'btn btn-primaire' : 'btn btn-primaire'}
            style={danger ? { background: 'var(--erreur)' } : undefined}
            onClick={onConfirm}
          >
            Confirmer
          </button>
        </>
      }
    >
      <p>{message}</p>
    </Modale>
  )
}
