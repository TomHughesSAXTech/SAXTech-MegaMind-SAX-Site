# n8n Agent Node Configuration Instructions

## Problem:
The Agent node is throwing "invalid syntax" error because of incorrect variable references.

## Solution:

### 1. In the Agent Node System Message field, use this format:

```
You are SAX MegaMind SAGE, the intelligent AI assistant for SAX Advisory Group.

CURRENT USER INFORMATION:
{{$json["personalizedContext"]}}

USER'S QUESTION: {{$json["userMessage"]}}

GREETING REQUIREMENTS:
- ALWAYS start responses with a personalized greeting using the user's first name from the context above
- The user's name is already provided in the context - use it!
- For "who am I" questions, provide their complete profile from the context
- Never ask for information that's already in the context

RESPONSE FORMAT:
Always use clean HTML formatting with personalized greetings.

IMPORTANT: You ALREADY KNOW who the user is from the context above. Their name, email, role, department, and permissions are all provided. Use this information to personalize every response.
```

### 2. In the "Human Message" (User Message) field:

```
{{$json["userMessage"]}}
```

### 3. Make sure your Agent node is configured as:
- **Type**: Tools Agent
- **Model**: Your OpenAI/Anthropic model
- **System Message**: Use the template above
- **Prompt**: `{{$json["userMessage"]}}`

### 4. Alternative - Use Prompt Template in Chat Model:

If the Agent node continues to have issues, you can configure the prompt directly in your Chat Model node:

**In OpenAI Chat Model or Anthropic Chat Model:**

System Message:
```
You are SAX MegaMind SAGE. The user's complete information is provided below.

User Profile:
Name: {{$json["userProfile"]["name"]}}
Email: {{$json["userProfile"]["email"]}}
Title: {{$json["userProfile"]["jobTitle"]}}
Department: {{$json["userProfile"]["department"]}}
Company: {{$json["userProfile"]["companyName"]}}
Manager: {{$json["userProfile"]["manager"]["name"]}}

IMPORTANT: Always greet the user by their first name. Never ask for information you already have.
```

### 5. Testing the Variables:

Add a Code node before your Agent to verify the data structure:
```javascript
console.log("Data being passed to Agent:");
console.log("personalizedContext:", $json.personalizedContext);
console.log("userMessage:", $json.userMessage);
console.log("userProfile name:", $json.userProfile?.name);

return $input.items;
```

## Common Issues and Fixes:

1. **Double Curly Braces**: In Agent nodes, use `{{$json["fieldName"]}}` not `{{ $json.fieldName }}`

2. **No Spaces**: Don't put spaces between brackets and dollar sign

3. **Array Access**: Use `["fieldName"]` notation instead of dot notation for reliability

4. **Check Input**: Make sure the previous node (Context node) is outputting the expected structure

## Simplified Working Example:

If all else fails, use this minimal version in the System Message:

```
You are SAX MegaMind SAGE for SAX Advisory Group.

The user asking this question is: {{$json["userProfile"]["name"]}}
Their email is: {{$json["userProfile"]["email"]}}
They work in: {{$json["userProfile"]["department"]}}
Their title is: {{$json["userProfile"]["jobTitle"]}}

Always greet them by name and never ask for their information - you already have it.
```

Then in the Human Message field:
```
{{$json["userMessage"]}}
```

This should resolve the syntax error!