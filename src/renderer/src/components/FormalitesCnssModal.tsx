import { useMemo, useState } from 'react'
import type { AppConfig, Employee, MotifSortie } from '../../../shared/types'
import { MOTIFS_SORTIE } from '../../../shared/types'
import { Modale } from './Modale'
import { PreviewFrame } from './PreviewFrame'
import { imprimerDocument, nomFichierDocument } from '../lib/print'
import { formatDate, todayISO } from '../lib/format'
import { bulletinCnssHtml, immatriculationHtml } from '../lib/documentsCnss'
import { certificatTravailHtml } from '../lib/documentsRh'

type Formalite = 'immatriculation' | 'entree' | 'sortie' | 'certificat'

interface Cas {
  formalites: Formalite[]
  titre: string
  explication: string
}

/**
 * Détermine la formalité qui s'applique, à partir du seul état du salarié.
 * C'est la règle CNSS : un travailleur sans numéro doit être immatriculé, un
 * travailleur immatriculé qu'on embauche fait l'objet d'un bulletin d'entrée,
 * et un travailleur qui quitte l'entreprise d'un bulletin de sortie · auquel
 * s'ajoute le certificat de travail, obligatoire au titre du Code du travail.
 */
export function determinerCas(e: Employee, aujourdhui = todayISO()): Cas {
  const contratEchu = Boolean(e.date_fin_contrat && e.date_fin_contrat <= aujourdhui)
  const parti = e.statut !== 'actif'

  if (parti || contratEchu) {
    return {
      formalites: e.numero_cnss
        ? ['sortie', 'certificat']
        : ['immatriculation', 'sortie', 'certificat'],
      titre: parti ? 'Salarié sorti des effectifs' : 'Contrat arrivé à échéance',
      explication: e.numero_cnss
        ? "Le bulletin de sortie déclare la fin de la relation de travail à la CNSS. Le certificat de travail est remis au salarié : il est obligatoire au titre du Code du travail."
        : "Ce salarié n'a jamais été immatriculé : la demande d'immatriculation doit être régularisée avant de déclarer sa sortie."
    }
  }

  if (!e.numero_cnss) {
    return {
      formalites: ['immatriculation'],
      titre: 'Travailleur non immatriculé',
      explication:
        "Aucun numéro CNSS n'est enregistré. La demande d'immatriculation doit être adressée à la CNSS dans les huit jours suivant l'embauche (loi n° 015-2006/AN du 11 mai 2006)."
    }
  }

  return {
    formalites: ['entree'],
    titre: 'Travailleur immatriculé',
    explication:
      "Le salarié possède un numéro CNSS : c'est le bulletin d'entrée qui déclare son embauche."
  }
}

const LIBELLES: Record<Formalite, string> = {
  immatriculation: "Demande d'immatriculation",
  entree: "Bulletin d'entrée",
  sortie: 'Bulletin de sortie',
  certificat: 'Certificat de travail'
}

/**
 * Formalités CNSS d'un salarié. Le document applicable est choisi
 * automatiquement ; l'utilisateur ne fait que compléter ce que l'application
 * ne peut pas deviner · la date et le motif de sortie.
 */
