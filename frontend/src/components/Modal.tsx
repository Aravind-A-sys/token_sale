import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Check, Copy, X } from "lucide-react";

export function Modal({
  title,
  subtitle,
  children,
  onClose,
  locked = false,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  onClose: () => void;
  locked?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    dialog?.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      dialog?.close();
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);

  return (
    <dialog
      ref={ref}
      className="modal"
      aria-labelledby={id}
      onCancel={(event) => {
        event.preventDefault();
        if (!locked) onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && !locked) onClose();
      }}
    >
      <div className="modal-content">
        <button
          className="icon-button modal-close"
          aria-label="Close dialog"
          onClick={onClose}
          disabled={locked}
        >
          <X size={19} />
        </button>
        <h2 id={id}>{title}</h2>
        {subtitle && <p className="modal-subtitle">{subtitle}</p>}
        {children}
      </div>
    </dialog>
  );
}

export function CopyButton({
  value,
  label = "Copy address",
  showText = false,
}: {
  value: string;
  label?: string;
  showText?: boolean;
}) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  useEffect(() => {
    if (state === "idle") return;
    const timer = setTimeout(() => setState("idle"), 2500);
    return () => clearTimeout(timer);
  }, [state]);
  return (
    <span className="copy-control">
      <button
        type="button"
        className={showText ? "text-button copy-button" : "icon-button copy-button"}
        aria-label={state === "copied" ? "Copied" : label}
        title={
          state === "failed" ? "Copy unavailable. Select and copy the address manually." : label
        }
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setState("copied");
          } catch {
            setState("failed");
          }
        }}
      >
        {state === "copied" ? <Check size={15} /> : <Copy size={15} />}
        {showText &&
          (state === "copied" ? "Copied" : state === "failed" ? "Select text to copy" : "Copy")}
      </button>
      <span className="sr-only" role="status">
        {state === "copied"
          ? "Copied to clipboard"
          : state === "failed"
            ? "Copy unavailable. Select and copy the text manually."
            : ""}
      </span>
    </span>
  );
}
