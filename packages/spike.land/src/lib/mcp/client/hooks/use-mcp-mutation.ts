export const useMcpMutation = <T = any>(_toolName?: string, _options?: any) => {
  return {
    mutate: (_args?: any) => {},
    mutateAsync: async (_args?: any) => ({} as T),
    isLoading: false,
    isPending: false,
    data: undefined as T | undefined,
    error: undefined as Error | undefined,
    reset: () => {}
  };
};
