import { useState } from "react";
import { useQaStudioMcp } from "../../hooks/useQaStudioMcp";
import { ConnectionPanel } from "../../components/qa-studio/ConnectionPanel";
import { BrowserBar } from "../../components/qa-studio/BrowserBar";
import { NarrationPanel } from "../../../core-logic/NarrationPanel";
import { SidePanel } from "../../components/qa-studio/SidePanel";
import { ConsolePanel } from "../../components/qa-studio/ConsolePanel";

export function QaStudioPage() {
  const mcp = useQaStudioMcp();
  const [narrationText, setNarrationText] = useState("");
  const [screenshotData, setScreenshotData] = useState<string | undefined>();
  const [tabsData, setTabsData] = useState<unknown>();
  const [formsData, setFormsData] = useState<unknown>();

  const handleNavigate = async (url: string) => {
    try {
      const result = await mcp.callTool("web_navigate", { url });
      setNarrationText(result.content[0]?.text || "");
    } catch (error) {
      console.error(error);
    }
  };

  const handleRefresh = async () => {
    try {
      const result = await mcp.callTool("web_read", {});
      setNarrationText(result.content[0]?.text || "");
    } catch (error) {
      console.error(error);
    }
  };

  const handleScreenshot = async () => {
    try {
      const result = await mcp.callTool("web_screenshot", {});
      const imgContent = result.content.find(
        (c) => c.type === "image" || c.mimeType === "image/png" || c.data,
      );
      if (imgContent?.data) {
        setScreenshotData(imgContent.data);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleRefClick = async (ref: number) => {
    try {
      const result = await mcp.callTool("web_click", { ref });
      setNarrationText(result.content[0]?.text || "");
    } catch (error) {
      console.error(error);
    }
  };

  const handleGetForms = async () => {
    try {
      const result = await mcp.callTool("web_forms", {});
      if (result.content[0]?.text) {
        try {
          setFormsData(JSON.parse(result.content[0].text));
        } catch {
          setFormsData({ text: result.content[0].text });
        }
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleGetTabs = async () => {
    try {
      const result = await mcp.callTool("web_tabs", { action: "list" });
      if (result.content[0]?.text) {
        try {
          setTabsData(JSON.parse(result.content[0].text));
        } catch {
          setTabsData({ text: result.content[0].text });
        }
      }
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="flex flex-col h-full w-full overflow-hidden bg-background">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20">
            <div className="w-4 h-4 bg-primary rounded-sm" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-foreground">QA Studio</h1>
            <p className="text-xs text-muted-foreground">Browser Automation Control</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <ConnectionPanel
            url={mcp.url}
            connected={mcp.connected}
            onConnect={mcp.connect}
            onDisconnect={mcp.disconnect}
          />
        </div>
      </div>

      {mcp.connected && (
        <div className="flex flex-col flex-1 overflow-hidden">
          <BrowserBar
            onNavigate={handleNavigate}
            onRefresh={handleRefresh}
            onScreenshot={handleScreenshot}
            onGetForms={handleGetForms}
            onGetTabs={handleGetTabs}
            isCalling={mcp.isCalling}
          />

          <div className="flex flex-1 overflow-hidden">
            <div className="w-1/2 min-w-[400px] border-r border-border overflow-hidden flex flex-col">
              <NarrationPanel
                text={narrationText}
                onRefClick={handleRefClick}
                isCalling={mcp.isCalling}
              />
            </div>

            <div className="w-1/2 min-w-[400px] overflow-hidden flex flex-col">
              <SidePanel
                {...(screenshotData !== undefined && { screenshotData })}
                tabsData={tabsData}
                formsData={formsData}
              />
            </div>
          </div>

          <ConsolePanel history={mcp.history} />
        </div>
      )}

      {!mcp.connected && (
        <div className="flex-1 flex items-center justify-center text-muted-foreground p-8 text-center flex-col gap-4">
          <div className="bg-muted/30 p-8 rounded-2xl border border-border mt-4 w-full max-w-2xl shadow-sm flex flex-col items-center">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20 mb-6">
              <div className="w-8 h-8 bg-primary rounded-lg" />
            </div>
            <div className="text-2xl font-bold text-foreground mb-2">Connect to QA Studio</div>
            <div className="text-base text-muted-foreground mb-8 max-w-md text-center">
              Use browser automation as the thin smoke layer around a tool-first test stack. Connect
              to a local MCP server to inspect flows, capture evidence, and exercise high-friction
              journeys.
            </div>

            <div className="w-full text-left space-y-6">
              <div className="flex items-start gap-4">
                <div className="bg-primary/10 text-primary w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 mt-0.5 border border-primary/20">
                  1
                </div>
                <div>
                  <div className="font-semibold text-foreground mb-2">Start the local server</div>
                  <div className="bg-background border border-border p-3 rounded-lg shadow-inner">
                    <code className="font-mono text-sm text-primary">
                      npx @spike-land-ai/qa-studio --http --visible
                    </code>
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="bg-primary/10 text-primary w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 mt-0.5 border border-primary/20">
                  2
                </div>
                <div>
                  <div className="font-semibold text-foreground mb-1">Connect from the header</div>
                  <div className="text-sm text-muted-foreground">
                    Click the Connect button in the top right corner of this page.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
