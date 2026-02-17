import type { TEmojiItem } from '@/components/tiptap-input/types';
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover';
import { useCustomEmojis } from '@/features/server/emojis/hooks';
import { memo, useCallback, useState } from 'react';
import { UnifiedEmojiView } from './unified-emoji-view';

type TEmojiPickerProps = {
  children: React.ReactNode;
  onEmojiSelect: (emoji: TEmojiItem) => void;
};

const EmojiPicker = memo(({ children, onEmojiSelect }: TEmojiPickerProps) => {
  const [open, setOpen] = useState(false);
  const customEmojis = useCustomEmojis();

  const handleEmojiSelect = useCallback(
    (emoji: TEmojiItem) => {
      onEmojiSelect(emoji);
      setOpen(false);
    },
    [onEmojiSelect]
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        className="w-[350px] p-0 h-[420px]"
        align="start"
        sideOffset={8}
      >
        <UnifiedEmojiView
          customEmojis={customEmojis}
          onEmojiSelect={handleEmojiSelect}
        />
      </PopoverContent>
    </Popover>
  );
});

EmojiPicker.displayName = 'EmojiPicker';

export { EmojiPicker };
