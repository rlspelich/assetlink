import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listAttachments, uploadAttachment, deleteAttachment } from '../api/attachments';

export function useAttachments(entityType: string, entityId: string | undefined) {
  return useQuery({
    queryKey: ['attachments', entityType, entityId],
    queryFn: () => listAttachments(entityType, entityId!),
    enabled: !!entityId,
  });
}

export function useUploadAttachment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      file,
      entityType,
      entityId,
      attachmentType,
    }: {
      file: File;
      entityType: string;
      entityId: string;
      attachmentType?: string;
    }) => uploadAttachment(file, entityType, entityId, attachmentType),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['attachments', variables.entityType, variables.entityId],
      });
    },
    onError: (error: Error) => {
      console.error('Failed to upload attachment:', error.message);
    },
  });
}

export function useDeleteAttachment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteAttachment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attachments'] });
    },
    onError: (error: Error) => {
      console.error('Failed to delete attachment:', error.message);
    },
  });
}
