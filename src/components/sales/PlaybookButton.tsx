import React from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PlaybookButtonProps {
  onClick: () => void;
  className?: string;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  showLabel?: boolean;
}

export function PlaybookButton({
  onClick,
  className,
  variant = 'outline',
  size = 'default',
  showLabel = true,
}: PlaybookButtonProps) {
  if (size === 'icon') {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={variant}
            size="icon"
            className={className}
            onClick={onClick}
          >
            <BookOpen className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Playbook</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Button
      variant={variant}
      size={size}
      className={cn('gap-2', className)}
      onClick={onClick}
    >
      <BookOpen className="h-4 w-4" />
      {showLabel && 'Playbook'}
    </Button>
  );
}
