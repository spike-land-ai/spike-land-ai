import { useState, useEffect } from "react";
import { Key, Save, Trash2, ShieldCheck, CheckCircle2, AlertCircle, Loader2, Sparkles, Brain, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";

export function Settings() {
  const [apiKey, setApiKey] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const [validationStatus, setIsValidatingStatus] = useState<"idle" | "valid" | "invalid">("idle");

  // Model Preferences
  const [textModel, setTextModel] = useState("gemini-3-flash-preview");
  const [imageModel, setImageModel] = useState("gemini-3.1-flash-image-preview");
  const [thinkingBudget, setThinkingBudget] = useState("off");

  useEffect(() => {
    setApiKey(localStorage.getItem("gemini_api_key") || "");
    setTextModel(localStorage.getItem("pref_text_model") || "gemini-3-flash-preview");
    setImageModel(localStorage.getItem("pref_image_model") || "gemini-3.1-flash-image-preview");
    setThinkingBudget(localStorage.getItem("pref_thinking_budget") || "off");
  }, []);

  const handleSave = () => {
    localStorage.setItem("gemini_api_key", apiKey);
    localStorage.setItem("pref_text_model", textModel);
    localStorage.setItem("pref_image_model", imageModel);
    localStorage.setItem("pref_thinking_budget", thinkingBudget);
    toast.success("Neural preferences synced successfully");
  };

  const validateKey = async () => {
    if (!apiKey) return;
    setIsValidating(true);
    setIsValidatingStatus("idle");

    try {
      // Basic call to list models to verify key
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
      if (res.ok) {
        setIsValidatingStatus("valid");
        toast.success("API Key verified");
      } else {
        setIsValidatingStatus("invalid");
        toast.error("Invalid API Key");
      }
    } catch {
      setIsValidatingStatus("invalid");
      toast.error("Validation failed");
    } finally {
      setIsValidating(false);
    }
  };

  const handleClear = () => {
    localStorage.removeItem("gemini_api_key");
    setApiKey("");
    setIsValidatingStatus("idle");
  };

  return (
    <div className="max-w-3xl mx-auto py-12 px-6 md:pt-20 space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-700">
      <div className="space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-neon/10 border border-amber-neon/20 text-[10px] font-black uppercase tracking-[0.2em] text-amber-neon">
          System Core
        </div>
        <h2 className="text-4xl font-black text-white tracking-tighter">
          NEURAL<span className="text-amber-neon">CONFIG</span>
        </h2>
        <p className="text-gray-500 font-medium max-w-lg">
          Calibrate your studio's processing engines and manage your neural access tokens.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Token Management */}
        <div className="glass-panel rounded-[2.5rem] p-8 border-white/5 space-y-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center">
              <Key className="w-6 h-6 text-amber-neon" />
            </div>
            <div>
              <h3 className="font-bold text-white tracking-tight">Access Token</h3>
              <p className="text-xs text-gray-500 font-medium">Google AI Studio Provider</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="relative group">
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Enter Gemini API Key..."
                className="w-full bg-obsidian-950/50 border border-white/10 rounded-2xl py-4 pl-6 pr-12 text-sm text-white placeholder:text-gray-700 focus:outline-none focus:ring-2 ring-amber-neon/20 transition-all"
              />
              {apiKey && (
                <button
                  onClick={handleClear}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-600 hover:text-red-400 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={validateKey}
                disabled={!apiKey || isValidating}
                className="flex-1 py-3 rounded-xl bg-white/5 border border-white/10 text-xs font-black uppercase tracking-widest text-gray-400 hover:bg-white/10 hover:text-white transition-all disabled:opacity-20 flex items-center justify-center gap-2"
              >
                {isValidating ? <Loader2 className="w-3 h-3 animate-spin" /> : "Verify Token"}
                {validationStatus === "valid" && <CheckCircle2 className="w-3 h-3 text-emerald-neon" />}
                {validationStatus === "invalid" && <AlertCircle className="w-3 h-3 text-red-500" />}
              </button>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-amber-neon/5 border border-amber-neon/10">
            <div className="flex gap-3">
              <ShieldCheck className="w-4 h-4 text-amber-neon shrink-0" />
              <p className="text-[10px] leading-relaxed text-amber-neon/70 font-medium uppercase tracking-tight">
                Localized encryption: Your token remains within this browser isolate and is only utilized for direct provider orchestration.
              </p>
            </div>
          </div>
        </div>

        {/* Model Preferences */}
        <div className="glass-panel rounded-[2.5rem] p-8 border-white/5 space-y-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-emerald-neon" />
            </div>
            <div>
              <h3 className="font-bold text-white tracking-tight">Processing Engines</h3>
              <p className="text-xs text-gray-500 font-medium">Model routing preferences</p>
            </div>
          </div>

          <div className="space-y-6">
            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 flex items-center gap-2">
                <Brain className="w-3 h-3" /> Linguistic Engine
              </label>
              <select
                value={textModel}
                onChange={(e) => setTextModel(e.target.value)}
                className="w-full bg-obsidian-950/50 border border-white/10 rounded-xl py-3 px-4 text-xs font-bold text-gray-300 focus:outline-none"
              >
                <option value="gemini-3-flash-preview">Gemini 3 Flash (Recommended)</option>
                <option value="gemini-3.1-pro-preview">Gemini 3.1 Pro</option>
              </select>
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 flex items-center gap-2">
                <ImageIcon className="w-3 h-3" /> Visual Manifestation
              </label>
              <select
                value={imageModel}
                onChange={(e) => setImageModel(e.target.value)}
                className="w-full bg-obsidian-950/50 border border-white/10 rounded-xl py-3 px-4 text-xs font-bold text-gray-300 focus:outline-none"
              >
                <option value="gemini-3.1-flash-image-preview">Gemini 3.1 Flash Image (Recommended)</option>
              </select>
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">Thinking Budget</label>
              <div className="grid grid-cols-3 gap-2">
                {["off", "partial", "full"].map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setThinkingBudget(mode)}
                    className={`py-2 rounded-lg text-[10px] font-black uppercase transition-all ${thinkingBudget === mode
                      ? "bg-emerald-neon text-obsidian-950 shadow-[0_0_15px_rgba(0,255,170,0.3)]"
                      : "bg-white/5 text-gray-500 hover:text-gray-300"
                      }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-center">
        <button
          onClick={handleSave}
          className="group relative px-12 py-5 rounded-[2rem] bg-amber-neon text-obsidian-950 font-black uppercase tracking-[0.2em] shadow-[0_20px_50px_rgba(255,170,0,0.2)] hover:scale-105 transition-all active:scale-95"
        >
          <div className="flex items-center gap-3">
            <Save className="w-5 h-5 stroke-[3]" />
            Sync Preferences
          </div>
        </button>
      </div>
    </div>
  );
}
