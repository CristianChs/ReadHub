"use client";

import * as React from "react";
import { FileText, UploadCloud, X } from "lucide-react";

import { cn } from "@/lib/utils";

interface FileInputProps {
  id?: string;
  accept?: string;
  /** Nombre del archivo seleccionado (controlado por el consumidor). */
  fileName?: string | null;
  onSelect?: (file: File | null) => void;
  onClear?: () => void;
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
  className?: string;
}

// Selector de archivo estilizado. Presentacional: expone el archivo elegido
// mediante `onSelect`; el estado y la validación los gestiona el consumidor.
export function FileInput({
  id,
  accept,
  fileName,
  onSelect,
  onClear,
  placeholder = "Seleccionar archivo",
  disabled,
  invalid,
  className,
}: FileInputProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    onSelect?.(event.target.files?.[0] ?? null);
  }

  function handleClear() {
    if (inputRef.current) inputRef.current.value = "";
    onClear?.();
    onSelect?.(null);
  }

  return (
    <div className={cn("w-full", className)}>
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept={accept}
        onChange={handleChange}
        disabled={disabled}
        className="sr-only"
      />

      {fileName ? (
        <div
          className={cn(
            "flex items-center gap-3 rounded-md border border-input bg-background px-3 py-2.5 text-sm shadow-xs",
            invalid && "border-destructive",
          )}
        >
          <FileText className="size-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate">{fileName}</span>
          <button
            type="button"
            onClick={handleClear}
            disabled={disabled}
            className="rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Quitar archivo"
          >
            <X className="size-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled}
          className={cn(
            "flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-input bg-background px-3 py-6 text-sm text-muted-foreground shadow-xs transition-colors",
            "hover:border-ring hover:bg-accent hover:text-accent-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            "disabled:cursor-not-allowed disabled:opacity-50",
            invalid && "border-destructive",
          )}
        >
          <UploadCloud className="size-5" />
          {placeholder}
        </button>
      )}
    </div>
  );
}
