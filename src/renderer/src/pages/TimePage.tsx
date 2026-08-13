import { useEffect, useMemo, useState } from 'react'
import type { Employee, TimeEntryInput, TimeEntryWithEmployee } from '../../../shared/types'
import { Modale } from '../components/Modale'
import { Confirm } from '../components/Confirm'
import { semaineRange, formatDate, formatHeures, labelJour, todayISO } from '../lib/format'

export function TimePage(): JSX.Element {
  const [refDate, setRefDate] = useState(() => new Date())
  const [entrees, setEntrees] = useState<TimeEntryWithEmployee[]>([])
  const [employes, setEmployes] = useState<Employee[]>([])
  const [modalOuverte, setModalOuverte] = useState(false)
  const [enEdition, setEnEdition] = useState<TimeEntryWithEmployee | null>(null)
  const [aSupprimer, setASupprimer] = useState<TimeEntryWithEmployee | null>(null)

  const { start, end } = useMemo(() => semaineRange(refDate), [refDate])

  async function charger(): Promise<void> {
    setEntrees(await window.api.time.listByRange(start, end))
  }

  useEffect(() => {
    window.api.employees.list(false).then(setEmployes)
  }, [])

  useEffect(() => {
    charger()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start, end])

  const totalSemaine = useMemo(
    () => entrees.reduce((s, e) => s + e.heures_travaillees, 0),
    [entrees]
  )

  // Récapitulatif par employé.
  const parEmploye = useMemo(() => {
    const map = new Map<number, { nom: string; heures: number }>()
    for (const e of entrees) {
      const cur = map.get(e.employee_id) ?? { nom: `${e.employee_prenom} ${e.employee_nom}`, heures: 0 }
      cur.heures += e.heures_travaillees
      map.set(e.employee_id, cur)
    }
    return [...map.values()].sort((a, b) => b.heures - a.heures)
  }, [entrees])

  async function supprimer(): Promise<void> {
    if (!aSupprimer) return
    await window.api.time.remove(aSupprimer.id)
    setASupprimer(null)
    charger()
  }

  return (
    <>
      <header className="entete-page">
        <div>
          <h1>Pointage</h1>
          <p>
            Heures travaillées · semaine du {formatDate(start)} au {formatDate(end)}
          </p>
        </div>
        <div className="groupe" style={{ display: 'flex', gap: 'var(--e2)' }}>
          <button className="btn btn-secondaire" onClick={() => setRefDate(new Date())}>
            Cette semaine
          </button>
          <button
            className="btn btn-secondaire"
            onClick={() => setRefDate((d) => new Date(d.getTime() - 7 * 86400000))}
          >
            ◀
          </button>
          <button
            className="btn btn-secondaire"
            onClick={() => setRefDate((d) => new Date(d.getTime() + 7 * 86400000))}
          >
            ▶
          </button>
          <button
            className="btn btn-primaire"
            disabled={employes.length === 0}
            onClick={() => {
              setEnEdition(null)
              setModalOuverte(true)
            }}
          >
            + Pointage
          </button>
        </div>
      </header>

      <div className="page-corps">
        <div className="tuiles">
          <div className="tuile succes">
            <div className="icone-tuile">⏱️</div>
            <div className="valeur">{formatHeures(totalSemaine)}</div>
            <div className="libelle">Total de la semaine</div>
          </div>
          {parEmploye.slice(0, 3).map((p) => (
            <div className="tuile" key={p.nom}>
              <div className="icone-tuile">👤</div>
              <div className="valeur">{formatHeures(p.heures)}</div>
              <div className="libelle">{p.nom}</div>
            </div>
          ))}
        </div>

        {entrees.length === 0 ? (
          <div className="carte vide">
            <div className="icone-vide">⏱️</div>
            <p>Aucun pointage cette semaine. Ajoutez les heures travaillées.</p>
          </div>
        ) : (
          <div className="tableau-conteneur">
            <table>
              <thead>
                <tr>
                  <th>Jour</th>
                  <th>Date</th>
                  <th>Employé</th>
                  <th>Arrivée</th>
                  <th>Départ</th>
                  <th className="num">Pause</th>
                  <th className="num">Heures</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {entrees.map((e) => (
                  <tr key={e.id}>
                    <td>{labelJour(e.date)}</td>
                    <td>{formatDate(e.date)}</td>
                    <td style={{ fontWeight: 600 }}>
                      {e.employee_prenom} {e.employee_nom}
                    </td>
                    <td className="mono">{e.arrivee}</td>
                    <td className="mono">
                      {e.depart ?? <span className="badge badge-alerte">en cours</span>}
                    </td>
                    <td className="num">{e.pause_minutes} min</td>
                    <td className="num" style={{ fontWeight: 700 }}>
                      {e.depart ? formatHeures(e.heures_travaillees) : 'Non renseigné'}
                    </td>
                    <td>
                      <div className="actions-cellule">
                        <button
                          className="btn-discret btn-sm"
                          onClick={() => {
                            setEnEdition(e)
                            setModalOuverte(true)
                          }}
                        >
                          Modifier
                        </button>
                        <button className="btn-danger btn-sm" onClick={() => setASupprimer(e)}>
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
        <TimeForm
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
          titre="Supprimer le pointage"
          message={`Supprimer le pointage de ${aSupprimer.employee_prenom} ${aSupprimer.employee_nom} du ${formatDate(
            aSupprimer.date
          )} ?`}
          danger
          onCancel={() => setASupprimer(null)}
          onConfirm={supprimer}
        />
      )}
    </>
  )
}

function TimeForm({
  initial,
  employes,
  onClose,
  onSaved
}: {
  initial: TimeEntryWithEmployee | null
  employes: Employee[]
  onClose: () => void
  onSaved: () => void
}): JSX.Element {
  const [form, setForm] = useState<TimeEntryInput>(() => ({
    employee_id: initial?.employee_id ?? employes[0]?.id ?? 0,
    date: initial?.date ?? todayISO(),
    arrivee: initial?.arrivee ?? '18:00',
    depart: initial?.depart ?? null,
    pause_minutes: initial?.pause_minutes ?? 0,
    notes: initial?.notes ?? null
  }))
  const [enreg, setEnreg] = useState(false)

  function set<K extends keyof TimeEntryInput>(cle: K, val: TimeEntryInput[K]): void {
    setForm((f) => ({ ...f, [cle]: val }))
  }

  async function enregistrer(): Promise<void> {
    setEnreg(true)
    try {
      if (initial) await window.api.time.update(initial.id, form)
      else await window.api.time.create(form)
      onSaved()
    } finally {
      setEnreg(false)
    }
  }

  return (
    <Modale
      titre={initial ? 'Modifier le pointage' : 'Nouveau pointage'}
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
          <label>Date</label>
          <input type="date" value={form.date} onChange={(e) => set('date', e.target.value)} />
        </div>
        <div className="champ">
          <label>Pause (minutes)</label>
          <input
            type="number"
            min="0"
            value={form.pause_minutes}
            onChange={(e) => set('pause_minutes', Number(e.target.value) || 0)}
          />
        </div>
        <div className="champ">
          <label>Heure d'arrivée</label>
          <input type="time" value={form.arrivee} onChange={(e) => set('arrivee', e.target.value)} />
        </div>
        <div className="champ">
          <label>Heure de départ</label>
          <input
            type="time"
            value={form.depart ?? ''}
            onChange={(e) => set('depart', e.target.value || null)}
          />
          <span className="texte-petit texte-gris">Laisser vide si le service est en cours.</span>
        </div>
        <div className="champ pleine-largeur">
          <label>Notes</label>
          <textarea value={form.notes ?? ''} onChange={(e) => set('notes', e.target.value || null)} />
        </div>
      </div>
    </Modale>
  )
}
