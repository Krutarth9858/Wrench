# Accessibility Guidelines

## Core Principles
Wrench is an emergency service platform. In a moment of panic, users may be visually impaired, distressed, or using assistive technologies. We must adhere strictly to WCAG 2.1 AA standards.

## Practices
1. **Semantic HTML**: Always use `<button>` for clickable actions, `<a>` for navigation, and proper `<main>`, `<nav>`, `<section>` wrappers.
2. **Keyboard Navigation**: Ensure every interactive element is reachable via the `Tab` key. Custom components MUST implement `:focus-visible` outlines (e.g., `focus-visible:ring-2 focus-visible:ring-blue-500`).
3. **ARIA Labels**: If a button contains only an icon, it must have an `aria-label` describing the action.
4. **Color Contrast**: Do not rely purely on color to convey meaning (e.g., use an icon alongside a red error state). 
5. **Reduced Motion**: Respect `prefers-reduced-motion` CSS media queries. If a user has animations disabled at the OS level, disable heavy GSAP scrubbing.
