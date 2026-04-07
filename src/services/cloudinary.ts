const MAX_BYTES = 5 * 1024 * 1024;

export const uploadImage = async (file: File) => {
  if (file.size > MAX_BYTES) {
    throw new Error("Imagem muito grande (máx. 5MB)");
  }

  try {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", "rota_incendio_upload");

    const response = await fetch("https://api.cloudinary.com/v1_1/dmcgufpyk/image/upload", {
      method: "POST",
      body: formData,
    });

    const data = (await response.json()) as {
      secure_url?: string;
      error?: { message?: string };
    };

    if (!response.ok) {
      const apiMsg = data.error?.message || "Erro no upload";
      if (
        apiMsg.includes("whitelisted for unsigned") ||
        apiMsg.includes("unsigned uploads")
      ) {
        throw new Error(
          'Preset do Cloudinary: abra o painel → Upload presets → "rota_incendio_upload" → modo de assinatura "Unsigned" (upload não assinado).'
        );
      }
      throw new Error(apiMsg);
    }

    if (!data.secure_url) {
      throw new Error("Resposta inválida do upload");
    }

    return data.secure_url;
  } catch (error) {
    console.error("Erro ao enviar imagem:", error);
    throw error;
  }
};
