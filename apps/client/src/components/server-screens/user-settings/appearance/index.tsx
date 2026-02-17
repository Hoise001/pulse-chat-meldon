import { useTheme } from '@/components/theme-provider';
import { Check, Circle, Monitor, Moon, Sun } from 'lucide-react';
import { memo } from 'react';

type ThemeOption = {
  value: 'dark' | 'light' | 'onyx' | 'system';
  label: string;
  icon: React.ReactNode;
  swatch: React.ReactNode;
};

const themeOptions: ThemeOption[] = [
  {
    value: 'dark',
    label: 'Dark',
    icon: <Moon className="h-4 w-4" />,
    swatch: <div className="h-full w-full rounded bg-[#313338]" />
  },
  {
    value: 'light',
    label: 'Light',
    icon: <Sun className="h-4 w-4" />,
    swatch: (
      <div className="h-full w-full rounded border border-border bg-white" />
    )
  },
  {
    value: 'onyx',
    label: 'Onyx',
    icon: <Circle className="h-4 w-4" />,
    swatch: <div className="h-full w-full rounded bg-[#0F0F0F]" />
  },
  {
    value: 'system',
    label: 'System',
    icon: <Monitor className="h-4 w-4" />,
    swatch: (
      <div className="flex h-full w-full overflow-hidden rounded">
        <div className="w-1/2 bg-white" />
        <div className="w-1/2 bg-[#313338]" />
      </div>
    )
  }
];

const Appearance = memo(() => {
  const { theme, setTheme } = useTheme();

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Theme</h3>
        <p className="text-sm text-muted-foreground">
          Choose how the app looks for you.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {themeOptions.map((option) => (
          <button
            key={option.value}
            onClick={() => setTheme(option.value)}
            className={`relative flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-colors hover:bg-accent/50 ${
              theme === option.value
                ? 'border-primary bg-accent/30'
                : 'border-border'
            }`}
          >
            {theme === option.value && (
              <div className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary">
                <Check className="h-3 w-3 text-primary-foreground" />
              </div>
            )}
            <div className="h-16 w-full">{option.swatch}</div>
            <div className="flex items-center gap-1.5 text-sm font-medium">
              {option.icon}
              {option.label}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
});

export { Appearance };
