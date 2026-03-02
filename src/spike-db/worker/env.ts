/** Worker environment bindings for spike-db. */
export interface Env {
  SPIKE_DATABASE: DurableObjectNamespace;
  IDENTITY_SECRET: string;
}

export const ENV_VARS = ["SPIKE_DATABASE", "IDENTITY_SECRET"];
