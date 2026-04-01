import { useState, useRef } from 'react';
import { Camera, Trash2, Loader2, X, Image as ImageIcon, Upload } from 'lucide-react';
import { useAttachments, useUploadAttachment, useDeleteAttachment } from '../../hooks/use-attachments';
import { getAttachmentUrl } from '../../api/attachments';
import type { Attachment } from '../../api/types';

interface PhotoGalleryProps {
  entityType: string;
  entityId: string;
  /** Compact mode: inline in detail panel. Full mode: larger grid. */
  compact?: boolean;
}

export function PhotoGallery({ entityType, entityId, compact = true }: PhotoGalleryProps) {
  const { data, isLoading } = useAttachments(entityType, entityId);
  const uploadMutation = useUploadAttachment();
  const deleteMutation = useDeleteAttachment();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [viewingPhoto, setViewingPhoto] = useState<Attachment | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const photos = data?.attachments?.filter(a => a.attachment_type === 'photo') ?? [];

  const handleFileSelect = async (files: FileList | null) => {
    if (!files) return;
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue;
      try {
        await uploadMutation.mutateAsync({
          file,
          entityType,
          entityId,
          attachmentType: 'photo',
        });
      } catch {
        // Error handled by mutation
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const handleDelete = async (attachmentId: string) => {
    await deleteMutation.mutateAsync(attachmentId);
    setConfirmDeleteId(null);
    if (viewingPhoto?.attachment_id === attachmentId) {
      setViewingPhoto(null);
    }
  };

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h4 className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
          <Camera size={14} />
          Photos
          {photos.length > 0 && (
            <span className="bg-gray-100 text-gray-600 rounded-full px-1.5 py-0.5 text-[10px] font-medium">
              {photos.length}
            </span>
          )}
        </h4>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadMutation.isPending}
          className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-blue-600 hover:bg-blue-50 rounded transition-colors disabled:opacity-50"
        >
          {uploadMutation.isPending ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <Upload size={12} />
          )}
          Upload
        </button>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleFileSelect(e.target.files)}
      />

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-4">
          <Loader2 size={16} className="animate-spin text-gray-400" />
        </div>
      )}

      {/* Empty state / drop zone */}
      {!isLoading && photos.length === 0 && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
            dragOver
              ? 'border-blue-400 bg-blue-50'
              : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
          }`}
        >
          <ImageIcon size={20} className="mx-auto text-gray-300 mb-1" />
          <p className="text-[11px] text-gray-400">
            Drop photos here or click to upload
          </p>
        </div>
      )}

      {/* Photo grid */}
      {photos.length > 0 && (
        <div
          className={`grid gap-1.5 ${compact ? 'grid-cols-3' : 'grid-cols-4'}`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          {photos.map((photo) => (
            <div
              key={photo.attachment_id}
              className="relative group aspect-square rounded-lg overflow-hidden bg-gray-100 cursor-pointer"
              onClick={() => setViewingPhoto(photo)}
            >
              <img
                src={getAttachmentUrl(photo)}
                alt={photo.title || photo.file_name}
                className="w-full h-full object-cover"
                loading="lazy"
              />
              {/* Delete overlay */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-start justify-end p-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setConfirmDeleteId(photo.attachment_id);
                  }}
                  aria-label="Delete photo"
                  className="opacity-0 group-hover:opacity-100 p-1 rounded bg-black/50 text-white hover:bg-red-600 transition-all"
                >
                  <Trash2 size={10} />
                </button>
              </div>
            </div>
          ))}

          {/* Upload more tile */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className={`aspect-square rounded-lg border-2 border-dashed border-gray-200 flex items-center justify-center cursor-pointer hover:border-gray-300 hover:bg-gray-50 transition-colors ${
              dragOver ? 'border-blue-400 bg-blue-50' : ''
            }`}
          >
            {uploadMutation.isPending ? (
              <Loader2 size={16} className="animate-spin text-gray-400" />
            ) : (
              <Camera size={16} className="text-gray-300" />
            )}
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {confirmDeleteId && (
        <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-[11px] text-red-800 mb-2">Delete this photo?</p>
          <div className="flex gap-2">
            <button
              onClick={() => setConfirmDeleteId(null)}
              className="flex-1 px-2 py-1 text-[11px] border border-gray-200 rounded bg-white text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={() => handleDelete(confirmDeleteId)}
              disabled={deleteMutation.isPending}
              className="flex-1 px-2 py-1 text-[11px] bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </div>
      )}

      {/* Full-size viewer overlay */}
      {viewingPhoto && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-8"
          onClick={() => setViewingPhoto(null)}
        >
          <button
            onClick={() => setViewingPhoto(null)}
            aria-label="Close photo viewer"
            className="absolute top-4 right-4 p-2 rounded-full bg-black/50 text-white hover:bg-black/70"
          >
            <X size={20} />
          </button>
          <img
            src={getAttachmentUrl(viewingPhoto)}
            alt={viewingPhoto.title || viewingPhoto.file_name}
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/50 text-white px-4 py-2 rounded-lg text-sm">
            {viewingPhoto.file_name}
            {viewingPhoto.file_size_bytes && (
              <span className="ml-2 text-gray-300">
                ({(viewingPhoto.file_size_bytes / 1024).toFixed(0)} KB)
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
