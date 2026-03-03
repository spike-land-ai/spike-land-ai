import { toast } from "sonner";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Plus, Sparkles } from "lucide-react";
import {
  Button,
  Input,
  Select,
  TextArea,
  CreditBadge,
  JobPoller,
  ImagePicker,
} from "@/components/ui";
import { callTool, parseToolResult } from "@/api/client";
import { SUBJECT_TYPES, ENHANCEMENT_TIERS, ENHANCEMENT_COSTS } from "@/constants/enums";

interface Subject {
  id: string;
  label: string;
  type: string;
  imageId: string;
  description?: string;
}

const subjectSchema = z.object({
  label: z.string().min(1, "Label is required").max(50),
  imageId: z.string().min(1, "Reference Image ID is required"),
  type: z.string(),
  description: z.string().optional(),
});
type SubjectFormData = z.infer<typeof subjectSchema>;

export function Subjects() {
  const queryClient = useQueryClient();

  // Register Form
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<SubjectFormData>({
    resolver: zodResolver(subjectSchema),
    defaultValues: {
      label: "",
      imageId: "",
      type: "character",
      description: "",
    },
  });

  // Generate
  const [genPrompt, setGenPrompt] = useState("");
  const [genSubjects, setGenSubjects] = useState<string[]>([]);
  const [genTier, setGenTier] = useState("TIER_1K");
  const [generating, setGenerating] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);

  const { data: subjectsData, isLoading: loading } = useQuery({
    queryKey: ["subjects"],
    queryFn: async () => {
      const res = await callTool("img_subject_list", {});
      const data = parseToolResult<{ subjects: Subject[] }>(res);
      return data.subjects ?? [];
    },
  });
  const subjects = subjectsData ?? [];

  const handleRegister = async (data: SubjectFormData) => {
    try {
      await callTool("img_subject_save", {
        label: data.label,
        image_id: data.imageId,
        type: data.type,
        description: data.description || undefined,
      });
      reset();
      queryClient.invalidateQueries({ queryKey: ["subjects"] });
      toast.success("Subject registered successfully!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Registration failed");
    }
  };

  const handleGenerate = async () => {
    if (!genPrompt.trim() || genSubjects.length === 0) return;
    setGenerating(true);
    setJobId(null);
    try {
      const res = await callTool("img_generate", {
        prompt: genPrompt,
        subject_refs: genSubjects,
        tier: genTier,
      });
      const data = parseToolResult<{ jobId?: string; job_id?: string }>(res);
      setJobId(data.jobId ?? data.job_id ?? null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const toggleSubject = (label: string) => {
    setGenSubjects((prev) =>
      prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label],
    );
  };

  const subjectTypeOptions = SUBJECT_TYPES.map((t) => ({ value: t, label: t }));
  const tierOptions = ENHANCEMENT_TIERS.map((t) => ({
    value: t,
    label: `${t} (${ENHANCEMENT_COSTS[t as keyof typeof ENHANCEMENT_COSTS]})`,
  }));

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-2xl font-bold text-gray-100">Subjects</h2>
        <p className="text-gray-400 mt-1">Register and generate with consistent subjects</p>
      </div>

      {/* Registered subjects */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <h3 className="text-sm font-medium text-gray-300 mb-3">
          Registered Subjects ({subjects.length})
        </h3>
        {loading ? (
          <div className="h-16 bg-gray-800 rounded animate-pulse" />
        ) : subjects.length === 0 ? (
          <p className="text-gray-500 text-sm">No subjects registered</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {subjects.map((s) => (
              <button
                key={s.id}
                onClick={() => toggleSubject(s.label)}
                className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                  genSubjects.includes(s.label)
                    ? "bg-accent-600/20 border-accent-500/30 text-accent-400"
                    : "bg-gray-800 border-gray-700 text-gray-300"
                }`}
              >
                {s.label} <span className="text-xs text-gray-500">({s.type})</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Register new */}
      <form
        onSubmit={handleSubmit(handleRegister)}
        className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3"
      >
        <h3 className="text-sm font-medium text-gray-300">Register New Subject</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Input label="Label" placeholder="Subject name" {...register("label")} />
            {errors.label && <p className="text-red-500 text-xs mt-1">{errors.label.message}</p>}
          </div>
          <div>
            <ImagePicker
              label="Image ID"
              placeholder="Select Reference image"
              value={watch("imageId")}
              onChange={(val) => setValue("imageId", val)}
            />
            {errors.imageId && (
              <p className="text-red-500 text-xs mt-1">{errors.imageId.message}</p>
            )}
          </div>
        </div>
        <Select
          label="Type"
          options={subjectTypeOptions}
          value={watch("type")}
          onChange={(e) => setValue("type", e.target.value)}
        />
        <Input label="Description (optional)" {...register("description")} />
        <Button type="submit" size="sm" loading={isSubmitting}>
          <Plus className="w-4 h-4" /> Register
        </Button>
      </form>

      {/* Generate with subjects */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
        <h3 className="text-sm font-medium text-gray-300">Generate with Subjects</h3>
        <p className="text-xs text-gray-500">Select subjects above, then enter a prompt</p>
        <TextArea
          label="Prompt"
          value={genPrompt}
          onChange={(e) => setGenPrompt(e.target.value)}
          rows={3}
          placeholder="Describe the scene..."
        />
        <Select
          label="Tier"
          options={tierOptions}
          value={genTier}
          onChange={(e) => setGenTier(e.target.value)}
        />
        <div className="flex items-center gap-3">
          <Button
            onClick={handleGenerate}
            loading={generating}
            disabled={!genPrompt.trim() || genSubjects.length === 0}
          >
            <Sparkles className="w-4 h-4" /> Generate
          </Button>
          <CreditBadge
            cost={
              (ENHANCEMENT_COSTS[genTier as keyof typeof ENHANCEMENT_COSTS] ?? 2) +
              genSubjects.length
            }
          />
        </div>
      </div>
      {jobId && <JobPoller jobId={jobId} toolName="img_job_status" />}
    </div>
  );
}
