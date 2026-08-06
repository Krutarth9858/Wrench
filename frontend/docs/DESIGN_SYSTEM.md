# Wrench Design System

## Philosophy
The Wrench aesthetic mirrors tier-1 professional startups (e.g., Stripe, Linear, Airbnb). 
It must communicate: **"Help is already on the way."**
The primary emotions are trust, reliability, and speed. We avoid flashy cyberpunk tropes in favor of grounded, realistic interfaces.

## Colors
We use a customized Slate palette in Tailwind.
- **Background**: `bg-slate-900` (`#0F172A`)
- **Surface**: `bg-slate-800` (`#1E293B`)
- **Cards**: `bg-slate-700` (`#334155`)
- **Primary Accent**: `bg-blue-600` (`#2563EB`)
- **Text Primary**: `text-slate-50` (`#F8FAFC`)
- **Text Secondary**: `text-slate-300` (`#CBD5E1`)
- **Success**: `text-green-500` (`#22C55E`)
- **Warning**: `text-amber-500` (`#F59E0B`)
- **Danger**: `text-red-500` (`#EF4444`)

## Typography
- **Primary Font**: `Inter` (sans-serif)
- **Headings**: Use `font-light` with tight tracking (`tracking-tight`) for large marketing headers.
- **Body**: Use `text-slate-400` with `leading-relaxed` for readable paragraph text.

## Shapes & Shadows
- **Borders**: Minimal usage. Use `border-slate-800` for structural separation.
- **Radii**: `rounded-2xl` for large cards, `rounded-lg` for inner items, `rounded-full` for primary action buttons.
- **Shadows**: Soft, colored shadows for primary actions (e.g., `shadow-[0_4px_14px_rgba(37,99,235,0.39)]`). Avoid hard drop-shadows.

## Glassmorphism
Use sparingly for the highest-tier UI elements overlaying the cinematic background:
```css
bg-slate-900/60 backdrop-blur-2xl border-slate-700/60
```
