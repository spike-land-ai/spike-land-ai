# API Migration Guide Template

> Use this template when creating migration guides for API version changes.

---

## API Version Migration: v[OLD] → v[NEW]

**Migration Deadline**: [DATE]

**Overview**: [2-3 sentence summary of major changes]

### Quick Reference

| Feature           | v[OLD]             | v[NEW]             | Status     |
| ----------------- | ------------------ | ------------------ | ---------- |
| Image Enhancement | POST `/api/v1/...` | POST `/api/v2/...` | Breaking   |
| Album Management  | GET `/api/v1/...`  | GET `/api/v2/...`  | Breaking   |
| Token Management  | GET `/api/v1/...`  | GET `/api/v2/...`  | Compatible |

---

## Breaking Changes

### Change 1: [Endpoint Name]

**What Changed**: [Describe what changed]

**Why**: [Business reason for change]

**Impact**: [Which integrations are affected]

**Before (v[OLD])**:

```
[Old endpoint/format]
```

Example request:

```bash
curl -X [METHOD] https://spike.land/api/v[OLD]/...
```

Example response:

```json
{
  "old_format": "example"
}
```

**After (v[NEW])**:

```
[New endpoint/format]
```

Example request:

```bash
curl -X [METHOD] https://spike.land/api/v[NEW]/...
```

Example response:

```json
{
  "new_format": "example"
}
```

**Migration Steps**:

1. Update endpoint URL
2. [Specific code changes]
3. Test with test data
4. Deploy to staging
5. Verify functionality

**Code Example**:

```javascript
// Before (v[OLD])
async function oldCode() {
  const response = await fetch("/api/v[OLD]/endpoint", {
    method: "POST",
    body: JSON.stringify({
      old_field: "value",
    }),
  });
  return response.json();
}

// After (v[NEW])
async function newCode() {
  const response = await fetch("/api/v[NEW]/endpoint", {
    method: "POST",
    body: JSON.stringify({
      new_field: "value",
    }),
  });
  return response.json();
}
```

**Common Issues**:

| Issue          | Solution     |
| -------------- | ------------ |
| [Common error] | [How to fix] |
| [Common error] | [How to fix] |

---

### Change 2: [Next Feature]

[Repeat the same structure for each breaking change]

---

## Non-Breaking Changes (No Action Needed)

### New Feature: [Feature Name]

**Availability**: v[OLD]+ (optional) and v[NEW]+ (supported)

**Description**: [What's new]

**Example**:

```javascript
// Optional in v[OLD], fully supported in v[NEW]
await fetch("/api/v[NEW]/endpoint", {
  body: JSON.stringify({
    new_optional_field: "value",
  }),
});
```

---

## Migration Checklist

Use this checklist to track your migration progress:

### Discovery Phase

- [ ] Read entire migration guide
- [ ] Identify all affected endpoints in your code
- [ ] List all third-party libraries that use this API
- [ ] Check if you have automated tests covering API usage

### Testing Phase

- [ ] Set up development environment with v[NEW]
- [ ] Update code to use v[NEW] endpoints
- [ ] Run unit tests against v[NEW]
- [ ] Test in staging environment
- [ ] Verify error handling for edge cases
- [ ] Load test against v[NEW] to ensure performance

### Deployment Phase

- [ ] Create feature branch: `git checkout -b api/v[NEW]-migration`
- [ ] Commit changes with message: `chore: migrate API from v[OLD] to v[NEW]`
- [ ] Deploy to staging first
- [ ] Monitor staging environment for 24 hours
- [ ] Deploy to production
- [ ] Monitor production logs for errors
- [ ] Update monitoring/alerts to v[NEW] endpoints

### Verification Phase

- [ ] Verify all API calls successful (check logs)
- [ ] Monitor error rates (should be 0)
- [ ] Check response times (should be similar or better)
- [ ] Confirm no 404 errors (v[OLD] endpoints removed)
- [ ] Test critical user flows end-to-end

### Cleanup Phase

- [ ] Remove any conditional v[OLD]/v[NEW] logic
- [ ] Delete v[OLD] API client code
- [ ] Update documentation links to v[NEW]
- [ ] Celebrate migration complete!

---

## Rollback Plan

If you encounter critical issues during migration:

### Immediate Actions

1. Revert to v[OLD] endpoints
2. Redeploy previous version of code
3. Verify API calls working with v[OLD]

### Rollback Procedure

```bash
# Option 1: Git rollback
git revert <migration-commit-hash>
git push origin main

# Option 2: Update code to use v[OLD] endpoints
# Edit all files using /api/v[NEW]/ and change to /api/v[OLD]/
grep -r "api/v[NEW]" src/ | cut -d: -f1 | sort -u | xargs -I {} vim {}
```

### When to Contact Support

Contact zoltan.erdos@spike.land if:

- Rollback doesn't resolve issues
- Specific endpoints behave incorrectly
- Performance degradation after migration
- Other integrations affected

---

## Common Issues & Solutions

### Issue: 404 Not Found on v[NEW] Endpoint

**Cause**: Endpoint URL slightly different or endpoint not available yet

**Solution**:

1. Check API_REFERENCE.md for correct endpoint URL
2. Verify you're using correct HTTP method (GET/POST/PATCH)
3. Contact support if endpoint documented but not available

### Issue: 400 Bad Request on v[NEW] Endpoint

**Cause**: Request format changed or required fields missing

**Solution**:

1. Compare request structure between v[OLD] and v[NEW]
2. Check response for detailed error message
3. Verify all required fields included
4. See "Change X" section above for specific field mappings

### Issue: Performance Slower After Migration

**Cause**: Network routing or new API implementation differences

**Solution**:

1. Verify same/similar response times in staging
2. Check if additional fields in response causing slowness
3. Monitor network latency vs. API processing time
4. Contact support if consistently slower than v[OLD]

### Issue: Different Error Codes in v[NEW]

**Cause**: Error handling improved in v[NEW]

**Solution**:

1. Review error handling section for v[NEW]
2. Update error handling code to expect new codes
3. Maintain backward compatibility with graceful handling
4. See API_REFERENCE.md#error-handling for full list

---

## Support & Questions

### Resources

- **API Reference**: docs/architecture/API_REFERENCE.md
- **Versioning Strategy**: docs/API_VERSIONING.md
- **Error Handling**: docs/architecture/API_REFERENCE.md#error-handling
- **Code Examples**: docs/examples/

### Getting Help

1. **Self-Service**
   - Search GitHub Issues: https://github.com/spike-land-ai/spike.land/issues
   - Check Discussions: https://github.com/spike-land-ai/spike.land/discussions

2. **Community Support**
   - GitHub Discussions: Ask questions and share solutions
   - Stack Overflow: Tag with `spike-land` and `api`

3. **Official Support**
   - Email: zoltan.erdos@spike.land
   - Response time: 24 hours (business days)
   - Include: API calls, error messages, and steps to reproduce

---

## Migration Timeline

```
Week 1: Read guide, test against v[NEW]
Week 2: Deploy to staging, monitor
Week 3: Deploy to production
Week 4: Verify and cleanup
```

**Total estimated time**: 2-4 weeks depending on integration complexity

---

## Feedback

Help us improve this migration guide!

- Report issues: https://github.com/spike-land-ai/spike.land/issues
- Suggest improvements: zoltan.erdos@spike.land
- Share your experience: GitHub Discussions

---

## Document Info

**Created**: [DATE] **Last Updated**: [DATE] **Status**: [DRAFT/PUBLISHED]
