# Performance Guidelines

## Optimization Strategies
1. **Bundle Size**: We use `rollup-plugin-visualizer` to monitor bundle size. Avoid pulling in massive monolithic libraries (e.g., use `lucide-react` icons individually, use `date-fns` instead of `moment`).
2. **Code Splitting**: Use `React.lazy()` for heavy components or routes that aren't visible above the fold.
3. **Canvas Rendering**: The `VideoScrubber` uses a raw `<canvas>` rather than `<video>` elements to ensure buttery 60fps scrubbing without keyframe decoding lag on mobile devices.
4. **Image Optimization**: Vite handles asset hashing, but ensure all raw image assets are compressed (WebP preferred).
5. **Re-rendering**: Prevent unnecessary React re-renders by lifting state down, or using `useMemo`/`useCallback` for complex calculations and prop passing to expensive child components.
