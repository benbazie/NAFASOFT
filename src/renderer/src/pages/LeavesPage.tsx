import { useEffect, useMemo, useState } from 'react'
import type {
  Employee,
  LeaveInput,
  LeaveType,
  LeaveStatus,
  LeaveWithEmployee
} from '../../../shared/types'
import { Modale } from '../components/Modale'
import { Confirm } from '../components/Confirm'
import { formatDate, nbJours, todayISO } from '../lib/format'

const TYPES: LeaveType[] = [
  'Congé payé',
  'RTT',
  'Maladie',
  'Absence injustifiée',
  'Congé sans solde',
  'Congé maternité/paternité',
  'Formation',
  'Autre'
]

function badgeStatut(statut: LeaveStatus): string {
  if (statut === 'Approuvé') return 'badge badge-succes'
  if (statut === 'Refusé') return 'badge badge-erreur'
  return 'badge badge-alerte'
}

export function LeavesPage(): JSX.Element {
  const [conges, setConges] = useState<LeaveWithEmployee[]>([])
  const [employes, setEmployes] = useState<Employee[]>([])
  const [filtre, setFiltre] = useState<'tous' | LeaveStatus>('tous')
  const [modalOuverte, setModalOuverte] = useState(false)
  const [enEdition, setEnEdition] = useState<LeaveWithEmployee | null>(null)
  const [aSupprimer, setASupprimer] = useState<LeaveWithEmployee | null>(null)

  async function charger(): Promise<void> {
    setConges(await window.api.leaves.list())
  }

  useEffect(() => {
    charger()
    window.api.employees.list(false).then(setEmployes)
  }, [])

  const filtres = useMemo(
    () => (filtre === 'tous' ? conges : conges.filter((c) => c.statut === filtre)),
    [conges, filtre]
  )

  async function changerStatut(c: LeaveWithEmployee, statut: LeaveStatus): Promise<void> {
    await window.api.leaves.setStatus(c.id, statut)
    charger()
  }

  async function supprimer(): Promise<void> {
    if (!aSupprimer) return
    await window.api.leaves.remove(aSupprimer.id)
    setASupprimer(null)
    charger()
  }

  return (
    <>
      <header className="entete-page">
        <div>
          <h1>Congés & absences</h1>
          <p>Demandes, validations et suivi des absences</p>
        </div>
        <button
          className="btn btn-primaire"
          disabled={employes.length === 0}
          onClick={() => {
            setEnEdition(null)
            setModalOuverte(true)
          }}
        >
          + Nouvelle demande
        </button>
      </header>

      <div className="page-corps">
        <div className="barre-outils">
          <div className="groupe">
            <select
              className="selecteur"
              value={filtre}
              onChange={(e) => setFiltre(e.target.value as typeof filtre)}
            >
              <option value="tous">Tous les statuts</option>
              <option value="En attente">En attente</option>
              <option value="Approuvé">Approuvé</option>
              <option value="Refusé">Refusé</option>
            </select>
          </div>
          <div className="groupe texte-gris texte-petit">{filtres.length} demande(s)</div>
        </div>

        {filtres.length === 0 ? (
          <div className="carte vide">
            <div className="icone-vide">🌴</div>
            <p>Aucune demande de congé ou d'absence enregistrée.</p>
          </div>
        ) : (
          <div className="tableau-conteneur">
            <table>
              <thead>
                <tr>
                  <th>Employé</th>
                  <th>Type</th>
                  <th>Du</th>
                  <th>Au</th>
                  <th className="num">Jours</th>
                  <th>Statut</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtres.map((c) => (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 600 }}>
                      {c.employee_prenom} {c.employee_nom}
                    </td>
                    <td>{c.type}</td>
                    <td>{formatDate(c.date_debut)}</td>
                    <td>{formatDate(c.date_fin)}</td>
                    <td className="num">{nbJours(c.date_debut, c.date_fin)}</td>
                    <td>
                      <span className={badgeStatut(c.statut)}>{c.statut}</span>
                    </td>
                    <td>
                      <div className="actions-cellule">
                        {c.statut !== 'Approuvé' && (
                          <button
                            className="btn-discret btn-sm"
                            title="Approuver"
                            onClick={() => changerStatut(c, 'Approuvé')}
                          >
                            ✔ Approuver
                          </button>
                        )}
                        {c.statut !== 'Refusé' && (
                          <button
                            className="btn-discret btn-sm"
                            title="Refuser"
                            onClick={() => changerStatut(c, 'Refusé')}
                          >
                            ✖ Refuser
                          </button>
                        )}
                        <button
                          className="btn-discret btn-sm"
                          onClick={() => {
                            setEnEdition(c)
                            setModalOuverte(true)
                          }}
                        >
                          Modifier
                        </button>
                        <button className="btn-danger btn-sm" onClick={() => setASupprimer(c)}>
                          Supprimer
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalOuverte && (
        <LeaveForm
          initial={enEdition}
          employes={employes}
          onClose={() => setModalOuverte(false)}
          onSaved={() => {
            setModalOuverte(false)
            charger()
          }}
        />
      )}

      {aSupprimer && (
        <Confirm
          titre="Supprimer la demande"
          message={`Supprimer la demande de ${aSupprimer.employee_prenom} ${aSupprimer.employee_nom} ?`}
          danger
          onCancel={() => setASupprimer(null)}
          onConfirm={supprimer}
        />
      )}
    </>
  )
}

function LeaveForm({
  initial,
  employes,
  onClose,
  onSaved
}: {
  initial: LeaveWithEmployee | null
  employes: Employee[]
  onClose: () => void
  onSaved: () => void
}): JSX.Element {
  const [form, setForm] = useState<LeaveInput>(() => ({
    employee_id: initial?.employee_id ?? employes[0]?.id ?? 0,
    type: initial?.type ?? 'Congé payé',
    date_debut: initial?.date_debut ?? todayISO(),
    date_fin: initial?.date_fin ?? todayISO(),
    statut: initial?.statut ?? 'En attente',
    motif: initial?.motif ?? null
  }))
  const [erreur, setErreur] = useState('')
  const [enreg, setEnreg] = useState(false)

  function set<K extends keyof LeaveInput>(cle: K, val: LeaveInput[K]): void {
    setForm((f) => ({ ...f, [cle]: val }))
  }

  async function enregistrer(): Promise<void> {
    if (form.date_fin < form.date_debut) {
      setErreur('La date de fin doit être postérieure ou égale à la date de début.')
      return
    }
    setEnreg(true)
    try {
      if (initial) await window.api.leaves.update(initial.id, form)
      else await window.api.leaves.create(form)
      onSaved()
    } finally {
      setEnreg(false)
    }
  }

  return (
    <Modale
      titre={initial ? 'Modifier la demande' : 'Nouvelle demande de congé / absence'}
      onClose={onClose}
      pied={
        <>
          <button className="btn btn-secondaire" onClick={onClose}>
            Annuler
          </button>
          <button className="btn btn-primaire" onClick={enregistrer} disabled={enreg}>
            Enregistrer
          </button>
        </>
      }
    >
      <div className="grille-champs">
        <div className="champ pleine-largeur">
          <label>Employé</label>
          <select value={form.employee_id} onChange={(e) => set('employee_id', Number(e.target.value))}>
            {employes.map((e) => (
              <option key={e.id} value={e.id}>
                {e.prenom} {e.nom}
              </option>
            ))}
          </select>
        </div>
        <div className="champ">
          <label>Type</label>
          <select value={form.type} onChange={(e) => set('type', e.target.value as LeaveType)}>
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div className="champ">
          <label>Statut</label>
          <select value={form.statut} onChange={(e) => set('statut', e.target.value as LeaveStatus)}>
            <option value="En attente">En attente</option>
            <option value="Approuvé">Approuvé</option>
            <option value="Refusé">Refusé</option>
          </select>
        </div>
        <div className="champ">
          <label>Date de début</label>
          <input type="date" value={form.date_debut} onChange={(e) => set('date_debut', e.target.value)} />
        </div>
        <div className="champ">
          <label>Date de fin</label>
          <input type="date" value={form.date_fin} onChange={(e) => set('date_fin', e.target.value)} />
        </div>
        <div className="champ pleine-largeur">
          <label>Motif / commentaire</label>
          <textarea value={form.motif ?? ''} onChange={(e) => set('motif', e.target.value || null)} />
        </div>
        {erreur && (
          <div className="champ pleine-largeur">
            <span className="erreur-champ">{erreur}</span>
          </div>
        )}
      </div>
    </Modale>
  )
}
