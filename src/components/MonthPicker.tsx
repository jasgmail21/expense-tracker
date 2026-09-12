import React, { useState } from "react";
import { Icon } from "./Icons";
import { Button } from "./ui";
import { monthLabel, shiftMonth, currentMonthKey } from "../utils";

export function MonthPicker({
  currentKey,
  onSelect,
  onClose,
}: {
  currentKey: string;
  onSelect: (key: string) => void;
  onClose: () => void;
}) {
  const [viewYear, setViewYear] = useState(() => {
    const [y] = currentKey.split("-").map(Number);
    return y;
  });

  const months = Array.from({ length: 12 }, (_, i) => {
    const key = `${viewYear}-${String(i + 1).padStart(2, "0")}`;
    return {
      key,
      label: new Date(viewYear, i, 1).toLocaleDateString(undefined, { month: "short" }),
      fullLabel: new Date(viewYear, i, 1).toLocaleDateString(undefined, { month: "long" }),
    };
  });

  const handleSelect = (key: string) => {
    onSelect(key);
    onClose();
  };

  return (
    <div className="anim-fade fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-pine/60 p-4 sm:p-6" onClick={onClose}>
      <div
        className="anim-pop my-8 flex max-h-[calc(100vh-4rem)] w-full max-w-md flex-col rounded-xl border-2 border-pine bg-card shadow-[8px_8px_0_0_rgba(13,33,26,0.35)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <h2 className="font-display text-lg font-bold text-ink">Jump to month</h2>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-md text-ink-faint hover:bg-line-soft hover:text-ink cursor-pointer" aria-label="Close">
            <Icon name="x" size={17} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
        {/* Year navigation */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => setViewYear(viewYear - 1)}
            className="w-10 h-10 rounded-lg border border-line bg-card text-ink-soft hover:border-ink-faint hover:text-ink transition-all cursor-pointer flex items-center justify-center"
          >
            <Icon name="chevronLeft" size={20} />
          </button>
          <div className="text-2xl font-bold text-ink font-display">{viewYear}</div>
          <button
            onClick={() => setViewYear(viewYear + 1)}
            className="w-10 h-10 rounded-lg border border-line bg-card text-ink-soft hover:border-ink-faint hover:text-ink transition-all cursor-pointer flex items-center justify-center"
          >
            <Icon name="chevronRight" size={20} />
          </button>
        </div>

        {/* Month grid */}
        <div className="grid grid-cols-3 gap-2">
          {months.map((m) => {
            const isCurrent = m.key === currentMonthKey();
            const isSelected = m.key === currentKey;
            return (
              <button
                key={m.key}
                onClick={() => handleSelect(m.key)}
                className={`px-4 py-3 rounded-lg border-2 text-sm font-semibold transition-all cursor-pointer ${
                  isSelected
                    ? "border-moss bg-mint-dim text-moss-deep"
                    : isCurrent
                    ? "border-line bg-paper text-ink hover:border-moss"
                    : "border-line bg-card text-ink-soft hover:border-ink-faint hover:text-ink"
                }`}
              >
                {m.label}
              </button>
            );
          })}
        </div>

        {/* Quick actions */}
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={() => handleSelect(currentMonthKey())}
            className="flex-1"
          >
            <Icon name="home" size={16} />
            This month
          </Button>
          <Button variant="ghost" onClick={onClose} className="flex-1">
            Cancel
          </Button>
        </div>
        </div>
      </div>
    </div>
  );
}
