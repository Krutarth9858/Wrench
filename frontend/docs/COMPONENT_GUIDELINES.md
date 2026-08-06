# Component Guidelines

## Folder Architecture
- `src/components/ui`: Pure, dumb components (e.g., `Button`, `Input`). These components must NOT contain business logic or API calls. They accept props and emit events.
- `src/components/features`: Domain-specific components (e.g., `VehicleCard`, `MechanicTracker`). These can be tied to Zustand stores or React Query hooks.
- `src/components/layout`: Structural scaffolding (e.g., `Navbar`, `Footer`, `Sidebar`).
- `src/components/sections`: Marketing page segments mapped to the scroll timeline.

## Best Practices
1. **Use `twMerge` and `clsx`**: All UI components must accept a `className` prop and merge it properly using the `cn()` utility in `src/lib/utils.ts`.
2. **Prop Delegation**: Always forward standard HTML attributes using `React.HTMLAttributes<T>` and `forwardRef`.
3. **No Unnecessary State**: Prefer deriving state from props. Use Zustand only for truly global state (e.g., active user session).
