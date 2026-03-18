---
name: react_components
description: How to build React components — patterns, styling with TailwindCSS, state management with Zustand, and routing.
---

# React Components Skill

## Component Pattern

```tsx
import { useState } from 'react';
import { clsx } from 'clsx';

export default function MyComponent({ prop1, prop2 }: { prop1: string; prop2: number }) {
  const [state, setState] = useState(false);

  return (
    <div className="p-4 bg-white rounded-lg shadow">
      {/* Component content */}
    </div>
  );
}
```

## Styling

- **TailwindCSS 3** with `tailwind-merge` for conditional classes
- `clsx` for className composition
- Brand colors defined in `brand-colours.css`
- Global styles in `index.css`
- Typography plugin: `@tailwindcss/typography`

## State Management

### Zustand (Global Auth State)
```typescript
import { useAuthStore } from '../store/authStore';

// In component:
const { user, session, signOut } = useAuthStore();
```

### React Query (Server State)
```typescript
import { useQuery } from '@tanstack/react-query';

const { data, isLoading } = useQuery({
  queryKey: ['myData'],
  queryFn: fetchMyData,
});
```

## Routing

Using `react-router-dom` v7 with routes defined in `App.tsx`.

```tsx
import { useNavigate, useParams } from 'react-router-dom';
```

## Key Components

| Component | Size | Purpose |
|---|---|---|
| `SupportChat.tsx` | 22KB | SSE chat widget with streaming |
| `WeeklyPlanner.tsx` | 55KB | Meal planning with Gemini |
| `AuthScreen.tsx` | 26KB | Login/signup forms |
| `Navbar.tsx` | 12KB | Top navigation |
| `AuthGuard.tsx` | 1KB | Route protection |

## Key Pages

| Page | Size | Purpose |
|---|---|---|
| `Intranet.tsx` | 191KB | Staff dashboard |
| `IntranetManager.tsx` | 155KB | Manager dashboard |
| `Profile.tsx` | 69KB | User profile |
| `Start.tsx` | 49KB | Onboarding form |

## Icons

Using `lucide-react` icon library:

```tsx
import { Settings, User, ChevronRight } from 'lucide-react';
```

## Supabase Auth Integration

```typescript
import { supabase } from '../lib/supabase';

// Get current session
const { data } = await supabase.auth.getSession();
const accessToken = data?.session?.access_token;

// API call with auth
fetch('/api/endpoint', {
  headers: { Authorization: `Bearer ${accessToken}` },
});
```
