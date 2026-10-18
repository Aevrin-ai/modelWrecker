

export interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  id?: string;
  disabled?: boolean;
}

export function Checkbox({ checked, onChange, id, disabled }: CheckboxProps) {
  return (
    <input
      id={id}
      type="checkbox"
      checked={checked}
      disabled={disabled}
      onChange={(e) => onChange(e.target.checked)}
      className="size-4 shrink-0 cursor-pointer rounded-sm border border-primary accent-zinc-900 disabled:cursor-not-allowed disabled:opacity-50 dark:accent-zinc-100"
    />
  );
}
