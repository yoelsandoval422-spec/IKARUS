/** De dónde provienen los datos que se muestran. */
export type DataSource = "demo" | "database";

export type DataError = "forbidden" | "unavailable";

export type DataResult<T> =
  | { ok: true; source: DataSource; data: T }
  | { ok: false; source: DataSource; error: DataError; message: string };

export const ok = <T>(source: DataSource, data: T): DataResult<T> => ({ ok: true, source, data });
export const fail = (source: DataSource, error: DataError, message: string): DataResult<never> => ({
  ok: false,
  source,
  error,
  message,
});
