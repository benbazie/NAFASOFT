import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { wrapDocument, dimensionsPage, type Orientation } from '../lib/print'

const mmEnPx = (mm: number): number => Math.round((mm / 25.4) * 96)

/**
 * Aperçu fidèle d'un document A4 : le contenu est rendu à sa taille réelle dans un
 * iframe isolé, puis mis à l'échelle pour s'ajuster à la largeur disponible.
 */
export function PreviewFrame({
  titre,
  corps,
  hauteur = 520,
  orientation = 'portrait'
}: {
  titre: string
  corps: string
  hauteur?: number
  orientation?: Orientation
}): JSX.Element {
  const zoneRef = useRef<HTMLDivElement>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [zoom, setZoom] = useState<number | 'auto'>('auto')
  const [echelleAuto, setEchelleAuto] = useState(0.5)
  const [hauteurContenu, setHauteurContenu] = useState(1123)

  // Largeur de rendu : celle d'une feuille A4 dans l'orientation demandée.
  const largeurPx = mmEnPx(dimensionsPage(orientation).largeur)

  // Écrit le document dans l'iframe et mesure sa hauteur réelle.
  useEffect(() => {
    const doc = iframeRef.current?.contentDocument
    if (!doc) return
    doc.open()
    doc.write(wrapDocument(titre, corps, orientation))
    doc.close()
    const mesurer = (): void => {
      const h = doc.documentElement?.scrollHeight ?? 1123
      setHauteurContenu(Math.max(h, 400))
    }
    mesurer()
    // Les polices peuvent décaler la mise en page après le premier rendu.
    const t = setTimeout(mesurer, 120)
    return () => clearTimeout(t)
  }, [titre, corps, orientation])

  // Calcule l'échelle « ajustée à la largeur » du panneau.
  useLayoutEffect(() => {
    const zone = zoneRef.current
    if (!zone) return
    const recalculer = (): void => {
      const dispo = zone.clientWidth - 32 // padding de la zone
      setEchelleAuto(Math.min(1, Math.max(0.2, dispo / largeurPx)))
    }
    recalculer()
    const ro = new ResizeObserver(recalculer)
    ro.observe(zone)
    return () => ro.disconnect()
  }, [largeurPx])

  const echelle = zoom === 'auto' ? echelleAuto : zoom

  return (
    <div>
      <div className="apercu-barre">
        <span className="apercu-titre">
          Aperçu · A4 {orientation === 'paysage' ? 'paysage' : 'portrait'}
        </span>
        <div className="groupe" style={{ display: 'flex', gap: 'var(--e1)' }}>
          {(['auto', 0.5, 0.75, 1] as const).map((z) => (
            <button
              key={String(z)}
              className={`btn btn-sm ${zoom === z ? 'btn-primaire' : 'btn-secondaire'}`}
              onClick={() => setZoom(z)}
            >
              {z === 'auto' ? 'Ajuster' : `${z * 100} %`}
            </button>
          ))}
        </div>
      </div>

      <div className="apercu-zone" ref={zoneRef} style={{ height: hauteur }}>
        {/* Le conteneur adopte la taille mise à l'échelle pour que le défilement reste juste. */}
        <div
          style={{
            width: largeurPx * echelle,
            height: hauteurContenu * echelle,
            flexShrink: 0
          }}
        >
          <iframe
            ref={iframeRef}
            title={titre}
            scrolling="no"
            style={{
              width: largeurPx,
              height: hauteurContenu,
              border: 'none',
              transform: `scale(${echelle})`,
              transformOrigin: 'top left',
              display: 'block'
            }}
          />
        </div>
      </div>
    </div>
  )
}
