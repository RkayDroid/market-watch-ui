import type { ReactElement } from 'react';
import { Box, Button } from '@mui/material';
import BookmarksOutlinedIcon from '@mui/icons-material/BookmarksOutlined';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import { APP_VIEWS, type AppView } from '../types/view.ts';

export interface AppNavProps {
  current: AppView;
  onChange: (view: AppView) => void;
}

const ICONS: Record<AppView, ReactElement> = {
  analysis: <ShowChartIcon fontSize="small" />,
  watchlist: <BookmarksOutlinedIcon fontSize="small" />,
};

/** Header menu: one button per top-level view, the current one filled so it reads as selected. */
export default function AppNav({ current, onChange }: AppNavProps) {
  return (
    <Box component="nav" aria-label="Main" data-testid="app-nav" sx={{ display: 'flex', gap: 0.5 }}>
      {APP_VIEWS.map((view) => {
        const selected = view.id === current;
        return (
          <Button
            key={view.id}
            size="small"
            color="inherit"
            variant={selected ? 'outlined' : 'text'}
            startIcon={ICONS[view.id]}
            onClick={() => onChange(view.id)}
            aria-current={selected ? 'page' : undefined}
            data-testid={`nav-${view.id}`}
            sx={{
              fontWeight: 700,
              whiteSpace: 'nowrap',
              borderColor: selected ? 'rgba(255,255,255,0.5)' : 'transparent',
              bgcolor: selected ? 'rgba(255,255,255,0.12)' : 'transparent',
              '&:hover': { bgcolor: 'rgba(255,255,255,0.2)', borderColor: selected ? 'common.white' : 'transparent' },
            }}
          >
            {view.label}
          </Button>
        );
      })}
    </Box>
  );
}
