"use client";
import { useState } from "react";

export function JobPreparationFields({
  notes,
  minutes,
  confirmationDelay,
  allowConfirmation = true,
}: {
  notes?: string;
  minutes?: number;
  confirmationDelay?: string;
  allowConfirmation?: boolean;
}) {
  const [estimate, setEstimate] = useState(
    minutes === undefined ? "" : String(minutes),
  );
  return (
    <>
      <fieldset>
        <legend>
          Time estimate <small>Optional</small>
        </legend>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {[
            [30, "30 min"],
            [60, "1 h"],
            [120, "2 h"],
            [180, "3 h"],
            [240, "4 h"],
            [480, "All day"],
          ].map(([value, label]) => (
            <button
              type="button"
              key={value}
              aria-pressed={estimate === String(value)}
              onClick={() => setEstimate(String(value))}
            >
              {label}
            </button>
          ))}
        </div>
        <label>
          Hours
          <input
            type="number"
            min="0.017"
            max="24"
            step="any"
            value={estimate ? Number(estimate) / 60 : ""}
            onChange={(event) =>
              setEstimate(
                event.target.value
                  ? String(Math.round(Number(event.target.value) * 60))
                  : "",
              )
            }
            placeholder="Time unknown"
          />
        </label>
        <input type="hidden" name="estimatedMinutes" value={estimate} />
      </fieldset>
      <label>
        Notes for the tech
        <textarea
          name="technicianNotes"
          rows={3}
          maxLength={3000}
          defaultValue={notes}
        />
        <small>
          Tools, parts and access instructions. Visible on the job and dispatch
          stops.
        </small>
      </label>
      {allowConfirmation ? (
        <label>
          Ask the store to confirm
          <select
            name="confirmationDelay"
            defaultValue={confirmationDelay ?? ""}
          >
            <option value="">Company default</option>
            <option value="next_morning">Next morning at 8 AM</option>
            <option value="four_hours">After 4 hours</option>
          </select>
        </label>
      ) : null}
    </>
  );
}
