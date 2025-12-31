# [*] README Template Guide

This template is based on the structure we use for comprehensive, user-friendly documentation that works for both technical and non-technical audiences.

## [>] Template Philosophy

### ASCII Art Instead of Emojis - CRITICAL

**NEVER use actual emojis or emoticons in documentation.** Emojis display inconsistently across:
- Different operating systems (Windows, macOS, Linux)
- Different browsers (Chrome, Firefox, Safari, Edge)
- Different terminals and text editors
- Different font configurations

**Always use ASCII art symbols instead:**
- `[*]` - Important sections, highlights, stars
- `[>]` - Action-oriented sections, quick starts, arrows
- `[~]` - Examples, tips, waves
- `[=]` - Reference sections, equals
- `[+]` - Positive items, checkmarks, additions
- `[-]` - Negative items, removals, warnings
- `[!]` - Warnings, important notes, alerts
- `[#]` - Numbered items, hashes
- `[@]` - Mentions, references
- `[|]` - Separators, dividers

**Examples:**
- Instead of: `## 🎯 Section` → Use: `## [>] Section`
- Instead of: `✅ Done` → Use: `[+] Done`
- Instead of: `❌ Error` → Use: `[-] Error`
- Instead of: `🚀 Quick Start` → Use: `[>] Quick Start`

### Progressive Disclosure
The template follows a **progressive disclosure** pattern:
1. **Start simple**: High-level concepts anyone can understand
2. **Build complexity**: Gradually introduce technical details
3. **Deep dive**: Full technical reference at the end

### Tone Guidelines
- **Light-hearted but professional**: Use ASCII art for visual elements, friendly language, but stay professional
- **Accessible**: Explain technical terms when first introduced
- **Practical**: Focus on real-world use cases and examples
- **Comprehensive**: Cover all features, edge cases, and business rules
- **Cross-platform compatible**: Use ASCII art instead of emojis (emojis display differently across OS/browsers)

## [=] Template Structure

### 1. Header & Tagline
- Catchy tagline that explains the value proposition
- Simple analogy or explanation

### 2. What's This All About?
- Plain language explanation
- No technical jargon
- Focus on benefits

### 3. Why Should You Care?
- Split into "Non-Technical" and "Developers" sections
- Highlight different benefits for each audience

### 4. What Makes This Special?
- 3-5 key differentiators
- Use ASCII art symbols for visual appeal (e.g., [*], [>], [~], [=])
- Keep descriptions brief and punchy

### 5. Quick Start
- Simplest possible example
- Should work copy-paste
- Show immediate value

### 6. Features Overview
- Categorize features logically
- Include use cases for each
- Highlight benefits with numbers when possible

### 7. How It Works
- Start with high-level process
- Then get technical
- Use diagrams/ASCII art for complex concepts

### 8. API Reference
- Complete function signatures
- Parameter descriptions
- Return type explanations
- Code examples for each

### 9. Architecture Deep Dive
- Visual representations
- Key points highlighted
- Version information

### 10. Security Best Practices
- Do's and Don'ts format
- Explain why each matters

### 11. Type Definitions
- Complete TypeScript interfaces
- Field-by-field descriptions

### 12. Real-World Examples
- 3-4 practical examples
- Different complexity levels
- Show common patterns

### 13. Testing
- What's tested
- How to run tests
- Test results summary

### 14. Migration Guide
- Before/after comparisons
- Compatibility notes
- Upgrade paths

### 15. Troubleshooting
- Common errors
- Causes and fixes

### 16. Performance Characteristics
- Benchmarks or ranges
- Efficiency comparisons
- Memory considerations

### 17. Use Case Recommendations
- When to use each approach
- Decision matrix format

### 18. Future Enhancements
- Roadmap items
- Planned improvements

## [~] Writing Tips

### For Non-Technical Sections
- Use analogies (like the lockbox example)
- Avoid jargon
- Focus on "what" and "why", not "how"
- Use simple language

### For Technical Sections
- Be precise and complete
- Include code examples
- Explain edge cases
- Document all parameters

### General
- **NEVER use actual emojis/emoticons** - they display inconsistently across operating systems and browsers
- **Use ASCII art instead** - examples: [*], [>], [~], [=], [|], [@], [#], [+], [-]
- Keep paragraphs short
- Use lists for scannability
- Include visual elements (diagrams, ASCII art boxes, symbols)
- Add examples everywhere
- Test all code examples

## [*] Formatting Guidelines

### Headers
- Use descriptive headers with ASCII symbols (e.g., [*], [>], [~], [=])
- **NEVER use actual emojis** - use ASCII alternatives for cross-platform compatibility
- Keep hierarchy clear (H1 [EMOJI] H2 [EMOJI] H3)
- Examples:
  - `## [*] Section Name` (for important sections)
  - `## [>] Quick Start` (for action-oriented sections)
  - `## [~] Examples` (for example sections)
  - `## [=] API Reference` (for reference sections)

### Code Blocks
- Always include language tags
- Show complete, working examples
- Include comments explaining what's happening
- Show expected results

### Lists
- Use ASCII symbols for positive items: `[+]`, `[*]`, `[OK]`, or `[X]` (checkmark alternative)
- Use ASCII symbols for negative items: `[-]`, `[!]`, `[X]`, or `[NO]`
- Use bullets for neutral items: `-`, `*`, or `•`
- **NEVER use emoji checkmarks ([OK]) or X marks ([ERROR])** - they display inconsistently
- Keep items parallel in structure
- Examples:
  - `[+] Feature works correctly`
  - `[-] Feature has limitations`
  - `[*] Important note`

### Emphasis
- **Bold** for important terms
- `Code` for technical terms
- *Italic* for emphasis (use sparingly)

## [*] Checklist

Before finalizing your README:

- [ ] Starts with simple, non-technical explanation
- [ ] Progressively gets more technical
- [ ] All features documented
- [ ] All business rules explained
- [ ] All API functions have examples
- [ ] Type definitions complete
- [ ] Security best practices included
- [ ] Troubleshooting section populated
- [ ] Code examples tested and working
- [ ] Tone is light-hearted but professional
- [ ] No jargon without explanation
- [ ] Visual elements (diagrams, ASCII art) for complex concepts
- [ ] **NO emojis used** - only ASCII art symbols for cross-platform compatibility
- [ ] Migration guide if applicable
- [ ] Performance characteristics documented
- [ ] Use case recommendations clear

## [>] Quick Start

1. Copy `README_TEMPLATE.md`
2. Replace all `[Placeholders]` with your actual content
3. Remove sections that don't apply
4. Add sections specific to your project
5. Test all code examples
6. Review for tone and clarity
7. Get feedback from both technical and non-technical readers

Happy documenting! [*] [>]

