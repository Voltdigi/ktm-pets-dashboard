# KTM Pets Dashboard

A modern, feature-rich dashboard application built with Next.js, React, and Tailwind CSS. The dashboard includes a floating sidebar navigation, dark/light theme toggle, and seamless Airtable integration for data management.

## Features

- **Modern Dashboard UI** - Clean, responsive interface with a floating sidebar
- **Dark/Light Theme Toggle** - System preference detection with localStorage persistence
- **Floating Sidebar Navigation** - Smooth animations and backdrop blur effects
- **Airtable Integration** - Read and write data from Airtable bases
- **TypeScript Support** - Full type safety across the application
- **Responsive Design** - Mobile-first approach with Tailwind CSS
- **Production-Ready Components** - shadcn UI components for consistency

## Tech Stack

- **Framework**: Next.js 16.1.6
- **React**: 19.2.3
- **Styling**: Tailwind CSS v4
- **UI Components**: shadcn/ui, Base UI
- **Icons**: Remixicon
- **Language**: TypeScript
- **API Integration**: Airtable REST API

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn package manager
- Airtable account (optional, for data integration)

### Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd ktm-pets-dashboard
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
```

4. Configure your Airtable credentials in `.env.local`:
```env
NEXT_PUBLIC_AIRTABLE_BASE_ID=your_base_id_here
AIRTABLE_API_KEY=your_personal_access_token_here
```

### Running the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser. You'll be automatically redirected to the dashboard at `/dashboard`.

## Project Structure

```
ktm-pets-dashboard/
├── app/
│   ├── api/
│   │   └── airtable/          # Airtable API routes
│   ├── dashboard/
│   │   └── page.tsx           # Main dashboard page
│   ├── layout.tsx             # Root layout with providers
│   ├── globals.css            # Global styles
│   └── page.tsx               # Redirect to dashboard
├── components/
│   ├── floating-sidebar.tsx   # Navigation sidebar component
│   ├── theme-provider.tsx     # Dark/light mode context
│   ├── theme-toggle.tsx       # Theme toggle button
│   ├── ui/                    # Reusable UI components
│   └── example.tsx            # Example wrapper components
├── hooks/
│   └── useAirtable.ts         # Hook for Airtable data fetching
├── lib/
│   └── utils.ts               # Utility functions
├── .env.local                 # Environment variables (not in git)
└── package.json               # Project dependencies
```

## Airtable Integration

### Setup Airtable Credentials

1. Go to [airtable.com](https://airtable.com) and log in
2. Open your base and find the **Base ID**:
   - Click the `?` icon → API documentation → copy Base ID
3. Create a **Personal Access Token**:
   - Account → Developer hub → Create token
   - Set required scopes: `data.records:read`, `data.records:write`
   - Copy the token to `.env.local`

### Using Airtable Data

#### With the Custom Hook

```typescript
"use client"

import { useAirtable } from "@/hooks/useAirtable"

export function MyComponent() {
  const { data, loading, error } = useAirtable("Table%201")

  if (loading) return <div>Loading...</div>
  if (error) return <div>Error: {error}</div>

  return (
    <div>
      {data.map((record) => (
        <div key={record.id}>{JSON.stringify(record.fields)}</div>
      ))}
    </div>
  )
}
```

#### Direct API Call

```typescript
// Fetch records
const response = await fetch("/api/airtable?table=Table%201")
const { records } = await response.json()

// Create record
const response = await fetch("/api/airtable", {
  method: "POST",
  body: JSON.stringify({
    table: "Table%201",
    fields: { Name: "John", Email: "john@example.com" }
  })
})
```

## Available Scripts

```bash
# Development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linting
npm run lint
```

## Customization

### Theme Colors

Edit the color variables in `app/globals.css`:
```css
:root {
  --primary: oklch(0.4955 0.2369 301.9241);
  --background: oklch(0.9729 0.0693 103.1933);
  /* ... more colors ... */
}

.dark {
  --primary: oklch(0.8606 0.1731 91.9357);
  --background: oklch(0.2827 0.1351 291.0894);
  /* ... more colors ... */
}
```

### Navigation Items

Edit the `navItems` array in `components/floating-sidebar.tsx` to customize sidebar navigation:

```typescript
const navItems: NavItem[] = [
  {
    label: "Dashboard",
    icon: <RiDashboardLine className="w-5 h-5" />,
    href: "#dashboard",
  },
  // Add more items...
]
```

## Components

### FloatingSidebar
- Fixed positioning with smooth animations
- Backdrop blur and responsive backdrop
- Active item indicator
- Badge support for notifications
- Sign out button

### ThemeProvider & ThemeToggle
- Automatic system preference detection
- LocalStorage persistence
- Context-based theme management
- Smooth transitions between themes

### Dashboard
- Responsive header with sticky positioning
- Empty content card ready for your data
- Integrated floating sidebar and theme toggle

## Performance Tips

- The dashboard uses Next.js App Router for optimal code splitting
- Tailwind CSS with Tailwind v4 provides excellent performance
- Components are optimized with proper React hooks usage
- Images are automatically optimized with Next.js Image component

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## Deployment

### Deploy on Vercel (Recommended)

The easiest way to deploy:

```bash
npm install -g vercel
vercel
```

### Environment Variables

Make sure to set the following environment variables in your deployment platform:
- `NEXT_PUBLIC_AIRTABLE_BASE_ID`
- `AIRTABLE_API_KEY`

### Deploy on Other Platforms

You can deploy to any platform that supports Next.js:
- Netlify
- AWS Amplify
- Google Cloud Run
- DigitalOcean App Platform

See [Next.js Deployment Documentation](https://nextjs.org/docs/deployment) for details.

## Troubleshooting

### Theme Toggle Not Working
- Ensure the app is wrapped with `ThemeProvider` in the layout
- Check browser console for errors
- Verify localStorage is enabled

### Airtable Integration Issues
- Verify API key and Base ID in `.env.local`
- Check table names are URL-encoded (spaces become `%20`)
- Ensure personal access token has required scopes
- Check Airtable API rate limits

### Components Not Rendering
- Make sure all imports are correct
- Check for missing `"use client"` directives in client components
- Verify dependencies are installed

## Contributing

Feel free to fork and submit pull requests for any improvements.

## License

MIT License - Feel free to use this project for personal and commercial purposes.

## Support

For issues and questions:
1. Check the [Next.js Documentation](https://nextjs.org/docs)
2. Review [Airtable API Documentation](https://airtable.com/developers/web/api/introduction)
3. Open an issue in the repository

## Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Airtable API Docs](https://airtable.com/developers/web/api)
- [shadcn/ui Components](https://ui.shadcn.com)
- [Remixicon Icons](https://remixicon.com)
