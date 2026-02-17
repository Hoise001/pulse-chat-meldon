import type { TEmojiItem } from '@/components/tiptap-input/types';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { EmojiItem } from '@tiptap/extension-emoji';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ALL_EMOJIS,
  EMOJI_CATEGORIES,
  GROUPED_EMOJIS,
  searchEmojis,
  toTEmojiItem
} from './emoji-data';
import { EmojiButton } from './emoji-grid';
import { useRecentEmojis } from './use-recent-emojis';

const CUSTOM_CATEGORY = { id: 'custom', label: 'Server Emojis', icon: '⭐' };

type TUnifiedEmojiViewProps = {
  customEmojis: EmojiItem[];
  onEmojiSelect: (emoji: TEmojiItem) => void;
};

const UnifiedEmojiView = memo(
  ({ customEmojis, onEmojiSelect }: TUnifiedEmojiViewProps) => {
    const [search, setSearch] = useState('');
    const { recentEmojis, addRecent } = useRecentEmojis();
    const [activeCategory, setActiveCategory] = useState<string>('');
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

    const convertedCustomEmojis = useMemo(
      () => customEmojis.map(toTEmojiItem),
      [customEmojis]
    );

    const hasCustom = convertedCustomEmojis.length > 0;
    const hasRecent = recentEmojis.length > 0;

    const categories = useMemo(() => {
      const cats: { id: string; label: string; icon: string }[] = [];
      if (hasCustom) cats.push(CUSTOM_CATEGORY);
      for (const cat of EMOJI_CATEGORIES) {
        if (cat.id === 'recent' && !hasRecent) continue;
        cats.push(cat);
      }
      return cats;
    }, [hasCustom, hasRecent]);

    const isSearching = search.trim().length > 0;

    const searchResults = useMemo(() => {
      if (!isSearching) return [];
      const allEmojis = [...convertedCustomEmojis, ...ALL_EMOJIS];
      return searchEmojis(allEmojis, search);
    }, [isSearching, search, convertedCustomEmojis]);

    const handleCategoryClick = useCallback((categoryId: string) => {
      const section = sectionRefs.current[categoryId];
      if (section) {
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      setSearch('');
    }, []);

    // Track which section is visible for category bar highlighting
    useEffect(() => {
      const container = scrollContainerRef.current;
      if (!container || isSearching) return;

      const handleScroll = () => {
        const containerTop = container.getBoundingClientRect().top;
        let closestId = '';
        let closestDistance = Infinity;

        for (const cat of categories) {
          const section = sectionRefs.current[cat.id];
          if (section) {
            const sectionTop = section.getBoundingClientRect().top;
            const distance = Math.abs(sectionTop - containerTop);
            if (distance < closestDistance) {
              closestDistance = distance;
              closestId = cat.id;
            }
          }
        }

        if (closestId && closestId !== activeCategory) {
          setActiveCategory(closestId);
        }
      };

      handleScroll();
      container.addEventListener('scroll', handleScroll, { passive: true });
      return () => container.removeEventListener('scroll', handleScroll);
    }, [categories, isSearching, activeCategory]);

    const handleEmojiSelect = useCallback(
      (emoji: TEmojiItem) => {
        onEmojiSelect(emoji);
        requestAnimationFrame(() => addRecent(emoji));
      },
      [onEmojiSelect, addRecent]
    );

    const setSectionRef = useCallback(
      (id: string) => (el: HTMLDivElement | null) => {
        sectionRefs.current[id] = el;
      },
      []
    );

    return (
      <div className="flex flex-col h-full">
        {/* Search */}
        <div className="p-3 border-b">
          <Input
            placeholder="Search emojis..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9"
            autoFocus
          />
        </div>

        {/* Category bar */}
        {!isSearching && (
          <div className="flex gap-1 px-3 py-1.5 border-b bg-muted/30">
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => handleCategoryClick(cat.id)}
                className={cn(
                  'w-7 h-7 flex items-center justify-center rounded-md text-base transition-colors cursor-pointer',
                  activeCategory === cat.id
                    ? 'bg-accent text-accent-foreground'
                    : 'hover:bg-accent/50'
                )}
                title={cat.label}
              >
                {cat.icon}
              </button>
            ))}
          </div>
        )}

        {/* Scrollable emoji sections */}
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto min-h-0"
        >
          {isSearching ? (
            <div>
              <div className="px-3 py-2 text-xs font-medium text-muted-foreground">
                Search results ({searchResults.length})
              </div>
              {searchResults.length > 0 ? (
                <div className="grid grid-cols-8 gap-1 px-3 pb-3">
                  {searchResults.map((emoji) => (
                    <EmojiButton
                      key={emoji.name}
                      emoji={emoji}
                      onSelect={handleEmojiSelect}
                    />
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
                  No emojis found
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Custom / Server emojis */}
              {hasCustom && (
                <div ref={setSectionRef('custom')}>
                  <div className="px-3 py-2 text-xs font-medium text-muted-foreground sticky top-0 bg-popover z-10">
                    Server Emojis
                  </div>
                  <div className="grid grid-cols-8 gap-1 px-3 pb-2">
                    {convertedCustomEmojis.map((emoji) => (
                      <EmojiButton
                        key={emoji.name}
                        emoji={emoji}
                        onSelect={handleEmojiSelect}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Recent */}
              {hasRecent && (
                <div ref={setSectionRef('recent')}>
                  <div className="px-3 py-2 text-xs font-medium text-muted-foreground sticky top-0 bg-popover z-10">
                    Recent
                  </div>
                  <div className="grid grid-cols-8 gap-1 px-3 pb-2">
                    {recentEmojis.map((emoji) => (
                      <EmojiButton
                        key={emoji.name}
                        emoji={emoji}
                        onSelect={handleEmojiSelect}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Standard categories */}
              {EMOJI_CATEGORIES.filter((c) => c.id !== 'recent').map(
                (category) => {
                  const emojis = GROUPED_EMOJIS[category.id] || [];
                  if (emojis.length === 0) return null;
                  return (
                    <div key={category.id} ref={setSectionRef(category.id)}>
                      <div className="px-3 py-2 text-xs font-medium text-muted-foreground sticky top-0 bg-popover z-10">
                        {category.label}
                      </div>
                      <div className="grid grid-cols-8 gap-1 px-3 pb-2">
                        {emojis.map((emoji) => (
                          <EmojiButton
                            key={emoji.name}
                            emoji={emoji}
                            onSelect={handleEmojiSelect}
                          />
                        ))}
                      </div>
                    </div>
                  );
                }
              )}
            </>
          )}
        </div>
      </div>
    );
  }
);

UnifiedEmojiView.displayName = 'UnifiedEmojiView';

export { UnifiedEmojiView };
