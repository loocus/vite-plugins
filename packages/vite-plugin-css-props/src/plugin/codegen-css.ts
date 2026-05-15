import type { NormalizedCssConfig } from '../types'

function indent(line: string): string {
  return `  ${line}`
}

function buildRootDeclarations(config: NormalizedCssConfig): string {
  const lines: string[] = []
  for (const token of config.colors.tokens)
    lines.push(indent(`${config.cssVarName(token)}: ${config.colors.light[token]};`))
  for (const token of config.props.tokens)
    lines.push(indent(`${config.cssVarName(token)}: ${config.props.values[token]};`))
  return lines.join('\n')
}

function buildDarkDeclarations(config: NormalizedCssConfig): string {
  return config.colors.tokens
    .filter(token => config.colors.dark[token] !== config.colors.light[token])
    .map(token => indent(`${config.cssVarName(token)}: ${config.colors.dark[token]};`))
    .join('\n')
}

export function generateCss(config: NormalizedCssConfig, darkSelector: string): string {
  const rootBlock = buildRootDeclarations(config)
  const darkBlock = buildDarkDeclarations(config)

  const sections: string[] = []
  if (rootBlock.length > 0)
    sections.push(`:root {\n${rootBlock}\n}`)
  if (darkBlock.length > 0)
    sections.push(`${darkSelector} {\n${darkBlock}\n}`)

  return sections.length > 0 ? `${sections.join('\n')}\n` : ''
}
