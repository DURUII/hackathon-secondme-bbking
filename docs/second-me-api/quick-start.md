# SecondMe API Quick Start

---
title: SecondMe API Quick Start
description: This guide will help you integrate with the SecondMe API in 5 minutes
---

Welcome to SecondMe API! This guide will help you integrate with the API in 5 minutes.

## API Overview

SecondMe API provides SecondMe digital avatar capabilities, enabling your application to:

- Access user-authorized personal information
- Access user's soft memories (personal knowledge base)
- Have streaming conversations as the user's AI avatar

**Base URL**: `https://app.mindos.com/gate/lab`

## Authentication Methods

SecondMe API supports two authentication methods:

| Method | Use Case | Features |
|--------|----------|----------|
| **API Key** | Server-side calls, backend services | Long-lived, no user interaction required |
| **OAuth2** | Third-party app integration | Requires user authorization, standard authorization code flow |

### Quick Start: Using API Key

1. **Get an API Key**

   Log in to [MindVerse Developer Console](https://app.mindos.com) to create an API Key with required permissions.

2. **Make an API Request**

   Add Authorization header to your request:

   ```bash
   curl -X GET "https://app.mindos.com/gate/lab/api/secondme/user/info" \
     -H "Authorization: Bearer lba_ak_your_api_key_here"
   ```

3. **Handle the Response**

   ```json
   {
     "code": 0,
     "message": "success",
     "data": {
       "name": "Username",
       "bio": "Personal bio",
       "avatar": "https://..."
     }
   }
   ```

## Your First API Call

### Get User Info

```bash
curl -X GET "https://app.mindos.com/gate/lab/api/secondme/user/info" \
  -H "Authorization: Bearer lba_ak_your_api_key_here"
```

### Streaming Chat

```bash
curl -X POST "https://app.mindos.com/gate/lab/api/secondme/chat/stream" \
  -H "Authorization: Bearer lba_ak_your_api_key_here" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Hello, introduce yourself"
  }'
```

Response is a Server-Sent Events stream:

```
event: session
data: {"sessionId": "labs_sess_xxx"}

data: {"choices": [{"delta": {"content": "Hello"}}]}
data: {"choices": [{"delta": {"content": ", I am..."}}]}
data: [DONE]
```

## Permissions (Scopes)

Both API Key and OAuth2 require specifying permission scopes:

| Scope | Description |
|-------|-------------|
| `user.info` | Access user's basic info (name, email, avatar, etc.) |
| `user.info.shades` | Access user's interest tags |
| `user.info.softmemory` | Access user's soft memories |
| `note.add` | Add notes and memories |
| `chat` | Access chat functionality |
| `voice` | Access voice functionality |

## Next Steps

- [Authentication Overview](/en/docs/authentication) - Learn about different authentication methods
- [API Key Guide](/en/docs/authentication/api-key) - Deep dive into API Key usage
- [OAuth2 Guide](/en/docs/authentication/oauth2) - Learn OAuth2 authorization flow
- [SecondMe API](/en/docs/api-reference/secondme) - View complete API reference
- [Error Codes](/en/docs/errors) - Understand error handling
