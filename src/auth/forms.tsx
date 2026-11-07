// SPDX-License-Identifier: GPL-3.0-or-later
import { type FormEvent, type ReactNode, useId } from 'react';

interface FieldProps {
  label: string;
  name: string;
  type: 'email' | 'password' | 'text';
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
}

/** Labelled input; the rules of each field are checked by the server only. */
export function Field({ label, name, type, value, onChange, autoComplete }: FieldProps) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        name={name}
        type={type}
        value={value}
        required
        autoComplete={autoComplete}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

interface FormProps {
  onSubmit: () => void;
  busy: boolean;
  error: string | null;
  submitLabel: string;
  children: ReactNode;
}

export function Form({ onSubmit, busy, error, submitLabel, children }: FormProps) {
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit();
  };
  return (
    <form className="form" onSubmit={submit}>
      {children}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <button type="submit" disabled={busy}>
        {submitLabel}
      </button>
    </form>
  );
}
