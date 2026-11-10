"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import type { ZodType } from "zod";
import { StatusBadge } from "@/components/StatusBadge";
import { statusFromProgress } from "@/lib/status";
import {
  collectErrors,
  hydrationSchema,
  nutritionSchema,
  trainingSchema,
  wellbeingSchema,
  type FormErrors,
} from "@/lib/validation";
import type { RecordSection } from "@/types";

const SECTIONS: { id: RecordSection; label: string }[] = [
  { id: "wellbeing", label: "Bienestar" },
  { id: "nutrition", label: "Alimentación" },
  { id: "hydration", label: "Hidratación" },
  { id: "training", label: "Entrenamiento" },
];

const input = "mt-1 w-full rounded-md border border-slate-500 bg-white px-3 py-3 text-base";

function Field({ id, label, error, children }: { id: string; label: string; error?: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="block text-base font-medium">{label}</label>
      {children}
      {error ? <p id={`${id}-err`} className="mt-1 text-sm font-medium text-red-800">⚠ {error}</p> : null}
    </div>
  );
}

function DemoForm({
  schema, onDone, children, setErrors, submitLabel,
}: {
  schema: ZodType;
  onDone: () => void;
  children: ReactNode;
  setErrors: (e: FormErrors) => void;
  submitLabel: string;
}) {
  const [sent, setSent] = useState(false);
  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const raw = Object.fromEntries(new FormData(e.currentTarget).entries());
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      setErrors(collectErrors(parsed.error));
      setSent(false);
      return;
    }
    setErrors({});
    setSent(true);
    onDone();
  }
  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {children}
      <button type="submit" className="min-h-12 w-full rounded-lg bg-brand-700 px-4 py-3 text-base font-semibold text-white hover:bg-brand-900">
        {submitLabel}
      </button>
      {sent ? (
        <p role="status" className="rounded-md border border-emerald-700 bg-emerald-50 p-3 text-sm text-emerald-950">
          ✓ Formulario demostrativo validado. No se guardó ningún dato real.
        </p>
      ) : null}
    </form>
  );
}

export function DemoRecordForms() {
  const [active, setActive] = useState<RecordSection>("wellbeing");
  const [done, setDone] = useState<Set<RecordSection>>(new Set());
  const [errors, setErrors] = useState<Record<RecordSection, FormErrors>>({
    wellbeing: {}, nutrition: {}, hydration: {}, training: {},
  });
  const mark = (s: RecordSection) => setDone((d) => new Set(d).add(s));
  const setErr = (s: RecordSection) => (e: FormErrors) => setErrors((all) => ({ ...all, [s]: e }));
  const status = statusFromProgress(done.size, SECTIONS.length);

  return (
    <section aria-labelledby="registro-hoy">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 id="registro-hoy" className="text-xl font-bold">Registro de hoy</h2>
        <StatusBadge status={status} />
      </div>
      <p className="mb-3 text-sm text-slate-700">{done.size} de {SECTIONS.length} secciones completadas (demostración).</p>

      <div role="group" aria-label="Secciones del registro" className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            aria-pressed={active === s.id}
            onClick={() => setActive(s.id)}
            className={`min-h-14 rounded-lg border-2 px-3 py-3 text-base font-semibold ${
              active === s.id ? "border-brand-700 bg-brand-700 text-white" : "border-slate-400 bg-white hover:bg-brand-50"
            }`}
          >
            {done.has(s.id) ? "✓ " : ""}{s.label}
          </button>
        ))}
      </div>

      <div className="rounded-lg border border-slate-300 bg-white p-4">
        {active === "wellbeing" && (
          <DemoForm schema={wellbeingSchema} onDone={() => mark("wellbeing")} setErrors={setErr("wellbeing")} submitLabel="Probar envío (demo)">
            <Field id="sleepHours" label="Horas de sueño" error={errors.wellbeing.sleepHours}>
              <input id="sleepHours" name="sleepHours" inputMode="decimal" className={input} aria-describedby="sleepHours-err" />
            </Field>
            <Field id="energy" label="Energía del día (1 baja – 5 alta)" error={errors.wellbeing.energy}>
              <input id="energy" name="energy" inputMode="numeric" className={input} aria-describedby="energy-err" />
            </Field>
          </DemoForm>
        )}
        {active === "nutrition" && (
          <DemoForm schema={nutritionSchema} onDone={() => mark("nutrition")} setErrors={setErr("nutrition")} submitLabel="Probar envío (demo)">
            <Field id="meal" label="Comida" error={errors.nutrition.meal}>
              <select id="meal" name="meal" className={input} defaultValue="" aria-describedby="meal-err">
                <option value="">Elegir…</option>
                <option>Desayuno</option><option>Almuerzo</option><option>Merienda</option><option>Cena</option><option>Colación</option>
              </select>
            </Field>
            <Field id="description" label="¿Qué comiste?" error={errors.nutrition.description}>
              <textarea id="description" name="description" rows={3} className={input} aria-describedby="description-err" />
            </Field>
          </DemoForm>
        )}
        {active === "hydration" && (
          <DemoForm schema={hydrationSchema} onDone={() => mark("hydration")} setErrors={setErr("hydration")} submitLabel="Probar envío (demo)">
            <Field id="ml" label="Líquido tomado hoy (ml)" error={errors.hydration.ml}>
              <input id="ml" name="ml" inputMode="numeric" className={input} aria-describedby="ml-err" />
            </Field>
          </DemoForm>
        )}
        {active === "training" && (
          <DemoForm schema={trainingSchema} onDone={() => mark("training")} setErrors={setErr("training")} submitLabel="Probar envío (demo)">
            <Field id="minutes" label="Duración (minutos)" error={errors.training.minutes}>
              <input id="minutes" name="minutes" inputMode="numeric" className={input} aria-describedby="minutes-err" />
            </Field>
            <Field id="effort" label="Esfuerzo percibido (1–10)" error={errors.training.effort}>
              <input id="effort" name="effort" inputMode="numeric" className={input} aria-describedby="effort-err" />
            </Field>
          </DemoForm>
        )}
      </div>
    </section>
  );
}
