# Coding Standards

## ESLint & Prettier
- **Prettier** acts as the single source of truth for code formatting (2 spaces, single quotes, trailing commas).
- **ESLint** enforces code quality (no unused variables, no `any` types in TS, React hooks exhaustiveness).
- Pre-commit hooks via **Husky** and **lint-staged** guarantee these rules are run automatically.

## TypeScript
- `strict` mode is enabled in `tsconfig.json`.
- Do NOT use `any`. Use `unknown` if the type is truly dynamic, or create explicit interfaces.
- Always type React component props using `interface` instead of `type`.

## React Specifics
- **Arrow Functions**: Use `const Component = () => {}` over `function Component() {}` for consistency.
- **Destructuring**: Always destructure props in the function signature.
- **Dependency Arrays**: Never lie to the React `useEffect` dependency array. If an exhaustive deps warning appears, refactor the logic rather than disabling the rule.
