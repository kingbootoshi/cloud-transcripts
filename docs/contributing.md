# Contributing Guidelines

Thank you for your interest in contributing to Cloud Transcripts! This document provides guidelines and instructions for contributing to the project.

## Code of Conduct

By participating in this project, you agree to abide by our Code of Conduct:

- Be respectful and inclusive
- Welcome newcomers and help them get started
- Focus on constructive criticism
- Respect differing viewpoints and experiences

## Getting Started

### Prerequisites

Before contributing, ensure you have:

- Node.js 18+ and npm
- Python 3.11+
- Git
- A GitHub account
- Familiarity with TypeScript and React

### Setting Up Your Development Environment

1. **Fork the repository**
   ```bash
   # Click "Fork" on GitHub, then clone your fork
   git clone https://github.com/YOUR_USERNAME/cloud-transcripts.git
   cd cloud-transcripts
   ```

2. **Add upstream remote**
   ```bash
   git remote add upstream https://github.com/ORIGINAL_OWNER/cloud-transcripts.git
   ```

3. **Install dependencies**
   ```bash
   npm install
   ```

4. **Set up environment**
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your development credentials
   ```

5. **Run tests**
   ```bash
   npm test
   ```

## Development Workflow

### 1. Create a Feature Branch

```bash
# Update your fork
git checkout main
git pull upstream main

# Create a new branch
git checkout -b feature/your-feature-name
```

Branch naming conventions:
- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation changes
- `refactor/` - Code refactoring
- `test/` - Test additions/changes
- `chore/` - Maintenance tasks

### 2. Make Your Changes

Follow these coding standards:

#### TypeScript/JavaScript
```typescript
// ✅ Good: Clear, documented function
/**
 * Creates a presigned URL for S3 upload
 * @param userId - User ID for folder organization
 * @param filename - Original filename
 * @returns Presigned URL and file key
 */
export async function createPresignedUploadUrl(
  userId: string | null,
  filename: string
): Promise<PresignedUploadResponse> {
  // Implementation
}

// ❌ Bad: No types, no docs
export async function createUrl(user, file) {
  // Implementation
}
```

#### React Components
```typescript
// ✅ Good: Typed, documented component
interface FileUploadProps {
  onUploadComplete: (fileKey: string, mediaType: MediaType) => void
  maxSize?: number
}

/**
 * File upload component with drag-and-drop support
 */
export function FileUpload({ 
  onUploadComplete,
  maxSize = MAX_FILE_SIZE 
}: FileUploadProps) {
  // Component implementation
}
```

#### Python
```python
# ✅ Good: Type hints, docstrings
def extract_audio(video_path: Path, wav_path: Path) -> None:
    """
    Extract mono 16kHz audio from video file.
    
    Args:
        video_path: Path to input video file
        wav_path: Path for output WAV file
        
    Raises:
        ValueError: If video has no audio stream
    """
    # Implementation
```

### 3. Write Tests

All new features should include tests:

#### Unit Tests (TypeScript)
```typescript
// __tests__/utils.test.ts
import { formatBytes } from '@/lib/utils'

describe('formatBytes', () => {
  it('formats bytes correctly', () => {
    expect(formatBytes(0)).toBe('0 Bytes')
    expect(formatBytes(1024)).toBe('1 KB')
    expect(formatBytes(1048576)).toBe('1 MB')
  })
})
```

#### Integration Tests
```typescript
// __tests__/api/upload.test.ts
import { createMocks } from 'node-mocks-http'
import handler from '@/pages/api/upload'

describe('/api/upload', () => {
  it('creates presigned URL', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      body: {
        filename: 'test.mp4',
        contentType: 'video/mp4',
        contentLength: 1024
      }
    })

    await handler(req, res)
    
    expect(res._getStatusCode()).toBe(200)
    expect(JSON.parse(res._getData())).toHaveProperty('uploadUrl')
  })
})
```

### 4. Update Documentation

- Update README.md if adding new features
- Add JSDoc comments to new functions
- Update API documentation for new endpoints
- Include examples in documentation

### 5. Commit Your Changes

Follow conventional commit format:

```bash
# Format: <type>(<scope>): <subject>

