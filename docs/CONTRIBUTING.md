# Contributing Guide

Hvala što želite da doprinesete CRM projektu! 🎉

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Testing Requirements](#testing-requirements)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)
- [Issue Guidelines](#issue-guidelines)

---

## Code of Conduct

### Naši Standardi

- ✅ Budite respektful prema svim kontributorima
- ✅ Pružajte i prihvatajte konstruktivnu kritiku
- ✅ Fokusirajte se na ono što je najbolje za zajednicu
- ✅ Pokažite empatiju prema drugim članovima zajednice

### Neprihvatljivo Ponašanje

- ❌ Uvrede, vređanje ili ponižavajući komentari
- ❌ Trolling ili neprikladni komentari
- ❌ Harassment u bilo kom obliku
- ❌ Objavljivanje privatnih informacija drugih

**Prijavite:** security@crm.example.com

---

## Getting Started

### 1. Fork Repository

```bash
# Fork na GitHub-u, zatim:
git clone https://github.com/YOUR_USERNAME/crm-monorepo.git
cd crm-monorepo
git remote add upstream https://github.com/ORIGINAL_OWNER/crm-monorepo.git
```

### 2. Setup Development Environment

Pročitajte [SETUP.md](./SETUP.md) za detaljna uputstva.

Quick setup:
```bash
bun install
docker-compose up -d
cd apps/api-server && bun run db:setup
bun run dev
```

### 3. Create Feature Branch

```bash
git checkout -b feature/your-feature-name
```

Branch naming conventions:
- `feature/` - Nova feature
- `fix/` - Bug fix
- `docs/` - Dokumentacija
- `refactor/` - Refactoring koda
- `test/` - Dodavanje testova
- `chore/` - Maintenance taskovi

---

## Development Workflow

### 1. Sync sa Upstream

Pre nego što počnete rad, uvek sync-ujte sa upstream:

```bash
git fetch upstream
git checkout main
git merge upstream/main
git push origin main
```

### 2. Develop Feature

```bash
# Create branch
git checkout -b feature/awesome-feature

# Make changes
# ... edit files ...

# Run tests
bun test

# Check types
bun run typecheck

# Lint and format
bun run check
```

### 3. Commit Changes

```bash
git add .
git commit -m "feat: add awesome feature"
```

### 4. Push to Fork

```bash
git push origin feature/awesome-feature
```

### 5. Create Pull Request

- Idite na GitHub
- Click "New Pull Request"
- Popunite template
- Wait for review

---

## Coding Standards

### TypeScript

- ✅ **Strict mode** enabled
- ✅ **No `any`** types (use `unknown` ako morate)
- ✅ **Prefer interfaces** over types za objekte
- ✅ **Export types** for public APIs

```typescript
// Good ✅
interface User {
  id: string;
  email: string;
  role: UserRole;
}

export function getUser(id: string): Promise<User> {
  // ...
}

// Bad ❌
export function getUser(id: any): Promise<any> {
  // ...
}
```

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Files | kebab-case | `user-service.ts` |
| Components | PascalCase | `UserProfile.tsx` |
| Functions | camelCase | `getUserById()` |
| Constants | UPPER_SNAKE_CASE | `MAX_RETRY_COUNT` |
| Interfaces | PascalCase | `UserData` |
| Types | PascalCase | `UserId` |

### File Organization

```typescript
// 1. Imports (external first, then internal)
import { useState } from 'react';
import { apiClient } from '@/lib/api';

// 2. Types/Interfaces
interface Props {
  userId: string;
}

// 3. Constants
const MAX_ITEMS = 100;

// 4. Component/Function
export function Component({ userId }: Props) {
  // ...
}

// 5. Helpers (if small, otherwise separate file)
function helperFunction() {
  // ...
}
```

### Code Style

We use **Biome** for formatting and linting.

```bash
# Auto-format on save (VS Code)
# or manually:
bun run format

# Check for issues
bun run lint
```

**Key rules**:
- 2 spaces indentation
- Single quotes for strings
- Trailing commas
- No semicolons (optional)
- 100 character line length

---

## Testing Requirements

### Coverage Requirements

- **Unit Tests**: 70%+ coverage za nove fajlove
- **Integration Tests**: Za sve nove endpoints
- **E2E Tests**: Za critical user flows

### Writing Tests

#### Unit Tests

```typescript
// user-service.test.ts
import { describe, it, expect } from 'vitest';
import { getUserById } from './user-service';

describe('getUserById', () => {
  it('should return user when found', async () => {
    const user = await getUserById('user-123');
    expect(user).toBeDefined();
    expect(user.id).toBe('user-123');
  });

  it('should throw error when not found', async () => {
    await expect(getUserById('invalid')).rejects.toThrow();
  });
});
```

#### Integration Tests

```typescript
// users.test.ts
import { describe, it, expect } from 'vitest';
import { callRoute } from '../test-helpers';

describe('GET /api/v1/users', () => {
  it('should return list of users', async () => {
    const response = await callRoute('/api/v1/users');
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(Array.isArray(data.data)).toBe(true);
  });
});
```

### Running Tests

```bash
# All tests
bun test

# Specific file
bun test user-service.test.ts

# Watch mode
bun test:watch

# Coverage
bun test:coverage
```

---

## Commit Guidelines

Mi koristimo **Conventional Commits** format:

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

| Type | Description | Example |
|------|-------------|---------|
| `feat` | Nova feature | `feat(auth): add 2FA support` |
| `fix` | Bug fix | `fix(api): resolve null pointer error` |
| `docs` | Documentation | `docs(readme): update setup instructions` |
| `style` | Formatting | `style(api): format code with biome` |
| `refactor` | Code restructure | `refactor(db): optimize query performance` |
| `test` | Add/update tests | `test(auth): add JWT validation tests` |
| `chore` | Maintenance | `chore(deps): update dependencies` |
| `perf` | Performance | `perf(api): cache user queries` |

### Examples

```bash
# Simple commit
git commit -m "feat(users): add user search endpoint"

# With body
git commit -m "fix(auth): resolve token expiration issue

The JWT tokens were expiring too quickly due to incorrect
calculation. This fixes the issue by using proper time units."

# Breaking change
git commit -m "feat(api)!: change user response format

BREAKING CHANGE: User API now returns camelCase instead of snake_case"
```

### Rules

- ✅ Use present tense ("add" not "added")
- ✅ Use imperative mood ("move" not "moves")
- ✅ First line max 72 characters
- ✅ Reference issues: `closes #123`
- ✅ Explain **why**, not just **what**

---

## Pull Request Process

### 1. Before Creating PR

- [ ] All tests pass (`bun test`)
- [ ] Type check passes (`bun run typecheck`)
- [ ] Linting passes (`bun run lint`)
- [ ] Coverage maintained/improved
- [ ] Dokumentacija ažurirana (ako je potrebno)
- [ ] CHANGELOG.md updated (ako je značajan feature)

### 2. PR Title

Use conventional commit format:

```
feat(api): add user export endpoint
```

### 3. PR Description Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix (non-breaking)
- [ ] New feature (non-breaking)
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing performed

## Screenshots (if applicable)
[Add screenshots here]

## Checklist
- [ ] Code follows project style guidelines
- [ ] Self-review performed
- [ ] Comments added for complex logic
- [ ] Documentation updated
- [ ] No new warnings generated
- [ ] Tests pass locally
- [ ] Dependent changes merged

## Related Issues
Closes #123
```

### 4. Review Process

1. **Automated Checks**
   - CI/CD pipeline runs
   - Tests must pass
   - Linting must pass
   - Type checking must pass

2. **Code Review**
   - At least 1 approval required
   - Address all review comments
   - Keep discussion professional

3. **Merge**
   - Use "Squash and merge" za clean history
   - Delete branch after merge

### 5. After Merge

```bash
# Sync your fork
git checkout main
git pull upstream main
git push origin main

# Delete feature branch
git branch -d feature/awesome-feature
git push origin --delete feature/awesome-feature
```

---

## Issue Guidelines

### Before Creating Issue

1. Search existing issues
2. Check [documentation](./README.md)
3. Try to reproduce consistently

### Bug Report Template

```markdown
## Bug Description
Clear description of the bug

## Steps to Reproduce
1. Go to '...'
2. Click on '...'
3. See error

## Expected Behavior
What should happen

## Actual Behavior
What actually happens

## Environment
- OS: [e.g., macOS 14]
- Bun version: [e.g., 1.1.0]
- Browser: [e.g., Chrome 120]

## Screenshots
If applicable

## Additional Context
Any other information
```

### Feature Request Template

```markdown
## Feature Description
Clear description of the feature

## Problem It Solves
Why this feature is needed

## Proposed Solution
How you think it should work

## Alternatives Considered
Other solutions you've thought about

## Additional Context
Mockups, examples, etc.
```

### Issue Labels

| Label | Description |
|-------|-------------|
| `bug` | Something isn't working |
| `feature` | New feature request |
| `documentation` | Improvements to docs |
| `good first issue` | Good for newcomers |
| `help wanted` | Extra attention needed |
| `priority: high` | High priority |
| `wontfix` | Won't be fixed |

---

## Development Tips

### Hot Reloading

Bun automatically reloads on file changes:

```bash
bun run dev  # Watch mode enabled
```

### Database Changes

When changing schema:

```bash
# 1. Update schema in db/schema/
# 2. Generate migration
bun run db:generate

# 3. Apply migration
bun run db:push

# 4. Update seed if needed
# 5. Test locally
bun run db:setup
```

### Debugging

#### VS Code

Use launch configurations:

```json
{
  "type": "node",
  "request": "launch",
  "name": "Debug Tests",
  "runtimeExecutable": "bun",
  "runtimeArgs": ["test", "--inspect-brk"],
  "console": "integratedTerminal"
}
```

#### Backend

Add breakpoints or `console.log`:

```typescript
logger.debug({ userId, data }, 'Processing request');
```

#### Frontend

Use React DevTools:

```bash
# Install React DevTools extension
# or use browser console
```

### Performance Tips

- Use `React.memo()` za expensive components
- Debounce user input
- Lazy load routes sa Next.js
- Optimize database queries
- Cache frequently accessed data

---

## Getting Help

### Resources

- **Documentation**: [/docs](./README.md)
- **API Reference**: [API.md](./API.md)
- **Architecture**: [ARCHITECTURE.md](./ARCHITECTURE.md)
- **Setup Guide**: [SETUP.md](./SETUP.md)

### Community

- **Discord**: [Join server](#) *(coming soon)*
- **Forum**: [Discussions](#) *(coming soon)*
- **Email**: dev@crm.example.com

### Office Hours

Weekly developer office hours:
- **When**: Thursdays 2-4 PM CET
- **Where**: Zoom (link in Discord)
- **What**: Q&A, pair programming, code review

---

## Recognition

Contributors will be:
- Added to [CONTRIBUTORS.md](./CONTRIBUTORS.md)
- Mentioned in release notes
- Credited in documentation

Top contributors may receive:
- Commit access
- Maintainer status
- Conference speaking opportunities

---

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

## Questions?

Imate pitanja? Kontaktirajte:
- Email: dev@crm.example.com
- Discord: [Join our server](#)
- GitHub: [Open discussion](#)

**Thank you for contributing!** 🙏

---

**Last Updated**: 2025-12-01
