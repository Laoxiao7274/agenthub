import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
}

export default function Select({ value, onChange, options, placeholder, className }: SelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={ref} className={`select-wrapper ${className || ""}`}>
      <button
        className={`select-trigger ${open ? "open" : ""}`}
        onClick={() => setOpen(!open)}
        type="button"
      >
        <span className={`select-value ${!selected ? "placeholder" : ""}`}>
          {selected?.label || placeholder || ""}
        </span>
        <ChevronDown size={14} className={`select-arrow ${open ? "rotated" : ""}`} />
      </button>

      <div className={`select-dropdown ${open ? "visible" : ""}`}>
        <div className="select-dropdown-inner">
          {options.map((opt) => (
            <button
              key={opt.value}
              className={`select-option ${opt.value === value ? "selected" : ""}`}
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              type="button"
            >
              {opt.value === value && <span className="select-check" />}
              <span className="select-option-label">{opt.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
