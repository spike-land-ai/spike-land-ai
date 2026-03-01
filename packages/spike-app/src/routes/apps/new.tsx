import { useState, type ChangeEvent, type FormEvent } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { StatusBadge, type AppStatus } from "@/components/StatusBadge";
import { useStdb } from "@/hooks/useStdb";

const steps = ["Details", "Prompt", "Review"] as const;

const categories = ["utility", "game", "tool", "social", "other"] as const;

interface FormData {
  name: string;
  slug: string;
  description: string;
  category: (typeof categories)[number];
  prompt: string;
}

interface FormErrors {
  name?: string;
  slug?: string;
  prompt?: string;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function validate(data: FormData, step: number): FormErrors {
  const errors: FormErrors = {};
  if (step >= 0) {
    if (!data.name.trim()) errors.name = "Name is required";
    if (!data.slug.trim()) errors.slug = "Slug is required";
    else if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(data.slug))
      errors.slug = "Slug must be lowercase letters, numbers, and hyphens";
  }
  if (step >= 1) {
    if (!data.prompt.trim()) errors.prompt = "Describe what your app should do";
  }
  return errors;
}

export function AppsNewPage() {
  const [currentStep, setCurrentStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [buildStatus, setBuildStatus] = useState<AppStatus | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const [data, setData] = useState<FormData>({
    name: "",
    slug: "",
    description: "",
    category: "utility",
    prompt: "",
  });

  const { client, connected } = useStdb();
  const navigate = useNavigate();

  function update(field: keyof FormData, value: string) {
    setData((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "name" && prev.slug === slugify(prev.name)) {
        next.slug = slugify(value);
      }
      return next;
    });
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function goNext() {
    const errs = validate(data, currentStep);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setCurrentStep((s) => Math.min(steps.length - 1, s + 1));
  }

  function goPrev() {
    setCurrentStep((s) => Math.max(0, s - 1));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const errs = validate(data, 2);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    setSubmitting(true);
    setBuildStatus("prompting");

    try {
      // Simulate build pipeline status updates
      setBuildStatus("drafting");
      await new Promise((r) => setTimeout(r, 800));
      setBuildStatus("building");

      if (connected) {
        client.recordEvent("create_app", {
          name: data.name,
          slug: data.slug,
          description: data.description,
          category: data.category,
          prompt: data.prompt,
        });
      }

      await new Promise((r) => setTimeout(r, 1000));
      setBuildStatus("live");

      await new Promise((r) => setTimeout(r, 500));
      navigate({ to: "/apps/$appId", params: { appId: data.slug } });
    } catch {
      setSubmitting(false);
      setBuildStatus(null);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/apps" className="text-blue-600 hover:underline">
          Apps
        </Link>
        <span className="text-gray-400">/</span>
        <h1 className="text-2xl font-bold">Create App</h1>
      </div>

      {/* Step indicators */}
      <div className="flex gap-2">
        {steps.map((step, i) => (
          <button
            key={step}
            onClick={() => i < currentStep && setCurrentStep(i)}
            disabled={i > currentStep || submitting}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${
              i === currentStep
                ? "bg-blue-600 text-white"
                : i < currentStep
                  ? "bg-blue-100 text-blue-700 hover:bg-blue-200"
                  : "bg-gray-100 text-gray-400"
            }`}
          >
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                i < currentStep
                  ? "bg-blue-600 text-white"
                  : "bg-white/20"
              }`}
            >
              {i < currentStep ? "\u2713" : i + 1}
            </span>
            {step}
          </button>
        ))}
      </div>

      {/* Build status */}
      {buildStatus && (
        <div className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
          <span className="text-sm font-medium text-blue-700">
            Building your app...
          </span>
          <StatusBadge status={buildStatus} />
        </div>
      )}

      {/* Step content */}
      <form onSubmit={handleSubmit}>
        <div className="rounded-xl border bg-white p-8">
          {currentStep === 0 && (
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium">
                  App Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={data.name}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => update("name", e.target.value)}
                  className={`w-full rounded-lg border px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.name ? "border-red-400" : ""
                  }`}
                  placeholder="My Awesome App"
                />
                {errors.name && (
                  <p className="mt-1 text-xs text-red-500">{errors.name}</p>
                )}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Slug</label>
                <input
                  type="text"
                  value={data.slug}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => update("slug", e.target.value)}
                  className={`w-full rounded-lg border px-4 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.slug ? "border-red-400" : ""
                  }`}
                  placeholder="my-awesome-app"
                />
                {errors.slug && (
                  <p className="mt-1 text-xs text-red-500">{errors.slug}</p>
                )}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Description</label>
                <textarea
                  value={data.description}
                  onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                    update("description", e.target.value)
                  }
                  className="w-full rounded-lg border px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="What does your app do?"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Category</label>
                <select
                  value={data.category}
                  onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                    update("category", e.target.value)
                  }
                  className="w-full rounded-lg border px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat.charAt(0).toUpperCase() + cat.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {currentStep === 1 && (
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium">
                  Prompt <span className="text-red-500">*</span>
                </label>
                <p className="mb-2 text-sm text-gray-500">
                  Describe what you want your app to do. Be as specific as possible.
                </p>
                <textarea
                  value={data.prompt}
                  onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                    update("prompt", e.target.value)
                  }
                  className={`w-full rounded-lg border px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.prompt ? "border-red-400" : ""
                  }`}
                  rows={8}
                  placeholder="I want an app that..."
                />
                {errors.prompt && (
                  <p className="mt-1 text-xs text-red-500">{errors.prompt}</p>
                )}
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold">Review your app</h3>
              <dl className="space-y-3">
                <div>
                  <dt className="text-xs font-medium text-gray-500">Name</dt>
                  <dd className="text-sm">{data.name}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-gray-500">Slug</dt>
                  <dd className="font-mono text-sm">{data.slug}</dd>
                </div>
                {data.description && (
                  <div>
                    <dt className="text-xs font-medium text-gray-500">Description</dt>
                    <dd className="text-sm">{data.description}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-xs font-medium text-gray-500">Category</dt>
                  <dd className="text-sm capitalize">{data.category}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-gray-500">Prompt</dt>
                  <dd className="whitespace-pre-wrap rounded-lg bg-gray-50 p-3 text-sm">
                    {data.prompt}
                  </dd>
                </div>
              </dl>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="mt-6 flex justify-between">
          <button
            type="button"
            onClick={goPrev}
            disabled={currentStep === 0 || submitting}
            className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium hover:bg-gray-200 disabled:opacity-50"
          >
            Previous
          </button>
          {currentStep < steps.length - 1 ? (
            <button
              type="button"
              onClick={goNext}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Next
            </button>
          ) : (
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-green-600 px-6 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              {submitting ? "Creating..." : "Create App"}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
