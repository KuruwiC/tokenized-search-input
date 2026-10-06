type Preset = { label: string; query: string };

/** A row of example queries; choosing one loads it into the editor. */
export function Presets({
  legend,
  presets,
  onSelect,
}: {
  legend: string;
  presets: readonly Preset[];
  onSelect: (query: string) => void;
}) {
  return (
    <fieldset className="presets">
      <legend className="presets__legend">{legend}</legend>
      <div className="presets__list">
        {presets.map((preset) => (
          <button
            type="button"
            className="preset"
            key={preset.label}
            onClick={() => onSelect(preset.query)}
          >
            <span className="preset__label">{preset.label}</span>
            <code className="preset__query">{preset.query}</code>
          </button>
        ))}
      </div>
    </fieldset>
  );
}
