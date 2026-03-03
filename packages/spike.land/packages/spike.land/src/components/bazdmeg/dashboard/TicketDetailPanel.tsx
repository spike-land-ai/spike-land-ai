"use client";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { tryCatch } from "@/lib/try-catch";
import { Check, ExternalLink, FileText, Loader2, Rocket } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { TicketItem } from "./TicketListItem";
import { PlanEditor } from "./PlanEditor";
import { JulesActivityFeed } from "./JulesActivityFeed";
import { JulesHandoffDialog } from "./JulesHandoffDialog";
import { WorkflowStepper } from "./WorkflowStepper";

interface PlanData {
  id: string;
  status: string;
  planContent: string | null;
  planVersion: number;
  julesSessionId: string | null;
  julesSessionUrl: string | null;
  julesLastState: string | null;
  chatMessages: Array<{
    id: string;
    role: string;
    content: string;
    createdAt: string;
  }>;
}

interface JulesStatus {
  state: string;
  activities: Array<{ type?: string; content?: string; }>;
  url?: string;
}

export function TicketDetailPanel({
  ticket,
  onPlanCreated,
}: {
  ticket: TicketItem;
  onPlanCreated: (planId: string) => void;
}) {
  const onPlanCreatedRef = useRef(onPlanCreated);
  onPlanCreatedRef.current = onPlanCreated;

  const [plan, setPlan] = useState<PlanData | null>(null);
  const [isLoadingPlan, setIsLoadingPlan] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isSendingToJules, setIsSendingToJules] = useState(false);
  const [showHandoffDialog, setShowHandoffDialog] = useState(false);
  const [julesStatus, setJulesStatus] = useState<JulesStatus | null>(null);
  const [isPollingJules, setIsPollingJules] = useState(false);

  // Load plan when ticket changes
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setIsLoadingPlan(true);
      const { data: response } = await tryCatch(
        fetch(`/api/bazdmeg/dashboard/plan?issueNumber=${ticket.number}`),
      );
      if (cancelled) return;
      if (response?.ok) {
        const data = await response.json();
        if (data.plan) {
          setPlan(data.plan);
          onPlanCreatedRef.current(data.plan.id);
        } else {
          setPlan(null);
        }
      }
      setIsLoadingPlan(false);
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [ticket.number]);

  // Track plan status in a ref to avoid re-triggering the poll effect
  const planStatusRef = useRef(plan?.status);
  planStatusRef.current = plan?.status;

  // Poll Jules status
  useEffect(() => {
    if (
      !plan?.julesSessionId
      || !["SENT_TO_JULES", "JULES_WORKING", "JULES_REVIEW", "BUILD_FIXING"]
        .includes(plan.status)
    ) {
      return;
    }

    const poll = async () => {
      setIsPollingJules(true);
      const { data: response } = await tryCatch(
        fetch(`/api/bazdmeg/dashboard/jules/status?planId=${plan.id}`),
      );
      if (response?.ok) {
        const data = await response.json();
        if (data.jules) setJulesStatus(data.jules);
        if (data.plan?.status && data.plan.status !== planStatusRef.current) {
          setPlan(prev => prev ? { ...prev, status: data.plan.status } : prev);
        }
      }
      setIsPollingJules(false);
    };

    poll();
    const interval = setInterval(
      poll,
      planStatusRef.current === "JULES_WORKING" ? 15_000 : 60_000,
    );
    return () => clearInterval(interval);
  }, [plan?.id, plan?.julesSessionId, plan?.status]);

  const savePlan = useCallback(
    async (planContent: string) => {
      setIsSaving(true);
      const { data: response } = await tryCatch(
        fetch("/api/bazdmeg/dashboard/plan", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            githubIssueNumber: ticket.number,
            githubIssueTitle: ticket.title,
            githubIssueUrl: ticket.url,
            githubIssueBody: ticket.body,
            planContent,
            status: "PLANNING",
          }),
        }),
      );
      if (response?.ok) {
        const data = await response.json();
        if (data.plan) {
          setPlan(prev => ({
            ...prev!,
            ...data.plan,
            chatMessages: prev?.chatMessages || [],
          }));
          onPlanCreatedRef.current(data.plan.id);
        }
      }
      setIsSaving(false);
    },
    [ticket],
  );

  const handleApprove = async () => {
    if (!plan) return;
    setIsApproving(true);
    const { data: response } = await tryCatch(
      fetch(`/api/bazdmeg/dashboard/plan/${plan.id}/approve`, {
        method: "POST",
      }),
    );
    if (response?.ok) {
      const data = await response.json();
      setPlan(prev => prev ? { ...prev, status: data.plan.status } : prev);
    }
    setIsApproving(false);
  };

  const handleSendToJules = async () => {
    if (!plan) return;
    setIsSendingToJules(true);
    const { data: response } = await tryCatch(
      fetch(`/api/bazdmeg/dashboard/plan/${plan.id}/send-to-jules`, {
        method: "POST",
      }),
    );
    if (response?.ok) {
      const data = await response.json();
      setPlan(prev =>
        prev
          ? {
            ...prev,
            status: data.plan.status,
            julesSessionId: data.plan.julesSessionId,
            julesSessionUrl: data.plan.julesSessionUrl,
            julesLastState: data.plan.julesLastState,
          }
          : prev
      );
    }
    setIsSendingToJules(false);
    setShowHandoffDialog(false);
  };

  const pollJulesManually = async () => {
    if (!plan?.id) return;
    setIsPollingJules(true);
    const { data: response } = await tryCatch(
      fetch(`/api/bazdmeg/dashboard/jules/status?planId=${plan.id}`),
    );
    if (response?.ok) {
      const data = await response.json();
      if (data.jules) setJulesStatus(data.jules);
      if (data.plan?.status) {
        setPlan(prev => prev ? { ...prev, status: data.plan.status } : prev);
      }
    }
    setIsPollingJules(false);
  };

  const status = plan?.status || "UNPLANNED";
  const isJulesActive = [
    "SENT_TO_JULES",
    "JULES_WORKING",
    "JULES_REVIEW",
    "BUILD_FIXING",
  ].includes(status);
  const isReadOnly = isJulesActive || status === "COMPLETED";

  if (isLoadingPlan) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 text-zinc-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Ticket Header */}
      <div className="p-3 border-b border-white/10">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500 font-mono">
              #{ticket.number}
            </span>
            <a
              href={ticket.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-zinc-400 hover:text-white"
            >
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          <WorkflowStepper status={status} />
        </div>
        <h2 className="text-sm font-semibold text-white mb-2">
          {ticket.title}
        </h2>

        {/* Action buttons */}
        <div className="flex gap-2">
          {(status === "PLANNING" || status === "PLAN_READY") && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleApprove}
              disabled={isApproving || !plan?.planContent}
              className="h-7 text-xs border-green-500/30 text-green-400 hover:bg-green-500/10"
            >
              {isApproving
                ? <Loader2 className="h-3 w-3 animate-spin mr-1" />
                : <Check className="h-3 w-3 mr-1" />}
              Approve Plan
            </Button>
          )}
          {status === "APPROVED" && (
            <Button
              size="sm"
              onClick={() => setShowHandoffDialog(true)}
              className="h-7 text-xs bg-amber-500 hover:bg-amber-600 text-black"
            >
              <Rocket className="h-3 w-3 mr-1" />
              Send to Jules
            </Button>
          )}
          {status === "FAILED" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowHandoffDialog(true)}
              className="h-7 text-xs border-red-500/30 text-red-400 hover:bg-red-500/10"
            >
              <Rocket className="h-3 w-3 mr-1" />
              Retry with Jules
            </Button>
          )}
        </div>
      </div>

      {/* Content tabs */}
      <Tabs
        defaultValue="plan"
        className="flex-1 flex flex-col overflow-hidden"
      >
        <TabsList className="w-full bg-transparent border-b border-white/10 rounded-none h-8 p-0">
          <TabsTrigger
            value="plan"
            className="text-xs data-[state=active]:bg-transparent data-[state=active]:text-amber-400 data-[state=active]:border-b-2 data-[state=active]:border-amber-500 rounded-none h-8"
          >
            <FileText className="h-3 w-3 mr-1" />
            Plan
          </TabsTrigger>
          <TabsTrigger
            value="issue"
            className="text-xs data-[state=active]:bg-transparent data-[state=active]:text-amber-400 data-[state=active]:border-b-2 data-[state=active]:border-amber-500 rounded-none h-8"
          >
            Issue
          </TabsTrigger>
          {isJulesActive && (
            <TabsTrigger
              value="jules"
              className="text-xs data-[state=active]:bg-transparent data-[state=active]:text-amber-400 data-[state=active]:border-b-2 data-[state=active]:border-amber-500 rounded-none h-8"
            >
              Jules
              {isPollingJules && <Loader2 className="h-2.5 w-2.5 ml-1 animate-spin" />}
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="plan" className="flex-1 overflow-hidden mt-0">
          <PlanEditor
            planContent={plan?.planContent || ""}
            isReadOnly={isReadOnly}
            onSave={savePlan}
            isSaving={isSaving}
          />
        </TabsContent>

        <TabsContent value="issue" className="flex-1 overflow-hidden mt-0">
          <ScrollArea className="h-full">
            <div className="p-3">
              <div className="flex flex-wrap gap-1 mb-3">
                {ticket.labels.map(label => (
                  <span
                    key={label}
                    className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700"
                  >
                    {label}
                  </span>
                ))}
              </div>
              <div className="prose prose-invert prose-sm max-w-none">
                <pre className="text-xs text-zinc-300 whitespace-pre-wrap font-sans leading-relaxed">
                  {ticket.body || "No description provided."}
                </pre>
              </div>
            </div>
          </ScrollArea>
        </TabsContent>

        {isJulesActive && (
          <TabsContent value="jules" className="flex-1 overflow-hidden mt-0">
            <JulesActivityFeed
              activities={julesStatus?.activities || []}
              sessionUrl={plan?.julesSessionUrl ?? null}
              sessionState={julesStatus?.state ?? plan?.julesLastState ?? null}
              isPolling={isPollingJules}
              onRefresh={pollJulesManually}
            />
          </TabsContent>
        )}
      </Tabs>

      {/* Jules Handoff Dialog */}
      <JulesHandoffDialog
        open={showHandoffDialog}
        onOpenChange={setShowHandoffDialog}
        ticketTitle={`#${ticket.number}: ${ticket.title}`}
        planPreview={plan?.planContent || ""}
        onConfirm={handleSendToJules}
        isLoading={isSendingToJules}
      />
    </div>
  );
}
