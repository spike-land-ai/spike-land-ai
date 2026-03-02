"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { GitBranch, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";

const formSchema = z.object({
  name: z.string().min(1, "Machine name is required").max(100),
  initialState: z.string().min(1, "Initial state ID is required").max(50),
});

interface NewMachineDialogProps {
  isOpen: boolean;
  onSubmit: (name: string, initialState?: string) => void;
  onClose: () => void;
}

export function NewMachineDialog({ isOpen, onSubmit, onClose }: NewMachineDialogProps) {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      initialState: "idle",
    },
  });

  const handleSubmit = (values: z.infer<typeof formSchema>) => {
    onSubmit(values.name, values.initialState);
    form.reset();
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
          form.reset();
        }
      }}
    >
      <DialogContent className="sm:max-w-md bg-[hsl(240,6%,9%)] border border-[hsl(240,4%,18%)] rounded-2xl shadow-2xl overflow-hidden p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b border-[hsl(240,4%,16%)]">
          <div className="flex items-center gap-3">
            <GitBranch className="w-5 h-5 text-purple-400" />
            <DialogTitle className="text-base font-semibold text-white">
              New State Machine
            </DialogTitle>
          </div>
        </DialogHeader>
        <div className="p-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium text-gray-400">
                      Machine Name
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g. Traffic Light Controller"
                        {...field}
                        className="bg-[hsl(240,6%,6%)] border-[hsl(240,4%,16%)] text-gray-200 focus-visible:ring-purple-500/30"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="initialState"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium text-gray-400">
                      Initial State
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g. idle"
                        {...field}
                        className="bg-[hsl(240,6%,6%)] border-[hsl(240,4%,16%)] text-gray-200 focus-visible:ring-purple-500/30"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="submit"
                className="w-full mt-2 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Machine
              </Button>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
