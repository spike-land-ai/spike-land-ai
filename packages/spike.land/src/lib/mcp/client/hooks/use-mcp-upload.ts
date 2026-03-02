export const useMcpUpload = (_toolName?: string, _opts?: any) => {
  return {
    upload: async (_file?: File, _args?: any) => "",
    isUploading: false,
    isLoading: false,
    progress: 0
  };
};
