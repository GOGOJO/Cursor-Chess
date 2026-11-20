import { ArrowLeft } from 'lucide-react';
import { BOARD_THEMES, type BoardThemeId, type PieceStyleId, type Settings } from '../../shared/settings';

interface SettingsPanelProps {
  settings: Settings;
  hookInstalled: boolean;
  onChange: (patch: Partial<Settings>) => void;
  onInstallHook: () => void;
  onBack: () => void;
}

function Switch({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <button type="button" className="setting-row" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}>
      <span className="flex min-w-0 flex-col items-start gap-0.5">
        <span className="text-[12px] text-ink">{label}</span>
        <span className="text-left text-[10px] leading-snug text-ink-faint">{hint}</span>
      </span>
      <span className={`setting-switch ${checked ? 'setting-switch-on' : ''}`} aria-hidden />
    </button>
  );
}

export function SettingsPanel({ settings, hookInstalled, onChange, onInstallHook, onBack }: SettingsPanelProps) {
  return (
    <section className="flex flex-col gap-4" aria-label="Settings">
      <div className="flex items-center justify-between">
        <h2 className="text-[13px] font-semibold text-ink">Settings</h2>
        <div className="text-[11px]">
          <button type="button" className="link-btn flex items-center gap-1" onClick={onBack}>
            <ArrowLeft size={12} />
            Back to puzzle
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <h3 className="section-title">Board</h3>
        <div className="grid grid-cols-4 gap-1.5" role="radiogroup" aria-label="Board colors">
          {(Object.entries(BOARD_THEMES) as [BoardThemeId, (typeof BOARD_THEMES)[BoardThemeId]][]).map(([id, theme]) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={settings.boardTheme === id}
              className={`theme-swatch ${settings.boardTheme === id ? 'theme-swatch-on' : ''}`}
              onClick={() => onChange({ boardTheme: id })}
            >
              <span className="theme-swatch-board" aria-hidden>
                <span style={{ background: theme.light }} />
                <span style={{ background: theme.dark }} />
              </span>
              <span>{theme.name}</span>
            </button>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-2 gap-1.5" role="radiogroup" aria-label="Piece style">
          {(
            [
              ['standard', 'Standard'],
              ['letters', 'Letters'],
            ] as [PieceStyleId, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={settings.pieceStyle === id}
              className={`choice-btn ${settings.pieceStyle === id ? 'choice-btn-on' : ''}`}
              onClick={() => onChange({ pieceStyle: id })}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <h3 className="section-title">Play</h3>
        <Switch label="Sound" hint="Short tones for moves, checks, and solves." checked={settings.sound} onChange={(sound) => onChange({ sound })} />
        <Switch
          label="Animate moves"
          hint="Slide pieces between squares. Off when your system asks for less motion."
          checked={settings.animate}
          onChange={(animate) => onChange({ animate })}
        />
        <Switch
          label="Coordinates"
          hint="File and rank labels along the board."
          checked={settings.coordinates}
          onChange={(coordinates) => onChange({ coordinates })}
        />
        <Switch
          label="Next puzzle automatically"
          hint="Loads another a moment after you solve. A reveal still waits."
          checked={settings.autoNext}
          onChange={(autoNext) => onChange({ autoNext })}
        />
        <Switch
          label="Agent finished"
          hint="A quiet notice when an agent finishes. It waits while a puzzle is on screen."
          checked={settings.notifyOnAgent}
          onChange={(notifyOnAgent) => onChange({ notifyOnAgent })}
        />
        {!hookInstalled && (
          <button type="button" className="link-btn self-start text-[11px]" onClick={onInstallHook}>
            Set up the agent hook
          </button>
        )}
      </div>
    </section>
  );
}
