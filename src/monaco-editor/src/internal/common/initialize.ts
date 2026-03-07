import * as worker from 'monaco-editor-core/esm/vs/editor/editor.worker.start';

let initialized = false;

export function isWorkerInitialized(): boolean {
	return initialized;
}

// ctx and createData are typed by each specific worker at call sites. `any` is intentional here:
// this is a low-level adapter; the concrete types cannot be known generically because m.data is
// untyped from MessageEvent and worker.start's ctx type varies by monaco-editor-core version.
export function initialize(callback: (ctx: any, createData: any) => any): void {
	initialized = true;
	self.onmessage = (m) => {
		worker.start((ctx) => {
			return callback(ctx, m.data);
		});
	};
}
