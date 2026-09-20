import { isDeepStrictEqual } from 'util'
import type { SimpleDraft, SimpleObject } from '../../shared/simple-config'
import { parse, stringify } from '../utils/yaml'
import { isObject, ruleParts } from './compiler'

export function readSimpleGroups(draft: SimpleDraft): SimpleObject[] {
  const groups: unknown = parse(draft.modules['proxy-groups'])
  if (!Array.isArray(groups) || !groups.every(isObject)) {
    throw new Error('代理组配置必须是对象列表')
  }
  return groups
}

function renameReferences(draft: SimpleDraft, before: string, after: string): SimpleDraft {
  const next = structuredClone(draft)
  const rename = (value: unknown): unknown => (value === before ? after : value)
  const rewriteRule = (value: unknown): unknown => {
    if (typeof value !== 'string') return value
    const parts = ruleParts(value)
    if (parts[0] === 'SUB-RULE') return value
    let index = parts.length - 1
    while (index > 0 && ['no-resolve', 'src'].includes(parts[index])) index--
    if (parts[index] !== before) return value
    parts[index] = after
    return parts.join(',')
  }
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) {
      value.forEach(visit)
      return
    }
    if (!isObject(value)) return
    for (const [key, entry] of Object.entries(value)) {
      if (['proxy', 'dialer-proxy', 'default-selected'].includes(key)) value[key] = rename(entry)
      else if (key === 'proxies' && Array.isArray(entry)) {
        value[key] = entry.map(rename)
        entry.forEach(visit)
      } else visit(entry)
    }
  }
  for (const key of Object.keys(next.modules)) {
    const value: unknown = parse(next.modules[key])
    let updated = structuredClone(value)
    if (key === 'rules' && Array.isArray(updated)) updated = updated.map(rewriteRule)
    else if (key === 'sub-rules' && isObject(updated)) {
      for (const name of Object.keys(updated)) {
        if (Array.isArray(updated[name])) updated[name] = updated[name].map(rewriteRule)
      }
    } else visit(updated)
    if (!isDeepStrictEqual(value, updated)) next.modules[key] = stringify(updated)
  }
  visit(next.preserved)
  next.sources = next.sources.map((source) => {
    const updated = structuredClone(source)
    visit(updated)
    return updated
  })
  return next
}

export function updateSimpleGroup(
  draft: SimpleDraft,
  name: string,
  value: SimpleObject,
  expected?: SimpleObject
): SimpleDraft {
  const groups = readSimpleGroups(draft)
  const index = groups.findIndex((group) => group.name === name)
  if (index < 0) throw new Error(`代理组 ${name} 已不存在，请重新打开编辑器`)
  if (expected && !isDeepStrictEqual(groups[index], expected)) {
    throw new Error(`代理组 ${name} 已被修改，请重新打开编辑器`)
  }
  if (typeof value.name !== 'string' || !value.name.trim()) throw new Error('代理组名称不能为空')
  const nextName = value.name.trim()
  if (groups.some((group, i) => i !== index && group.name === nextName)) {
    throw new Error(`代理组名称已存在: ${nextName}`)
  }
  groups[index] = { ...structuredClone(value), name: nextName }
  const next = { ...draft, modules: { ...draft.modules, 'proxy-groups': stringify(groups) } }
  return nextName === name ? next : renameReferences(next, name, nextName)
}

export function addSimpleGroup(draft: SimpleDraft, value: SimpleObject): SimpleDraft {
  const groups = readSimpleGroups(draft)
  if (typeof value.name !== 'string' || !value.name.trim()) throw new Error('代理组名称不能为空')
  const name = value.name.trim()
  if (groups.some((group) => group.name === name)) throw new Error(`代理组名称已存在: ${name}`)
  return {
    ...draft,
    modules: {
      ...draft.modules,
      'proxy-groups': stringify([...groups, { ...structuredClone(value), name }])
    }
  }
}

export function reorderSimpleGroups(draft: SimpleDraft, names: string[]): SimpleDraft {
  const groups = readSimpleGroups(draft)
  if (
    names.length !== groups.length ||
    new Set(names).size !== names.length ||
    groups.some((group) => typeof group.name !== 'string' || !names.includes(group.name))
  ) {
    throw new Error('代理组列表已变化，请刷新后重新排序')
  }
  const byName = new Map(groups.map((group) => [group.name, group]))
  return {
    ...draft,
    modules: { ...draft.modules, 'proxy-groups': stringify(names.map((name) => byName.get(name))) }
  }
}

export function removeSimpleGroup(
  draft: SimpleDraft,
  name: string,
  expected?: SimpleObject
): SimpleDraft {
  const groups = readSimpleGroups(draft)
  const current = groups.find((group) => group.name === name)
  if (expected && (!current || !isDeepStrictEqual(current, expected)))
    throw new Error(`代理组 ${name} 已变化，请刷新后重新删除`)
  return {
    ...draft,
    modules: {
      ...draft.modules,
      'proxy-groups': stringify(groups.filter((group) => group.name !== name))
    }
  }
}
