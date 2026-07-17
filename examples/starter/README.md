# Kanji Starter Example

This is a minimal blank starter project for **Kanji Framework**. It demonstrates how to initialize a server, define controllers, and enforce contract validation without database dependencies.

## Setup

1. Install dependencies from the project root:
   ```bash
   pnpm install
   ```

2. Run development server:
   ```bash
   bun run dev
   ```

3. Test the server is running:
   ```bash
   curl -I http://localhost:3000/
   # Returns 404 (indicating the server is alive and listening)
   ```

4. Test contract validation:
   ```bash
   curl http://localhost:3000/hello?name=Kanji
   # Returns: {"message":"Hello, Kanji!"}
   ```
