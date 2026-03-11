import { useRef } from 'react';
import { Palette } from 'lucide-react';

interface ColorPickerProps {
  value: string | undefined;
  onChange: (color: string | undefined) => void;
  label?: string;
  allowNone?: boolean;
}

// Predefined color palette with human-readable names
const presetColors: { hex: string; name: string }[] = [
  { hex: '#EF4444', name: 'Red' },
  { hex: '#F97316', name: 'Orange' },
  { hex: '#F59E0B', name: 'Amber' },
  { hex: '#84CC16', name: 'Lime' },
  { hex: '#22C55E', name: 'Green' },
  { hex: '#14B8A6', name: 'Teal' },
  { hex: '#06B6D4', name: 'Cyan' },
  { hex: '#3B82F6', name: 'Blue' },
  { hex: '#6366F1', name: 'Indigo' },
  { hex: '#8B5CF6', name: 'Violet' },
  { hex: '#A855F7', name: 'Purple' },
  { hex: '#D946EF', name: 'Fuchsia' },
  { hex: '#EC4899', name: 'Pink' },
  { hex: '#F43F5E', name: 'Rose' },
];

export function ColorPicker({ value, onChange, label = 'Color', allowNone = true }: ColorPickerProps) {
  const customInputRef = useRef<HTMLInputElement>(null);

  const handleCustomColorClick = () => {
    setTimeout(() => {
      customInputRef.current?.click();
    }, 50);
  };

  const handleCustomColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };

  const isCustomColor = value && !presetColors.some((c) => c.hex === value);

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{label}</label>
      <div className="flex flex-wrap gap-2 relative">
        {/* No color option */}
        {allowNone && (
          <button
            type="button"
            onClick={() => onChange(undefined)}
            className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${
              !value
                ? 'border-primary-500 ring-2 ring-primary-200'
                : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
            }`}
            aria-label="No color"
            data-testid="color-none"
          >
            <div className="w-5 h-5 rounded-full bg-gray-100 dark:bg-gray-600 flex items-center justify-center">
              <span className="text-gray-400 text-xs">×</span>
            </div>
          </button>
        )}

        {/* Preset colors */}
        {presetColors.map((color) => (
          <button
            key={color.hex}
            type="button"
            onClick={() => onChange(color.hex)}
            className={`w-8 h-8 rounded-full border-2 transition-all ${
              value === color.hex
                ? 'border-gray-800 dark:border-gray-100 ring-2 ring-gray-300 dark:ring-gray-600 scale-110'
                : 'border-transparent hover:scale-110'
            }`}
            style={{ backgroundColor: color.hex }}
            aria-label={`Select color ${color.name}`}
            data-testid={`color-${color.hex}`}
          />
        ))}

        {/* Custom color picker button */}
        <button
          type="button"
          onClick={handleCustomColorClick}
          className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${
            isCustomColor
              ? 'border-gray-800 dark:border-gray-100 ring-2 ring-gray-300 dark:ring-gray-600 scale-110'
              : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500 hover:scale-110'
          }`}
          style={isCustomColor ? { backgroundColor: value } : { backgroundColor: '#f3f4f6' }}
          aria-label={isCustomColor ? `Custom color: ${value}` : 'Custom color'}
        >
          {!isCustomColor && <Palette className="w-4 h-4 text-gray-500" aria-hidden="true" />}
        </button>

        {/* Hidden native color input for custom colors */}
        <input
          ref={customInputRef}
          type="color"
          value={value || '#6366F1'}
          onChange={handleCustomColorChange}
          className="absolute opacity-0 w-0 h-0 pointer-events-none"
          tabIndex={-1}
        />
      </div>

      {/* Show current color value */}
      {value && (
        <div className="mt-2 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <div
            className="w-4 h-4 rounded border border-gray-300 dark:border-gray-600"
            style={{ backgroundColor: value }}
          />
          <span className="font-mono text-xs">
            {presetColors.find((c) => c.hex === value)?.name ?? value}
          </span>
        </div>
      )}
    </div>
  );
}

export default ColorPicker;
