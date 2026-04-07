"use client";

import { useState } from "react";
import { Camera } from "lucide-react";
import { toast } from "sonner";
import { uploadImage } from "@/services/cloudinary";
import { cn } from "@/lib/utils";
import { putOfflineBlob } from "@/lib/checklistOffline";

type Props = {
  onUpload: (url: string) => void;
  className?: string;
  disabled?: boolean;
};

function UploadFoto({ onUpload, className, disabled }: Props) {
  const [loading, setLoading] = useState(false);

  const handleFile = async (file: File) => {
    if (disabled) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Imagem muito grande (máx. 5MB)");
      return;
    }

    setLoading(true);
    try {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        const id = crypto.randomUUID();
        await putOfflineBlob(id, file);
        onUpload(`offline:${id}`);
        toast.success("Foto guardada no aparelho; será enviada quando houver internet.");
        return;
      }
      const url = await uploadImage(file);
      onUpload(url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao enviar imagem");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <label
        className={cn(
          "flex h-24 w-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-zinc-600 bg-zinc-950/50 text-xs text-zinc-400 hover:border-fire-yellow hover:text-fire-yellow",
          (loading || disabled) && "pointer-events-none opacity-60"
        )}
      >
        <Camera className="h-5 w-5" />
        {loading ? "Enviando…" : "Upload"}
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          disabled={loading || disabled}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void handleFile(file);
          }}
        />
      </label>
    </div>
  );
}

export { UploadFoto };
export default UploadFoto;
