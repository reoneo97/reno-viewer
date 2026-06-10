import { useEffect, useState } from 'react'
import { useEscapeKey } from '../hooks/useEscapeKey'

interface Props {
  images: string[]
  initialIndex?: number
  caption?: string
  onClose: () => void
}

// Full-screen image viewer. ← / → navigate, Esc closes. Sits above all
// modals so it can be opened from any candidate card.
export function Lightbox({ images, initialIndex = 0, caption, onClose }: Props) {
  const [index, setIndex] = useState(Math.min(initialIndex, images.length - 1))

  // Parents that also listen for Escape must pass active=false to their own
  // useEscapeKey while the lightbox is open, so Esc only closes this layer.
  useEscapeKey(() => onClose())

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') setIndex((i) => (i + 1) % images.length)
      if (e.key === 'ArrowLeft') setIndex((i) => (i - 1 + images.length) % images.length)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [images.length])

  if (images.length === 0) return null

  const prev = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIndex((i) => (i - 1 + images.length) % images.length)
  }
  const next = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIndex((i) => (i + 1) % images.length)
  }

  return (
    <div className="lightbox-backdrop" onClick={onClose}>
      <button className="lightbox-close" aria-label="Close" onClick={onClose}>✕</button>

      {images.length > 1 && (
        <button className="lightbox-nav lightbox-prev" aria-label="Previous image" onClick={prev}>‹</button>
      )}

      <figure className="lightbox-figure" onClick={(e) => e.stopPropagation()}>
        <img src={images[index]} alt={caption ?? ''} className="lightbox-img" />
        {(caption || images.length > 1) && (
          <figcaption className="lightbox-caption">
            {caption}
            {images.length > 1 && (
              <span className="lightbox-counter">{index + 1} / {images.length}</span>
            )}
          </figcaption>
        )}
      </figure>

      {images.length > 1 && (
        <button className="lightbox-nav lightbox-next" aria-label="Next image" onClick={next}>›</button>
      )}

      {images.length > 1 && (
        <div className="lightbox-thumbs" onClick={(e) => e.stopPropagation()}>
          {images.map((url, i) => (
            <img
              key={i}
              src={url}
              alt=""
              className={`lightbox-thumb ${i === index ? 'active' : ''}`}
              onClick={() => setIndex(i)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
