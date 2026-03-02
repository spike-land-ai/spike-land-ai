import { DbConnection } from "@spike-land-ai/spacetimedb-platform/src/module_bindings/index";

const isDev = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
export const STDB_URL = isDev ? "ws://localhost:3000" : "wss://api.spike.land/spacetimedb";
export const STDB_MODULE = "rightful-dirt-5033";

let stdbClient: DbConnection | null = null;
let isConnecting = false;
const connectionListeners: Array<(conn: DbConnection) => void> = [];

export function getStdbClient() {
  return stdbClient;
}

export function onStdbConnect(cb: (conn: DbConnection) => void) {
  if (stdbClient) {
    cb(stdbClient);
  } else {
    connectionListeners.push(cb);
  }
}

export function connectToSpacetimeDB() {
  if (stdbClient || isConnecting) {
    return;
  }
  isConnecting = true;
  
  const token = typeof localStorage !== "undefined" ? localStorage.getItem("stdb_token") || "" : "";
  
  let builder = DbConnection.builder()
    .withUri(STDB_URL)
    .withDatabaseName(STDB_MODULE);

  if (token) {
    builder = builder.withToken(token);
  }

  builder.onConnect((conn, identity, tok) => {
    console.log("Connected to SpacetimeDB with identity:", identity.toHexString());
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("stdb_token", tok);
    }
    stdbClient = conn;
    
    conn.subscriptionBuilder().onApplied(() => {
      console.log("Subscribed to CodeSession");
    }).subscribe("SELECT * FROM code_session");

    isConnecting = false;
    connectionListeners.forEach(cb => cb(conn));
  })
  .onConnectError((_conn, err) => {
    console.error("SpacetimeDB connection error:", err);
    isConnecting = false;
  })
  .onDisconnect(() => {
    console.log("Disconnected from SpacetimeDB");
    stdbClient = null;
  })
  .build();
}
