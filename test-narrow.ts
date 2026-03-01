export interface ResultOk<T> {
  ok: true;
  data: T;
}

export interface ResultErr<T> {
  ok: false;
  error: Error;
}

export type Result<T> = ResultOk<T> | ResultErr<T>;

declare function tryCatch<T>(p: Promise<T>): Promise<Result<T>>;

async function test() {
  const r = await tryCatch(Promise.resolve(1));
  if (!r.ok) {
    console.log(r.error.message);
  }
}
