import { useRef } from 'react';

interface UseFileUploadOptions {
  multiple?: boolean;
  accept?: string;
  onFilesSelected: (files: File | File[]) => void;
}

export function useFileUpload({ multiple = false, onFilesSelected }: UseFileUploadOptions) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClick = () => inputRef.current?.click();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;

    if (multiple) {
      onFilesSelected(Array.from(e.target.files));
    } else {
      onFilesSelected(e.target.files[0]);
    }
    e.target.value = '';
  };

  return {
    inputRef,
    handleClick,
    handleChange,
  };
}
