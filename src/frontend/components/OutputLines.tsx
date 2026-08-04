import type { OutputSection as OutputSectionType } from '../../types/index.js'
import { OutputSection } from './OutputSection.js'

interface OutputLinesProps {
  sections: OutputSectionType[]
}

export function OutputLines({ sections }: OutputLinesProps) {
  return (
    <>
      {sections.map((section) => (
        <OutputSection
          key={section.id}
          section={section}
        />
      ))}
    </>
  )
}
