import { ChevronDown } from 'lucide-react';
import type { ReactNode } from 'react';
import { DIFFICULTY_BANDS } from '../../shared/difficulty';
import { FILTER_THEMES, themeLabel } from '../../shared/themes';
import type { PuzzleFilters as Filters } from '../../shared/types';

const BAND_RANGES: Record<string, string> = {
  Beginner: '< 800',
  Easy: '800–1200',
  Intermediate: '1200–1600',
  Advanced: '1600–2000',
  Expert: '2000+',
};

interface PuzzleFiltersProps {
  filters: Filters;
  onChange: (filters: Filters) => void;
}

function FilterSelect({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: ReactNode }) {
  return (
    <label className="filter-select">
      <span className="sr-only">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {children}
      </select>
      <ChevronDown size={12} className="pointer-events-none text-ink-faint" aria-hidden />
    </label>
  );
}

export function PuzzleFilters({ filters, onChange }: PuzzleFiltersProps) {
  return (
    <div className="grid grid-cols-2 gap-1.5">
      <FilterSelect
        label="Difficulty"
        value={filters.difficulty}
        onChange={(difficulty) => onChange({ ...filters, difficulty: difficulty as Filters['difficulty'] })}
      >
        <option value="any">Any level</option>
        {DIFFICULTY_BANDS.map((band) => (
          <option key={band} value={band} title={`Rated ${BAND_RANGES[band]}`}>
            {band}
          </option>
        ))}
      </FilterSelect>
      <FilterSelect label="Theme" value={filters.theme} onChange={(theme) => onChange({ ...filters, theme })}>
        <option value="any">Any tactic</option>
        {FILTER_THEMES.map((theme) => (
          <option key={theme} value={theme}>
            {themeLabel(theme)}
          </option>
        ))}
      </FilterSelect>
    </div>
  );
}
