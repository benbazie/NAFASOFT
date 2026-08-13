import { useMemo, useState } from 'react'
import type { AppConfig, Employee, TypeDocumentRh } from '../../../shared/types'
import { Modale } from './Modale'
import { PreviewFrame } from './PreviewFrame'
import { imprimerDocument } from '../lib/print'
import { todayISO } from '../lib/format'
import {
  attestationTravailHtml,
  certificatTravailHtml,
  ordreMissionHtml,
  autorisationCongeHtml,
  type OptionsDocumentRh
} from '../lib/documentsRh'

const MODELES: {
  type: TypeDocumentRh
  label: string
  description: string
  champObjet: string
  placeholderObjet: string
  avecPeriode: boolean
}[] = [
  {
    type: 'attestation_travail',
    label: 'Attestation de travail',
    description: 'Atteste que le salarié est en poste · pour une banque, un bailleur, un visa.',
    champObjet: 'Mention complémentaire',
    placeholderObjet: 'ex. Cette attestation est délivrée à la demande de l’intéressé.',
    avecPeriode: false
  },
  {
    type: 'certificat_travail',
    label: 'Certificat de travail',
    description: 'Remis à la fin du contrat · obligatoire selon le Code du travail.',
    champObjet: 'Appréciation',
    placeholderObjet: 'ex. Il a fait preuve de sérieux et de ponctualité.',
    avecPeriode: true
  },
  {
    type: 'ordre_mission',
    label: 'Ordre de mission',
    description: 'Autorise un déplacement professionnel et facilite les contrôles.',
    champObjet: 'Objet de la mission',
    placeholderObjet: 'ex. Approvisionnement au marché de Bobo-Dioulasso',
    avecPeriode: true
  },
  {
    type: 'autorisation_conge',
    label: "Autorisation d'absence",
    description: "Formalise un congé ou une absence autorisée.",
    champObjet: 'Motif',
    placeholderObjet: 'ex. Congé annuel',
    avecPeriode: true
  }
]

/** Établit un document RH pour un salarié, avec aperçu avant impression. */
export function DocumentsRhModal({
  employee,
  config,
  onClose
}: {
  employee: Employee
  config: AppConfig
  onClose: () => void
}): JSX.Element {
  const [type, setType] = useState<TypeDocumentRh>('attestation_travail')
  const [opts, setOpts] = useState<OptionsDocumentRh>({
    lieu: config.entreprise_ville,
    date: todayISO(),
    objet: '',
    date_debut: employee.date_embauche ?? todayISO(),
    date_fin: employee.date_fin_contrat ?? todayISO()
  })

  const modele = MODELES.find((m) => m.type === type)!

  function set<K extends keyof OptionsDocumentRh>(cle: K, val: OptionsDocumentRh[K]): void {
    setOpts((o) => ({ ...o, [cle]: val }))
  }

  const corps = useMemo(() => {
    switch (type) {
      case 'certificat_travail':
        return certificatTravailHtml(employee, config, opts)
      case 'ordre_mission':
        return ordreMissionHtml(employee, config, opts)
      case 'autorisation_conge':
        return autorisationCongeHtml(employee, config, opts)
      default:
        return attestationTravailHtml(employee, config, opts)
    }
  }, [type, employee, config, opts])

  return (
    <Modale
      titre={`Établir un document · ${employee.prenom} ${employee.nom.toUpperCase()}`}
      onClose={onClose}
      large
      pied={
        <>
          <button className="btn btn-secondaire" onClick={onClose}>
            Fermer
          </button>
          <button
            className="btn btn-primaire"
            onClick={() =>
              imprimerDocument(`${modele.label} · ${employee.prenom} ${employee.nom}`, corps)
            }
          >
            Imprimer / PDF
          </button>
        </>
      }
    >
      <div className="editeur-doc">
        <div className="formulaire-colonne">
          <h3 className="section-titre">Type de document</h3>
          <div className="liste-modeles">
            {MODELES.map((m) => (
              <button
                key={m.type}
                className={`modele-carte ${type === m.type ? 'actif' : ''}`}
                onClick={() => setType(m.type)}
              >
                <span className="modele-nom">{m.label}</span>
                <span className="modele-desc">{m.description}</span>
              </button>
            ))}
          </div>

          <h3 className="section-titre">Informations</h3>
          <div className="grille-champs">
            {modele.avecPeriode && (
              <>
                <div className="champ">
                  <label>Du</label>
                  <input
                    type="date"
                    value={opts.date_debut}
                    onChange={(e) => set('date_debut', e.target.value)}
                  />
                </div>
                <div className="champ">
                  <label>Au</label>
                  <input
                    type="date"
                    value={opts.date_fin}
                    onChange={(e) => set('date_fin', e.target.value)}
                  />
                </div>
              </>
            )}
            <div className="champ">
              <label>Fait à</label>
              <input value={opts.lieu} onChange={(e) => set('lieu', e.target.value)} />
            </div>
            <div className="champ">
              <label>Le</label>
              <input type="date" value={opts.date} onChange={(e) => set('date', e.target.value)} />
            </div>
            <div className="champ pleine-largeur">
              <label>{modele.champObjet}</label>
              <textarea
                rows={3}
                value={opts.objet}
                placeholder={modele.placeholderObjet}
                onChange={(e) => set('objet', e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="apercu-colonne">
          <PreviewFrame titre={modele.label} corps={corps} hauteur={540} />
        </div>
      </div>
    </Modale>
  )
}
