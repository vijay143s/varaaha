import { useEffect, useState } from "react";
import { CheckCircleIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";

interface Toast {
  id: number;
  type: "success" | "error";
  message: string;
}

let nextToastId = 1;
let listeners: Array<(toasts: Toast[]) => void> = [];
let queue: Toast[] = [];

function emit(): void {
  listeners.forEach((listener) => listener(queue));
}

export function pushToast(toast: Omit<Toast, "id">): void {
  queue = [...queue, { ...toast, id: nextToastId++ }];
  emit();
  setTimeout(() => {
    queue = queue.slice(1);
    emit();
  }, 3500);
}

export function ToastRack(): JSX.Element {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const listener = (newToasts: Toast[]) => setToasts(newToasts);
    listeners.push(listener);
    return () => {
      listeners = listeners.filter((item) => item !== listener);
    };
  }, []);

  return (
    <div className="pointer-events-none fixed bottom-6 right-6 flex flex-col gap-3">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="pointer-events-auto flex items-center gap-3 rounded-xl border border-white/5 bg-slate-900/95 px-4 py-3 shadow-frost"
        >
          {toast.type === "success" ? (
            <CheckCircleIcon className="h-5 w-5 text-emerald-400" />
          ) : (
            <ExclamationTriangleIcon className="h-5 w-5 text-rose-400" />
          )}
          <span className="text-sm text-white/90">{toast.message}</span>
        </div>
      ))}
    </div>
  );
}
