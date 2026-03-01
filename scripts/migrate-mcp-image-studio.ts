import { Project, SyntaxKind } from "ts-morph";

const project = new Project();
project.addSourceFilesAtPaths("packages/mcp-image-studio/src/tools/*.ts");

const files = project.getSourceFiles().filter(f => !f.getFilePath().endsWith(".test.ts") && !f.getFilePath().endsWith("try-catch.ts"));

for (const sourceFile of files) {
  let changed = false;

  // Find defineTool imports
  const defineToolImport = sourceFile.getImportDeclaration(decl => {
    return decl.getModuleSpecifierValue() === "../define-tool.js" || decl.getModuleSpecifierValue() === "../define-tool";
  });

  // Find the tool declaration
  const varDecls = sourceFile.getVariableDeclarations();
  for (const varDecl of varDecls) {
    const initializer = varDecl.getInitializer();
    if (!initializer) continue;

    // We are looking for something like defineTool(...).resolves(...)...handler(...)
    // Which is a CallExpression chain.
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
        // Reverse the chain to go from defineTool -> resolves -> handler
        chain.reverse();
        
        let newBuilderStr = "imageProcedure\\n";
        const usedMiddleware = new Set();
        
        for (let i = 0; i < chain.length; i++) {
          const call = chain[i];
          const args = call.getArguments().map(a => a.getText());
          
          if (i === 0) { // defineTool call
            newBuilderStr += `  .tool(${args.join(", ")})\\n`;
          } else {
            const propAccess = call.getExpression();
            const methodName = propAccess.getName();
            
            if (methodName === "resolves") {
              newBuilderStr = `imageProcedure\\n  .use(withResolves(${args[0]}))\\n` + newBuilderStr.replace("imageProcedure\\n", "");
              usedMiddleware.add("withResolves");
            } else if (methodName === "requireOwnership") {
              newBuilderStr = `imageProcedure\\n  .use(withOwnership(${args[0]}))\\n` + newBuilderStr.replace("imageProcedure\\n", "");
              usedMiddleware.add("withOwnership");
            } else if (methodName === "credits") {
              newBuilderStr = `imageProcedure\\n  .use(withCredits(${args[0]}))\\n` + newBuilderStr.replace("imageProcedure\\n", "");
              usedMiddleware.add("withCredits");
            } else if (methodName === "job") {
              newBuilderStr = `imageProcedure\\n  .use(withJob(${args[0]}))\\n` + newBuilderStr.replace("imageProcedure\\n", "");
              usedMiddleware.add("withJob");
            } else if (methodName === "validate") {
               // Ignore validate for now or convert to a refine on schema?
               // Actually validate can be moved into the handler manually or we can inject it.
               console.log(`Skipping validate in ${sourceFile.getFilePath()}`);
            } else if (methodName === "handler") {
               const handlerText = args[0];
               // If handler uses (input, ctx) we should change it to ({input, ctx})
               // Simple regex replace for the handler signature
               let newHandlerText = handlerText.replace(/^(async\\s+)?\\(([^,]+),\\s*([^)]+)\\)\\s*=>/, "$1({ input: $2, ctx: $3 }) =>");
               // Some handlers might use async function(input, ctx) { ... }
               newHandlerText = newHandlerText.replace(/^(async\\s+)?function\\s*\\(([^,]+),\\s*([^)]+)\\)\\s*\\{/, "$1function({ input: $2, ctx: $3 }) {");
               // Handle `async (_input, ctx) =>`
               newHandlerText = newHandlerText.replace(/({ input: _input, ctx: ([^}]+) })/, "{ input: _input, ctx: $2 }");

               newBuilderStr += `  .handler(${newHandlerText})\\n`;
            }
          }
        }
        
        initializer.replaceWithText(newBuilderStr);
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

  // Update exports like `ToolInputSchema = tool.schema` to `z.object(tool.inputSchema)`
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
