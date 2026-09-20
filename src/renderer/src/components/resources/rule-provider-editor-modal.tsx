import {
  Button,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Select,
  SelectItem,
  Tab,
  Tabs,
  Textarea
} from '@heroui/react'
import React, { useState } from 'react'
import { saveSimpleRuleProvider } from '@renderer/utils/ipc'
import type { SimpleObject, SimpleRuleEditor } from '../../../../shared/simple-config'

interface Props {
  name?: string
  data: SimpleRuleEditor
  onClose: () => void
  onSaved: () => void
}

const RuleProviderEditorModal: React.FC<Props> = (props) => {
  const { name, data, onClose, onSaved } = props
  const initial =
    name === undefined
      ? { type: 'http', behavior: 'domain', format: 'yaml', interval: 3600 }
      : data.ruleProviders[name]
  const [values, setValues] = useState<SimpleObject>(() => structuredClone(initial || {}))
  const [nextName, setNextName] = useState(name || '')
  const [payload, setPayload] = useState(() =>
    Array.isArray(initial?.payload) ? initial.payload.join('\n') : ''
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const type = String(values.type || 'http')
  const behavior = String(values.behavior || 'domain')
  const set = (key: string, value: unknown): void =>
    setValues((current) => {
      const next = { ...current }
      if (value === '' || value === undefined) delete next[key]
      else next[key] = value
      return next
    })
  const nameError = !nextName.trim()
    ? '名称不能为空'
    : nextName.trim() !== name && Object.hasOwn(data.ruleProviders, nextName.trim())
      ? '名称已存在'
      : /[,\r\n]/.test(nextName)
        ? '名称不能包含逗号或换行'
        : ''
  const input = (key: string, label: string): React.ReactNode => (
    <Input
      size="sm"
      label={label}
      value={String(values[key] ?? '')}
      onValueChange={(value) => set(key, value)}
    />
  )
  const save = async (): Promise<void> => {
    setSaving(true)
    setError('')
    try {
      if (!initial) throw new Error('规则集已不存在，请重新打开编辑器')
      if (nameError) throw new Error(nameError)
      const value: SimpleObject = { ...values, type, behavior }
      if (type === 'http') {
        const url = new URL(String(value.url || ''))
        if (!['http:', 'https:'].includes(url.protocol)) throw new Error('URL 必须使用 http(s)')
        delete value.payload
        for (const [key, label] of [
          ['interval', '更新间隔'],
          ['size-limit', '大小上限']
        ]) {
          if (value[key] === undefined) continue
          const number = Number(value[key])
          if (!Number.isSafeInteger(number) || number < 0) throw new Error(`${label}必须是非负整数`)
          value[key] = number
        }
      } else {
        for (const key of ['url', 'interval', 'proxy', 'header', 'size-limit']) delete value[key]
        if (type === 'file') {
          if (!String(value.path || '').trim()) throw new Error('文件路径不能为空')
          delete value.payload
        } else {
          delete value.path
          delete value.format
          value.payload = payload
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean)
        }
      }
      if (value.format === 'mrs' && behavior === 'classical')
        throw new Error('classical 规则不支持 MRS 格式')
      await saveSimpleRuleProvider(
        name,
        nextName.trim(),
        value,
        name === undefined ? undefined : initial
      )
      onSaved()
      onClose()
    } catch (error) {
      setError(String(error))
    } finally {
      setSaving(false)
    }
  }
  return (
    <Modal
      isOpen
      hideCloseButton
      size="3xl"
      backdrop="blur"
      scrollBehavior="inside"
      isDismissable={!saving}
      isKeyboardDismissDisabled={saving}
      onClose={onClose}
      classNames={{ backdrop: 'top-[48px]', base: 'max-h-[calc(100dvh-80px)]' }}
    >
      <ModalContent>
        <ModalHeader className="app-drag min-w-0">
          <span className="truncate">
            {name === undefined ? '添加规则集' : `编辑规则集 · ${name}`}
          </span>
        </ModalHeader>
        <ModalBody>
          <fieldset disabled={saving} className="min-w-0">
            <Tabs aria-label="规则集参数" size="sm" classNames={{ panel: 'px-0 pt-4' }}>
              <Tab key="basic" title="基本">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Input
                    size="sm"
                    label="名称"
                    value={nextName}
                    onValueChange={setNextName}
                    isInvalid={!!nextName && !!nameError}
                    errorMessage={nameError}
                  />
                  <Select
                    size="sm"
                    label="类型"
                    selectedKeys={[type]}
                    disallowEmptySelection
                    onSelectionChange={(keys) => set('type', Array.from(keys)[0])}
                  >
                    <SelectItem key="http">HTTP</SelectItem>
                    <SelectItem key="file">文件</SelectItem>
                    <SelectItem key="inline">内联</SelectItem>
                  </Select>
                  <Select
                    size="sm"
                    label="行为"
                    selectedKeys={[behavior]}
                    disallowEmptySelection
                    onSelectionChange={(keys) => {
                      const value = String(Array.from(keys)[0] || behavior)
                      setValues((current) => ({
                        ...current,
                        behavior: value,
                        ...(value === 'classical' && current.format === 'mrs'
                          ? { format: 'yaml' }
                          : {})
                      }))
                    }}
                  >
                    <SelectItem key="domain">domain</SelectItem>
                    <SelectItem key="ipcidr">ipcidr</SelectItem>
                    <SelectItem key="classical">classical</SelectItem>
                  </Select>
                  {type !== 'inline' && (
                    <Select
                      size="sm"
                      label="格式"
                      selectedKeys={[String(values.format || 'yaml')]}
                      disallowEmptySelection
                      disabledKeys={behavior === 'classical' ? ['mrs'] : []}
                      onSelectionChange={(keys) => set('format', Array.from(keys)[0])}
                    >
                      <SelectItem key="yaml">YAML</SelectItem>
                      <SelectItem key="text">Text</SelectItem>
                      <SelectItem key="mrs">MRS</SelectItem>
                    </Select>
                  )}
                  {type === 'http' && <div className="sm:col-span-2">{input('url', 'URL')}</div>}
                  {type !== 'inline' && (
                    <div className="sm:col-span-2">
                      {input('path', type === 'http' ? '缓存路径' : '文件路径')}
                    </div>
                  )}
                  {type === 'inline' && (
                    <Textarea
                      size="sm"
                      className="sm:col-span-2 font-mono"
                      label="规则内容"
                      minRows={6}
                      value={payload}
                      onValueChange={setPayload}
                    />
                  )}
                </div>
              </Tab>
              {type === 'http' && (
                <Tab key="advanced" title="高级">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Input
                      size="sm"
                      type="number"
                      min={0}
                      step={1}
                      label="更新间隔（秒）"
                      value={String(values.interval ?? '')}
                      onValueChange={(value) => set('interval', value)}
                    />
                    <Input
                      size="sm"
                      type="number"
                      min={0}
                      step={1}
                      label="大小上限（字节）"
                      value={String(values['size-limit'] ?? '')}
                      onValueChange={(value) => set('size-limit', value)}
                    />
                    <Select
                      size="sm"
                      label="下载代理"
                      selectedKeys={values.proxy ? [String(values.proxy)] : []}
                      onSelectionChange={(keys) => set('proxy', Array.from(keys)[0])}
                    >
                      {[
                        ...new Set([
                          ...data.outbounds,
                          ...(values.proxy ? [String(values.proxy)] : [])
                        ])
                      ].map((name) => (
                        <SelectItem key={name}>{name}</SelectItem>
                      ))}
                    </Select>
                  </div>
                </Tab>
              )}
            </Tabs>
          </fieldset>
          {error && (
            <div role="alert" className="text-sm text-danger break-words">
              {error}
            </div>
          )}
        </ModalBody>
        <ModalFooter>
          <Button size="sm" variant="light" isDisabled={saving} onPress={onClose}>
            取消
          </Button>
          <Button
            size="sm"
            color="primary"
            isLoading={saving}
            isDisabled={saving || !!nameError}
            onPress={() => save()}
          >
            保存
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
export default RuleProviderEditorModal