# Examples:
git commit -m "feat(upload): add progress indicator"
git commit -m "fix(worker): handle missing audio streams"
git commit -m "docs(api): update endpoint documentation"
git commit -m "test(transcript): add unit tests for parser"
git commit -m "refactor(db): optimize query performance"
```

Commit types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding/updating tests
- `chore`: Maintenance tasks

### 6. Push and Create Pull Request

```bash
# Push your branch
git push origin feature/your-feature-name
```

Then create a Pull Request on GitHub with:
- Clear title describing the change
- Description of what changed and why
- Reference to any related issues
- Screenshots for UI changes
- Test results

## Pull Request Guidelines

### PR Checklist

Before submitting a PR, ensure:

- [ ] Code follows project style guidelines
- [ ] All tests pass (`npm test`)
- [ ] Linting passes (`npm run lint`)
- [ ] TypeScript compiles without errors (`npm run typecheck`)
- [ ] Documentation is updated
- [ ] Commit messages follow conventions
- [ ] PR description is complete

### PR Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing completed

## Screenshots (if applicable)
Add screenshots for UI changes

## Related Issues
Fixes #123
```

## Code Style Guidelines

### General Principles

1. **Clarity over cleverness**: Write readable code
2. **DRY (Don't Repeat Yourself)**: Extract common functionality
3. **SOLID principles**: Follow OOP best practices
4. **Functional when possible**: Prefer pure functions
5. **Error handling**: Always handle errors appropriately

### TypeScript/JavaScript

- Use TypeScript for all new code
- Prefer `const` over `let`
- Use async/await over promises
- Destructure when appropriate
- Use optional chaining (`?.`)

### React

- Use functional components with hooks
- Keep components small and focused
- Extract custom hooks for reusable logic
- Use proper TypeScript types for props
- Memoize expensive computations

### Python

- Follow PEP 8
- Use type hints
- Write docstrings for all functions
- Use f-strings for formatting
- Handle exceptions explicitly

### CSS/Styling

- Use Tailwind utility classes
- Extract repeated styles to components
- Follow mobile-first approach
- Ensure accessibility (ARIA labels, etc.)

## Project Structure

```
cloud-transcripts/
├── apps/
│   ├── web/              # Next.js frontend
│   │   ├── src/
│   │   │   ├── app/      # App router pages
│   │   │   ├── components/
│   │   │   ├── lib/      # Utilities
│   │   │   └── server/   # API routes
│   │   └── __tests__/    # Tests
│   └── worker/           # Modal Python worker
├── packages/
│   ├── db/               # Database types/schemas
│   └── shared/           # Shared utilities
├── infra/                # Infrastructure configs
└── docs/                 # Documentation
```

## Testing Guidelines

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run specific test file
npm test -- upload.test.ts

# Run with coverage
npm test -- --coverage
```

### Test Structure

- Unit tests next to source files
- Integration tests in `__tests__` directory
- E2E tests in `cypress/` or `playwright/`
- Mock external dependencies

### What to Test

1. **Business Logic**: Core functionality
2. **Edge Cases**: Error conditions, boundaries
3. **User Interactions**: UI components
4. **API Endpoints**: Request/response handling
5. **Data Transformations**: Parsers, formatters

## Debugging Tips

### Frontend Debugging

1. **Browser DevTools**: Use React DevTools
2. **Console Logging**: Use structured logging
3. **Network Tab**: Monitor API calls
4. **Source Maps**: Enable for production debugging

### Backend Debugging

1. **Winston Logs**: Check structured logs
2. **Modal Logs**: Use `modal logs` command
3. **Supabase Logs**: Check query logs
4. **Local Testing**: Use debugger in VS Code

### Common Issues

1. **CORS Errors**: Check S3 bucket configuration
2. **Auth Issues**: Verify Supabase keys
3. **Upload Failures**: Check file size limits
4. **Worker Timeouts**: Monitor processing time

## Release Process

### Version Numbering

We follow Semantic Versioning (MAJOR.MINOR.PATCH):

- MAJOR: Breaking changes
- MINOR: New features (backward compatible)
- PATCH: Bug fixes

### Release Steps

1. Update version in package.json
2. Update CHANGELOG.md
3. Create release branch
4. Run full test suite
5. Create GitHub release
6. Deploy to production

## Getting Help

### Resources

- [Project Documentation](../README.md)
- [API Documentation](./api.md)
- [Architecture Overview](./architecture.md)
- [Discord/Slack Community](#)

### Asking Questions

When asking for help:

1. Search existing issues first
2. Provide context and error messages
3. Include minimal reproduction steps
4. Mention your environment details

### Office Hours

We hold weekly office hours for contributors:
- Day: Thursdays
- Time: 3 PM UTC
- Location: Discord/Google Meet

## Recognition

We value all contributions! Contributors are:

- Listed in CONTRIBUTORS.md
- Mentioned in release notes
- Given credit in pull requests
- Invited to contributor meetings

## License

By contributing, you agree that your contributions will be licensed under the project's MIT License.

---

Thank you for contributing to Cloud Transcripts! Your efforts help make transcription accessible to everyone. 🎉 