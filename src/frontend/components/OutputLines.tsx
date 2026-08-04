import type { OutputSection as OutputSectionType } from '../../types/index.js'
import { OutputSection } from './OutputSection.js'

interface OutputLinesProps {
  sections: OutputSectionType[]
  showDetails: boolean
}

export function OutputLines({ sections, showDetails }: OutputLinesProps) {
  return (
    <>
      {sections.map((section) => (
        <OutputSection
          key={section.id}
          section={section}
          showDetails={showDetails}
        />
      ))}
    </>
  )
}
