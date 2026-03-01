import { Project, SyntaxKind, CallExpression } from "ts-morph";

const project = new Project();
project.addSourceFilesAtPaths("../../packages/mcp-image-studio/src/tools/*.ts");

const files = project.getSourceFiles().filter(f => !f.getFilePath().endsWith(".test.ts") && !f.getFilePath().endsWith("try-catch.ts"));

for (const sourceFile of files) {
  let changed = false;

  const defineToolImport = sourceFile.getImportDeclaration(decl => {
    return decl.getModuleSpecifierValue() === "../define-tool.js" || decl.getModuleSpecifierValue() === "../define-tool";
  });

  const varDecls = sourceFile.getVariableDeclarations();
  for (const varDecl of varDecls) {
    const initializer = varDecl.getInitializer();
    if (!initializer) continue;

    if (initializer.getKind() === SyntaxKind.CallExpression) {
      let callExpr = initializer as CallExpression;
      let isDefineTool = false;
      
      const chain: CallExpression[] = [];
      let current = callExpr;
      while (current.getKind() === SyntaxKind.CallExpression) {
        chain.push(current);
        const expr = current.getExpression();
        if (expr.getKind() === SyntaxKind.PropertyAccessExpression) {
          current = (expr as any).getExpression();
        } else if (expr.getKind() === SyntaxKind.Identifier && expr.getText() === "defineTool") {
          isDefineTool = true;
          chain.push(current as any);
          break;
        } else {
          break;
        }
      }

      if (isDefineTool) {
        chain.reverse();
        
        let newBuilderLines: string[] = ["imageProcedure"];
        const usedMiddleware = new Set<string>();
        
        for (let i = 0; i < chain.length; i++) {
          const call = chain[i];
          const args = call.getArguments().map(a => a.getText());
          
          if (i === 0) {
            newBuilderLines.push(`  .tool(${args.join(", ")})`);
          } else {
            const propAccess = call.getExpression() as any;
            const methodName = propAccess.getName();
            
            if (methodName === "resolves") {
              newBuilderLines.splice(1, 0, `  .use(withResolves(${args[0]}))`);
              usedMiddleware.add("withResolves");
            } else if (methodName === "requireOwnership") {
              newBuilderLines.splice(1, 0, `  .use(withOwnership(${args[0]}))`);
              usedMiddleware.add("withOwnership");
            } else if (methodName === "credits") {
              newBuilderLines.splice(1, 0, `  .use(withCredits(${args[0]}))`);
              usedMiddleware.add("withCredits");
            } else if (methodName === "job") {
              newBuilderLines.splice(1, 0, `  .use(withJob(${args[0]}))`);
              usedMiddleware.add("withJob");
            } else if (methodName === "validate") {
               console.log(`Skipping validate in ${sourceFile.getFilePath()}`);
            } else if (methodName === "handler") {
               const handlerText = args[0];
               let newHandlerText = handlerText.replace(/^(async\s+)?\(([^,]+),\s*([^)]+)\)\s*=>/, "$1({ input: $2, ctx: $3 }) =>");
               newHandlerText = newHandlerText.replace(/^(async\s+)?function\s*\(([^,]+),\s*([^)]+)\)\s*\{/, "$1function({ input: $2, ctx: $3 }) {");
               newHandlerText = newHandlerText.replace(/({ input: _input, ctx: ([^}]+) })/, "{ input: _input, ctx: $2 }");

               newBuilderLines.push(`  .handler(${newHandlerText})`);
            }
          }
        }
        
        initializer.replaceWithText(newBuilderLines.join("
"));
        changed = true;

        if (defineToolImport) {
          defineToolImport.remove();
        }

        const imports = ["imageProcedure", ...Array.from(usedMiddleware)];
        sourceFile.addImportDeclaration({
          namedImports: imports,
          moduleSpecifier: "../tool-builder/image-middleware.js"
        });
      }
    }
  }

  for (const varDecl of varDecls) {
    const init = varDecl.getInitializer();
    if (init && init.getText().endsWith(".schema")) {
      init.replaceWithText(`z.object(${init.getText().replace(".schema", ".inputSchema")})`);
      changed = true;
    }
  }

  if (changed) {
    sourceFile.saveSync();
    console.log(`Updated ${sourceFile.getFilePath()}`);
  }
}
