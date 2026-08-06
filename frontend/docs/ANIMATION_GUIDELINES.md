# Animation Guidelines

## Philosophy
Motion should feel intentional, frictionless, and Apple-like. 
Animations must NEVER obstruct the user or force them to wait unnecessarily.

## Scroll Animations (GSAP)
- **Use `ScrollTrigger`**: Bind heavy transitions (like the phone sliding in) directly to the scrollbar using `scrub: true`. This makes the page feel physical.
- **Pinning**: Use `pin: true` to hold structural elements (like the device mockup) in place while their internal content transitions.
- **Cleanup**: ALWAYS use `gsap.context()` inside a `useEffect` and `ctx.revert()` on unmount to prevent memory leaks in React.

## Micro-interactions (Tailwind & Framer Motion)
- **Hover States**: Elements should lift slightly (`hover:-translate-y-0.5` or `hover:scale-[1.02]`) and increase their shadow intensity.
- **Durations**: Standard micro-interactions take `150ms` to `300ms` (`duration-300`).
- **Easing**: Default to Tailwind's `ease-out`. For GSAP, use `power3.out`. Avoid linear easings unless for constant spinners.
- **Staggering**: When revealing lists or chat bubbles, stagger the entry by `0.1s` to create a cascading effect.
