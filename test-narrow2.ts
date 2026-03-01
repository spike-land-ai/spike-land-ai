export interface ResultOk<T> {
  ok: true;
  data: T;
  unwrap(): T;
  map<U>(fn: (val: T) => U): Result<U>;
  flatMap<U>(fn: (val: T) => Result<U>): Result<U>;
}

export interface ResultErr<T> {
  ok: false;
  error: Error;
  unwrap(): never;
  map<U>(fn: (val: T) => U): Result<U>;
  flatMap<U>(fn: (val: T) => Result<U>): Result<U>;
}

export type Result<T> = ResultOk<T> | ResultErr<T>;

declare function tryCatch<T>(p: Promise<T>): Promise<Result<T>>;

async function test() {
  const r = await tryCatch(Promise.resolve(1));
  if (!r.ok) {
    console.log(r.error.message);
  }
}
