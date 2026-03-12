import Modal, { Field, Input, Select } from './Modal'
import { useSettings } from './SettingsContext'
import { AGENT_OPTIONS, MODEL_OPTIONS, defaultModelForAgent, agentHasModelList } from '../agentConfig'
import { ARCHITECT_DEFAULT_SYSTEM_PROMPT, EXECUTOR_DEFAULT_SYSTEM_PROMPT, type AppSettings } from '../settings'

interface Props {
  onClose: () => void
}

const themeOptions = [
  { value: 'dark',  label: 'dark' },
  { value: 'light', label: 'light' },
]

const taskTypeOptions = [
  { value: 'leaf',      label: 'leaf task' },
  { value: 'container', label: 'container' },
]

const boolOptions = [
  { value: 'true',  label: 'yes' },
  { value: 'false', label: 'no' },
]

export default function SettingsModal({ onClose }: Props) {
  const { settings, updateSetting } = useSettings()

  function handleAgentChange(agent: string) {
    updateSetting('default_agent', agent)
    updateSetting('default_model', defaultModelForAgent(agent))
  }

  return (
    <Modal title="settings" onClose={onClose} width={420}>

      <Section label="appearance">
        <Field label="theme">
          <Select
            value={settings.theme}
            onChange={(v) => updateSetting('theme', v as AppSettings['theme'])}
            options={themeOptions}
          />
        </Field>
      </Section>

      <Section label="defaults for new tasks">
        <Field label="default agent">
          <Select value={settings.default_agent} onChange={handleAgentChange} options={AGENT_OPTIONS} />
        </Field>
        <Field label="default model">
          {agentHasModelList(settings.default_agent) ? (
            <Select
              value={settings.default_model}
              onChange={(v) => updateSetting('default_model', v)}
              options={MODEL_OPTIONS[settings.default_agent]}
            />
          ) : (
            <Select
              value={settings.default_model}
              onChange={(v) => updateSetting('default_model', v)}
              options={[{ value: settings.default_model, label: settings.default_model }]}
            />
          )}
        </Field>
        <Field label="default task type">
          <Select
            value={settings.default_task_type}
            onChange={(v) => updateSetting('default_task_type', v as AppSettings['default_task_type'])}
            options={taskTypeOptions}
          />
        </Field>
      </Section>

      <Section label="architect">
        <Field label="system prompt">
          <Input
            value={settings.architect_system_prompt}
            onChange={(v) => updateSetting('architect_system_prompt', v)}
            placeholder="instructions given to the architect on every session start"
            multiline
            rows={8}
          />
        </Field>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: -8 }}>
          <span style={{ color: 'var(--text-faint)', fontSize: 10 }}>applied on next session start</span>
          {settings.architect_system_prompt !== ARCHITECT_DEFAULT_SYSTEM_PROMPT && (
            <button
              onClick={() => updateSetting('architect_system_prompt', ARCHITECT_DEFAULT_SYSTEM_PROMPT)}
              style={{
                background: 'none', border: 'none', color: 'var(--text-faint)', fontSize: 10,
                cursor: 'pointer', fontFamily: 'inherit', padding: 0,
                textDecoration: 'underline',
              }}
            >
              reset to default
            </button>
          )}
        </div>
      </Section>

      <Section label="executor">
        <Field label="system prompt">
          <Input
            value={settings.executor_system_prompt}
            onChange={(v) => updateSetting('executor_system_prompt', v)}
            placeholder="brief instructions for the agent executing tasks"
            multiline
            rows={3}
          />
        </Field>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: -8 }}>
          <span style={{ color: 'var(--text-faint)', fontSize: 10 }}>applied to every headless task run</span>
          {settings.executor_system_prompt !== EXECUTOR_DEFAULT_SYSTEM_PROMPT && (
            <button
              onClick={() => updateSetting('executor_system_prompt', EXECUTOR_DEFAULT_SYSTEM_PROMPT)}
              style={{ background: 'none', border: 'none', color: 'var(--text-faint)', fontSize: 10, cursor: 'pointer', fontFamily: 'inherit', padding: 0, textDecoration: 'underline' }}
            >
              reset to default
            </button>
          )}
        </div>
      </Section>

      <Section label="behaviour">
        <Field label="confirm before deleting tasks">
          <Select
            value={settings.confirm_delete}
            onChange={(v) => updateSetting('confirm_delete', v as AppSettings['confirm_delete'])}
            options={boolOptions}
          />
        </Field>
      </Section>

    </Modal>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{
        color: 'var(--text-faint)', fontSize: 10, fontWeight: 600,
        textTransform: 'uppercase', letterSpacing: '0.1em',
        borderBottom: '1px solid var(--border)', paddingBottom: 6,
      }}>
        {label}
      </div>
      {children}
    </div>
  )
}
