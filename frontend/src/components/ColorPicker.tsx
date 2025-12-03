import { useState, useRef } from 'react';
import { Palette } from 'lucide-react';

interface ColorPickerProps {
  value: string | undefined;
  onChange: (color: string | undefined) => void;
  label?: string;
  allowNone?: boolean;
}

// Predefined color palette
const presetColors = [
  // Reds & Oranges
  '#EF4444', '#F97316', '#F59E0B',
  // Greens
  '#84CC16', '#22C55E', '#14B8A6',
  // Blues
  '#06B6D4', '#3B82F6', '#6366F1',
  // Purples & Pinks
  '#8B5CF6', '#A855F7', '#D946EF', '#EC4899', '#F43F5E',
];

export function ColorPicker({ value, onChange, label = 'Color', allowNone = true }: ColorPickerProps) {
  const [showCustom, setShowCustom] = useState(false);
  const customInputRef = useRef<HTMLInputElement>(null);

  const handleCustomColorClick = () => {
    setShowCustom(true);
    // Small delay to ensure the input is rendered
    setTimeout(() => {
      customInputRef.current?.click();
    }, 50);
  };

  const handleCustomColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };

  const isCustomColor = value && !presetColors.includes(value);

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
      <div className="flex flex-wrap gap-2">
        {/* No color option */}
        {allowNone && (
          <button
            type="button"
            onClick={() => onChange(undefined)}
            className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${
              !value
                ? 'border-primary-500 ring-2 ring-primary-200'
                : 'border-gray-300 hover:border-gray-400'
            }`}
            title="No color"
          >
            <div className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center">
              <span className="text-gray-400 text-xs">×</span>
            </div>
          </button>
        )}

        {/* Preset colors */}
        {presetColors.map((color) => (
          <button
            key={color}
            type="button"
            onClick={() => onChange(color)}
            className={`w-8 h-8 rounded-full border-2 transition-all ${
              value === color
                ? 'border-gray-800 ring-2 ring-gray-300 scale-110'
                : 'border-transparent hover:scale-110'
            }`}
            style={{ backgroundColor: color }}
            title={color}
          />
        ))}

        {/* Custom color picker button */}
        <button
          type="button"
          onClick={handleCustomColorClick}
          className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${
            isCustomColor
              ? 'border-gray-800 ring-2 ring-gray-300 scale-110'
              : 'border-gray-300 hover:border-gray-400 hover:scale-110'
          }`}
          style={isCustomColor ? { backgroundColor: value } : { backgroundColor: '#f3f4f6' }}
          title="Custom color"
        >
          {!isCustomColor && <Palette className="w-4 h-4 text-gray-500" />}
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
        <div className="mt-2 flex items-center gap-2 text-sm text-gray-500">
          <div
            className="w-4 h-4 rounded border border-gray-300"
            style={{ backgroundColor: value }}
          />
          <span className="font-mono text-xs">{value}</span>
        </div>
      )}
    </div>
  );
}

export default ColorPicker;
