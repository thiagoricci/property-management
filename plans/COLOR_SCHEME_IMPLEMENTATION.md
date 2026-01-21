# Color Scheme Implementation Plan

## Overview

Replace the current HSL-based color scheme with a sophisticated OKLCH color palette that includes:

- Light and dark mode color variables
- Chart colors for data visualization
- Sidebar-specific colors
- Custom font families (Poppins, Libre Baskerville, IBM Plex Mono)
- Advanced shadow definitions
- Rounded radius variables

## Changes Required

### 1. Update globals.css

**Location**: `dashboard/src/app/globals.css`

**Changes**:

- Replace existing `:root` and `.dark` CSS variables with OKLCH color scheme
- Add `@theme inline` section for Tailwind integration
- Keep existing `@layer base` with `*` and `body` styles

**Key differences**:

- Color format changes from HSL to OKLCH
- Additional variables: chart-1 through chart-5, sidebar colors, shadows
- Font family variables added
- Shadow system with multiple sizes (2xs through 2xl)

### 2. Update tailwind.config.ts

**Location**: `dashboard/tailwind.config.ts`

**Changes**:

- Replace `hsl()` with `oklch()` wrapper for all color definitions
- Add new color categories:
  - `chart-1` through `chart-5`
  - `sidebar`, `sidebar-foreground`, `sidebar-primary`, `sidebar-primary-foreground`
  - `sidebar-accent`, `sidebar-accent-foreground`, `sidebar-border`, `sidebar-ring`
- Add shadow definitions (shadow-2xs through shadow-2xl)
- Add font family definitions (sans, serif, mono)

### 3. Update layout.tsx

**Location**: `dashboard/src/app/layout.tsx`

**Changes**:

- Remove Inter font import
- Add Google Font imports for:
  - Poppins (sans-serif)
  - Libre Baskerville (serif)
  - IBM Plex Mono (monospace)
- Update body className to use Poppins by default

## Implementation Order

1. **Step 1**: Update globals.css with new OKLCH color variables
2. **Step 2**: Update tailwind.config.ts to use oklch() and add new colors
3. **Step 3**: Update layout.tsx with new font imports
4. **Step 4**: Verify the implementation works correctly

## Benefits of OKLCH Color Space

- **Perceptual Uniformity**: Colors appear more consistent across different lightness levels
- **Better Color Control**: More precise control over color perception
- **Modern Standard**: OKLCH is becoming the preferred color space for web design
- **Accessibility**: Better color contrast ratios are easier to achieve

## Font Family Rationale

- **Poppins**: Modern, geometric sans-serif for UI elements and body text
- **Libre Baskerville**: Classic serif for headings and emphasis
- **IBM Plex Mono**: Monospace for code, data, and technical content

## Shadow System

The new shadow system provides multiple sizes:

- `shadow-2xs`: Subtle, barely visible
- `shadow-xs`: Very light shadow
- `shadow-sm`: Small shadow for cards
- `shadow`: Default shadow
- `shadow-md`: Medium shadow
- `shadow-lg`: Large shadow
- `shadow-xl`: Extra large shadow
- `shadow-2xl`: Maximum shadow for dramatic effects

## Testing Checklist

After implementation, verify:

- [ ] Light mode colors display correctly
- [ ] Dark mode colors display correctly
- [ ] Color contrast meets accessibility standards
- [ ] Fonts load correctly
- [ ] Shadows render properly
- [ ] Chart colors are available for use
- [ ] Sidebar colors work in sidebar components
- [ ] No console errors related to colors

## Notes

- The new color scheme uses a warm, sophisticated palette with terracotta/brown tones
- Primary color shifts from blue to warm terracotta in both light and dark modes
- Chart colors provide a harmonious palette for data visualization
- Shadow system uses warm undertone (hsl(0 63% 18%)) for consistency
