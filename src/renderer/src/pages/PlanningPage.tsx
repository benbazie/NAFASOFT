import { useEffect, useMemo, useState } from 'react'
import type {
  Employee,
  ShiftInput,
  ShiftWithEmployee,
  GenerateWeekOptions
} from '../../../shared/types'
import { Modale } from '../components/Modale'
import { Confirm } from '../components/Confirm'
import { semaineRange, JOURS_SEMAINE, formatDate } from '../lib/format'

function addDays(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

export function PlanningPage(): JSX.Element {
  const [refDate, setRefDate] = useState(() => new Date())
  const [shifts, setShifts] = useState<ShiftWithEmployee[]>([])
  const [employes, setEmployes] = useState<Employee[]>([])
  const [modal, setModal] = useState<{ date: string; shift: ShiftWithEmployee | null } | null>(null)
  const [aSupprimer, setASupprimer] = useState<ShiftWithEmployee | null>(null)
  const [genOuvert, setGenOuvert] = useState(false)

  const { start, end } = useMemo(() => semaineRange(refDate), [refDate])

  async function charger(): Promise<void> {
    setShifts(await window.api.shifts.listByRange(start, end))
  }

  useEffect(() => {
    window.api.employees.list(false).then(setEmployes)
  }, [])

  useEffect(() => {
    charger()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start, end])

  const jours = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const date = addDays(start, i)
      return { date, label: JOURS_SEMAINE[i], shifts: shifts.filter((s) => s.date === date) }
    })
  }, [start, shifts])

  async function supprimer(): Promise<void> {
    if (!aSupprimer) return
    await window.api.shifts.remove(aSupprimer.id)
    setASupprimer(null)
    charger()
  }

  return (
    <>
      <header className="entete-page">
        <div>
          <h1>Planning</h1>
          <p>
            Semaine du {formatDate(start)} au {formatDate(end)}
          </p>
        </div>
        <div className="groupe" style={{ display: 'flex', gap: 'var(--e2)' }}>
          <button className="btn btn-secondaire" onClick={() => setRefDate(new Date())}>
            Aujourd'hui
          </button>
          <button
            className="btn btn-secondaire"
            onClick={() => setRefDate((d) => new Date(d.getTime() - 7 * 86400000))}
          >
            ◀ Précédente
          </button>
          <button
            className="btn btn-secondaire"
            onClick={() => setRefDate((d) => new Date(d.getTime() + 7 * 86400000))}
          >
            Suivante ▶
          </button>
          <button
            className="btn btn-primaire"
            disabled={employes.length === 0}
            onClick={() => setGenOuvert(true)}
          >
            Générer la semaine
          </button>
        </div>
      </header>

      <div className="page-corps">
        {employes.length === 0 && (
          <div className="carte vide">
            <div className="icone-vide">👥</div>
            <p>Ajoutez d'abord des employés actifs pour créer un planning.</p>
          </div>
        )}
        <div className="planning-grille">
          {jours.map((j) => (
            <div key={j.date} className="planning-jour">
              <div className="planning-jour-entete">
                <div>
                  <strong>{j.label}</strong>
                  <div className="texte-petit texte-gris">{formatDate(j.date)}</div>
                </div>
                <button
                  className="btn-discret btn-sm"
                  title="Ajouter un service"
                  disabled={employes.length === 0}
                  onClick={() => setModal({ date: j.date, shift: null })}
                >
                  +
                </button>
              </div>
              <div className="planning-jour-corps">
                {j.shifts.length === 0 ? (
                  <div className="texte-petit texte-gris" style={{ padding: 'var(--e2)' }}>
                    —
                  </div>
                ) : (
                  j.shifts.map((s) => (
                    <div
                      key={s.id}
                      className="shift-carte"
                      onClick={() => setModal({ date: s.date, shift: s })}
                    >
                      <div className="shift-horaire mono">
                        {s.heure_debut}–{s.heure_fin}
                      </div>
                      <div className="shift-nom">
                        {s.employee_prenom} {s.employee_nom}
                      </div>
                      {s.poste && <div className="texte-petit texte-gris">{s.poste}</div>}
                      <button
                        className="shift-suppr"
                        title="Supprimer"
                        onClick={(ev) => {
                          ev.stopPropagation()
                          setASupprimer(s)
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {modal && (
        <ShiftForm
          date={modal.date}
          shift={modal.shift}
          employes={employes}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null)
            charger()
          }}
        />
      )}

      {aSupprimer && (
        <Confirm
          titre="Supprimer le service"
          message={`Supprimer le service de ${aSupprimer.employee_prenom} ${aSupprimer.employee_nom} le ${formatDate(
            aSupprimer.date
          )} ?`}
          danger
          onCancel={() => setASupprimer(null)}
          onConfirm={supprimer}
        />
      )}

      {genOuvert && (
        <GenerateWeekModal
          weekStart={start}
          nbEmployes={employes.length}
          onClose={() => setGenOuvert(false)}
          onDone={() => {
            setGenOuvert(false)
            charger()
          }}
        />
      )}
    </>
  )
}

function GenerateWeekModal({
  weekStart,
  nbEmployes,
  onClose,
  onDone
}: {
  weekStart: string
  nbEmployes: number
  onClose: () => void
  onDone: () => void
}): JSX.Element {
  const [jours, setJours] = useState<number[]>([0, 1, 2, 3, 4]) // lun→ven
  const [heureDebut, setHeureDebut] = useState('11:00')
  const [pause, setPause] = useState(60)
  const [remplacer, setRemplacer] = useState(true)
  const [enCours, setEnCours] = useState(false)

  function toggleJour(i: number): void {
    setJours((j) => (j.includes(i) ? j.filter((x) => x !== i) : [...j, i]))
  }

  async function generer(): Promise<void> {
    setEnCours(true)
    try {
      const opts: GenerateWeekOptions = {
        week_start: weekStart,
        jours,
        heure_debut: heureDebut,
        pause_minutes: pause,
        remplacer
      }
      await window.api.shifts.generateWeek(opts)
      onDone()
    } finally {
      setEnCours(false)
    }
  }

  return (
    <Modale
      titre="Générer la semaine automatiquement"
      onClose={onClose}
      pied={
        <>
          <button className="btn btn-secondaire" onClick={onClose}>
            Annuler
          </button>
          <button className="btn btn-primaire" onClick={generer} disabled={enCours || jours.length === 0}>
            {enCours ? 'Génération…' : 'Générer'}
          </button>
        </>
      }
    >
      <p className="texte-gris texte-petit" style={{ marginBottom: 'var(--e4)' }}>
        Les heures contractuelles hebdomadaires de chaque employé actif seront réparties sur les
        jours cochés. Les employés en congé approuvé un jour donné sont ignorés.
      </p>

      <div className="champ">
        <label>Jours travaillés</label>
        <div style={{ display: 'flex', gap: 'var(--e1)', flexWrap: 'wrap' }}>
          {JOURS_SEMAINE.map((nom, i) => (
            <button
              key={i}
              type="button"
              className={`btn btn-sm ${jours.includes(i) ? 'btn-primaire' : 'btn-secondaire'}`}
              onClick={() => toggleJour(i)}
            >
              {nom.slice(0, 3)}
            </button>
          ))}
        </div>
      </div>

      <div className="grille-champs">
        <div className="champ">
          <label>Heure de début</label>
          <input type="time" value={heureDebut} onChange={(e) => setHeureDebut(e.target.value)} />
        </div>
        <div className="champ">
          <label>Pause (minutes)</label>
          <input
            type="number"
            min="0"
            value={pause}
            onChange={(e) => setPause(Number(e.target.value) || 0)}
          />
        </div>
      </div>

      <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--e2)' }}>
        <input type="checkbox" checked={remplacer} onChange={(e) => setRemplacer(e.target.checked)} />
        Remplacer les services existants de cette semaine
      </label>

      <p className="texte-petit texte-gris" style={{ marginTop: 'var(--e3)' }}>
        {nbEmployes} employé(s) actif(s) concerné(s).
      </p>
    </Modale>
  )
}

function ShiftForm({
  date,
  shift,
  employes,
  onClose,
  onSaved
}: {
  date: string
  shift: ShiftWithEmployee | null
  employes: Employee[]
  onClose: () => void
  onSaved: () => void
}): JSX.Element {
  const [form, setForm] = useState<ShiftInput>(() => ({
    employee_id: shift?.employee_id ?? employes[0]?.id ?? 0,
    date: shift?.date ?? date,
    heure_debut: shift?.heure_debut ?? '18:00',
    heure_fin: shift?.heure_fin ?? '23:00',
    poste: shift?.poste ?? null,
    pause_minutes: shift?.pause_minutes ?? 0,
    notes: shift?.notes ?? null
  }))
  const [enreg, setEnreg] = useState(false)

  function set<K extends keyof ShiftInput>(cle: K, val: ShiftInput[K]): void {
    setForm((f) => ({ ...f, [cle]: val }))
  }

  async function enregistrer(): Promise<void> {
    setEnreg(true)
    try {
      if (shift) await window.api.shifts.update(shift.id, form)
      else await window.api.shifts.create(form)
      onSaved()
    } finally {
      setEnreg(false)
    }
  }

  return (
    <Modale
      titre={shift ? 'Modifier le service' : 'Nouveau service'}
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
          <select
            value={form.employee_id}
            onChange={(e) => set('employee_id', Number(e.target.value))}
          >
            {employes.map((e) => (
              <option key={e.id} value={e.id}>
                {e.prenom} {e.nom} · {e.poste}
              </option>
            ))}
          </select>
        </div>
        <div className="champ">
          <label>Date</label>
          <input type="date" value={form.date} onChange={(e) => set('date', e.target.value)} />
        </div>
        <div className="champ">
          <label>Poste ce jour</label>
          <input
            value={form.poste ?? ''}
            placeholder="Salle, Cuisine…"
            onChange={(e) => set('poste', e.target.value || null)}
          />
        </div>
        <div className="champ">
          <label>Heure de début</label>
          <input
            type="time"
            value={form.heure_debut}
            onChange={(e) => set('heure_debut', e.target.value)}
          />
        </div>
        <div className="champ">
          <label>Heure de fin</label>
          <input
            type="time"
            value={form.heure_fin}
            onChange={(e) => set('heure_fin', e.target.value)}
          />
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
        <div className="champ pleine-largeur">
          <label>Notes</label>
          <textarea value={form.notes ?? ''} onChange={(e) => set('notes', e.target.value || null)} />
        </div>
      </div>
    </Modale>
  )
}
