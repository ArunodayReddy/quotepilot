import { useEffect, useId, useRef, useState } from "react";

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  required?: boolean;
  error?: string;
  hint?: string;
  placeholder?: string;
  disabled?: boolean;
}

/**
 * Apple-grade custom dropdown: button trigger + listbox popup.
 *
 * Accessibility contract (WAI-ARIA collapsible listbox pattern):
 * - trigger: aria-haspopup="listbox", aria-expanded, aria-activedescendant
 * - popup: role="listbox"; options: role="option" + aria-selected
 * - keyboard: ArrowUp/Down moves, Home/End jumps, Enter/Space selects,
 *   Escape closes (focus returns to trigger), Tab closes naturally,
 *   printable characters type-ahead to the next matching option.
 * - click/tap outside closes; checkmark marks the selected option.
 * - open/close animation disabled under prefers-reduced-motion.
 */
export function Select({
  id,
  label,
  value,
  onChange,
  options,
  required,
  error,
  hint,
  placeholder = "Select…",
  disabled,
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(() =>
    Math.max(0, options.findIndex((o) => o.value === value)),
  );
  const [typeahead, setTypeahead] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const typeaheadTimer = useRef<number | null>(null);
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const listboxId = `${id}-listbox-${uid}`;
  const labelId = `${id}-label-${uid}`;
  const optionId = (i: number) => `${id}-option-${uid}-${i}`;

  const selectedIndex = options.findIndex((o) => o.value === value);
  const selected = selectedIndex >= 0 ? options[selectedIndex] : null;

  const close = (refocus: boolean) => {
    setOpen(false);
    setTypeahead("");
    if (refocus) triggerRef.current?.focus();
  };

  const openMenu = () => {
    if (disabled) return;
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
    setOpen(true);
  };

  const choose = (index: number) => {
    const opt = options[index];
    if (!opt) return;
    if (opt.value !== value) onChange(opt.value);
    close(true);
  };

  // Click/tap outside closes the popup.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setTypeahead("");
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open ]);

  // Clear the type-ahead buffer after a pause.
  useEffect(
    () => () => {
      if (typeaheadTimer.current) window.clearTimeout(typeaheadTimer.current);
    },
    [],
  );

  const jumpToMatch = (buffer: string, fromIndex: number) => {
    const q = buffer.toLowerCase();
    for (let step = 1; step <= options.length; step++) {
      const i = (fromIndex + step) % options.length;
      if (options[i].label.toLowerCase().startsWith(q)) {
        setActiveIndex(i);
        document.getElementById(optionId(i))?.scrollIntoView({ block: "nearest" });
        return;
      }
    }
  };

  const onTriggerKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        openMenu();
      } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
        openMenu();
        const buf = e.key.toLowerCase();
        setTypeahead(buf);
        if (typeaheadTimer.current) window.clearTimeout(typeaheadTimer.current);
        typeaheadTimer.current = window.setTimeout(() => setTypeahead(""), 600);
        jumpToMatch(buf, -1);
      }
      return;
    }
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActiveIndex((i) => {
          const next = Math.min(i + 1, options.length - 1);
          document.getElementById(optionId(next))?.scrollIntoView({ block: "nearest" });
          return next;
        });
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIndex((i) => {
          const next = Math.max(i - 1, 0);
          document.getElementById(optionId(next))?.scrollIntoView({ block: "nearest" });
          return next;
        });
        break;
      case "Home":
        e.preventDefault();
        setActiveIndex(0);
        break;
      case "End":
        e.preventDefault();
        setActiveIndex(options.length - 1);
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        choose(activeIndex);
        break;
      case "Escape":
        e.preventDefault();
        close(true);
        break;
      case "Tab":
        setOpen(false);
        setTypeahead("");
        break;
      default:
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
          const buf = (typeahead + e.key).toLowerCase();
          setTypeahead(buf);
          if (typeaheadTimer.current) window.clearTimeout(typeaheadTimer.current);
          typeaheadTimer.current = window.setTimeout(() => setTypeahead(""), 600);
          jumpToMatch(buf, activeIndex);
        }
    }
  };

  return (
    <div className="field">
      <label id={labelId} htmlFor={id}>
        {label} {required && <span aria-hidden="true"> *</span>}
        {required && <span className="sr-only">(required)</span>}
      </label>
      <div className="qp-select" ref={containerRef}>
        <button
          ref={triggerRef}
          type="button"
          id={id}
          className={`qp-select-trigger${error ? " qp-select-error" : ""}`}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-labelledby={`${labelId} ${id}-value`}
          aria-activedescendant={open ? optionId(activeIndex) : undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
          disabled={disabled}
          onClick={() => (open ? close(false) : openMenu())}
          onKeyDown={onTriggerKeyDown}
        >
          <span id={`${id}-value`} className={selected ? "" : "qp-select-placeholder"}>
            {selected ? selected.label : placeholder}
          </span>
          <svg
            className={`qp-select-chevron${open ? " qp-select-chevron-open" : ""}`}
            width="16"
            height="16"
            viewBox="0 0 16 16"
            aria-hidden="true"
          >
            <path
              d="M4 6l4 4 4-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        {open && (
          <div className="qp-select-popup" role="presentation">
            <ul
              role="listbox"
              id={listboxId}
              aria-labelledby={labelId}
              tabIndex={-1}
              className="qp-select-list"
            >
              {options.map((o, i) => {
                const isSelected = o.value === value;
                const isActive = i === activeIndex;
                return (
                  <li
                    key={o.value}
                    id={optionId(i)}
                    role="option"
                    aria-selected={isSelected}
                    data-active={isActive}
                    className="qp-select-option"
                    onMouseEnter={() => setActiveIndex(i)}
                    onClick={() => choose(i)}
                  >
                    <span className="qp-select-option-label">{o.label}</span>
                    {isSelected && (
                      <svg
                        className="qp-check"
                        width="16"
                        height="16"
                        viewBox="0 0 16 16"
                        aria-hidden="true"
                      >
                        <path
                          d="M3 8.5l3.5 3.5L13 4.5"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
      {hint && !error && (
        <div className="field-hint" id={`${id}-hint`}>
          {hint}
        </div>
      )}
      {error && (
        <div className="field-error" id={`${id}-error`} role="alert">
          {error}
        </div>
      )}
    </div>
  );
}
