const { Project, SyntaxKind } = require("ts-morph");

const project = new Project();
project.addSourceFilesAtPaths("../../packages/mcp-image-studio/src/tools/*-delete.ts");

const files = project.getSourceFiles().filter(f => !f.getFilePath().endsWith(".test.ts"));

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
      let callExpr = initializer;
      let isDefineTool = false;
      
      const chain = [];
      let current = callExpr;
      while (current.getKind() === SyntaxKind.CallExpression) {
        chain.push(current);
        const expr = current.getExpression();
        if (expr.getKind() === SyntaxKind.PropertyAccessExpression) {
          current = expr.getExpression();
        } else if (expr.getKind() === SyntaxKind.Identifier && expr.getText() === "defineTool") {
          isDefineTool = true;
          chain.push(current);
          break;
        } else {
          break;
        }
      }

      if (isDefineTool) {
        chain.reverse();
        
        // We will collect the parts
        let toolCall = "";
        let resolvesCall = "";
        let ownershipCall = "";
        let creditsCall = "";
        let jobCall = "";
        let validateCall = "";
        let handlerCall = "";

        const usedMiddleware = new Set();
        
        for (let i = 0; i < chain.length; i++) {
          const call = chain[i];
          const args = call.getArguments().map(a => a.getText());
          
          if (i === 0) {
            toolCall = "  .tool(" + args.join(", ") + ")";
          } else {
            const expr = call.getExpression();
            let methodName = "";
            if (expr.getKind() === SyntaxKind.PropertyAccessExpression) {
              methodName = expr.getName();
            } else {
              methodName = expr.getText();
            }
            
            if (methodName === "resolves") {
              resolvesCall = "  .use(withResolves(" + args[0] + "))";
              usedMiddleware.add("withResolves");
            } else if (methodName === "requireOwnership") {
              ownershipCall = "  .use(withOwnership(" + args[0] + "))";
              usedMiddleware.add("withOwnership");
            } else if (methodName === "credits") {
              let creditsArg = args[0];
              creditsArg = creditsArg.replace(/cost:\s*\(([^,)]+)(,\s*deps)?\)/, "cost: ($1: any$2)");
              creditsCall = "  .use(withCredits(" + creditsArg + "))";
              usedMiddleware.add("withCredits");
            } else if (methodName === "job") {
              jobCall = "  .use(withJob(" + args[0] + "))";
              usedMiddleware.add("withJob");
            } else if (methodName === "validate") {
               validateCall = "  // TODO: validate -> refine\n  /* .validate(" + args[0] + ") */";
            } else if (methodName === "handler") {
               const handlerText = args[0];
               let newHandlerText = handlerText.replace(/^(async\s+)?\(([^,]+),\s*([^)]+)\)\s*=>/, "$1({ input: $2, ctx: $3 }) =>");
               newHandlerText = newHandlerText.replace(/^(async\s+)?function\s*\(([^,]+),\s*([^)]+)\)\s*\{/, "$1function({ input: $2, ctx: $3 }) {");
               newHandlerText = newHandlerText.replace(/(\{ input: _input, ctx: ([^}]+) \})/, "{ input: _input, ctx: $2 }");

               handlerCall = "  .handler(" + newHandlerText + ")";
            }
          }
        }
        
        const newBuilderLines = ["imageProcedure"];
        if (resolvesCall) newBuilderLines.push(resolvesCall);
        if (ownershipCall) newBuilderLines.push(ownershipCall);
        if (creditsCall) newBuilderLines.push(creditsCall);
        if (jobCall) newBuilderLines.push(jobCall);
        
        newBuilderLines.push(toolCall);
        
        if (validateCall) newBuilderLines.push(validateCall);
        if (handlerCall) newBuilderLines.push(handlerCall);

        initializer.replaceWithText(newBuilderLines.join(String.fromCharCode(10)));
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
      init.replaceWithText("z.object(" + init.getText().replace(".schema", ".inputSchema") + ")");
      changed = true;
    }
  }

  if (changed) {
    sourceFile.saveSync();
    console.log("Updated " + sourceFile.getFilePath());
  }
}
