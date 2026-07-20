# Contributing to OpenSignature

Thank you for your interest in contributing to OpenSignature! This document provides guidelines and information for contributors.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Code Style](#code-style)
- [Testing](#testing)
- [Pull Request Process](#pull-request-process)
- [Issue Guidelines](#issue-guidelines)
- [Community](#community)

## Code of Conduct

We expect all contributors to:
- Be respectful and inclusive
- Use welcoming and inclusive language
- Focus on what is best for the community
- Show empathy towards other community members

## Getting Started

### Prerequisites

- Node.js 18+ and npm 9+
- PostgreSQL 14+
- Redis 7+
- Git

### Setup

1. Fork the repository on GitHub

2. Clone your fork locally:
```bash
git clone https://github.com/your-username/open-signature.git
cd open-signature
```

3. Add upstream remote:
```bash
git remote add upstream https://github.com/your-org/open-signature.git
```

4. Install dependencies:
```bash
npm run install-all
```

5. Set up environment:
```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
# Edit .env files with your configuration
```

6. Initialize database:
```bash
cd backend
npm run db:init
```

7. Start development servers:
```bash
npm run dev
```

## Development Workflow

### Branch Naming

- `feature/description` - New features
- `fix/description` - Bug fixes
- `docs/description` - Documentation changes
- `refactor/description` - Code refactoring
- `test/description` - Adding tests

### Commit Messages

Follow Conventional Commits:

```
feat: add new biometric verification method
fix: resolve signature rendering issue on mobile
docs: update API documentation
refactor: improve fraud detection algorithm
test: add unit tests for evidence service
```

### Development Process

1. Create a feature branch from `main`:
```bash
git checkout -b feature/my-feature main
```

2. Make your changes

3. Write or update tests

4. Run linting and tests:
```bash
npm run lint
npm test
```

5. Commit your changes:
```bash
git add .
git commit -m "feat: add my new feature"
```

6. Push to your fork:
```bash
git push origin feature/my-feature
```

7. Create a Pull Request

## Code Style

### TypeScript/JavaScript

- Use TypeScript for all new code
- Follow ESLint configuration
- Use async/await over callbacks
- Prefer const over let
- Use meaningful variable names
- Add types for function parameters and return values

### React

- Use functional components with hooks
- Keep components small and focused
- Use proper prop types
- Handle errors gracefully
- Optimize performance with memo/useMemo/useCallback

### Backend

- Follow RESTful API conventions
- Use proper HTTP status codes
- Validate all inputs
- Handle errors consistently
- Log appropriately

### CSS/Tailwind

- Use Tailwind utility classes
- Follow mobile-first approach
- Maintain consistent spacing
- Use semantic color names

## Testing

### Running Tests

```bash
# All tests
npm test

# Backend tests
cd backend && npm test

# Frontend tests
cd frontend && npm test

# With coverage
npm run test:coverage
```

### Writing Tests

- Write unit tests for services
- Write integration tests for API endpoints
- Write component tests for React components
- Aim for >80% code coverage
- Test edge cases and error scenarios

### Test Structure

```typescript
describe('ServiceName', () => {
  describe('methodName', () => {
    it('should do something when condition', async () => {
      // Arrange
      const input = {};

      // Act
      const result = await service.method(input);

      // Assert
      expect(result).toEqual(expected);
    });

    it('should throw error when invalid input', async () => {
      // Arrange
      const invalidInput = {};

      // Act & Assert
      await expect(service.method(invalidInput)).rejects.toThrow();
    });
  });
});
```

## Pull Request Process

### Before Submitting

- [ ] Code follows style guidelines
- [ ] Tests pass locally
- [ ] Linting passes
- [ ] Documentation updated (if needed)
- [ ] No console.log statements
- [ ] No hardcoded secrets
- [ ] Branch is up to date with main

### PR Description

Include:
- Summary of changes
- Related issue number
- Testing performed
- Screenshots (for UI changes)
- Breaking changes (if any)

### Review Process

1. PR will be reviewed by maintainers
2. Address feedback and make changes
3. Once approved, PR will be merged
4. Delete your feature branch after merge

### PR Template

```markdown
## Description
Brief description of changes

## Related Issue
Fixes #123

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing performed

## Checklist
- [ ] My code follows the style guidelines
- [ ] I have performed a self-review
- [ ] I have commented my code where necessary
- [ ] I have updated documentation accordingly
- [ ] My changes generate no new warnings
- [ ] I have added tests that prove my fix/feature works
- [ ] New and existing tests pass locally
```

## Issue Guidelines

### Bug Reports

Include:
- Steps to reproduce
- Expected behavior
- Actual behavior
- Environment (OS, browser, Node version)
- Screenshots (if applicable)

### Feature Requests

Include:
- Use case
- Proposed solution
- Alternatives considered
- Additional context

### Labels

- `bug` - Something isn't working
- `enhancement` - New feature or request
- `documentation` - Documentation improvements
- `good first issue` - Good for newcomers
- `help wanted` - Extra attention needed

## Security

### Reporting Vulnerabilities

**DO NOT** open a public issue for security vulnerabilities.

Instead, please email security@opensignature.dev with:
- Description of vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

You should receive a response within 48 hours.

### Security Guidelines

- Never commit secrets or API keys
- Use environment variables for configuration
- Validate and sanitize all inputs
- Follow OWASP guidelines
- Use parameterized queries
- Implement proper authentication/authorization

## Documentation

### Updating Documentation

- Update README.md for major changes
- Update API.md for API changes
- Update ARCHITECTURE.md for architectural changes
- Add inline comments for complex logic
- Update CHANGELOG.md

### Documentation Standards

- Use clear, concise language
- Include code examples
- Keep documentation up to date
- Fix typos and grammatical errors

## Community

### Getting Help

- Check existing documentation
- Search existing issues
- Ask in discussions
- Join our Discord (if available)

### Communication

- Be respectful and professional
- Stay on topic
- Help others when possible
- Share knowledge and experiences

## Recognition

Contributors will be recognized in:
- README.md contributors section
- Release notes
- Annual contributor appreciation

Thank you for contributing to OpenSignature!
