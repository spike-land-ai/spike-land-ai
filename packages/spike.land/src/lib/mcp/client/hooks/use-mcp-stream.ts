export const useMcpStream = <T = any>(_toolName?: string, _opts?: any) => {
  return {
    start: (_args?: any) => {},
    stop: () => {},
    isStreaming: false,
    data: null as T | null,
    chunks: [] as string[],
    fullText: "",
    isDone: false,
    error: null as Error | null
  };
};
