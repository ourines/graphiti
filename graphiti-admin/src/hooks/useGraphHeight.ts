import { useState, useEffect } from 'react'

export const useGraphHeight = () => {
  const [graphHeight, setGraphHeight] = useState('600px')

  useEffect(() => {
    const calculateHeight = () => {
      const vh = window.innerHeight
      const isMobile = window.innerWidth < 640
      const isTablet = window.innerWidth >= 640 && window.innerWidth < 1024
      const isDesktop = window.innerWidth >= 1024

      let height: string

      if (isMobile) {
        // Mobile: Reserve space for header and controls
        height = `${Math.max(300, vh - 320)}px`
      } else if (isTablet) {
        // Tablet: Reserve space for header and sidebar
        height = `${Math.max(400, vh - 280)}px`
      } else {
        // Desktop: More generous space
        height = `${Math.max(500, vh - 300)}px`
      }

      setGraphHeight(height)
    }

    calculateHeight()
    window.addEventListener('resize', calculateHeight)

    return () => window.removeEventListener('resize', calculateHeight)
  }, [])

  return graphHeight
}