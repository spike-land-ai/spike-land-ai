import { tryCatch } from "@/lib/try-catch";
import { getSpeedy2 } from "@/lib/use-archive";

const download = async (codeSpace: string, onlyReturn: boolean): Promise<string | void> => {
  const downloadProcess = async (): Promise<string | void> => {
    await getSpeedy2();

    const url = `/live-cms/${codeSpace}.html`;
    const response = await fetch(url);

    if (!response || !response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const content = await response.text();

    if (onlyReturn) {
      return content;
    }

    const blob = new Blob([content], { type: "text/html" });
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = `${codeSpace}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
  };

  const { data, error } = await tryCatch<string | void>(downloadProcess());

  if (error) {
    console.error("Error in useDownload:", error);
    throw error;
  }
  return data;
};

export const useDownload = (codeSpace: string, onlyReturn = false) => {
  return () => download(codeSpace, onlyReturn);
};
