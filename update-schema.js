const fs = require('fs');
let code = fs.readFileSync('packages/spacetimedb-platform/module/src/lib.ts', 'utf8');

const tableCode = `
const CodeSession = table(
  { name: "code_session", public: true },
  {
    codeSpace: t.string().primaryKey(),
    code: t.string(),
    html: t.string(),
    css: t.string(),
    transpiled: t.string(),
    messagesJson: t.string(),
    lastUpdatedBy: t.identity(),
    updatedAt: t.u64(),
  },
);
`;

const reducerCode = `
// ─── Code Session Reducers ───

export const update_code_session = spacetimedb.reducer(
  {
    codeSpace: t.string(),
    code: t.string(),
    html: t.string(),
    css: t.string(),
    transpiled: t.string(),
    messagesJson: t.string(),
  },
  (ctx, { codeSpace, code, html, css, transpiled, messagesJson }) => {
    if (!codeSpace) {
      throw new SenderError("CodeSpace is required");
    }
    const now = BigInt(ctx.timestamp.microsSinceUnixEpoch);
    const existing = ctx.db.code_session.codeSpace.find(codeSpace);
    
    if (existing) {
      ctx.db.code_session.codeSpace.update({
        ...existing,
        code,
        html,
        css,
        transpiled,
        messagesJson,
        lastUpdatedBy: ctx.sender,
        updatedAt: now,
      });
    } else {
      ctx.db.code_session.insert({
        codeSpace,
        code,
        html,
        css,
        transpiled,
        messagesJson,
        lastUpdatedBy: ctx.sender,
        updatedAt: now,
      });
    }
  },
);
`;

if (!code.includes('code_session: CodeSession')) {
  code = code.replace('// ─── Tables: Messaging ───', tableCode + '\n// ─── Tables: Messaging ───');
  code = code.replace('  direct_message: DirectMessage,', '  code_session: CodeSession,\n  direct_message: DirectMessage,');
  code = code + '\n' + reducerCode;
  fs.writeFileSync('packages/spacetimedb-platform/module/src/lib.ts', code);
  console.log("Updated schema");
} else {
  console.log("Schema already updated");
}
