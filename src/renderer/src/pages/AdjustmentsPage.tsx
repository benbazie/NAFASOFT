import { useEffect, useMemo, useState } from 'react'
import type { ElementPaie, Employee } from '../../../shared/types'
import { ElementsPaie } from '../components/ElementsPaie'
import { formatMoney, formatDate } from '../lib/format'

function moisCourant(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function bornesMois(mois: string): { start: string; end: string } {
  const [y, m] = mois.split('-').map(Number)
  const dernier = new Date(y, m, 0).getDate()
  return { start: `${mois}-01`, end: `${mois}-${String(dernier).padStart(2, '0')}` }
}

/**
 * Module Ajustements : tout ce qui s'ajoute ou se retire du salaire d'un mois
 * donné · primes, indemnités, avances, prêts. La paie les reprend
 * automatiquement au moment du calcul des bulletins.
 */
export function AdjustmentsPage(): JSX.Element {
  const [mois, setMois] = useState(moisCourant)
  const [employes, setEmployes] = useState<Employee[]>([])
  const [tous, setTous] = useState<ElementPaie[]>([])
  const [rafraichir, setRafraichir] = useState(0)

  const { start, end } = useMemo(() => bornesMois(mois), [mois])

  useEffect(() => {
    window.api.employees.list(false).then(setEmployes)
  }, [])

  // Vue d'ensemble de la période, pour les totaux affichés en tuiles.
  useEffect(() => {
    let annule = false
    async function charger(): Promise<void> {
      const paquets = await Promise.all(
        employes.map((e) => window.api.elements.listPourPeriode(e.id, start, end))
      )
      if (!annule) setTous(paquets.flat())
    }
    if (employes.length > 0) charger()
    return () => {
      annule = true
    }
  }, [employes, start, end, rafraichir])

  const totaux = useMemo(() => {
    const gains = tous.filter((e) => e.sens === 'gain')
    const retenues = tous.filter((e) => e.sens === 'retenue')
    return {
      nbGains: gains.length,
      nbRetenues: retenues.length,
      totalGains: gains.reduce((t, e) => t + e.montant, 0),
      totalRetenues: retenues.reduce((t, e) => t + e.montant, 0),
      concernes: new Set(tous.map((e) => e.employee_id)).size
    }
  }, [tous])

  function moisPrecedent(pas: number): void {
    const [y, m] = mois.split('-').map(Number)
    const d = new Date(y, m - 1 + pas, 1)
    setMois(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  return (
    <>
      <header className="entete-page">
        <div>
          <h1>Ajustements</h1>
          <p>Primes, indemnités, avances et retenues · repris automatiquement dans les bulletins</p>
        </div>
        <div className="groupe" style={{ display: 'flex', gap: 'var(--e2)', alignItems: 'center' }}>
          <button className="btn btn-secondaire" onClick={() => moisPrecedent(-1)}>
            ◀
          </button>
          <input
            className="selecteur"
            type="month"
            value={mois}
            onChange={(e) => setMois(e.target.value)}
          />
          <button className="btn btn-secondaire" onClick={() => moisPrecedent(1)}>
            ▶
          </button>
        </div>
      </header>

      <div className="page-corps">
        <div className="tuiles">
          <div className="tuile succes">
            <span className="libelle">Primes &amp; indemnités</span>
            <span className="valeur">{formatMoney(totaux.totalGains)}</span>
            <span className="detail">{totaux.nbGains} ligne(s)</span>
          </div>
          <div className="tuile erreur">
            <span className="libelle">Retenues</span>
            <span className="valeur">{formatMoney(totaux.totalRetenues)}</span>
            <span className="detail">{totaux.nbRetenues} ligne(s)</span>
          </div>
          <div className="tuile accent">
            <span className="libelle">Incidence nette</span>
            <span className="valeur">
              {totaux.totalGains - totaux.totalRetenues >= 0 ? '+' : ''}
              {formatMoney(totaux.totalGains - totaux.totalRetenues)}
            </span>
            <span className="detail">Sur la masse salariale du mois</span>
          </div>
          <div className="tuile">
            <span className="libelle">Salariés concernés</span>
            <span className="valeur">{totaux.concernes}</span>
            <span className="detail">sur {employes.length} actif(s)</span>
          </div>
        </div>

        <div className="encart" style={{ marginBottom: 'var(--e4)' }}>
          Période du <strong>{formatDate(start)}</strong> au <strong>{formatDate(end)}</strong>.
          Ce que vous saisissez ici est repris tel quel au moment de calculer la paie de ce mois —
          aucune ressaisie n'est nécessaire.
        </div>

        <ElementsPaie
          employes={employes}
          start={start}
          end={end}
          onChange={() => setRafraichir((n) => n + 1)}
        />
      </div>
    </>
  )
}
