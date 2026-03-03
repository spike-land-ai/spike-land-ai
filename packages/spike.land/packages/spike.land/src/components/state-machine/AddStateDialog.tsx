"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const formSchema = z.object({
  stateId: z.string().min(1, "State ID is required").refine(
    val => /^[a-zA-Z0-9_-]+$/.test(val),
    "State ID must be alphanumeric and cannot contain spaces",
  ),
  type: z.enum(["atomic", "compound", "parallel", "final"]),
  parent: z.string().optional(),
});

interface AddStateDialogProps {
  isOpen: boolean;
  existingStates: string[];
  onSubmit: (
    stateId: string,
    type: "atomic" | "compound" | "parallel" | "final",
    parent?: string,
  ) => void;
  onClose: () => void;
}

export function AddStateDialog(
  { isOpen, existingStates, onSubmit, onClose }: AddStateDialogProps,
) {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      stateId: "",
      type: "atomic",
      parent: "none",
    },
  });

  const handleSubmit = (values: z.infer<typeof formSchema>) => {
    onSubmit(
      values.stateId,
      values.type,
      values.parent === "none" ? undefined : values.parent,
    );
    form.reset();
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={open => {
        if (!open) {
          onClose();
          form.reset();
        }
      }}
    >
      <DialogContent className="sm:max-w-md bg-[hsl(240,6%,9%)] border border-[hsl(240,4%,18%)] rounded-2xl shadow-2xl overflow-hidden p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b border-[hsl(240,4%,16%)]">
          <DialogTitle className="text-base font-semibold text-white">
            Add State
          </DialogTitle>
        </DialogHeader>
        <div className="p-6">
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(handleSubmit)}
              className="space-y-4"
            >
              <FormField
                control={form.control}
                name="stateId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium text-gray-400">
                      State ID
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g. loading"
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
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium text-gray-400">
                      Type
                    </FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger className="bg-[hsl(240,6%,6%)] border-[hsl(240,4%,16%)] text-gray-200 focus:ring-purple-500/30">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="atomic">Atomic</SelectItem>
                        <SelectItem value="compound">Compound</SelectItem>
                        <SelectItem value="parallel">Parallel</SelectItem>
                        <SelectItem value="final">Final</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {existingStates.length > 0 && (
                <FormField
                  control={form.control}
                  name="parent"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-medium text-gray-400">
                        Parent (optional)
                      </FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value || "none"}
                      >
                        <FormControl>
                          <SelectTrigger className="bg-[hsl(240,6%,6%)] border-[hsl(240,4%,16%)] text-gray-200 focus:ring-purple-500/30">
                            <SelectValue placeholder="Select parent" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="max-h-[200px]">
                          <SelectItem value="none">None (top-level)</SelectItem>
                          {existingStates.map(id => (
                            <SelectItem key={id} value={id}>
                              {id}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <Button
                type="submit"
                className="w-full mt-2 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add State
              </Button>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