export function FormalitesCnssModal({
  employee,
  config,
  onClose
}: {
  employee: Employee
  config: AppConfig
  onClose: () => void
}): JSX.Element {
  const cas = useMemo(() => determinerCas(employee), [employee])
  const [choisie, setChoisie] = useState<Formalite>(cas.formalites[0])
  const [dateSortie, setDateSortie] = useState(employee.date_fin_contrat ?? todayISO())
  const [motif, setMotif] = useState<MotifSortie>('Fin de contrat')
  const [appreciation, setAppreciation] = useState('')

  const corps = useMemo(() => {
    switch (choisie) {
      case 'immatriculation':
        return immatriculationHtml(employee, config, todayISO())
      case 'sortie':
        return bulletinCnssHtml(employee, config, {
          sens: 'sortie',
          date_entree: employee.date_embauche ?? '',
          date_sortie: dateSortie,
          motif
        })
      case 'certificat':
        return certificatTravailHtml(employee, config, {
          lieu: config.entreprise_ville,
          date: todayISO(),
          objet: appreciation,
          date_debut: employee.date_embauche ?? todayISO(),
          date_fin: dateSortie
        })
      default:
        return bulletinCnssHtml(employee, config, {
          sens: 'entree',
          date_entree: employee.date_embauche ?? todayISO(),
          date_sortie: '',
          motif: null
        })
    }
  }, [choisie, employee, config, dateSortie, motif, appreciation])

  const nomDoc = nomFichierDocument([
    LIBELLES[choisie].replace(/[' ]/g, '-'),
    `${employee.nom}-${employee.prenom}`
  ])

  const avecSortie = choisie === 'sortie' || choisie === 'certificat'

  return (
    <Modale
      titre={`Formalités CNSS · ${employee.prenom} ${employee.nom.toUpperCase()}`}
      onClose={onClose}
      large
      pied={
        <>
          <button className="btn btn-secondaire" onClick={onClose}>
            Fermer
          </button>
          <button className="btn btn-primaire" onClick={() => imprimerDocument(nomDoc, corps)}>
            Imprimer / PDF
          </button>
        </>
      }
    >
      <div className="editeur-doc">
        <div className="formulaire-colonne">
          <div className={`encart-cas ${employee.numero_cnss ? '' : 'a-regulariser'}`}>
            <strong>{cas.titre}</strong>
            <p>{cas.explication}</p>
            <div className="cas-refs">
              <span>
                N° CNSS <b>{employee.numero_cnss || 'non attribué'}</b>
              </span>
              <span>
                Embauche <b>{formatDate(employee.date_embauche)}</b>
              </span>
              {employee.date_fin_contrat && (
                <span>
                  Fin de contrat <b>{formatDate(employee.date_fin_contrat)}</b>
                </span>
              )}
            </div>
          </div>

          <h3 className="section-titre">
            Document{cas.formalites.length > 1 ? 's à établir' : ' à établir'}
          </h3>
          <div className="liste-modeles">
            {cas.formalites.map((f) => (
              <button
                key={f}
                className={`modele-carte ${choisie === f ? 'actif' : ''}`}
                onClick={() => setChoisie(f)}
              >
                <span className="modele-nom">{LIBELLES[f]}</span>
                <span className="modele-desc">
                  {f === 'immatriculation' && 'Imprimé CNSS, 2 pages · pré-rempli avec la fiche du salarié.'}
                  {f === 'entree' && "Déclare l'embauche d'un salarié déjà immatriculé."}
                  {f === 'sortie' && 'Déclare la fin de la relation de travail.'}
                  {f === 'certificat' && 'Remis au salarié · obligatoire à la fin du contrat.'}
                </span>
              </button>
            ))}
          </div>

          {avecSortie && (
            <>
              <h3 className="section-titre">Sortie</h3>
              <div className="grille-champs">
                <div className="champ">
                  <label>Date de sortie</label>
                  <input
                    type="date"
                    value={dateSortie}
                    onChange={(ev) => setDateSortie(ev.target.value)}
                  />
                </div>
                {choisie === 'sortie' && (
                  <div className="champ">
                    <label>Motif</label>
                    <select value={motif} onChange={(ev) => setMotif(ev.target.value as MotifSortie)}>
                      {MOTIFS_SORTIE.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {choisie === 'certificat' && (
                  <div className="champ pleine-largeur">
                    <label>Appréciation</label>
                    <textarea
                      rows={3}
                      value={appreciation}
                      placeholder="ex. Il a fait preuve de sérieux et de ponctualité."
                      onChange={(ev) => setAppreciation(ev.target.value)}
                    />
                  </div>
                )}
              </div>
            </>
          )}

          {choisie === 'immatriculation' && (
            <p className="note-champs">
              L'imprimé reprend tout ce qui figure dans la fiche du salarié, y compris l'onglet
              <strong> État civil CNSS</strong> (acte de naissance, coordonnées bancaires,
              découpage du domicile). Ce qui n'y est pas renseigné sort en cases blanches, à
              compléter à la main. Le cadre « N° Travailleur » reste vide : il est réservé à la
              C.N.S.S.
            </p>
          )}
        </div>

        <div className="apercu-colonne">
          <PreviewFrame titre={LIBELLES[choisie]} corps={corps} hauteur={540} />
        </div>
      </div>
    </Modale>
  )
}
