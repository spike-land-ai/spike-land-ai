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
      const imgContent = result.content.find((c) => c.type === "image" || c.mimeType === "image/png" || c.data);
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
      const result = await mcp.callTool("web_tabs", {});
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
      <ConnectionPanel 
        url={mcp.url} 
        connected={mcp.connected} 
        onConnect={mcp.connect} 
        onDisconnect={mcp.disconnect} 
      />
      
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
            <div className="flex-1 min-w-[50%]">
              <NarrationPanel 
                text={narrationText} 
                onRefClick={handleRefClick} 
                isCalling={mcp.isCalling} 
              />
            </div>
            
            <div className="w-[40%] min-w-[300px]">
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
          <div className="text-2xl font-semibold text-foreground">QA Studio</div>
          <div className="max-w-md">Connect to a local QA Studio MCP server to begin visually controlling browser automation without writing code.</div>
          <div className="bg-muted/50 p-6 rounded-lg text-left border border-border mt-4 w-full max-w-lg shadow-sm">
            <div className="font-semibold mb-3 text-foreground flex items-center gap-2">
              <span className="bg-primary/20 text-primary w-6 h-6 rounded-full flex items-center justify-center text-sm">1</span>
              Open your terminal
            </div>
            <div className="font-semibold mb-3 text-foreground flex items-center gap-2">
              <span className="bg-primary/20 text-primary w-6 h-6 rounded-full flex items-center justify-center text-sm">2</span>
              Run the server
            </div>
            <div className="pl-8 mb-6">
              <code className="bg-background border border-border px-3 py-2 rounded text-primary block shadow-inner font-mono text-sm">
                npx @spike-land-ai/qa-studio --http --visible
              </code>
            </div>
            <div className="font-semibold mb-3 text-foreground flex items-center gap-2">
              <span className="bg-primary/20 text-primary w-6 h-6 rounded-full flex items-center justify-center text-sm">3</span>
              Click Connect above
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
