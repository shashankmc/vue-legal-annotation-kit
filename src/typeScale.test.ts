import { describe, expect, it } from 'vitest'

// Every text size reads a --lak-font-size-* variable, so a host can map the kit
// onto its own type scale the way it maps colours and radii.
const sources = import.meta.glob<string>('./components/*.vue', { query: '?raw', import: 'default', eager: true })
const components = Object.entries(sources).map(([path, css]) => ({ file: path.split('/').pop() as string, css }))

// Icon glyphs sized as text: the error banner's close "×" and the confidence stars.
const glyphs = new Set(['AnnotatorView.vue:1.1rem', 'StarRating.vue:1.4rem'])
const steps = ['2xs', 'xs', 'sm', 'md', 'base']

describe('type scale', () => {
  it('has no literal font size outside a variable fallback, icon glyphs aside', () => {
    const literal = components.flatMap(({ file, css }) =>
      [...css.matchAll(/font-size:\s*([0-9.]+(?:rem|px|em))\s*;/g)]
        .map((m) => `${file}:${m[1]}`)
        .filter((hit) => !glyphs.has(hit)),
    )
    expect(literal).toEqual([])
  })

  it('uses only the documented steps', () => {
    const used = new Set(
      components.flatMap(({ css }) => [...css.matchAll(/--lak-font-size-([a-z0-9]+)/g)].map((m) => m[1])),
    )
    expect([...used].filter((s) => !steps.includes(s))).toEqual([])
  })

  it('has no hardcoded uppercase label', () => {
    const hits = components.filter(({ css }) => /text-transform:\s*uppercase/.test(css)).map((c) => c.file)
    expect(hits).toEqual([])
  })
})
