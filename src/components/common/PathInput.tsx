import { Folder, Database } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface PathInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: 'folder' | 'database';
  description?: string;
  className?: string;
}

export function PathInput({
  label,
  value,
  onChange,
  placeholder,
  type = 'folder',
  description,
  className,
}: PathInputProps) {
  const Icon = type === 'database' ? Database : Folder;

  return (
    <div className={cn('space-y-2', className)}>
      <Label className="text-sm font-medium">{label}</Label>
      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="pl-10 font-mono text-sm"
          />
        </div>
        <Button variant="secondary" size="icon" className="shrink-0">
          <Folder className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
