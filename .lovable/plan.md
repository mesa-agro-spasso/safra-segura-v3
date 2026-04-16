

# Replace option premium catch block in MTM.tsx

Single edit in `src/pages/MTM.tsx`: replace the silent `catch` block with one that shows a toast error with the error details.

## Change
- File: `src/pages/MTM.tsx`
- Find the `catch` block (~line 80) that silently swallows option premium errors
- Replace with `catch (optErr)` that calls `toast.error` with the formatted error message

