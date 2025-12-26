import { useState } from "react";

export const useRatingModals = () => {
  const [isChangePreviewOpen, setIsChangePreviewOpen] = useState(false);
  const [deletePopoverOpen, setDeletePopoverOpen] = useState<string | null>(
    null
  );

  const handleOpenChangePreview = (open: boolean) => {
    setIsChangePreviewOpen(open);
  };

  const handleDeletePopoverChange = (ratingId: string | null) => {
    setDeletePopoverOpen(ratingId);
  };

  return {
    isChangePreviewOpen,
    deletePopoverOpen,
    handleOpenChangePreview,
    handleDeletePopoverChange,
  };
};
