export const useMcpTool = <T = any>(_toolName?: string, _args?: any, _options?: any) => {
  return {
    data: undefined as T | undefined,
    isLoading: false,
    error: undefined as Error | undefined,
    refetch: () => {},
    mutate: () => {}
  };
};
